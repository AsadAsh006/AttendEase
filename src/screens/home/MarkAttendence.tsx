import { Image, StyleSheet, Text, TouchableOpacity, View, FlatList, Share, Alert, ActivityIndicator } from 'react-native'
import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { moderateScale } from 'react-native-size-matters'
import Icon from 'react-native-vector-icons/Ionicons'
import images from '../../assets/images'
import Dropdown from '../../components/Dropdown'
import DatePicker from '../../components/datePicker'
import { lightTheme as theme } from '../../theme/colors'
import StudentItem from '../../components/studentItem'
import RNPrint from 'react-native-print'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute, useNavigation } from '@react-navigation/native'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationContext'
import { useOffline } from '../../contexts/OfflineContext'
import { MMKV } from 'react-native-mmkv'
import { useDispatch, useSelector } from 'react-redux'
import { setRecord } from '../../redux/attendanceSlice'
import offlineService from '../../services/OfflineService'

const storage = new MMKV()
const OFFLINE_ATTENDANCE_KEY = 'AttendEase.offlineAttendance'

type Subject = {
  id: string
  name: string
  code?: string
}

type Student = {
  id: string
  name: string
  roll_number: string
  email?: string
  user_id?: string
}

type OfflineAttendance = {
  id: string
  subjectId: string
  subjectName: string
  date: string
  dateKey?: string
  attendance: Record<string, boolean>
  students: Student[]
  createdAt: number
  createdBy: string
  existingLectureId?: string
  timestamp?: number
}

