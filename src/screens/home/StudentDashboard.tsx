import React, { useState, useEffect, useCallback } from 'react'
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { moderateScale } from 'react-native-size-matters'
import { useNavigation } from '@react-navigation/native'
import CustomText from '../../components/text'
import { lightTheme } from '../../theme/colors'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useOffline } from '../../contexts/OfflineContext'
import NotificationBell from '../../components/NotificationBell'
import { MMKV } from 'react-native-mmkv'

const storage = new MMKV()
const STUDENT_CACHE_KEY = 'AttendEase.studentDashboard'

interface Subject {
  id: string
  name: string
  teacher_email: string
}

interface AttendanceStats {
  subjectId: string
  totalLectures: number
  attended: number
  percentage: number
}

interface CachedStudentData {
  subjects: Subject[]
  attendanceStats: Record<string, AttendanceStats>
  className: string
  lastUpdated: number
}

const StudentDashboard = () => {
  const navigation = useNavigation<any>()
  const { user, userProfile, signOut, isDualRole, setActiveRole, handleAuthError, activeRole } = useAuth()
  const { isOnline } = useOffline()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [attendanceStats, setAttendanceStats] = useState<Map<string, AttendanceStats>>(new Map())
  const [refreshing, setRefreshing] = useState(false)
  const [className, setClassName] = useState('')
  const [studentId, setStudentId] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Watch for when user becomes dual role and needs to select role
  useEffect(() => {
    if (isDualRole && !activeRole) {
      console.log('StudentDashboard: User is now dual role, redirecting to RoleSelection')
      navigation.replace('RoleSelection')
    }
  }, [isDualRole, activeRole, navigation])

  // Load cached data on mount
  useEffect(() => {
    loadCachedData()
  }, [])

  const loadCachedData = () => {
    try {
      const cached = storage.getString(STUDENT_CACHE_KEY)
      if (cached) {
        const data: CachedStudentData = JSON.parse(cached)
        setSubjects(data.subjects)
        setClassName(data.className)
        setLastUpdated(new Date(data.lastUpdated))
        
        // Convert to Map
        const statsMap = new Map<string, AttendanceStats>()
        Object.entries(data.attendanceStats).forEach(([key, value]) => {
          statsMap.set(key, value)
        })
        setAttendanceStats(statsMap)
      }
    } catch (error) {
      console.error('Error loading cached data:', error)
    }
  }

  const cacheData = (subjects: Subject[], stats: Map<string, AttendanceStats>, className: string) => {
    try {
      const statsObj: Record<string, AttendanceStats> = {}
      stats.forEach((value, key) => {
        statsObj[key] = value
      })

      const data: CachedStudentData = {
        subjects,
        attendanceStats: statsObj,
        className,
        lastUpdated: Date.now(),
      }
      storage.set(STUDENT_CACHE_KEY, JSON.stringify(data))
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Error caching data:', error)
    }
  }

  const fetchData = useCallback(async () => {
    if (!userProfile?.class_id || !user) return

    // If offline, just use cached data
    if (!isOnline) {
      console.log('Offline - using cached data')
      return
    }

    try {
      // Fetch class info
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('name')
        .eq('id', userProfile.class_id)
        .single()

      if (classError) {
        handleAuthError(classError)
      } else if (classData) {
        setClassName(classData.name)
      }

      // Find student record for current user first
      const { data: studentData } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', userProfile.class_id)
        .eq('email', userProfile.email)
        .single()

      let foundStudentId: string | null = null

      if (!studentData) {
        // Try matching by roll number
        const { data: studentByRoll } = await supabase
          .from('students')
          .select('id')
          .eq('class_id', userProfile.class_id)
          .eq('roll_number', userProfile.roll_number)
          .single()

        if (!studentByRoll) {
          console.log('Student record not found')
          setSubjects([])
          setAttendanceStats(new Map())
          return
        }
        foundStudentId = studentByRoll.id
      } else {
        foundStudentId = studentData.id
      }

      setStudentId(foundStudentId)

      // Fetch only subjects the student is enrolled in
      const { data: enrolledSubjects, error: enrollmentError } = await supabase
        .from('student_subjects')
        .select('subject_id')
        .eq('student_id', foundStudentId)

      if (enrollmentError) {
        handleAuthError(enrollmentError)
        return
      }

      const enrolledSubjectIds = enrolledSubjects?.map(es => es.subject_id) || []

      if (enrolledSubjectIds.length === 0) {
        setSubjects([])
        setAttendanceStats(new Map())
        cacheData([], new Map(), classData?.name || '')
        return
      }

      // Fetch subjects data only for enrolled subjects
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('*')
        .in('id', enrolledSubjectIds)
        .order('name', { ascending: true })

      if (subjectsError) {
        handleAuthError(subjectsError)
        throw subjectsError
      }
      setSubjects(subjectsData || [])
      await calculateAttendance(subjectsData || [], foundStudentId, classData?.name || '')
    } catch (error) {
      console.error('Error fetching data:', error)
      handleAuthError(error)
    }
  }, [userProfile?.class_id, userProfile?.email, userProfile?.roll_number, user, isOnline])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Real-time subscription for subjects and attendance
  useEffect(() => {
    if (!userProfile?.class_id) return

    // Subscribe to subject changes
    const subjectsChannel = supabase
      .channel('subjects_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subjects',
          filter: `class_id=eq.${userProfile.class_id}`,
        },
        () => {
          fetchData()
        }
      )
      .subscribe()

    // Subscribe to attendance changes
    const attendanceChannel = supabase
      .channel('attendance_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
        },
        () => {
          fetchData()
        }
      )
      .subscribe()

    return () => {
      subjectsChannel.unsubscribe()
      attendanceChannel.unsubscribe()
    }
  }, [userProfile?.class_id, fetchData])

  const calculateAttendance = async (subjects: Subject[], studentId: string) => {
    const statsMap = new Map<string, AttendanceStats>()

    for (const subject of subjects) {
      try {
        // Get all lectures for this subject
        const { data: lectures } = await supabase
          .from('lectures')
          .select('id')
          .eq('subject_id', subject.id)

        const totalLectures = lectures?.length || 0

        if (totalLectures === 0) {
          statsMap.set(subject.id, {
            subjectId: subject.id,
            totalLectures: 0,
            attended: 0,
            percentage: 0,
          })
          continue
        }

        // Get attendance records for this student
        const lectureIds = lectures?.map((l) => l.id) || []
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('*')
          .eq('student_id', studentId)
          .in('lecture_id', lectureIds)
          .eq('status', 'present')

        const attended = attendanceData?.length || 0
        const percentage = totalLectures > 0 ? Math.round((attended / totalLectures) * 100) : 0

        statsMap.set(subject.id, {
          subjectId: subject.id,
          totalLectures,
          attended,
          percentage,
        })
      } catch (error) {
        console.error('Error calculating attendance for subject:', subject.id, error)
        handleAuthError(error)
      }
    }

    setAttendanceStats(statsMap)
    // Cache the data
    cacheData(subjects, statsMap, className)
  }

  const onRefresh = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Cannot refresh while offline. Using cached data.')
      return
    }
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Sign Out', 
        style: 'destructive', 
        onPress: async () => {
          await signOut()
          // RootNavigator will automatically handle navigation to Login
        }
      },
    ])
  }

  const handleSwitchToAdmin = () => {
    setActiveRole('admin');
    navigation.replace('Main');
  }

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 75) return '#10B981' // Green
    if (percentage >= 50) return '#F59E0B' // Yellow
    return '#EF4444' // Red
  }

  const renderSubjectCard = ({ item }: { item: Subject }) => {
    const stats = attendanceStats.get(item.id)
    const percentage = stats?.percentage || 0
    const color = getAttendanceColor(percentage)

    return (
      <TouchableOpacity style={styles.subjectCard} activeOpacity={0.7}>
        <View style={styles.subjectInfo}>
          <CustomText text={item.name} textStyle={styles.subjectName} />
          <CustomText text={`Teacher: ${item.teacher_email}`} textStyle={styles.teacherEmail} />
          
          {stats && (
            <CustomText
              text={`${stats.attended}/${stats.totalLectures} lectures attended`}
              textStyle={styles.lectureCount}
            />
          )}
        </View>

        {/* Attendance Progress */}
        <View style={styles.progressContainer}>
          <View style={styles.progressCircle}>
            <CustomText
              text={`${percentage}%`}
              textStyle={[styles.percentageText, { color }]}
            />
          </View>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                { width: `${percentage}%`, backgroundColor: color },
              ]}
            />
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  // Calculate overall attendance
  const calculateOverallAttendance = () => {
    let totalLectures = 0
    let totalAttended = 0

    attendanceStats.forEach((stats) => {
      totalLectures += stats.totalLectures
      totalAttended += stats.attended
    })

    return totalLectures > 0 ? Math.round((totalAttended / totalLectures) * 100) : 0
  }

  const overallPercentage = calculateOverallAttendance()
  const overallColor = getAttendanceColor(overallPercentage)

  return (
    <SafeAreaView style={styles.container}>
      {/* Offline Banner */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <CustomText 
            text={`📴 Offline Mode ${lastUpdated ? `• Last updated ${lastUpdated.toLocaleTimeString()}` : ''}`} 
            textStyle={styles.offlineBannerText} 
          />
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <CustomText text={`Hello, ${userProfile?.name?.split(' ')[0] || 'Student'}! 👋`} textStyle={styles.greeting} />
          <CustomText text={className || 'Your Class'} textStyle={styles.className} />
        </View>
        <View style={styles.headerRight}>
          {isDualRole && (
            <TouchableOpacity onPress={handleSwitchToAdmin} style={styles.switchRoleButton}>
              <CustomText text="👑" textStyle={styles.switchRoleIcon} />
            </TouchableOpacity>
          )}
          <NotificationBell />
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
            <CustomText text="🚪" textStyle={styles.signOutIcon} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Overall Stats Card */}
      <View style={styles.overallCard}>
        <View style={styles.overallInfo}>
          <CustomText text="Overall Attendance" textStyle={styles.overallLabel} />
          <CustomText text={`${subjects.length} Subjects`} textStyle={styles.subjectCount} />
        </View>
        <View style={[styles.overallCircle, { borderColor: overallColor }]}>
          <CustomText text={`${overallPercentage}%`} textStyle={[styles.overallPercentage, { color: overallColor }]} />
        </View>
      </View>

      {/* Attendance Status */}
      <View style={styles.statusBadge}>
        <CustomText
          text={
            overallPercentage >= 75
              ? '✅ Good Standing'
              : overallPercentage >= 50
              ? '⚠️ Needs Improvement'
              : '❌ Low Attendance'
          }
          textStyle={[styles.statusText, { color: overallColor }]}
        />
      </View>

      {/* Subjects List */}
      <View style={styles.sectionHeader}>
        <CustomText text="📚 Your Subjects" textStyle={styles.sectionTitle} />
      </View>

      {subjects.length === 0 ? (
        <View style={styles.emptyContainer}>
          <CustomText text="📖" textStyle={styles.emptyEmoji} />
          <CustomText text="No subjects yet" textStyle={styles.emptyTitle} />
          <CustomText
            text="Your class administrator will add subjects soon."
            textStyle={styles.emptySubtitle}
          />
        </View>
      ) : (
        <FlatList
          data={subjects}
          renderItem={renderSubjectCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[lightTheme.primary]} />
          }
        />
      )}
    </SafeAreaView>
  )
}

