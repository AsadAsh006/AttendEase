import React, { useState, useEffect, useCallback } from 'react'
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { moderateScale } from 'react-native-size-matters'
import { useNavigation, useRoute } from '@react-navigation/native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import CustomText from '../../components/text'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useOffline } from '../../contexts/OfflineContext'
import { MMKV } from 'react-native-mmkv'

const storage = new MMKV()
const CACHE_KEY_PREFIX = 'AttendEase.subjectAttendance.'
const { width: SCREEN_WIDTH } = Dimensions.get('window')

interface Lecture {
  id: string
  date: string
  topic?: string
  created_at: string
}

interface AttendanceRecord {
  id: string
  lecture_id: string
  status: 'present' | 'absent' | 'late'
  lecture: Lecture
}

interface RouteParams {
  subjectId: string
  subjectName: string
  subjectCode?: string
  subjectColor?: string
}

const StudentSubjectAttendance = () => {
  const navigation = useNavigation<any>()
  const route = useRoute()
  const { subjectId, subjectName, subjectCode, subjectColor } = route.params as RouteParams
  const { user, userProfile, handleAuthError } = useAuth()
  const { isOnline } = useOffline()

  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<Map<string, AttendanceRecord>>(new Map())
  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    percentage: 0,
  })
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const fadeAnim = useState(new Animated.Value(0))[0]
  const progressAnim = useState(new Animated.Value(0))[0]

  const primaryColor = subjectColor || '#0077B6'
  const cacheKey = `${CACHE_KEY_PREFIX}${subjectId}`

  // Load cached data on mount
  const loadCachedData = useCallback(() => {
    try {
      const cached = storage.getString(cacheKey)
      if (cached) {
        const data = JSON.parse(cached)
        setLectures(data.lectures || [])
        setStats(data.stats || { total: 0, present: 0, absent: 0, late: 0, percentage: 0 })
        setLastUpdated(data.lastUpdated ? new Date(data.lastUpdated) : null)

        // Reconstruct attendance map
        const attendanceMap = new Map<string, AttendanceRecord>()
        if (data.attendanceRecords) {
          Object.entries(data.attendanceRecords).forEach(([key, value]) => {
            attendanceMap.set(key, value as AttendanceRecord)
          })
        }
        setAttendanceRecords(attendanceMap)
        setLoading(false)
      }
    } catch (error) {
      console.error('Error loading cached attendance data:', error)
    }
  }, [cacheKey])

  // Cache data to storage
  const cacheData = useCallback((
    lecturesData: Lecture[],
    attendanceMap: Map<string, AttendanceRecord>,
    statsData: typeof stats
  ) => {
    try {
      // Convert Map to plain object for JSON serialization
      const attendanceObj: Record<string, AttendanceRecord> = {}
      attendanceMap.forEach((value, key) => {
        attendanceObj[key] = value
      })

      storage.set(cacheKey, JSON.stringify({
        lectures: lecturesData,
        attendanceRecords: attendanceObj,
        stats: statsData,
        lastUpdated: Date.now(),
      }))
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Error caching attendance data:', error)
    }
  }, [cacheKey])

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start()
  }, [])

  useEffect(() => {
    loadCachedData()
    if (isOnline) {
      fetchAttendanceData()
    }
  }, [isOnline])

  // Refetch when active class changes
  useEffect(() => {
    if (isOnline && (userProfile?.active_class_id || userProfile?.class_id)) {
      fetchAttendanceData()
    }
  }, [userProfile?.active_class_id, userProfile?.class_id])

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: stats.percentage / 100,
      duration: 800,
      useNativeDriver: false,
    }).start()
  }, [stats.percentage])

  const fetchAttendanceData = useCallback(async () => {
    const activeClassId = userProfile?.active_class_id || userProfile?.class_id
    if (!activeClassId || !user) return

    setLoading(true)
    try {
      // Find student record
      const { data: studentData } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', activeClassId)
        .or(`email.eq.${userProfile.email},roll_number.eq.${userProfile.roll_number}`)
        .single()

      if (!studentData) {
        setLoading(false)
        return
      }

      // Fetch all lectures for this subject
      const { data: lecturesData, error: lecturesError } = await supabase
        .from('lectures')
        .select('*')
        .eq('subject_id', subjectId)
        .order('date', { ascending: false })

      if (lecturesError) {
        handleAuthError(lecturesError)
        return
      }

      setLectures(lecturesData || [])

      if (!lecturesData || lecturesData.length === 0) {
        setStats({ total: 0, present: 0, absent: 0, late: 0, percentage: 0 })
        setLoading(false)
        return
      }

      // Fetch attendance records for this student
      const lectureIds = lecturesData.map(l => l.id)
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', studentData.id)
        .in('lecture_id', lectureIds)

      if (attendanceError) {
        handleAuthError(attendanceError)
        return
      }

      // Create attendance map
      const attendanceMap = new Map<string, AttendanceRecord>()
      attendanceData?.forEach(record => {
        const lecture = lecturesData.find(l => l.id === record.lecture_id)
        if (lecture) {
          attendanceMap.set(record.lecture_id, { ...record, lecture })
        }
      })
      setAttendanceRecords(attendanceMap)

      // Calculate stats
      const total = lecturesData.length
      const present = attendanceData?.filter(a => a.status === 'present').length || 0
      const late = attendanceData?.filter(a => a.status === 'late').length || 0
      const absent = total - present - late
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0

      const newStats = { total, present, absent, late, percentage }
      setStats(newStats)

      // Cache the data for offline use
      cacheData(lecturesData, attendanceMap, newStats)
    } catch (error) {
      console.error('Error fetching attendance:', error)
      handleAuthError(error)
    } finally {
      setLoading(false)
    }
  }, [userProfile, user, subjectId, handleAuthError, cacheData])

  const onRefresh = async () => {
    if (!isOnline) return
    setRefreshing(true)
    await fetchAttendanceData()
    setRefreshing(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return '#10B981'
      case 'late':
        return '#F59E0B'
      case 'absent':
        return '#EF4444'
      default:
        return '#9CA3AF'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return 'check-circle'
      case 'late':
        return 'clock-alert'
      case 'absent':
        return 'close-circle'
      default:
        return 'help-circle'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatLastUpdated = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 75) return '#10B981'
    if (percentage >= 50) return '#F59E0B'
    return '#EF4444'
  }

  const percentageColor = getAttendanceColor(stats.percentage)

  const renderLectureItem = (lecture: Lecture) => {
    const record = attendanceRecords.get(lecture.id)
    const status = record?.status || 'absent'
    const statusColor = getStatusColor(status)
    const statusIcon = getStatusIcon(status)

    return (
      <Animated.View
        key={lecture.id}
        style={[styles.lectureCard, { opacity: fadeAnim }]}
      >
        <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
        <View style={styles.lectureContent}>
          <View style={styles.lectureHeader}>
            <View style={styles.dateContainer}>
              <Icon name="calendar" size={moderateScale(14)} color="#6B7280" />
              <CustomText text={formatDate(lecture.date)} textStyle={styles.dateText} />
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <Icon name={statusIcon} size={moderateScale(14)} color={statusColor} />
              <CustomText
                text={status.charAt(0).toUpperCase() + status.slice(1)}
                textStyle={[styles.statusText, { color: statusColor }]}
              />
            </View>
          </View>
          {lecture.topic && (
            <View style={styles.topicContainer}>
              <Icon name="book-open-variant" size={moderateScale(12)} color="#9CA3AF" />
              <CustomText text={lecture.topic} textStyle={styles.topicText} />
            </View>
          )}
        </View>
      </Animated.View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={moderateScale(24)} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <CustomText text={subjectName} textStyle={styles.headerTitle} />
          {subjectCode && (
            <View style={[styles.codeBadge, { backgroundColor: primaryColor + '20' }]}>
              <CustomText text={subjectCode} textStyle={[styles.codeText, { color: primaryColor }]} />
            </View>
          )}
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Offline Banner */}
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Icon name="wifi-off" size={moderateScale(14)} color="#B91C1C" />
            <CustomText text=" Offline Mode" textStyle={styles.offlineBannerText} />
            {lastUpdated && (
              <CustomText
                text={` • Updated ${formatLastUpdated(lastUpdated)}`}
                textStyle={styles.offlineBannerText}
              />
            )}
          </View>
        )}

        {/* Stats Card */}
        <View style={[styles.statsCard, { borderColor: primaryColor + '30' }]}>
          <View style={[styles.statsHeader, { backgroundColor: primaryColor + '10' }]}>
            <Icon name="chart-arc" size={moderateScale(20)} color={primaryColor} />
            <CustomText text=" Attendance Overview" textStyle={[styles.statsTitle, { color: primaryColor }]} />
          </View>

          <View style={styles.statsBody}>
            {/* Circular Progress */}
            <View style={styles.circularContainer}>
              <View style={[styles.circularOuter, { borderColor: percentageColor + '30' }]}>
                <View style={[styles.circularInner, { borderColor: percentageColor }]}>
                  <CustomText
                    text={`${stats.percentage}%`}
                    textStyle={[styles.percentageText, { color: percentageColor }]}
                  />
                </View>
              </View>
              <CustomText
                text={stats.percentage >= 75 ? 'Good Standing' : stats.percentage >= 50 ? 'Needs Improvement' : 'Low Attendance'}
                textStyle={[styles.standingText, { color: percentageColor }]}
              />
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <View style={[styles.statIconContainer, { backgroundColor: '#E0F2FE' }]}>
                  <Icon name="book-multiple" size={moderateScale(16)} color="#0284C7" />
                </View>
                <CustomText text={`${stats.total}`} textStyle={styles.statValue} />
                <CustomText text="Total" textStyle={styles.statLabel} />
              </View>

              <View style={styles.statItem}>
                <View style={[styles.statIconContainer, { backgroundColor: '#D1FAE5' }]}>
                  <Icon name="check-circle" size={moderateScale(16)} color="#10B981" />
                </View>
                <CustomText text={`${stats.present}`} textStyle={styles.statValue} />
                <CustomText text="Present" textStyle={styles.statLabel} />
              </View>

              <View style={styles.statItem}>
                <View style={[styles.statIconContainer, { backgroundColor: '#FEE2E2' }]}>
                  <Icon name="close-circle" size={moderateScale(16)} color="#EF4444" />
                </View>
                <CustomText text={`${stats.absent}`} textStyle={styles.statValue} />
                <CustomText text="Absent" textStyle={styles.statLabel} />
              </View>

              <View style={styles.statItem}>
                <View style={[styles.statIconContainer, { backgroundColor: '#FEF3C7' }]}>
                  <Icon name="clock-alert" size={moderateScale(16)} color="#F59E0B" />
                </View>
                <CustomText text={`${stats.late}`} textStyle={styles.statValue} />
                <CustomText text="Late" textStyle={styles.statLabel} />
              </View>
            </View>
          </View>
        </View>

        {/* Lectures Section */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Icon name="calendar-month" size={moderateScale(18)} color="#0077B6" />
            <CustomText text=" Lecture History" textStyle={styles.sectionTitle} />
          </View>
          <CustomText text={`${lectures.length} lectures`} textStyle={styles.sectionCount} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <CustomText text="Loading..." textStyle={styles.loadingText} />
          </View>
        ) : lectures.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="calendar-blank" size={moderateScale(48)} color="#9CA3AF" />
            <CustomText text="No lectures yet" textStyle={styles.emptyTitle} />
            <CustomText
              text="Lecture attendance will appear here once recorded"
              textStyle={styles.emptySubtitle}
            />
          </View>
        ) : (
          <View style={styles.lecturesList}>
            {lectures.map(renderLectureItem)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

export default StudentSubjectAttendance

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(12),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: moderateScale(8),
    marginLeft: moderateScale(-8),
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: '#1F2937',
  },
  codeBadge: {
    marginTop: moderateScale(4),
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(2),
    borderRadius: moderateScale(4),
  },
  codeText: {
    fontSize: moderateScale(10),
    fontWeight: '600',
  },
  placeholder: {
    width: moderateScale(40),
  },
  scrollContent: {
    paddingBottom: moderateScale(100),
  },
  offlineBanner: {
    backgroundColor: '#FEE2E2',
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(16),
    marginHorizontal: moderateScale(20),
    marginTop: moderateScale(8),
    borderRadius: moderateScale(8),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBannerText: {
    color: '#B91C1C',
    fontSize: moderateScale(12),
    fontWeight: '500',
  },
  statsCard: {
    margin: moderateScale(16),
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(16),
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(12),
  },
  statsTitle: {
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  statsBody: {
    padding: moderateScale(16),
  },
  circularContainer: {
    alignItems: 'center',
    marginBottom: moderateScale(20),
  },
  circularOuter: {
    width: moderateScale(100),
    height: moderateScale(100),
    borderRadius: moderateScale(50),
    borderWidth: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: moderateScale(8),
  },
  circularInner: {
    width: moderateScale(80),
    height: moderateScale(80),
    borderRadius: moderateScale(40),
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  percentageText: {
    fontSize: moderateScale(20),
    fontWeight: '700',
  },
  standingText: {
    fontSize: moderateScale(12),
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statIconContainer: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: moderateScale(6),
  },
  statValue: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: moderateScale(10),
    color: '#6B7280',
    marginTop: moderateScale(2),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(20),
    marginBottom: moderateScale(12),
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: '#1F2937',
  },
  sectionCount: {
    fontSize: moderateScale(12),
    color: '#6B7280',
  },
  loadingContainer: {
    padding: moderateScale(40),
    alignItems: 'center',
  },
  loadingText: {
    fontSize: moderateScale(14),
    color: '#6B7280',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: moderateScale(40),
    paddingHorizontal: moderateScale(20),
  },
  emptyTitle: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: '#6B7280',
    marginTop: moderateScale(12),
  },
  emptySubtitle: {
    fontSize: moderateScale(12),
    color: '#9CA3AF',
    marginTop: moderateScale(4),
    textAlign: 'center',
  },
  lecturesList: {
    paddingHorizontal: moderateScale(16),
  },
  lectureCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(12),
    marginBottom: moderateScale(10),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statusIndicator: {
    width: moderateScale(4),
  },
  lectureContent: {
    flex: 1,
    padding: moderateScale(14),
  },
  lectureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: moderateScale(13),
    color: '#374151',
    marginLeft: moderateScale(6),
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(12),
  },
  statusText: {
    fontSize: moderateScale(11),
    fontWeight: '600',
    marginLeft: moderateScale(4),
  },
  topicContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: moderateScale(8),
    paddingTop: moderateScale(8),
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  topicText: {
    fontSize: moderateScale(12),
    color: '#6B7280',
    marginLeft: moderateScale(6),
    flex: 1,
  },
})