const MarkAttendence = () => {
  const route = useRoute<any>()
  const navigation = useNavigation<any>()
  const dispatch = useDispatch()
  const { user, userProfile, handleAuthError } = useAuth()
  const { sendNotification } = useNotifications()
  const { isOnline, queueOperation, pendingOperations } = useOffline()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [enrolledStudentIds, setEnrolledStudentIds] = useState<string[]>([])
  const [selectedSubject, setSelectedSubject] = useState<string | null>(route.params?.subjectId ?? null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [attendance, setAttendance] = useState<Record<string, boolean>>({})
  const [bulkAction, setBulkAction] = useState<'present' | 'absent' | null>(null)
  const [existingLectureId, setExistingLectureId] = useState<string | null>(null)
  const [offlineAttendanceCount, setOfflineAttendanceCount] = useState(0)
  const [markedDates, setMarkedDates] = useState<string[]>([])

  // Filter students based on enrollment
  const students = useMemo(() => {
    if (!selectedSubject || selectedSubject === 'all') {
      return allStudents
    }
    return allStudents.filter(s => enrolledStudentIds.includes(s.id))
  }, [allStudents, enrolledStudentIds, selectedSubject])

  // Load offline attendance count
  useEffect(() => {
    const saved = storage.getString(OFFLINE_ATTENDANCE_KEY)
    if (saved) {
      const offlineRecords: OfflineAttendance[] = JSON.parse(saved)
      setOfflineAttendanceCount(offlineRecords.length)
    }
  }, [])

  // Load cached data when offline
  const loadCachedData = useCallback(() => {
    const cached = offlineService.getCachedData()
    if (cached.subjects.length > 0) {
      setSubjects(cached.subjects.map((s: any) => ({ id: s.id, name: s.name, code: s.code })))
    }
    if (cached.students.length > 0) {
      setAllStudents(cached.students)
    }
    if (cached.studentSubjects && selectedSubject && selectedSubject !== 'all') {
      const enrolledIds = cached.studentSubjects
        .filter((ss: any) => ss.subject_id === selectedSubject)
        .map((ss: any) => ss.student_id)
      setEnrolledStudentIds(enrolledIds)
    }
  }, [selectedSubject])

  // Fetch subjects for the class
  const fetchSubjects = useCallback(async () => {
    if (!userProfile?.class_id) return

    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, name, code')
        .eq('class_id', userProfile.class_id)
        .order('name')

      if (error) {
        handleAuthError(error)
        throw error
      }
      setSubjects(data || [])
    } catch (error) {
      console.error('Error fetching subjects:', error)
    }
  }, [userProfile?.class_id])

  // Fetch students for the class
  const fetchStudents = useCallback(async () => {
    if (!userProfile?.class_id) return

    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, name, roll_number, email, user_id')
        .eq('class_id', userProfile.class_id)
        .order('roll_number')

      if (error) {
        handleAuthError(error)
        throw error
      }
      setAllStudents(data || [])
    } catch (error) {
      console.error('Error fetching students:', error)
    }
  }, [userProfile?.class_id])

  // Fetch enrolled students for selected subject
  const fetchEnrolledStudents = useCallback(async () => {
    if (!selectedSubject || selectedSubject === 'all') {
      setEnrolledStudentIds([])
      return
    }

    // If offline, load from cache
    if (!isOnline) {
      const cached = offlineService.getCachedData()
      if (cached.studentSubjects) {
        const enrolledIds = cached.studentSubjects
          .filter((ss: any) => ss.subject_id === selectedSubject)
          .map((ss: any) => ss.student_id)
        setEnrolledStudentIds(enrolledIds)
      }
      return
    }

    try {
      const { data, error } = await supabase
        .from('student_subjects')
        .select('student_id')
        .eq('subject_id', selectedSubject)

      if (error) {
        handleAuthError(error)
        throw error
      }
      setEnrolledStudentIds((data || []).map(d => d.student_id))
    } catch (error) {
      console.error('Error fetching enrolled students:', error)
    }
  }, [selectedSubject, handleAuthError, isOnline])

  // Fetch all dates with attendance for selected subject
  const fetchMarkedDates = useCallback(async () => {
    if (!selectedSubject || selectedSubject === 'all') {
      setMarkedDates([])
      return
    }

    try {
      const { data: lectureData } = await supabase
        .from('lectures')
        .select('date')
        .eq('subject_id', selectedSubject)

      if (lectureData) {
        const dates = lectureData.map(l => l.date)
        setMarkedDates(dates)
      } else {
        setMarkedDates([])
      }
    } catch (error) {
      console.error('Error fetching marked dates:', error)
      setMarkedDates([])
    }
  }, [selectedSubject])

  // Check for existing lecture and attendance on date/subject change
  const fetchExistingAttendance = useCallback(async () => {
    if (!selectedSubject || selectedSubject === 'all') {
      setExistingLectureId(null)
      setAttendance({})
      return
    }

    try {
      const dateKey = selectedDate.toISOString().slice(0, 10)
      
      // Check if a lecture exists for this subject and date
      const { data: lectureData } = await supabase
        .from('lectures')
        .select('id')
        .eq('subject_id', selectedSubject)
        .eq('date', dateKey)
        .single()

      if (lectureData) {
        setExistingLectureId(lectureData.id)

        // Fetch existing attendance
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('student_id, status')
          .eq('lecture_id', lectureData.id)

        if (attendanceData) {
          const attendanceMap: Record<string, boolean> = {}
          attendanceData.forEach((a) => {
            attendanceMap[a.student_id] = a.status === 'present'
          })
          setAttendance(attendanceMap)
        }
      } else {
        setExistingLectureId(null)
        setAttendance({})
      }
    } catch (error) {
      // No existing lecture, start fresh
      setExistingLectureId(null)
      setAttendance({})
    }
  }, [selectedSubject, selectedDate])

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      if (!isOnline) {
        loadCachedData()
        setLoading(false)
        return
      }
      await Promise.all([fetchSubjects(), fetchStudents()])
      setLoading(false)
    }
    loadData()
  }, [fetchSubjects, fetchStudents, isOnline, loadCachedData])

  // Fetch enrolled students when subject changes
  useEffect(() => {
    fetchEnrolledStudents()
  }, [fetchEnrolledStudents])

  // Fetch marked dates when subject changes
  useEffect(() => {
    fetchMarkedDates()
  }, [fetchMarkedDates])

  useEffect(() => {
    fetchExistingAttendance()
  }, [fetchExistingAttendance])

  const presentCount = useMemo(() => {
    return students.filter((s) => attendance[s.id] === true).length
  }, [attendance, students])

  const absentCount = useMemo(() => {
    return students.filter((s) => attendance[s.id] === false).length
  }, [attendance, students])

  const toggleAttendance = (studentId: string) => {
    setAttendance(prev => {
      const currentValue = prev[studentId]
      if (currentValue === undefined) {
        return { ...prev, [studentId]: true }
      }
      return { ...prev, [studentId]: !currentValue }
    })
  }

  // Save attendance offline to MMKV storage
  const saveAttendanceOffline = (offlineRecord: OfflineAttendance) => {
    try {
      const existingData = storage.getString(OFFLINE_ATTENDANCE_KEY)
      const offlineRecords: OfflineAttendance[] = existingData ? JSON.parse(existingData) : []
      offlineRecords.push(offlineRecord)
      storage.set(OFFLINE_ATTENDANCE_KEY, JSON.stringify(offlineRecords))
      setOfflineAttendanceCount(offlineRecords.length)
    } catch (error) {
      console.error('Error saving offline attendance:', error)
    }
  }

  const handleSaveAttendance = async () => {
    if (!selectedSubject || selectedSubject === 'all') {
      Alert.alert('Error', 'Please select a specific subject to save attendance.')
      return
    }

    if (students.length === 0) {
      Alert.alert('Error', 'No students found for the class.')
      return
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to save attendance.')
      return
    }

    // Prepare attendance data
    const markedStudents = students.filter((s) => attendance[s.id] !== undefined)
    if (markedStudents.length === 0) {
      Alert.alert('Error', 'Please mark attendance for at least one student.')
      return
    }

    setSaving(true)
    const dateKey = selectedDate.toISOString().slice(0, 10)

    // If offline, save locally and queue for sync
    if (!isOnline) {
      const subject = subjects.find((s) => s.id === selectedSubject)
      const subjectName = subject?.name || 'Unknown Subject'
      
      const offlineRecord: OfflineAttendance = {
        id: `offline_${Date.now()}`,
        subjectId: selectedSubject,
        subjectName,
        date: dateKey,
        attendance: { ...attendance },
        students: students.map(s => ({ id: s.id, name: s.name, roll_number: s.roll_number, email: s.email, user_id: s.user_id })),
        createdAt: Date.now(),
        createdBy: user.id,
        existingLectureId: existingLectureId || undefined,
      }

      saveAttendanceOffline(offlineRecord)

      // Update Redux store so history shows this record immediately
      dispatch(setRecord({
        subjectId: selectedSubject,
        dateKey: dateKey,
        attendance: { ...attendance },
      }))

      // Also update the offline cache
      const cached = offlineService.getCachedData()
      const newAttendanceRecord = {
        id: offlineRecord.id,
        subject_id: selectedSubject,
        subjectId: selectedSubject,
        date: dateKey,
        dateKey: dateKey,
        attendance: { ...attendance },
      }
      offlineService.cacheData({
        ...cached,
        attendance: [...cached.attendance, newAttendanceRecord],
      })

      // Queue the operation for syncing when online
      queueOperation({
        type: 'attendance',
        table: 'attendance',
        data: offlineRecord,
      })

      setSaving(false)
      Alert.alert(
        'Saved Offline',
        `Attendance for ${subjectName} saved locally. It will sync when you're back online.`,
        [{ text: 'OK', style: 'default' }]
      )
      return
    }

    // Online mode - save directly to Supabase
    try {
      let lectureId = existingLectureId

      // Create lecture if it doesn't exist
      if (!lectureId) {
        const { data: newLecture, error: lectureError } = await supabase
          .from('lectures')
          .insert({
            subject_id: selectedSubject,
            date: dateKey,
            title: `Lecture on ${selectedDate.toLocaleDateString()}`,
            created_by: user.id,
          })
          .select('id')
          .single()

        if (lectureError) {
          handleAuthError(lectureError)
          throw lectureError
        }
        lectureId = newLecture.id
        setExistingLectureId(lectureId)
      }

      // Prepare attendance records
      const attendanceRecords = markedStudents.map((s) => ({
        lecture_id: lectureId,
        student_id: s.id,
        status: attendance[s.id] ? 'present' : 'absent',
        marked_by: user.id,
      }))

      // Upsert attendance records
      const { error: attendanceError } = await supabase
        .from('attendance')
        .upsert(attendanceRecords, { onConflict: 'lecture_id,student_id' })

      if (attendanceError) {
        handleAuthError(attendanceError)
        throw attendanceError
      }

      // Get subject name for notification
      const subject = subjects.find((s) => s.id === selectedSubject)
      const subjectName = subject?.name || 'a subject'

      // Send notifications to students who have user accounts
      const studentsWithAccounts = students.filter(
        (s) => s.user_id && attendance[s.id] !== undefined
      )

      for (const student of studentsWithAccounts) {
        const status = attendance[student.id] ? 'present' : 'absent'
        await sendNotification(
          student.user_id!,
          'attendance_marked',
          'Attendance Marked 📝',
          `Your attendance for ${subjectName} on ${selectedDate.toLocaleDateString()} has been marked as ${status}`,
          { subject_id: selectedSubject, date: selectedDate.toISOString().slice(0, 10), status }
        )
      }

      Alert.alert(
        'Success',
        `Attendance saved! ${studentsWithAccounts.length} students notified.`,
        [
          {
            text: 'OK',
            style: 'default',
          },
        ]
      )
    } catch (error: any) {
      console.error('Error saving attendance:', error)
      Alert.alert('Error', error.message || 'Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  const markAll = (present: boolean) => {
    const next: Record<string, boolean> = {}
    students.forEach((s) => { next[s.id] = present })
    setAttendance(next)
    setBulkAction(present ? 'present' : 'absent')
  }

  type Row = { name: string; code: string; status: 'Present' | 'Absent' }
  const buildAttendanceRows = (): Row[] => {
    return students.map((s) => ({
      name: s.name,
      code: s.roll_number ?? '',
      status: attendance[s.id] ? 'Present' : 'Absent'
    }))
  }

  const handleSavePDF = async () => {
    const rows = buildAttendanceRows()
    const dateStr = selectedDate.toLocaleString()
    const subjectName = subjects.find((x) => x.id === selectedSubject)?.name ?? 'All Students'
    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; }
            h1 { font-size: 20px; }
            .meta { margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
            th { background: #f3f6ff; text-align: left; }
            .present { color: #1E7D34; font-weight: 600; }
            .absent { color: #C62828; font-weight: 600; }
          </style>
        </head>
        <body>
          <h1>Attendance Report</h1>
          <div class="meta">Subject: <b>${subjectName}</b> | Date: <b>${dateStr}</b></div>
          <div class="meta">Present: <b>${presentCount}</b> | Absent: <b>${absentCount}</b></div>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Roll Number</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((r: Row) => `<tr><td>${r.name}</td><td>${r.code}</td><td class="${r.status === 'Present' ? 'present' : 'absent'}">${r.status}</td></tr>`).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `
    try {
      await RNPrint.print({ html })
    } catch (e) {
      console.warn('Print failed', e)
    }
  }

  const handleExportCSV = async () => {
    const rows = buildAttendanceRows()
    const header = ['Name', 'Roll Number', 'Status']
    const csv = [header.join(','), ...rows.map((r: Row) => [r.name, r.code, r.status].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n')
    try {
      await Share.share({ message: csv })
    } catch (e) {
      console.warn('Share failed', e)
    }
  }

  const subjectOptions = [
    { label: 'Select Subject', value: 'all' },
    ...subjects.map((s) => ({
      label: s.name ?? 'Unnamed',
      subtitle: s.code,
      value: s.id,
    }))
  ]

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5080BE" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    )
  }


  return (
    <SafeAreaView style={styles.container}>
      {/* Offline Banner */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <View style={styles.offlineBannerContent}>
            <Icon name="cloud-offline-outline" size={moderateScale(16)} color="#92400E" style={styles.bannerIcon} />
            <Text style={styles.offlineBannerText}>
              You're offline. Attendance will sync when online.
            </Text>
          </View>
          {offlineAttendanceCount > 0 && (
            <Text style={styles.offlineBannerSubtext}>
              {offlineAttendanceCount} record(s) pending sync
            </Text>
          )}
        </View>
      )}

      {/* Pending Sync Badge when online */}
      {isOnline && offlineAttendanceCount > 0 && (
        <View style={styles.syncBanner}>
          <View style={styles.syncBannerContent}>
            <Icon name="sync-outline" size={moderateScale(16)} color="#1E40AF" style={styles.bannerIcon} />
            <Text style={styles.syncBannerText}>
              {offlineAttendanceCount} offline record(s) will sync shortly
            </Text>
          </View>
        </View>
      )}

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={moderateScale(24)} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mark Attendance</Text>
        {selectedSubject && selectedSubject !== 'all' && students.length > 0 && (
          <TouchableOpacity 
            onPress={handleSaveAttendance} 
            style={[styles.headerSaveButton, saving && styles.headerSaveButtonDisabled]}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Image source={images.calender} style={styles.headerSaveIcon} />
                <Text style={styles.headerSaveText}>{isOnline ? 'Save' : 'Save Offline'}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filtersRow}>
        <View style={styles.filterItem}>
          <Dropdown
            Title="Subject"
            isIcon
            source={images.book}
            options={subjectOptions}
            value={selectedSubject}
            onValueChange={(v) => setSelectedSubject(String(v))}
            placeholder="Select"
            searchable
          />
        </View>
        <View style={styles.filterItem}>
          <DatePicker
            label="Date"
            initialDate={selectedDate}
            onDateChange={setSelectedDate}
            markedDates={markedDates}
          />
        </View>
      </View>

      {selectedSubject && selectedSubject !== 'all' && (
        <View style={styles.statsRow}>
          <View style={[styles.statBox, styles.statBoxPresent]}>
            <Text style={[styles.statNumber, { color: '#047857' }]}>{presentCount}</Text>
            <Text style={[styles.statLabel, { color: '#065F46' }]}>Present</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxAbsent]}>
            <Text style={[styles.statNumber, { color: '#B91C1C' }]}>{absentCount}</Text>
            <Text style={[styles.statLabel, { color: '#991B1B' }]}>Absent</Text>
          </View>
          <TouchableOpacity onPress={() => markAll(true)} style={[styles.quickButton, { backgroundColor: '#D1FAE5', borderColor: '#10B981' }]}>
            <Text style={[styles.quickButtonText, { color: '#047857' }]}>✓ All</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => markAll(false)} style={[styles.quickButton, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]}>
            <Text style={[styles.quickButtonText, { color: '#B91C1C' }]}>✕ All</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.studentsSection}>
        {selectedSubject && selectedSubject !== 'all' && (
          <Text style={styles.sectionTitle}>Students ({students.length})</Text>
        )}
        {!selectedSubject || selectedSubject === 'all' ? (
          <View style={styles.emptyContainer}>
            <Image source={images.book} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>Select a Subject</Text>
            <Text style={styles.emptyText}>Please select a subject to view and mark attendance</Text>
          </View>
        ) : (
          <FlatList
            data={students}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isMarked = attendance[item.id] !== undefined
              return (
                <StudentItem
                  item={{
                    ...item,
                    code: item.roll_number,
                  }}
                  present={!!attendance[item.id]}
                  onTogglePresent={() => toggleAttendance(item.id)}
                  showColors={isMarked || bulkAction !== null}
                />
              )
            }}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Image source={images.user} style={styles.emptyIcon} />
                <Text style={styles.emptyTitle}>No Students Enrolled</Text>
                <Text style={styles.emptyText}>No students are enrolled in this subject yet. Please enroll students first.</Text>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  )
}

export default MarkAttendence

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  backButton: {
    padding: moderateScale(3),
    marginRight: moderateScale(12),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: theme.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  headerSaveButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  headerSaveIcon: {
    width: moderateScale(16),
    height: moderateScale(16),
    tintColor: '#FFFFFF',
    marginRight: 6,
  },
  headerSaveText: {
    color: '#FFFFFF',
    fontSize: moderateScale(14),
    fontWeight: '700',
  },
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  filterItem: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    alignItems: 'center',
  },
  statBox: {
    flex: 1.2,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    minHeight: moderateScale(56),
  },
  statBoxPresent: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
  },
  statBoxAbsent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  statIconContainer: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  statIcon: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: '#10B981',
  },
  statContent: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: moderateScale(22),
    fontWeight: '800',
    lineHeight: moderateScale(24),
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: moderateScale(11),
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    minHeight: moderateScale(56),
  },
  quickButtonText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
  },
  studentsSection: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 100,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: moderateScale(80),
    height: moderateScale(80),
    tintColor: '#CBD5E1',
    marginBottom: 16,
    opacity: 0.6,
  },
  emptyTitle: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: moderateScale(14),
    color: '#94A3B8',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: moderateScale(16),
    color: '#64748B',
  },
  headerSaveButtonDisabled: {
    opacity: 0.7,
  },
  offlineBanner: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FCD34D',
  },
  offlineBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerIcon: {
    marginRight: moderateScale(8),
  },
  offlineBannerText: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: '#92400E',
  },
  offlineBannerSubtext: {
    fontSize: moderateScale(11),
    color: '#B45309',
    marginTop: 2,
  },
  syncBanner: {
    backgroundColor: '#DBEAFE',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#93C5FD',
  },
  syncBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncBannerText: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: '#1E40AF',
  },
})
