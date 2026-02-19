import { StyleSheet, Text, View, FlatList, Image, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from 'react-native'
import React, { useMemo, useState, useCallback, useEffect } from 'react'
import { moderateScale } from 'react-native-size-matters'
import Icon from 'react-native-vector-icons/Ionicons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSelector, useDispatch } from 'react-redux'
import { lightTheme as theme } from '../../theme/colors'
import { useNavigation } from '@react-navigation/native'
import images from '../../assets/images'
import { useAuth } from '../../contexts/AuthContext'
import { useOffline } from '../../contexts/OfflineContext'
import { supabase } from '../../lib/supabase'
import { setSubjects } from '../../redux/subjectsSlice'
import { setStudents } from '../../redux/studentsSlice'
import { setAttendanceRecords } from '../../redux/attendanceSlice'
import offlineService from '../../services/OfflineService'

const Statistics = () => {
  const navigation = useNavigation<any>()
  const dispatch = useDispatch()
  const { userProfile, handleAuthError } = useAuth()
  const { isOnline } = useOffline()
  const subjects = useSelector((state: any) => state.subjects?.items ?? [])
  const students = useSelector((state: any) => state.students?.items ?? [])
  const attendanceRecords = useSelector((state: any) => state.attendance?.records ?? {})
  const [studentSubjects, setStudentSubjects] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load cached data when offline
  const loadCachedData = useCallback(() => {
    const cached = offlineService.getCachedData()
    if (cached.subjects.length > 0) {
      dispatch(setSubjects(cached.subjects))
    }
    if (cached.students.length > 0) {
      dispatch(setStudents(cached.students))
    }
    if (cached.attendance.length > 0) {
      dispatch(setAttendanceRecords(cached.attendance))
    }
    if (cached.studentSubjects) {
      setStudentSubjects(cached.studentSubjects)
    }
    setLoading(false)
  }, [dispatch])

  const fetchStatisticsData = useCallback(async () => {
    if (!userProfile?.class_id && !userProfile?.admin_class_id) {
      setLoading(false)
      return
    }

    // If offline, load from cache
    if (!isOnline) {
      loadCachedData()
      return
    }

    const classId = userProfile.admin_class_id || userProfile.class_id

    try {
      // Fetch subjects
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('*')
        .eq('class_id', classId)

      if (subjectsError) {
        handleAuthError(subjectsError)
      } else if (subjectsData) {
        dispatch(setSubjects(subjectsData))
      }

      // Fetch students from 'students' table
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classId)

      if (studentsError) {
        handleAuthError(studentsError)
      } else if (studentsData) {
        dispatch(setStudents(studentsData))
      }

      // Fetch student-subject enrollments
      if (studentsData && studentsData.length > 0) {
        const studentIds = studentsData.map((s: any) => s.id)
        const { data: enrollmentData, error: enrollmentError } = await supabase
          .from('student_subjects')
          .select('*')
          .in('student_id', studentIds)

        if (enrollmentError) {
          handleAuthError(enrollmentError)
        } else {
          setStudentSubjects(enrollmentData || [])
        }
      }

      // Fetch lectures with attendance data
      const { data: lecturesData, error: lecturesError } = await supabase
        .from('lectures')
        .select(`
          id,
          subject_id,
          date,
          attendance (student_id, status)
        `)
        .in('subject_id', subjectsData?.map((s: any) => s.id) || [])
        .order('date', { ascending: false })

      if (lecturesError) {
        handleAuthError(lecturesError)
      } else if (lecturesData) {
        // Transform lectures to attendance records format
        const records = lecturesData.map((lecture: any) => {
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
        dispatch(setAttendanceRecords(records))
      }
    } catch (error) {
      console.error('Error fetching statistics data:', error)
      handleAuthError(error)
    } finally {
      setLoading(false)
    }
  }, [userProfile, dispatch, handleAuthError])

  useEffect(() => {
    if (isOnline) {
      fetchStatisticsData()
    } else {
      loadCachedData()
    }
  }, [isOnline, fetchStatisticsData, loadCachedData])

  const onRefresh = useCallback(async () => {
    if (!isOnline) {
      loadCachedData()
      return
    }
    setRefreshing(true)
    await fetchStatisticsData()
    setRefreshing(false)
  }, [isOnline, fetchStatisticsData, loadCachedData])

  // Calculate subject-wise statistics
  const subjectStats = useMemo(() => {
    return subjects.map((subject: any) => {
      // Get enrolled student IDs from student_subjects
      const enrolledStudentIds = studentSubjects
        .filter((ss: any) => ss.subject_id === subject.id)
        .map((ss: any) => ss.student_id)
      
      const enrolledStudents = students.filter((s: any) => 
        enrolledStudentIds.includes(s.id)
      )
      
      let totalClasses = 0
      let totalPresent = 0
      
      Object.values(attendanceRecords).forEach((record: any) => {
        if (record.subjectId === subject.id) {
          totalClasses++
          const presentCount = Object.values(record.attendance).filter(Boolean).length
          totalPresent += presentCount
        }
      })
      
      const totalPossible = totalClasses * enrolledStudents.length
      const attendancePercentage = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 0
      
      return {
        ...subject,
        enrolledCount: enrolledStudents.length,
        totalClasses,
        attendancePercentage
      }
    })
  }, [subjects, students, studentSubjects, attendanceRecords])

  // Calculate student-wise statistics
  const studentStats = useMemo(() => {
    return students.map((student: any) => {
      let totalClasses = 0
      let attendedClasses = 0
      const subjectWiseStats: any = {}

      // Get subjects this student is enrolled in from student_subjects
      const enrolledSubjectIds = studentSubjects
        .filter((ss: any) => ss.student_id === student.id)
        .map((ss: any) => ss.subject_id)

      // Calculate for each subject the student is enrolled in
      enrolledSubjectIds.forEach((subjectId: string) => {
        let subjectTotal = 0
        let subjectAttended = 0

        Object.values(attendanceRecords).forEach((record: any) => {
          if (record.subjectId === subjectId && record.attendance[student.id] !== undefined) {
            subjectTotal++
            totalClasses++
            if (record.attendance[student.id]) {
              subjectAttended++
              attendedClasses++
            }
          }
        })

        if (subjectTotal > 0) {
          const subject = subjects.find((s: any) => s.id === subjectId)
          subjectWiseStats[subjectId] = {
            subjectName: subject?.name || 'Unknown',
            total: subjectTotal,
            attended: subjectAttended,
            percentage: Math.round((subjectAttended / subjectTotal) * 100)
          }
        }
      })

      const overallPercentage = totalClasses > 0 ? Math.round((attendedClasses / totalClasses) * 100) : 0
      
      // Determine performance badge
      let badge = 'Poor'
      if (overallPercentage >= 90) badge = 'Excellent'
      else if (overallPercentage >= 75) badge = 'Good'
      else if (overallPercentage >= 60) badge = 'Average'

      return {
        ...student,
        totalClasses,
        attendedClasses,
        overallPercentage,
        badge,
        subjectWiseStats: Object.values(subjectWiseStats)
      }
    }).sort((a: any, b: any) => b.overallPercentage - a.overallPercentage)
  }, [students, subjects, studentSubjects, attendanceRecords])

  // Get recent attendance records
  const recentRecords = useMemo(() => {
    const records = Object.entries(attendanceRecords).map(([id, record]: [string, any]) => {
      const subject = subjects.find((s: any) => s.id === record.subjectId)
      const date = new Date(record.dateKey)
      const presentCount = Object.values(record.attendance).filter(Boolean).length
      const totalCount = Object.values(record.attendance).length
      
      return {
        id,
        subjectName: subject?.name || 'Unknown',
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        presentCount,
        totalCount,
        status: presentCount === totalCount ? 'All Present' : `${presentCount}/${totalCount} Present`
      }
    })
    
    return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10)
  }, [attendanceRecords, subjects])

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const getSubjectColor = (index: number) => {
    const colors = ['#4F39F6', '#12C25E', '#FF7A00', '#B35BFF', '#EF4444', '#3B82F6']
    return colors[index % colors.length]
  }

  const renderSubjectCard = ({ item, index }: any) => (
    <TouchableOpacity 
      style={styles.subjectCard}
      onPress={() => navigation.navigate('SubjectStatistics', { subjectId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.subjectHeader}>
        <View style={[styles.subjectIcon, { backgroundColor: getSubjectColor(index) }]}>
          <Image source={images.book} style={styles.subjectIconImage} />
        </View>
        <View style={styles.subjectInfo}>
          <Text style={styles.subjectName}>{item.name}</Text>
          <Text style={styles.subjectCode}>{item.code || 'No Code'}</Text>
        </View>
      </View>

      <View style={styles.subjectStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Students</Text>
          <Text style={styles.statValue}>{item.enrolledCount}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Classes</Text>
          <Text style={styles.statValue}>{item.totalClasses}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Attendance</Text>
          <Text style={[styles.statValue, { color: getSubjectColor(index) }]}>
            {item.attendancePercentage}%
          </Text>
        </View>
      </View>

      <View style={styles.progressBarContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: `${item.attendancePercentage}%`,
                backgroundColor: getSubjectColor(index)
              }
            ]} 
          />
        </View>
      </View>
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F39F6" />
          <Text style={styles.loadingText}>Loading statistics...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={moderateScale(24)} color="#1A1A2E" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Statistics</Text>
          <Text style={styles.headerSubtitle}>View attendance by subject</Text>
        </View>
        {!isOnline && (
          <View style={styles.offlineBadge}>
            <Text style={styles.offlineBadgeText}>Offline</Text>
          </View>
        )}
      </View>

      {subjectStats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Image source={images.statistic} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>No Subjects Available</Text>
          <Text style={styles.emptyText}>Add subjects to view statistics</Text>
        </View>
      ) : (
        <FlatList
          data={subjectStats}
          keyExtractor={(item) => item.id}
          renderItem={renderSubjectCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#4F39F6']}
              tintColor="#4F39F6"
            />
          }
        />
      )}
    </SafeAreaView>
  )
}

export default Statistics

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  offlineBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  offlineBadgeText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '600',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 15,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: {
    padding: moderateScale(3),
    marginRight: moderateScale(12),
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: moderateScale(12),
    color: '#6B7280',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  subjectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: moderateScale(0), height: moderateScale(2) },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  subjectIcon: {
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  subjectIconImage: {
    width: moderateScale(28),
    height: moderateScale(28),
    tintColor: '#FFFFFF',
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  subjectCode: {
    fontSize: moderateScale(14),
    color: '#6B7280',
  },
  subjectStats: {
    flexDirection: 'row',
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: moderateScale(12),
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: '#1A1A2E',
  },
  progressBarContainer: {
    marginTop: 4,
  },
  progressBar: {
    height: moderateScale(8),
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: moderateScale(120),
    height: moderateScale(120),
    marginBottom: 20,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: moderateScale(14),
    color: '#6B7280',
    textAlign: 'center',
  },
})
