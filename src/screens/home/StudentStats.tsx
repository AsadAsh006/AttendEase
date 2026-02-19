import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { moderateScale } from 'react-native-size-matters'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { BarChart, PieChart, LineChart } from 'react-native-gifted-charts'
import LinearGradient from 'react-native-linear-gradient'
import CustomText from '../../components/text'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useOffline } from '../../contexts/OfflineContext'
import { MMKV } from 'react-native-mmkv'

const storage = new MMKV()
const STATS_CACHE_KEY = 'AttendEase.studentStats'
const { width: SCREEN_WIDTH } = Dimensions.get('window')
const MAX_ALLOWED_ABSENTS = 4

interface Subject {
  id: string
  name: string
  code?: string
  color?: string
}

interface SubjectStats {
  subjectId: string
  subjectName: string
  subjectCode?: string
  subjectColor: string
  totalLectures: number
  attended: number
  absents: number
  percentage: number
  remainingAbsents: number
  isAtRisk: boolean
}

interface WeeklyData {
  week: string
  attended: number
  total: number
  percentage: number
}

interface MonthlyData {
  month: string
  attended: number
  total: number
  percentage: number
}

interface DailyAttendance {
  date: string
  attended: boolean
  subjectName: string
}

const StudentStats = () => {
  const navigation = useNavigation<any>()
  const { user, userProfile, handleAuthError } = useAuth()
  const { isOnline, cachedData, lastSyncTime } = useOffline()
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [subjectStats, setSubjectStats] = useState<SubjectStats[]>([])
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [recentAttendance, setRecentAttendance] = useState<DailyAttendance[]>([])
  const [selectedTab, setSelectedTab] = useState<'weekly' | 'monthly'>('weekly')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const fadeAnim = useState(new Animated.Value(0))[0]

  // Animated values for progress bars
  const barAnimations = useState(() => 
    Array(10).fill(0).map(() => new Animated.Value(0))
  )[0]

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
      setIsOfflineMode(false)
      fetchAllData()
    } else {
      // Use cached data from OfflineContext when offline
      setIsOfflineMode(true)
      loadFromOfflineContext()
    }
  }, [isOnline, cachedData])

  // Refetch when active class changes
  useEffect(() => {
    if (isOnline && (userProfile?.active_class_id || userProfile?.class_id)) {
      fetchAllData()
    }
  }, [userProfile?.active_class_id, userProfile?.class_id])

  // Refetch data when screen comes into focus (e.g., after leaving a class)
  useFocusEffect(
    useCallback(() => {
      if (isOnline && (userProfile?.active_class_id || userProfile?.class_id)) {
        fetchAllData()
      }
    }, [isOnline, userProfile?.active_class_id, userProfile?.class_id, fetchAllData])
  )

  useEffect(() => {
    if (subjectStats.length > 0) {
      barAnimations.forEach((anim, index) => {
        if (index < subjectStats.length) {
          Animated.timing(anim, {
            toValue: subjectStats[index].percentage / 100,
            duration: 800,
            delay: index * 100,
            useNativeDriver: false,
          }).start()
        }
      })
    }
  }, [subjectStats])

  const loadCachedData = () => {
    try {
      const cached = storage.getString(STATS_CACHE_KEY)
      if (cached) {
        const data = JSON.parse(cached)
        setSubjectStats(data.subjectStats || [])
        setWeeklyData(data.weeklyData || [])
        setMonthlyData(data.monthlyData || [])
        setRecentAttendance(data.recentAttendance || [])
        setLoading(false)
      }
    } catch (error) {
      console.error('Error loading cached stats:', error)
    }
  }

  // Load and calculate stats from OfflineContext cached data
  const loadFromOfflineContext = useCallback(() => {
    if (!cachedData || !userProfile) {
      setLoading(false)
      return
    }

    try {
      const { subjects, students, attendance } = cachedData

      // Find the student
      const student = students.find(
        (s: any) => s.email === userProfile.email || s.roll_number === userProfile.roll_number
      )

      if (!student) {
        setLoading(false)
        return
      }

      setStudentId(student.id)

      // Calculate subject stats from cached attendance
      const stats: SubjectStats[] = subjects.map((subject: any) => {
        const subjectAttendance = attendance.filter((a: any) => a.subject_id === subject.id)
        const totalLectures = subjectAttendance.length
        const attended = subjectAttendance.filter(
          (a: any) => a.attendance && a.attendance[student.id] === true
        ).length
        const absents = totalLectures - attended
        const percentage = totalLectures > 0 ? Math.round((attended / totalLectures) * 100) : 0
        const remainingAbsents = Math.max(0, MAX_ALLOWED_ABSENTS - absents)
        const isAtRisk = absents >= MAX_ALLOWED_ABSENTS

        return {
          subjectId: subject.id,
          subjectName: subject.name,
          subjectCode: subject.code,
          subjectColor: subject.color || '#0077B6',
          totalLectures,
          attended,
          absents,
          percentage,
          remainingAbsents,
          isAtRisk,
        }
      })

      setSubjectStats(stats)

      // Calculate weekly data from cached attendance
      const weeks: WeeklyData[] = []
      const now = new Date()

      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - (i * 7) - now.getDay())
        weekStart.setHours(0, 0, 0, 0)

        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)
        weekEnd.setHours(23, 59, 59, 999)

        const weekLectures = attendance.filter((a: any) => {
          const lectureDate = new Date(a.date)
          return lectureDate >= weekStart && lectureDate <= weekEnd
        })

        const total = weekLectures.length
        const attendedCount = weekLectures.filter(
          (a: any) => a.attendance && a.attendance[student.id] === true
        ).length
        const percentage = total > 0 ? Math.round((attendedCount / total) * 100) : 0

        weeks.push({
          week: `W${4 - i}`,
          attended: attendedCount,
          total,
          percentage,
        })
      }

      setWeeklyData(weeks)

      // Calculate monthly data from cached attendance
      const months: MonthlyData[] = []
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)

        const monthLectures = attendance.filter((a: any) => {
          const lectureDate = new Date(a.date)
          return lectureDate >= monthStart && lectureDate <= monthEnd
        })

        const total = monthLectures.length
        const attendedCount = monthLectures.filter(
          (a: any) => a.attendance && a.attendance[student.id] === true
        ).length
        const percentage = total > 0 ? Math.round((attendedCount / total) * 100) : 0

        months.push({
          month: monthNames[monthDate.getMonth()],
          attended: attendedCount,
          total,
          percentage,
        })
      }

      setMonthlyData(months)

      // Calculate recent attendance from cached data
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const recentLectures = attendance
        .filter((a: any) => new Date(a.date) >= sevenDaysAgo)
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10)

      const recent: DailyAttendance[] = recentLectures.map((lecture: any) => {
        const subject = subjects.find((s: any) => s.id === lecture.subject_id)
        return {
          date: lecture.date,
          attended: lecture.attendance && lecture.attendance[student.id] === true,
          subjectName: subject?.name || 'Unknown',
        }
      })

      setRecentAttendance(recent)
      setLoading(false)
    } catch (error) {
      console.error('Error loading from offline context:', error)
      setLoading(false)
    }
  }, [cachedData, userProfile])

  const cacheData = (
    subjectStats: SubjectStats[],
    weeklyData: WeeklyData[],
    monthlyData: MonthlyData[],
    recentAttendance: DailyAttendance[]
  ) => {
    try {
      storage.set(STATS_CACHE_KEY, JSON.stringify({
        subjectStats,
        weeklyData,
        monthlyData,
        recentAttendance,
        lastUpdated: Date.now(),
      }))
    } catch (error) {
      console.error('Error caching stats:', error)
    }
  }

  const fetchAllData = useCallback(async () => {
    const activeClassId = userProfile?.active_class_id || userProfile?.class_id
    if (!activeClassId || !user) return

    try {
      setLoading(true)

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
        setSubjectStats([])
        setWeeklyData([])
        setMonthlyData([])
        setRecentAttendance([])
        setLoading(false)
        return
      }

      // Fetch subjects data only for enrolled subjects
      const { data: subjects, error: subjectsError } = await supabase
        .from('subjects')
        .select('*')
        .in('id', enrolledSubjectIds)
        .order('name')

      if (subjectsError) {
        handleAuthError(subjectsError)
        return
      }

      const [stats, weeks, months, recent] = await Promise.all([
        calculateSubjectStats(subjects || [], studentData.id),
        calculateWeeklyData(subjects || [], studentData.id),
        calculateMonthlyData(subjects || [], studentData.id),
        fetchRecentAttendance(subjects || [], studentData.id),
      ])

      // Cache the fetched data for offline use
      if (stats && weeks && months && recent) {
        cacheData(stats, weeks, months, recent)
      }

      setLoading(false)
    } catch (error) {
      console.error('Error fetching stats:', error)
      handleAuthError(error)
      setLoading(false)
    }
  }, [userProfile, user, handleAuthError])

  const calculateSubjectStats = async (subjects: Subject[], studentId: string) => {
    const stats: SubjectStats[] = []

    for (const subject of subjects) {
      try {
        const { data: lectures } = await supabase
          .from('lectures')
          .select('id')
          .eq('subject_id', subject.id)

        const totalLectures = lectures?.length || 0

        if (totalLectures === 0) {
          stats.push({
            subjectId: subject.id,
            subjectName: subject.name,
            subjectCode: subject.code,
            subjectColor: subject.color || '#0077B6',
            totalLectures: 0,
            attended: 0,
            absents: 0,
            percentage: 0,
            remainingAbsents: MAX_ALLOWED_ABSENTS,
            isAtRisk: false,
          })
          continue
        }

        const lectureIds = lectures?.map(l => l.id) || []
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('*')
          .eq('student_id', studentId)
          .in('lecture_id', lectureIds)
          .eq('status', 'present')

        const attended = attendanceData?.length || 0
        const absents = totalLectures - attended
        const percentage = totalLectures > 0 ? Math.round((attended / totalLectures) * 100) : 0
        const remainingAbsents = Math.max(0, MAX_ALLOWED_ABSENTS - absents)
        const isAtRisk = absents >= MAX_ALLOWED_ABSENTS

        stats.push({
          subjectId: subject.id,
          subjectName: subject.name,
          subjectCode: subject.code,
          subjectColor: subject.color || '#0077B6',
          totalLectures,
          attended,
          absents,
          percentage,
          remainingAbsents,
          isAtRisk,
        })
      } catch (error) {
        console.error('Error calculating subject stats:', error)
      }
    }

    setSubjectStats(stats)
    return stats
  }

  const calculateWeeklyData = async (subjects: Subject[], studentId: string) => {
    const weeks: WeeklyData[] = []
    const now = new Date()

    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - (i * 7) - now.getDay())
      weekStart.setHours(0, 0, 0, 0)

      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)

      try {
        const { data: lectures } = await supabase
          .from('lectures')
          .select('id')
          .in('subject_id', subjects.map(s => s.id))
          .gte('date', weekStart.toISOString().split('T')[0])
          .lte('date', weekEnd.toISOString().split('T')[0])

        const total = lectures?.length || 0

        if (total > 0) {
          const { data: attendance } = await supabase
            .from('attendance')
            .select('*')
            .eq('student_id', studentId)
            .in('lecture_id', lectures?.map(l => l.id) || [])
            .eq('status', 'present')

          const attended = attendance?.length || 0
          const percentage = Math.round((attended / total) * 100)

          weeks.push({
            week: `W${4 - i}`,
            attended,
            total,
            percentage,
          })
        } else {
          weeks.push({
            week: `W${4 - i}`,
            attended: 0,
            total: 0,
            percentage: 0,
          })
        }
      } catch (error) {
        console.error('Error calculating weekly data:', error)
      }
    }

    setWeeklyData(weeks)
    return weeks
  }

  const calculateMonthlyData = async (subjects: Subject[], studentId: string) => {
    const months: MonthlyData[] = []
    const now = new Date()
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)

      try {
        const { data: lectures } = await supabase
          .from('lectures')
          .select('id')
          .in('subject_id', subjects.map(s => s.id))
          .gte('date', monthStart.toISOString().split('T')[0])
          .lte('date', monthEnd.toISOString().split('T')[0])

        const total = lectures?.length || 0

        if (total > 0) {
          const { data: attendance } = await supabase
            .from('attendance')
            .select('*')
            .eq('student_id', studentId)
            .in('lecture_id', lectures?.map(l => l.id) || [])
            .eq('status', 'present')

          const attended = attendance?.length || 0
          const percentage = Math.round((attended / total) * 100)

          months.push({
            month: monthNames[monthDate.getMonth()],
            attended,
            total,
            percentage,
          })
        } else {
          months.push({
            month: monthNames[monthDate.getMonth()],
            attended: 0,
            total: 0,
            percentage: 0,
          })
        }
      } catch (error) {
        console.error('Error calculating monthly data:', error)
      }
    }

    setMonthlyData(months)
    return months
  }

  const fetchRecentAttendance = async (subjects: Subject[], studentId: string) => {
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { data: lectures } = await supabase
        .from('lectures')
        .select('id, date, subject_id')
        .in('subject_id', subjects.map(s => s.id))
        .gte('date', sevenDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false })
        .limit(10)

      if (!lectures || lectures.length === 0) {
        setRecentAttendance([])
        return []
      }

      const { data: attendance } = await supabase
        .from('attendance')
        .select('lecture_id, status')
        .eq('student_id', studentId)
        .in('lecture_id', lectures.map(l => l.id))

      const attendanceMap = new Map(attendance?.map(a => [a.lecture_id, a.status === 'present']) || [])

      const recent: DailyAttendance[] = lectures.map(lecture => {
        const subject = subjects.find(s => s.id === lecture.subject_id)
        return {
          date: lecture.date,
          attended: attendanceMap.get(lecture.id) || false,
          subjectName: subject?.name || 'Unknown',
        }
      })

      setRecentAttendance(recent)
      return recent
    } catch (error) {
      console.error('Error fetching recent attendance:', error)
      return []
    }
  }

  const onRefresh = async () => {
    if (!isOnline) return
    setRefreshing(true)
    await fetchAllData()
    setRefreshing(false)
  }

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 75) return '#10B981'
    if (percentage >= 50) return '#F59E0B'
    return '#EF4444'
  }

  const getAbsenceColor = (remaining: number) => {
    if (remaining >= 3) return '#10B981'
    if (remaining >= 1) return '#F59E0B'
    return '#EF4444'
  }

  // Calculate totals
  const totalAttended = subjectStats.reduce((sum, s) => sum + s.attended, 0)
  const totalLectures = subjectStats.reduce((sum, s) => sum + s.totalLectures, 0)
  const overallPercentage = totalLectures > 0 ? Math.round((totalAttended / totalLectures) * 100) : 0
  const totalAbsents = subjectStats.reduce((sum, s) => sum + s.absents, 0)
  const atRiskSubjects = subjectStats.filter(s => s.isAtRisk).length

  // Prepare bar chart data for weekly/monthly
  const barChartData = useMemo(() => {
    if (selectedTab === 'weekly') {
      return weeklyData.map((item) => ({
        value: item.attended,
        label: item.week,
        frontColor: getAttendanceColor(item.percentage),
        topLabelComponent: () => (
          <CustomText 
            text={`${item.percentage}%`} 
            textStyle={{ 
              fontSize: moderateScale(10), 
              color: getAttendanceColor(item.percentage),
              fontWeight: '600',
            }} 
          />
        ),
      }))
    } else {
      return monthlyData.map((item) => ({
        value: item.attended,
        label: item.month,
        frontColor: getAttendanceColor(item.percentage),
        topLabelComponent: () => (
          <CustomText 
            text={`${item.percentage}%`} 
            textStyle={{ 
              fontSize: moderateScale(10), 
              color: getAttendanceColor(item.percentage),
              fontWeight: '600',
            }} 
          />
        ),
      }))
    }
  }, [selectedTab, weeklyData, monthlyData])

  // Prepare line chart data for attendance trend
  const lineChartData = useMemo(() => {
    const data = selectedTab === 'weekly' ? weeklyData : monthlyData
    return data.map((item) => ({
      value: item.percentage,
      dataPointText: `${item.percentage}%`,
    }))
  }, [selectedTab, weeklyData, monthlyData])

  // Prepare pie chart data for overall attendance
  const pieChartData = useMemo(() => {
    if (totalLectures === 0) return []
    return [
      { value: totalAttended, color: '#10B981', text: `${overallPercentage}%` },
      { value: totalAbsents, color: '#EF4444', text: '' },
    ]
  }, [totalAttended, totalAbsents, overallPercentage, totalLectures])

  // Prepare subject-wise bar chart data
  const subjectBarChartData = useMemo(() => {
    return subjectStats.map((stat) => ({
      value: stat.percentage,
      label: stat.subjectCode || stat.subjectName.substring(0, 4),
      frontColor: stat.subjectColor,
      topLabelComponent: () => (
        <CustomText 
          text={`${stat.percentage}%`} 
          textStyle={{ 
            fontSize: moderateScale(9), 
            color: '#374151',
            fontWeight: '600',
          }} 
        />
      ),
    }))
  }, [subjectStats])

  const renderSubjectAbsenceCard = (stat: SubjectStats, index: number) => {
    const absenceColor = getAbsenceColor(stat.remainingAbsents)
    const progressWidth = barAnimations[index]?.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    }) || '0%'

    return (
      <Animated.View 
        key={stat.subjectId} 
        style={[styles.absenceCard, { opacity: fadeAnim }]}
      >
        <View style={[styles.subjectColorStrip, { backgroundColor: stat.subjectColor }]} />
        <View style={styles.absenceCardContent}>
          <View style={styles.absenceHeader}>
            <View style={styles.absenceSubjectInfo}>
              <CustomText text={stat.subjectName} textStyle={styles.absenceSubjectName} />
              {stat.subjectCode && (
                <View style={styles.codeBadge}>
                  <CustomText text={stat.subjectCode} textStyle={styles.codeText} />
                </View>
              )}
            </View>
            <View style={[styles.absenceCountBadge, { backgroundColor: absenceColor + '20' }]}>
              <CustomText 
                text={`${stat.remainingAbsents} left`} 
                textStyle={[styles.absenceCountText, { color: absenceColor }]} 
              />
            </View>
          </View>

          <View style={styles.absenceProgressContainer}>
            <View style={styles.absenceProgressBar}>
              <Animated.View 
                style={[
                  styles.absenceProgressFill, 
                  { 
                    width: progressWidth,
                    backgroundColor: stat.subjectColor
                  }
                ]} 
              />
            </View>
            <CustomText 
              text={`${stat.attended}/${stat.totalLectures}`} 
              textStyle={styles.absenceProgressText} 
            />
          </View>

          <View style={styles.absenceDetails}>
            <View style={styles.absenceDetailItem}>
              <Icon name="check-circle" size={moderateScale(14)} color="#10B981" />
              <CustomText text={` Present: ${stat.attended}`} textStyle={styles.absenceDetailText} />
            </View>
            <View style={styles.absenceDetailItem}>
              <Icon name="close-circle" size={moderateScale(14)} color="#EF4444" />
              <CustomText text={` Absent: ${stat.absents}`} textStyle={styles.absenceDetailText} />
            </View>
            <View style={styles.absenceDetailItem}>
              <Icon name="percent" size={moderateScale(14)} color="#6B7280" />
              <CustomText text={` ${stat.percentage}%`} textStyle={styles.absenceDetailText} />
            </View>
          </View>

          {stat.isAtRisk && (
            <View style={styles.riskWarning}>
              <Icon name="alert-circle" size={moderateScale(14)} color="#EF4444" />
              <CustomText text=" Attendance at risk! No absences remaining." textStyle={styles.riskWarningText} />
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={moderateScale(24)} color="#1A1A2E" />
        </TouchableOpacity>
        <CustomText text="My Statistics" textStyle={styles.headerTitle} />
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Offline Banner */}
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <View style={styles.offlineBannerContent}>
              <View style={styles.offlineBannerHeader}>
                <Icon name="wifi-off" size={moderateScale(16)} color="#B91C1C" />
                <CustomText text=" Offline Mode" textStyle={styles.offlineBannerTitle} />
              </View>
              <CustomText 
                text={lastSyncTime 
                  ? `Last synced: ${lastSyncTime.toLocaleDateString()} at ${lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Showing cached data'
                } 
                textStyle={styles.offlineBannerText} 
              />
            </View>
            <Icon name="cloud-off-outline" size={moderateScale(24)} color="#FCA5A5" />
          </View>
        )}

        {/* Overall Stats Cards with Pie Chart */}
        <LinearGradient
          colors={['#FFFFFF', '#F0F9FF', '#E0F2FE']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.overallSection}
        >
          <View style={styles.pieChartContainer}>
            <View style={styles.pieChartWrapper}>
              <View style={styles.pieChartShadowRing} />
              {pieChartData.length > 0 ? (
                <PieChart
                  data={pieChartData}
                  donut
                  radius={moderateScale(60)}
                  innerRadius={moderateScale(45)}
                  innerCircleColor="#FFFFFF"
                  innerCircleBorderWidth={4}
                  innerCircleBorderColor="#F0F9FF"
                  showGradient
                  gradientCenterColor="#10B981"
                  focusOnPress
                  sectionAutoFocus
                  centerLabelComponent={() => (
                    <View style={styles.pieCenter}>
                      <CustomText text={`${overallPercentage}%`} textStyle={styles.pieCenterText} />
                      <CustomText text="Overall" textStyle={styles.pieCenterLabel} />
                    </View>
                  )}
                />
              ) : (
                <View style={styles.emptyPie}>
                  <Icon name="chart-arc" size={moderateScale(48)} color="#E5E7EB" />
                </View>
              )}
            </View>
            <View style={styles.pieLegendRow}>
              <View style={styles.pieLegendItem}>
                <View style={[styles.pieLegendDot, { backgroundColor: '#10B981' }]} />
                <CustomText text="Present" textStyle={styles.pieLegendText} />
              </View>
              <View style={styles.pieLegendItem}>
                <View style={[styles.pieLegendDot, { backgroundColor: '#EF4444' }]} />
                <CustomText text="Absent" textStyle={styles.pieLegendText} />
              </View>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={[styles.miniStatCard, { backgroundColor: '#10B98115' }]}>
              <Icon name="check-circle" size={moderateScale(20)} color="#10B981" />
              <CustomText text={`${totalAttended}`} textStyle={[styles.miniStatValue, { color: '#10B981' }]} />
              <CustomText text="Present" textStyle={styles.miniStatLabel} />
            </View>
            <View style={[styles.miniStatCard, { backgroundColor: '#EF444415' }]}>
              <Icon name="close-circle" size={moderateScale(20)} color="#EF4444" />
              <CustomText text={`${totalAbsents}`} textStyle={[styles.miniStatValue, { color: '#EF4444' }]} />
              <CustomText text="Absent" textStyle={styles.miniStatLabel} />
            </View>
            <View style={[styles.miniStatCard, { backgroundColor: '#F59E0B15' }]}>
              <Icon name="alert" size={moderateScale(20)} color="#F59E0B" />
              <CustomText text={`${atRiskSubjects}`} textStyle={[styles.miniStatValue, { color: '#F59E0B' }]} />
              <CustomText text="At Risk" textStyle={styles.miniStatLabel} />
            </View>
          </View>
        </LinearGradient>

        {/* Attendance Trend Line Chart */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIconWrapper}>
                <Icon name="chart-line" size={moderateScale(16)} color="#FFFFFF" />
              </View>
              <CustomText text="Attendance Trend" textStyle={styles.sectionTitle} />
            </View>
            <View style={styles.dropdownWrapper}>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setDropdownOpen(!dropdownOpen)}
              >
                <CustomText 
                  text={selectedTab === 'weekly' ? 'Weekly' : 'Monthly'} 
                  textStyle={styles.dropdownButtonText} 
                />
                <Icon 
                  name={dropdownOpen ? 'chevron-up' : 'chevron-down'} 
                  size={moderateScale(16)} 
                  color="#0077B6" 
                />
              </TouchableOpacity>
              {dropdownOpen && (
                <View style={styles.dropdownMenu}>
                  <TouchableOpacity
                    style={[styles.dropdownItem, selectedTab === 'weekly' && styles.dropdownItemActive]}
                    onPress={() => {
                      setSelectedTab('weekly')
                      setDropdownOpen(false)
                    }}
                  >
                    <CustomText 
                      text="Weekly" 
                      textStyle={[styles.dropdownItemText, selectedTab === 'weekly' && styles.dropdownItemTextActive]} 
                    />
                    {selectedTab === 'weekly' && (
                      <Icon name="check" size={moderateScale(14)} color="#0077B6" />
                    )}
                  </TouchableOpacity>
                  <View style={styles.dropdownDivider} />
                  <TouchableOpacity
                    style={[styles.dropdownItem, selectedTab === 'monthly' && styles.dropdownItemActive]}
                    onPress={() => {
                      setSelectedTab('monthly')
                      setDropdownOpen(false)
                    }}
                  >
                    <CustomText 
                      text="Monthly" 
                      textStyle={[styles.dropdownItemText, selectedTab === 'monthly' && styles.dropdownItemTextActive]} 
                    />
                    {selectedTab === 'monthly' && (
                      <Icon name="check" size={moderateScale(14)} color="#0077B6" />
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {lineChartData.length > 0 && lineChartData.some(d => d.value > 0) ? (
            <View style={styles.chartWrapper}>
              <View style={styles.chartBackgroundPattern}>
                <View style={styles.chartGridLine} />
                <View style={styles.chartGridLine} />
                <View style={styles.chartGridLine} />
                <View style={styles.chartGridLine} />
              </View>
              <LineChart
                data={lineChartData}
                width={SCREEN_WIDTH - moderateScale(100)}
                height={moderateScale(180)}
                color="#0077B6"
                thickness={4}
                dataPointsColor="#FFFFFF"
                dataPointsRadius={6}
                curved
                curvature={0.2}
                areaChart
                startFillColor="rgba(0, 119, 182, 0.4)"
                endFillColor="rgba(0, 180, 216, 0.05)"
                startOpacity={1}
                endOpacity={0.1}
                noOfSections={4}
                maxValue={100}
                yAxisTextStyle={{ color: '#6B7280', fontSize: moderateScale(10), fontWeight: '500' }}
                xAxisLabelTexts={selectedTab === 'weekly' 
                  ? weeklyData.map(w => w.week) 
                  : monthlyData.map(m => m.month)
                }
                xAxisLabelTextStyle={{ color: '#6B7280', fontSize: moderateScale(11), fontWeight: '600' }}
                rulesType="dashed"
                rulesColor="#E5E7EB"
                dashWidth={4}
                dashGap={4}
                yAxisColor="#E5E7EB"
                xAxisColor="#E5E7EB"
                showVerticalLines
                verticalLinesColor="#F3F4F6"
                pointerConfig={{
                  pointerStripHeight: moderateScale(150),
                  pointerStripColor: '#0077B620',
                  pointerStripWidth: 2,
                  pointerColor: '#0077B6',
                  radius: 8,
                  pointerLabelWidth: 100,
                  pointerLabelHeight: 40,
                  activatePointersOnLongPress: true,
                  autoAdjustPointerLabelPosition: true,
                  pointerLabelComponent: (items: any) => (
                    <View style={styles.tooltipContainer}>
                      <CustomText text={`${items[0]?.value || 0}%`} textStyle={styles.tooltipText} />
                    </View>
                  ),
                }}
              />
              <View style={styles.chartTargetLine}>
                <View style={styles.targetLineIndicator} />
                <CustomText text="75% Target" textStyle={styles.targetLineText} />
              </View>
            </View>
          ) : (
            <View style={styles.emptyChartContainer}>
              <View style={styles.emptyChartIcon}>
                <Icon name="chart-line-variant" size={moderateScale(32)} color="#9CA3AF" />
              </View>
              <CustomText text="No trend data available" textStyle={styles.emptyChartText} />
              <CustomText text="Attendance data will appear here" textStyle={styles.emptyChartSubtext} />
            </View>
          )}
        </View>

        {/* Bar Chart for Lectures */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIconWrapper, { backgroundColor: '#00B4D8' }]}>
                <Icon name="chart-bar" size={moderateScale(16)} color="#FFFFFF" />
              </View>
              <CustomText text="Lectures Attended" textStyle={styles.sectionTitle} />
            </View>
          </View>

          {barChartData.length > 0 && barChartData.some(d => d.value > 0) ? (
            <View style={styles.chartWrapper}>
              <BarChart
                data={barChartData}
                width={SCREEN_WIDTH - moderateScale(100)}
                height={moderateScale(180)}
                barWidth={moderateScale(36)}
                spacing={moderateScale(24)}
                noOfSections={4}
                barBorderRadius={8}
                barBorderTopLeftRadius={10}
                barBorderTopRightRadius={10}
                yAxisTextStyle={{ color: '#6B7280', fontSize: moderateScale(10), fontWeight: '500' }}
                xAxisLabelTextStyle={{ color: '#374151', fontSize: moderateScale(12), fontWeight: '600' }}
                rulesType="dashed"
                rulesColor="#E5E7EB"
                dashWidth={4}
                dashGap={4}
                yAxisColor="#E5E7EB"
                xAxisColor="#E5E7EB"
                isAnimated
                animationDuration={1000}
                showGradient
                gradientColor="#FFFFFF"
                frontColor="#0077B6"
                cappedBars
                capThickness={3}
                capColor="#FFFFFF"
              />
            </View>
          ) : (
            <View style={styles.emptyChartContainer}>
              <View style={styles.emptyChartIcon}>
                <Icon name="chart-bar" size={moderateScale(32)} color="#9CA3AF" />
              </View>
              <CustomText text="No lecture data available" textStyle={styles.emptyChartText} />
              <CustomText text="Data will appear once lectures are recorded" textStyle={styles.emptyChartSubtext} />
            </View>
          )}

          <View style={styles.legendCard}>
            <View style={styles.legendCardItem}>
              <LinearGradient colors={['#10B981', '#059669']} style={styles.legendGradientDot} />
              <View>
                <CustomText text="Good" textStyle={styles.legendCardTitle} />
                <CustomText text="≥75%" textStyle={styles.legendCardValue} />
              </View>
            </View>
            <View style={styles.legendDivider} />
            <View style={styles.legendCardItem}>
              <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.legendGradientDot} />
              <View>
                <CustomText text="Warning" textStyle={styles.legendCardTitle} />
                <CustomText text="50-74%" textStyle={styles.legendCardValue} />
              </View>
            </View>
            <View style={styles.legendDivider} />
            <View style={styles.legendCardItem}>
              <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.legendGradientDot} />
              <View>
                <CustomText text="Low" textStyle={styles.legendCardTitle} />
                <CustomText text="<50%" textStyle={styles.legendCardValue} />
              </View>
            </View>
          </View>
        </View>

        {/* Subject-wise Performance */}
        {subjectStats.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconWrapper, { backgroundColor: '#8B5CF6' }]}>
                  <Icon name="book-multiple" size={moderateScale(16)} color="#FFFFFF" />
                </View>
                <CustomText text="Subject Performance" textStyle={styles.sectionTitle} />
              </View>
              <View style={styles.subjectCountBadge}>
                <CustomText text={`${subjectStats.length} Subjects`} textStyle={styles.subjectCountText} />
              </View>
            </View>

            <View style={styles.chartWrapper}>
              <BarChart
                data={subjectBarChartData}
                width={SCREEN_WIDTH - moderateScale(100)}
                height={moderateScale(200)}
                barWidth={moderateScale(32)}
                spacing={moderateScale(20)}
                noOfSections={5}
                maxValue={100}
                barBorderRadius={8}
                barBorderTopLeftRadius={10}
                barBorderTopRightRadius={10}
                yAxisTextStyle={{ color: '#6B7280', fontSize: moderateScale(10), fontWeight: '500' }}
                xAxisLabelTextStyle={{ color: '#374151', fontSize: moderateScale(10), fontWeight: '600' }}
                rulesType="dashed"
                rulesColor="#E5E7EB"
                dashWidth={4}
                dashGap={4}
                yAxisColor="#E5E7EB"
                xAxisColor="#E5E7EB"
                isAnimated
                animationDuration={1000}
                showGradient
                gradientColor="#FFFFFF"
                cappedBars
                capThickness={3}
                capColor="#FFFFFF"
                renderTooltip={(item: any) => (
                  <View style={styles.barTooltip}>
                    <CustomText text={`${item.value}%`} textStyle={styles.barTooltipText} />
                  </View>
                )}
              />
            </View>

            <View style={styles.subjectPerformanceSummary}>
              <View style={styles.summaryItem}>
                <Icon name="arrow-up-circle" size={moderateScale(16)} color="#10B981" />
                <CustomText text={` Best: ${subjectStats.reduce((max, s) => s.percentage > max.percentage ? s : max, subjectStats[0])?.subjectName || 'N/A'}`} textStyle={styles.summaryText} />
              </View>
              <View style={styles.summaryItem}>
                <Icon name="arrow-down-circle" size={moderateScale(16)} color="#EF4444" />
                <CustomText text={` Needs Focus: ${subjectStats.reduce((min, s) => s.percentage < min.percentage ? s : min, subjectStats[0])?.subjectName || 'N/A'}`} textStyle={styles.summaryText} />
              </View>
            </View>
          </View>
        )}

        {/* Subject-wise Absences */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Icon name="book-open-variant" size={moderateScale(18)} color="#0077B6" />
              <CustomText text=" Subject Absences" textStyle={styles.sectionTitle} />
            </View>
            <View style={styles.allowedBadge}>
              <CustomText text={`Max ${MAX_ALLOWED_ABSENTS} allowed`} textStyle={styles.allowedText} />
            </View>
          </View>

          {subjectStats.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="chart-bar" size={moderateScale(48)} color="#9CA3AF" />
              <CustomText text="No data available" textStyle={styles.emptyText} />
            </View>
          ) : (
            subjectStats.map((stat, index) => renderSubjectAbsenceCard(stat, index))
          )}
        </View>

        {/* Recent Activity */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Icon name="history" size={moderateScale(18)} color="#0077B6" />
              <CustomText text=" Recent Activity" textStyle={styles.sectionTitle} />
            </View>
          </View>

          {recentAttendance.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="calendar-blank" size={moderateScale(48)} color="#9CA3AF" />
              <CustomText text="No recent activity" textStyle={styles.emptyText} />
            </View>
          ) : (
            <View style={styles.activityList}>
              {recentAttendance.map((item, index) => (
                <View key={index} style={styles.activityItem}>
                  <View style={[
                    styles.activityIcon, 
                    { backgroundColor: item.attended ? '#10B98120' : '#EF444420' }
                  ]}>
                    <Icon 
                      name={item.attended ? 'check' : 'close'} 
                      size={moderateScale(16)} 
                      color={item.attended ? '#10B981' : '#EF4444'} 
                    />
                  </View>
                  <View style={styles.activityContent}>
                    <CustomText text={item.subjectName} textStyle={styles.activitySubject} />
                    <CustomText text={item.date} textStyle={styles.activityDate} />
                  </View>
                  <View style={[
                    styles.activityStatus,
                    { backgroundColor: item.attended ? '#10B98120' : '#EF444420' }
                  ]}>
                    <CustomText 
                      text={item.attended ? 'Present' : 'Absent'} 
                      textStyle={[
                        styles.activityStatusText,
                        { color: item.attended ? '#10B981' : '#EF4444' }
                      ]} 
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Tips Card */}
        <View style={styles.tipsCard}>
          <View style={styles.tipsHeader}>
            <Icon name="lightbulb-on" size={moderateScale(20)} color="#F59E0B" />
            <CustomText text=" Attendance Tips" textStyle={styles.tipsTitle} />
          </View>
          <View style={styles.tipsList}>
            <View style={styles.tipItem}>
              <Icon name="check" size={moderateScale(14)} color="#10B981" />
              <CustomText text=" Maintain at least 75% attendance" textStyle={styles.tipText} />
            </View>
            <View style={styles.tipItem}>
              <Icon name="check" size={moderateScale(14)} color="#10B981" />
              <CustomText text=" You're allowed only 4 absences per subject" textStyle={styles.tipText} />
            </View>
            <View style={styles.tipItem}>
              <Icon name="check" size={moderateScale(14)} color="#10B981" />
              <CustomText text=" Regular attendance improves academic performance" textStyle={styles.tipText} />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

export default StudentStats

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
  },
  headerTitle: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: '#1A1A2E',
  },
  headerRight: {
    width: moderateScale(40),
  },
  scrollContent: {
    paddingBottom: moderateScale(100),
  },
  offlineBanner: {
    backgroundColor: '#FEE2E2',
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(16),
    marginHorizontal: moderateScale(16),
    marginTop: moderateScale(8),
    borderRadius: moderateScale(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  offlineBannerContent: {
    flex: 1,
  },
  offlineBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(2),
  },
  offlineBannerTitle: {
    color: '#B91C1C',
    fontSize: moderateScale(13),
    fontWeight: '700',
  },
  offlineBannerText: {
    color: '#DC2626',
    fontSize: moderateScale(11),
    fontWeight: '400',
    marginLeft: moderateScale(22),
  },
  overallSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: moderateScale(16),
    marginTop: moderateScale(16),
    borderRadius: moderateScale(16),
    padding: moderateScale(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  pieChartContainer: {
    alignItems: 'center',
    marginBottom: moderateScale(16),
  },
  pieCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieCenterText: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: '#1A1A2E',
  },
  pieCenterLabel: {
    fontSize: moderateScale(11),
    color: '#6B7280',
  },
  emptyPie: {
    width: moderateScale(110),
    height: moderateScale(110),
    borderRadius: moderateScale(55),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: moderateScale(10),
  },
  miniStatCard: {
    flex: 1,
    borderRadius: moderateScale(12),
    padding: moderateScale(12),
    alignItems: 'center',
  },
  miniStatValue: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    marginTop: moderateScale(4),
  },
  miniStatLabel: {
    fontSize: moderateScale(10),
    color: '#6B7280',
    marginTop: moderateScale(2),
  },
  sectionContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: moderateScale(16),
    marginTop: moderateScale(16),
    borderRadius: moderateScale(16),
    padding: moderateScale(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: moderateScale(16),
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#1A1A2E',
  },
  dropdownWrapper: {
    position: 'relative',
    zIndex: 1000,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: moderateScale(8),
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(8),
    gap: moderateScale(6),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dropdownButtonText: {
    fontSize: moderateScale(12),
    color: '#0077B6',
    fontWeight: '600',
  },
  dropdownMenu: {
    position: 'absolute',
    top: moderateScale(42),
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(8),
    minWidth: moderateScale(120),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(10),
  },
  dropdownItemActive: {
    backgroundColor: '#F0F9FF',
  },
  dropdownItemText: {
    fontSize: moderateScale(13),
    color: '#374151',
    fontWeight: '500',
  },
  dropdownItemTextActive: {
    color: '#0077B6',
    fontWeight: '600',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  chartWrapper: {
    alignItems: 'center',
    paddingTop: moderateScale(10),
  },
  emptyChartContainer: {
    alignItems: 'center',
    paddingVertical: moderateScale(32),
  },
  emptyChartText: {
    fontSize: moderateScale(14),
    color: '#9CA3AF',
    marginTop: moderateScale(8),
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: moderateScale(16),
    marginTop: moderateScale(16),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: moderateScale(8),
    height: moderateScale(8),
    borderRadius: moderateScale(4),
    marginRight: moderateScale(4),
  },
  legendText: {
    fontSize: moderateScale(11),
    color: '#6B7280',
  },
  allowedBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(8),
  },
  allowedText: {
    fontSize: moderateScale(11),
    color: '#92400E',
    fontWeight: '600',
  },
  absenceCard: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: moderateScale(12),
    marginBottom: moderateScale(12),
    overflow: 'hidden',
  },
  subjectColorStrip: {
    width: moderateScale(4),
  },
  absenceCardContent: {
    flex: 1,
    padding: moderateScale(12),
  },
  absenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: moderateScale(10),
  },
  absenceSubjectInfo: {
    flex: 1,
  },
  absenceSubjectName: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: moderateScale(4),
  },
  codeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E7EB',
    paddingHorizontal: moderateScale(6),
    paddingVertical: moderateScale(2),
    borderRadius: moderateScale(4),
  },
  codeText: {
    fontSize: moderateScale(10),
    fontWeight: '600',
    color: '#6B7280',
  },
  absenceCountBadge: {
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(8),
  },
  absenceCountText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
  },
  absenceProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(10),
  },
  absenceProgressBar: {
    flex: 1,
    height: moderateScale(6),
    backgroundColor: '#E5E7EB',
    borderRadius: moderateScale(3),
    overflow: 'hidden',
    marginRight: moderateScale(10),
  },
  absenceProgressFill: {
    height: '100%',
    borderRadius: moderateScale(3),
  },
  absenceProgressText: {
    fontSize: moderateScale(11),
    color: '#6B7280',
    fontWeight: '500',
  },
  absenceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  absenceDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  absenceDetailText: {
    fontSize: moderateScale(11),
    color: '#6B7280',
  },
  riskWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: moderateScale(8),
    borderRadius: moderateScale(6),
    marginTop: moderateScale(10),
  },
  riskWarningText: {
    fontSize: moderateScale(11),
    color: '#B91C1C',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: moderateScale(32),
  },
  emptyText: {
    fontSize: moderateScale(14),
    color: '#9CA3AF',
    marginTop: moderateScale(8),
  },
  activityList: {
    gap: moderateScale(8),
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: moderateScale(12),
    borderRadius: moderateScale(10),
  },
  activityIcon: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityContent: {
    flex: 1,
    marginLeft: moderateScale(12),
  },
  activitySubject: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: '#1A1A2E',
  },
  activityDate: {
    fontSize: moderateScale(11),
    color: '#6B7280',
    marginTop: moderateScale(2),
  },
  activityStatus: {
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(8),
  },
  activityStatusText: {
    fontSize: moderateScale(11),
    fontWeight: '600',
  },
  tipsCard: {
    backgroundColor: '#FFFBEB',
    marginHorizontal: moderateScale(16),
    marginTop: moderateScale(16),
    borderRadius: moderateScale(16),
    padding: moderateScale(16),
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(12),
  },
  tipsTitle: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: '#92400E',
  },
  tipsList: {
    gap: moderateScale(8),
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipText: {
    fontSize: moderateScale(12),
    color: '#78350F',
  },
  // New improved styles for charts
  pieChartWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieChartShadowRing: {
    position: 'absolute',
    width: moderateScale(130),
    height: moderateScale(130),
    borderRadius: moderateScale(65),
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#0077B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  pieLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: moderateScale(24),
    marginTop: moderateScale(16),
  },
  pieLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pieLegendDot: {
    width: moderateScale(10),
    height: moderateScale(10),
    borderRadius: moderateScale(5),
    marginRight: moderateScale(6),
  },
  pieLegendText: {
    fontSize: moderateScale(12),
    color: '#6B7280',
    fontWeight: '500',
  },
  sectionIconWrapper: {
    width: moderateScale(28),
    height: moderateScale(28),
    borderRadius: moderateScale(8),
    backgroundColor: '#0077B6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(10),
  },
  chartBackgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-evenly',
    opacity: 0.3,
  },
  chartGridLine: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  tooltipContainer: {
    backgroundColor: '#1A1A2E',
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: moderateScale(12),
    fontWeight: '700',
  },
  chartTargetLine: {
    position: 'absolute',
    right: moderateScale(10),
    top: moderateScale(50),
    flexDirection: 'row',
    alignItems: 'center',
  },
  targetLineIndicator: {
    width: moderateScale(16),
    height: 2,
    backgroundColor: '#F59E0B',
    marginRight: moderateScale(4),
  },
  targetLineText: {
    fontSize: moderateScale(9),
    color: '#F59E0B',
    fontWeight: '600',
  },
  emptyChartIcon: {
    width: moderateScale(64),
    height: moderateScale(64),
    borderRadius: moderateScale(32),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: moderateScale(8),
  },
  emptyChartSubtext: {
    fontSize: moderateScale(12),
    color: '#D1D5DB',
    marginTop: moderateScale(4),
  },
  legendCard: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: moderateScale(12),
    padding: moderateScale(12),
    marginTop: moderateScale(16),
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  legendCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(8),
  },
  legendGradientDot: {
    width: moderateScale(12),
    height: moderateScale(12),
    borderRadius: moderateScale(6),
  },
  legendCardTitle: {
    fontSize: moderateScale(11),
    color: '#374151',
    fontWeight: '600',
  },
  legendCardValue: {
    fontSize: moderateScale(10),
    color: '#9CA3AF',
  },
  legendDivider: {
    width: 1,
    height: moderateScale(24),
    backgroundColor: '#E5E7EB',
  },
  subjectCountBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(8),
  },
  subjectCountText: {
    fontSize: moderateScale(11),
    color: '#7C3AED',
    fontWeight: '600',
  },
  barTooltip: {
    backgroundColor: '#1A1A2E',
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(4),
    marginBottom: moderateScale(4),
  },
  barTooltipText: {
    color: '#FFFFFF',
    fontSize: moderateScale(10),
    fontWeight: '600',
  },
  subjectPerformanceSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: moderateScale(10),
    padding: moderateScale(12),
    marginTop: moderateScale(16),
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  summaryText: {
    fontSize: moderateScale(11),
    color: '#374151',
    fontWeight: '500',
    flex: 1,
  },
})
