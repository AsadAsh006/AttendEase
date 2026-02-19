import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import offlineService, { CachedData, SyncOperation } from '../services/OfflineService'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { useDispatch } from 'react-redux'
import { setSubjects } from '../redux/subjectsSlice'
import { setStudents } from '../redux/studentsSlice'
import { setAttendanceRecords } from '../redux/attendanceSlice'

interface OfflineContextType {
  isOnline: boolean
  isSyncing: boolean
  pendingOperations: number
  lastSyncTime: Date | null
  cachedData: CachedData | null
  syncNow: () => Promise<void>
  fetchAndCacheData: () => Promise<void>
  queueOperation: (operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>) => void
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined)

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile, handleAuthError } = useAuth()
  const dispatch = useDispatch()
  const [isOnline, setIsOnline] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingOperations, setPendingOperations] = useState(0)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [cachedData, setCachedData] = useState<CachedData | null>(null)

  // Initialize
  useEffect(() => {
    const init = async () => {
      const online = await offlineService.checkNetwork()
      setIsOnline(online)
      setPendingOperations(offlineService.getPendingCount())
      
      const lastSync = offlineService.getLastSyncTime()
      if (lastSync > 0) {
        setLastSyncTime(new Date(lastSync))
      }

      // Load cached data
      const cached = offlineService.getCachedData()
      setCachedData(cached)

      // Load cached data into Redux
      if (cached.subjects.length > 0) {
        dispatch(setSubjects(cached.subjects))
      }
      if (cached.students.length > 0) {
        dispatch(setStudents(cached.students))
      }
      if (cached.attendance.length > 0) {
        dispatch(setAttendanceRecords(cached.attendance))
      }
    }

    init()

    // Listen for network changes
    const unsubscribe = offlineService.addNetworkListener((online) => {
      setIsOnline(online)
      if (online) {
        setPendingOperations(offlineService.getPendingCount())
      }
    })

    return () => unsubscribe()
  }, [dispatch])

  // Sync when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isOnline && userProfile) {
        syncNow()
        fetchAndCacheData()
      }
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange)
    return () => subscription.remove()
  }, [isOnline, userProfile])

  // Fetch data from server and cache it
  const fetchAndCacheData = useCallback(async () => {
    if (!userProfile) return
    
    // If offline, load from cache
    if (!isOnline) {
      const cached = offlineService.getCachedData()
      if (cached.subjects.length > 0 || cached.students.length > 0 || cached.attendance.length > 0) {
        dispatch(setSubjects(cached.subjects))
        dispatch(setStudents(cached.students))
        dispatch(setAttendanceRecords(cached.attendance))
        setCachedData(cached)
      }
      return
    }

    try {
      const classId = userProfile.class_id || userProfile.admin_class_id

      if (!classId) return

      // Fetch subjects
      const { data: subjects, error: subjectsError } = await supabase
        .from('subjects')
        .select('*')
        .eq('class_id', classId)
        .order('created_at', { ascending: false })

      if (subjectsError) {
        handleAuthError(subjectsError)
        return
      }

      // Fetch students from 'students' table (not profiles)
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classId)
        .order('name', { ascending: true })

      if (studentsError) {
        handleAuthError(studentsError)
        return
      }

      // Fetch student_subjects enrollments
      let studentSubjects: any[] = []
      if (students && students.length > 0) {
        const studentIds = students.map((s: any) => s.id)
        const { data: enrollments, error: enrollmentError } = await supabase
          .from('student_subjects')
          .select('*')
          .in('student_id', studentIds)

        if (!enrollmentError) {
          studentSubjects = enrollments || []
        }
      }

      // Fetch lectures with attendance data
      const { data: lecturesData, error: lecturesError } = await supabase
        .from('lectures')
        .select(`
          id,
          subject_id,
          date,
          title,
          attendance (student_id, status)
        `)
        .in('subject_id', subjects?.map((s: any) => s.id) || [])
        .order('date', { ascending: false })

      let attendance: any[] = []
      if (!lecturesError && lecturesData) {
        // Transform lectures to attendance records format
        attendance = lecturesData.map((lecture: any) => {
          const attendanceMap: Record<string, boolean> = {}
          ;(lecture.attendance || []).forEach((a: any) => {
            attendanceMap[a.student_id] = a.status === 'present'
          })
          return {
            id: lecture.id,
            subject_id: lecture.subject_id,
            subjectId: lecture.subject_id,
            date: lecture.date,
            dateKey: lecture.date,
            attendance: attendanceMap,
          }
        })
      }

      // Cache the data
      const dataToCache = {
        subjects: subjects || [],
        students: students || [],
        studentSubjects: studentSubjects,
        attendance: attendance,
      }

      offlineService.cacheData(dataToCache)
      setCachedData({
        ...dataToCache,
        lastUpdated: Date.now(),
      })

      // Update Redux
      dispatch(setSubjects(subjects || []))
      dispatch(setStudents(students || []))
      dispatch(setAttendanceRecords(attendance))

      console.log('Data fetched and cached successfully')
    } catch (error) {
      console.error('Error fetching data:', error)
      handleAuthError(error)
    }
  }, [userProfile, isOnline, dispatch, handleAuthError])

  // Sync pending operations
  const syncNow = useCallback(async () => {
    if (!isOnline || isSyncing) return

    setIsSyncing(true)
    try {
      const result = await offlineService.syncPendingOperations()
      setPendingOperations(offlineService.getPendingCount())
      
      if (result.success) {
        setLastSyncTime(new Date())
      }
    } catch (error) {
      console.error('Sync error:', error)
    } finally {
      setIsSyncing(false)
    }
  }, [isOnline, isSyncing])

  // Queue an operation
  const queueOperation = useCallback((operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>) => {
    offlineService.queueOperation(operation)
    setPendingOperations(offlineService.getPendingCount())
  }, [])

  // Fetch data when user logs in
  useEffect(() => {
    if (userProfile && isOnline) {
      fetchAndCacheData()
    }
  }, [userProfile?.id])

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingOperations,
        lastSyncTime,
        cachedData,
        syncNow,
        fetchAndCacheData,
        queueOperation,
      }}
    >
      {children}
    </OfflineContext.Provider>
  )
}

export const useOffline = () => {
  const context = useContext(OfflineContext)
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider')
  }
  return context
}
