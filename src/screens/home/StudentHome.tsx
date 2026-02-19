import React, { useState, useEffect, useCallback } from 'react'
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Animated,
  Alert,
  Dimensions,
} from 'react-native'
import { moderateScale } from 'react-native-size-matters'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import CustomText from '../../components/text'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useOffline } from '../../contexts/OfflineContext'
import NotificationBell from '../../components/NotificationBell'
import { MMKV } from 'react-native-mmkv'

const storage = new MMKV()
const STUDENT_CACHE_KEY = 'AttendEase.studentHome'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const isSmallScreen = SCREEN_WIDTH < 360
const isMediumScreen = SCREEN_WIDTH >= 360 && SCREEN_WIDTH < 400

interface Subject {
  id: string
  name: string
  code?: string
  color?: string
  teacher_email: string
}

interface AttendanceStats {
  subjectId: string
  totalLectures: number
  attended: number
  percentage: number
}

const StudentHome = () => {
  const navigation = useNavigation<any>()
  const { user, userProfile, handleAuthError, isDualRole, activeRole } = useAuth()
  const { isOnline } = useOffline()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [attendanceStats, setAttendanceStats] = useState<Map<string, AttendanceStats>>(new Map())
  const [refreshing, setRefreshing] = useState(false)
  const [className, setClassName] = useState('')
  const [studentId, setStudentId] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [hasMissingRecords, setHasMissingRecords] = useState(false)
  const [isRemovedFromClass, setIsRemovedFromClass] = useState(false)
  const [pendingEnrollment, setPendingEnrollment] = useState<{ className: string } | null>(null)
  const fadeAnim = useState(new Animated.Value(0))[0]

  // Watch for when user becomes dual role and needs to select role
  useEffect(() => {
    if (isDualRole && !activeRole) {
      console.log('StudentHome: User is now dual role, redirecting to RoleSelection')
      navigation.replace('RoleSelection')
    }
  }, [isDualRole, activeRole, navigation])

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
      fetchData()
    }
  }, [isOnline])

  // Refetch data when screen comes into focus (e.g., after leaving a class)
  useFocusEffect(
    useCallback(() => {
      if (isOnline) {
        fetchData()
      }
    }, [isOnline, fetchData])
  )

  // Watch for student record deletion
  useEffect(() => {
    const activeClassId = userProfile?.active_class_id || userProfile?.class_id
    if (!activeClassId || !user || !isOnline) return

    // Set up real-time subscription to detect when student record is deleted
    const subscription = supabase
      .channel('student_deletion')
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'students',
          filter: `email=eq.${userProfile.email}`,
        },
        () => {
          console.log('Student record deleted, refreshing data')
          fetchData()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [userProfile?.active_class_id, userProfile?.class_id, userProfile?.email, user, isOnline, fetchData])

  const loadCachedData = () => {
    try {
      const cached = storage.getString(STUDENT_CACHE_KEY)
      if (cached) {
        const data = JSON.parse(cached)
        setSubjects(data.subjects || [])
        setClassName(data.className || '')
        setLastUpdated(new Date(data.lastUpdated))
        
        const statsMap = new Map<string, AttendanceStats>()
        Object.entries(data.attendanceStats || {}).forEach(([key, value]) => {
          statsMap.set(key, value as AttendanceStats)
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
      storage.set(STUDENT_CACHE_KEY, JSON.stringify({
        subjects,
        attendanceStats: statsObj,
        className,
        lastUpdated: Date.now(),
      }))
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Error caching data:', error)
    }
  }

  const fetchData = useCallback(async () => {
    if (!user) return

    // Get active class ID (supports multi-class enrollment)
    const activeClassId = userProfile?.active_class_id || userProfile?.class_id
    
    // Check if user has an active class
    if (!activeClassId) {
      // Check if there's a pending enrollment
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select(`
          *,
          classes (
            name
          )
        `)
        .eq('student_id', user.id)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false })
        .limit(1)
        .single()

      if (enrollment) {
        setPendingEnrollment({ className: enrollment.classes?.name || 'Unknown Class' })
      } else {
        setPendingEnrollment(null)
      }
      
      setIsRemovedFromClass(true)
      setClassName('')
      setSubjects([])
      setAttendanceStats(new Map())
      return
    }

    try {
      // Fetch class info for active class
      const { data: classData } = await supabase
        .from('classes')
        .select('name')
        .eq('id', activeClassId)
        .single()

      if (classData) setClassName(classData.name)

      // Find student record for active class
      const { data: studentData } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', activeClassId)
        .or(`email.eq.${userProfile.email},roll_number.eq.${userProfile.roll_number}`)
        .single()

      if (!studentData) {
        // Student record not found - student was removed from this class
        setIsRemovedFromClass(true)
        setClassName('')
        setSubjects([])
        setAttendanceStats(new Map())
        return
      }

      setIsRemovedFromClass(false)
      setStudentId(studentData.id)

      // Fetch only subjects the student is enrolled in
      const { data: enrolledSubjects, error: enrollmentError } = await supabase
        .from('student_subjects')
        .select('subject_id')
        .eq('student_id', studentData.id)

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
        .order('name')

      if (subjectsError) {
        handleAuthError(subjectsError)
        return
      }
      setSubjects(subjectsData || [])

      if (studentData) {
        await calculateAttendance(subjectsData || [], studentData.id, classData?.name || '')
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      handleAuthError(error)
    }
  }, [userProfile, user, handleAuthError])

  const calculateAttendance = async (subjects: Subject[], studentId: string, className: string) => {
    const statsMap = new Map<string, AttendanceStats>()
    let missingRecords = false

    for (const subject of subjects) {
      try {
        const { data: lectures } = await supabase
          .from('lectures')
          .select('id')
          .eq('subject_id', subject.id)

        const totalLectures = lectures?.length || 0

        if (totalLectures === 0) {
          statsMap.set(subject.id, { subjectId: subject.id, totalLectures: 0, attended: 0, percentage: 0 })
          continue
        }

        const lectureIds = lectures?.map(l => l.id) || []
        
        // Get all attendance records (both present and absent)
        const { data: allAttendanceData } = await supabase
          .from('attendance')
          .select('*')
          .eq('student_id', studentId)
          .in('lecture_id', lectureIds)

        const { data: presentData } = await supabase
          .from('attendance')
          .select('*')
          .eq('student_id', studentId)
          .in('lecture_id', lectureIds)
          .eq('status', 'present')

        const totalRecords = allAttendanceData?.length || 0
        const attended = presentData?.length || 0
        const percentage = totalLectures > 0 ? Math.round((attended / totalLectures) * 100) : 0

        // Check if there are missing records (lectures without attendance)
        if (totalRecords < totalLectures) {
          missingRecords = true
        }

        statsMap.set(subject.id, { subjectId: subject.id, totalLectures, attended, percentage })
      } catch (error) {
        console.error('Error calculating attendance:', error)
      }
    }

    setHasMissingRecords(missingRecords)
    setAttendanceStats(statsMap)
    cacheData(subjects, statsMap, className)
  }

  const onRefresh = async () => {
    if (!isOnline) return
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 75) return '#10B981'
    if (percentage >= 50) return '#F59E0B'
    return '#EF4444'
  }

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
  
  // Check if there are any lectures marked
  const totalLecturesAcrossSubjects = Array.from(attendanceStats.values()).reduce(
    (sum, stats) => sum + stats.totalLectures, 
    0
  )

  const handleSubjectPress = (subject: Subject) => {
    navigation.navigate('StudentSubjectAttendance', {
      subjectId: subject.id,
      subjectName: subject.name,
      subjectCode: subject.code,
      subjectColor: subject.color,
    })
  }

  const renderSubjectCard = ({ item, index }: { item: Subject; index: number }) => {
    const stats = attendanceStats.get(item.id)
    const percentage = stats?.percentage || 0
    const color = getAttendanceColor(percentage)
    const subjectColor = item.color || '#0077B6'

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleSubjectPress(item)}
      >
        <Animated.View style={[styles.subjectCard, { opacity: fadeAnim }]}>
          <View style={[styles.subjectColorBar, { backgroundColor: subjectColor }]} />
          <View style={styles.subjectContent}>
            <View style={styles.subjectHeader}>
              <View style={styles.subjectInfo}>
                <CustomText text={item.name} textStyle={styles.subjectName} />
                {item.code && (
                  <View style={styles.codeBadge}>
                    <CustomText text={item.code} textStyle={styles.codeText} />
                  </View>
                )}
              </View>
              <View style={[styles.percentageBadge, { backgroundColor: color + '20' }]}>
                <CustomText text={`${percentage}%`} textStyle={[styles.percentageText, { color }]} />
              </View>
            </View>

            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: color }]} />
              </View>
            </View>

            <View style={styles.subjectFooter}>
              <CustomText 
                text={`${stats?.attended || 0}/${stats?.totalLectures || 0} lectures`} 
                textStyle={styles.lectureCount} 
              />
              <View style={styles.subjectFooterRight}>
                <View style={[styles.statusDot, { backgroundColor: color }]} />
                <Icon name="chevron-right" size={moderateScale(16)} color="#9CA3AF" />
              </View>
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
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
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <CustomText text={`Hi, ${userProfile?.name?.split(' ')[0] || 'Student'}!`} textStyle={styles.greeting} />
            <CustomText text={isRemovedFromClass ? 'No Class' : (className || 'Your Class')} textStyle={[styles.className, isRemovedFromClass && { color: '#EF4444' }]} />
          </View>
          <NotificationBell />
        </View>

        {/* Overall Stats Card */}
        <View style={styles.overallCard}>
          {isRemovedFromClass ? (
            <View style={styles.overallEmpty}>
              {pendingEnrollment ? (
                <>
                  <Icon name="clock-outline" size={moderateScale(isSmallScreen ? 32 : 40)} color="#F59E0B" />
                  <CustomText text="Enrollment Request Pending" textStyle={styles.overallEmptyTitle} />
                  <CustomText 
                    text={`Your request for enrollment in ${pendingEnrollment.className} has been sent and waiting for approval.`}
                    textStyle={styles.overallEmptySubtitle} 
                  />
                  <TouchableOpacity 
                    style={[styles.goToProfileButton, { backgroundColor: '#F59E0B' }]}
                    onPress={() => navigation.navigate('EnrollmentPending')}
                  >
                    <Icon name="information" size={moderateScale(16)} color="#FFFFFF" />
                    <CustomText text=" View Status" textStyle={styles.goToProfileButtonText} />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Icon name="account-remove-outline" size={moderateScale(isSmallScreen ? 32 : 40)} color="#EF4444" />
                  <CustomText text="Not Enrolled in Any Class" textStyle={styles.overallEmptyTitle} />
                  <CustomText 
                    text="You are not enrolled in any class. Go to Profile and select your class to continue." 
                    textStyle={styles.overallEmptySubtitle} 
                  />
                  <TouchableOpacity 
                    style={styles.goToProfileButton}
                    onPress={() => navigation.navigate('StudentProfile')}
                  >
                    <Icon name="account-cog" size={moderateScale(16)} color="#FFFFFF" />
                    <CustomText text=" Go to Profile" textStyle={styles.goToProfileButtonText} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : subjects.length === 0 ? (
            <View style={styles.overallEmpty}>
              <Icon name="book-alert-outline" size={moderateScale(isSmallScreen ? 32 : 40)} color="#6B7280" />
              <CustomText text="No Subjects Enrolled" textStyle={styles.overallEmptyTitle} />
              <CustomText 
                text="You are not enrolled in any subjects yet. Contact your admin to get enrolled." 
                textStyle={styles.overallEmptySubtitle} 
              />
            </View>
          ) : (
            <>
              <View style={styles.overallLeft}>
                <CustomText text="Overall Attendance" textStyle={styles.overallLabel} />
                <CustomText text={`${subjects.length} ${isSmallScreen ? 'Subj.' : 'Subjects'}`} textStyle={styles.subjectCount} />
                
                <View style={[styles.statusBadge, { backgroundColor: overallColor + '20' }]}>
                  <View style={styles.statusContent}>
                    <Icon 
                      name={totalLecturesAcrossSubjects === 0 ? 'information-outline' : overallPercentage >= 75 ? 'check-circle' : overallPercentage >= 50 ? 'alert-circle' : 'close-circle'} 
                      size={moderateScale(isSmallScreen ? 8 : 10)} 
                      color={overallColor} 
                    />
                    <CustomText
                      text={
                        totalLecturesAcrossSubjects === 0 ? (isSmallScreen ? ' Not marked' : ' Attendance not marked yet') :
                        overallPercentage >= 75 ? ' Good Standing' :
                        overallPercentage >= 50 ? (isSmallScreen ? ' Improve' : ' Needs Improvement') :
                        ' Low Attendance'
                      }
                      textStyle={[styles.statusText, { color: overallColor }]}
                    />
                  </View>
                </View>
              </View>
              
              <View style={styles.overallRight}>
                <View style={[styles.overallCircle, { borderColor: overallColor }]}>
                  <CustomText text={`${overallPercentage}%`} textStyle={[styles.overallPercentage, { color: overallColor }]} />
                </View>
              </View>
            </>
          )}
        </View>

        {/* Missing Records Warning */}
        {hasMissingRecords && subjects.length > 0 && (
          <View style={styles.warningCard}>
            <Icon name="alert-circle-outline" size={moderateScale(20)} color="#F59E0B" />
            <View style={styles.warningContent}>
              <CustomText text="Attendance Records Missing" textStyle={styles.warningTitle} />
              <CustomText 
                text="You don't have your previous attendance record updated. Ask your CR/GR for update." 
                textStyle={styles.warningText} 
              />
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('StudentStats')}
          >
            <Icon name="chart-bar" size={moderateScale(24)} color="#0077B6" />
            <CustomText text="View Stats" textStyle={styles.actionLabel} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('StudentStanding')}
          >
            <Icon name="trophy" size={moderateScale(24)} color="#00B4D8" />
            <CustomText text="Standing" textStyle={styles.actionLabel} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('StudentNotepad')}
          >
            <Icon name="notebook" size={moderateScale(24)} color="#48CAE4" />
            <CustomText text="Notes" textStyle={styles.actionLabel} />
          </TouchableOpacity>
        </View>

        {/* Subjects Section */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Icon name="book-open-variant" size={moderateScale(18)} color="#0077B6" />
            <CustomText text=" Your Subjects" textStyle={styles.sectionTitle} />
          </View>
          <CustomText text={`${subjects.length}`} textStyle={styles.sectionCount} />
        </View>

        {subjects.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="book-open-page-variant" size={moderateScale(48)} color="#9CA3AF" />
            <CustomText text="No subjects yet" textStyle={styles.emptyTitle} />
            <CustomText text="Subjects will appear here once added by your admin" textStyle={styles.emptySubtitle} />
          </View>
        ) : (
          <View style={styles.subjectsList}>
            {subjects.map((subject, index) => (
              <View key={subject.id}>
                {renderSubjectCard({ item: subject, index })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

export default StudentHome

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingBottom: moderateScale(100),
  },
  offlineBanner: {
    backgroundColor: '#FEE2E2',
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(isSmallScreen ? 12 : 16),
    marginHorizontal: moderateScale(isSmallScreen ? 12 : 20),
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
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(isSmallScreen ? 12 : 20),
    paddingTop: moderateScale(isSmallScreen ? 12 : 16),
    paddingBottom: moderateScale(12),
  },
  headerLeft: {
    flex: 1,
    marginRight: moderateScale(8),
  },
  greeting: {
    fontSize: moderateScale(isSmallScreen ? 20 : 24),
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: moderateScale(4),
  },
  className: {
    fontSize: moderateScale(isSmallScreen ? 12 : 14),
    color: '#6B7280',
  },
  overallCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: moderateScale(isSmallScreen ? 12 : 20),
    marginTop: moderateScale(8),
    padding: moderateScale(isSmallScreen ? 14 : 20),
    borderRadius: moderateScale(isSmallScreen ? 16 : 20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    minHeight: moderateScale(120),
  },
  overallLeft: {
    flex: 1,
    marginRight: moderateScale(isSmallScreen ? 8 : 12),
  },
  overallLabel: {
    fontSize: moderateScale(isSmallScreen ? 15 : 18),
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: moderateScale(4),
  },
  subjectCount: {
    fontSize: moderateScale(isSmallScreen ? 11 : 13),
    color: '#6B7280',
    marginBottom: moderateScale(isSmallScreen ? 8 : 12),
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: moderateScale(isSmallScreen ? 8 : 10),
    paddingVertical: moderateScale(isSmallScreen ? 4 : 6),
    borderRadius: moderateScale(12),
    maxWidth: SCREEN_WIDTH * 0.5,
  },
  statusText: {
    fontSize: moderateScale(isSmallScreen ? 8 : 10),
    fontWeight: '600',
    flexShrink: 1,
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  overallRight: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  overallCircle: {
    width: moderateScale(isSmallScreen ? 65 : 80),
    height: moderateScale(isSmallScreen ? 65 : 80),
    borderRadius: moderateScale(isSmallScreen ? 32.5 : 40),
    borderWidth: isSmallScreen ? 3 : 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  overallPercentage: {
    fontSize: moderateScale(isSmallScreen ? 16 : 20),
    fontWeight: '700',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: moderateScale(isSmallScreen ? 12 : 20),
    marginTop: moderateScale(isSmallScreen ? 16 : 20),
    gap: moderateScale(isSmallScreen ? 8 : 12),
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(isSmallScreen ? 12 : 16),
    padding: moderateScale(isSmallScreen ? 12 : 16),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    minHeight: moderateScale(isSmallScreen ? 70 : 80),
  },
  actionIcon: {
    marginBottom: moderateScale(8),
  },
  actionLabel: {
    fontSize: moderateScale(isSmallScreen ? 10 : 12),
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(isSmallScreen ? 12 : 20),
    paddingTop: moderateScale(isSmallScreen ? 20 : 24),
    paddingBottom: moderateScale(12),
  },
  sectionTitle: {
    fontSize: moderateScale(isSmallScreen ? 16 : 18),
    fontWeight: '700',
    color: '#1A1A2E',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionCount: {
    fontSize: moderateScale(isSmallScreen ? 12 : 14),
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: moderateScale(isSmallScreen ? 8 : 10),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(10),
    minWidth: moderateScale(28),
    textAlign: 'center',
  },
  subjectsList: {
    paddingHorizontal: moderateScale(isSmallScreen ? 12 : 20),
  },
  subjectCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(isSmallScreen ? 12 : 16),
    marginBottom: moderateScale(12),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  subjectColorBar: {
    width: moderateScale(4),
  },
  subjectContent: {
    flex: 1,
    padding: moderateScale(isSmallScreen ? 12 : 16),
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: moderateScale(12),
  },
  subjectInfo: {
    flex: 1,
    marginRight: moderateScale(8),
  },
  subjectName: {
    fontSize: moderateScale(isSmallScreen ? 14 : 16),
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: moderateScale(4),
    flexWrap: 'wrap',
  },
  codeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(2),
    borderRadius: moderateScale(6),
  },
  codeText: {
    fontSize: moderateScale(isSmallScreen ? 10 : 11),
    fontWeight: '600',
    color: '#6B7280',
  },
  percentageBadge: {
    paddingHorizontal: moderateScale(isSmallScreen ? 10 : 12),
    paddingVertical: moderateScale(isSmallScreen ? 5 : 6),
    borderRadius: moderateScale(12),
  },
  percentageText: {
    fontSize: moderateScale(isSmallScreen ? 14 : 16),
    fontWeight: '700',
  },
  progressContainer: {
    marginBottom: moderateScale(12),
  },
  progressBar: {
    height: moderateScale(isSmallScreen ? 5 : 6),
    backgroundColor: '#E5E7EB',
    borderRadius: moderateScale(3),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: moderateScale(3),
  },
  subjectFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subjectFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(6),
  },
  lectureCount: {
    fontSize: moderateScale(isSmallScreen ? 11 : 12),
    color: '#6B7280',
  },
  statusDot: {
    width: moderateScale(isSmallScreen ? 7 : 8),
    height: moderateScale(isSmallScreen ? 7 : 8),
    borderRadius: moderateScale(4),
  },
  overallEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(isSmallScreen ? 16 : 24),
    paddingHorizontal: moderateScale(isSmallScreen ? 8 : 12),
  },
  overallEmptyTitle: {
    fontSize: moderateScale(isSmallScreen ? 14 : 16),
    fontWeight: '700',
    color: '#1A1A2E',
    marginTop: moderateScale(12),
    marginBottom: moderateScale(4),
    textAlign: 'center',
  },
  overallEmptySubtitle: {
    fontSize: moderateScale(isSmallScreen ? 11 : 12),
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: moderateScale(isSmallScreen ? 8 : 12),
    lineHeight: moderateScale(isSmallScreen ? 16 : 18),
  },
  goToProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0077B6',
    paddingHorizontal: moderateScale(isSmallScreen ? 12 : 16),
    paddingVertical: moderateScale(isSmallScreen ? 8 : 10),
    borderRadius: moderateScale(20),
    marginTop: moderateScale(isSmallScreen ? 12 : 16),
  },
  goToProfileButtonText: {
    fontSize: moderateScale(isSmallScreen ? 12 : 13),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    marginHorizontal: moderateScale(isSmallScreen ? 12 : 20),
    marginTop: moderateScale(12),
    padding: moderateScale(isSmallScreen ? 12 : 16),
    borderRadius: moderateScale(isSmallScreen ? 12 : 16),
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  warningContent: {
    flex: 1,
    marginLeft: moderateScale(12),
  },
  warningTitle: {
    fontSize: moderateScale(isSmallScreen ? 12 : 14),
    fontWeight: '700',
    color: '#92400E',
    marginBottom: moderateScale(4),
  },
  warningText: {
    fontSize: moderateScale(isSmallScreen ? 11 : 12),
    color: '#92400E',
    lineHeight: moderateScale(isSmallScreen ? 15 : 16),
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: moderateScale(isSmallScreen ? 32 : 48),
    paddingHorizontal: moderateScale(isSmallScreen ? 24 : 40),
  },
  emptyTitle: {
    fontSize: moderateScale(isSmallScreen ? 16 : 18),
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: moderateScale(4),
    marginTop: moderateScale(12),
  },
  emptySubtitle: {
    fontSize: moderateScale(isSmallScreen ? 12 : 14),
    color: '#6B7280',
    textAlign: 'center',
  },
})