export default StudentDashboard

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E6F5FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(16),
    paddingBottom: moderateScale(12),
  },
  offlineBanner: {
    backgroundColor: '#FEE2E2',
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(16),
    marginHorizontal: moderateScale(20),
    marginBottom: moderateScale(8),
    borderRadius: moderateScale(8),
  },
  offlineBannerText: {
    color: '#B91C1C',
    fontSize: moderateScale(12),
    fontWeight: '500',
    textAlign: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(8),
  },
  greeting: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: '#1A3A52',
    marginBottom: moderateScale(4),
  },
  className: {
    fontSize: moderateScale(14),
    color: '#6B7280',
  },
  signOutButton: {
    padding: moderateScale(4),
  },
  signOutIcon: {
    fontSize: moderateScale(24),
  },
  switchRoleButton: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#5080BE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  switchRoleIcon: {
    fontSize: moderateScale(18),
    marginLeft: moderateScale(4),
  },
  overallCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: moderateScale(20),
    marginTop: moderateScale(8),
    padding: moderateScale(20),
    borderRadius: moderateScale(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  overallInfo: {
    flex: 1,
  },
  overallLabel: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    color: '#1A3A52',
    marginBottom: moderateScale(4),
  },
  subjectCount: {
    fontSize: moderateScale(14),
    color: '#6B7280',
  },
  overallCircle: {
    width: moderateScale(70),
    height: moderateScale(70),
    borderRadius: moderateScale(35),
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  overallPercentage: {
    fontSize: moderateScale(18),
    fontWeight: '700',
  },
  statusBadge: {
    alignSelf: 'center',
    marginTop: moderateScale(12),
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(6),
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(20),
  },
  statusText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  sectionHeader: {
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(20),
    paddingBottom: moderateScale(12),
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    color: '#1A3A52',
  },
  listContent: {
    paddingHorizontal: moderateScale(20),
    paddingBottom: moderateScale(20),
  },
  subjectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(12),
    padding: moderateScale(16),
    marginBottom: moderateScale(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  subjectInfo: {
    marginBottom: moderateScale(12),
  },
  subjectName: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: '#1A3A52',
    marginBottom: moderateScale(4),
  },
  teacherEmail: {
    fontSize: moderateScale(13),
    color: '#6B7280',
    marginBottom: moderateScale(2),
  },
  lectureCount: {
    fontSize: moderateScale(12),
    color: '#9CA3AF',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressCircle: {
    marginRight: moderateScale(12),
  },
  percentageText: {
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  progressBarContainer: {
    flex: 1,
    height: moderateScale(8),
    backgroundColor: '#E5E7EB',
    borderRadius: moderateScale(4),
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: moderateScale(4),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: moderateScale(40),
  },
  emptyEmoji: {
    fontSize: moderateScale(64),
    marginBottom: moderateScale(16),
  },
  emptyTitle: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    color: '#1A3A52',
    marginBottom: moderateScale(8),
  },
  emptySubtitle: {
    fontSize: moderateScale(14),
    color: '#6B7280',
    textAlign: 'center',
  },
})
