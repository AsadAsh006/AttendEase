import { StyleSheet, Text, View, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native'
import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { moderateScale } from 'react-native-size-matters'
import Icon from 'react-native-vector-icons/Ionicons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSelector } from 'react-redux'
import { useNavigation, useRoute } from '@react-navigation/native'
import images from '../../assets/images'
import { supabase } from '../../lib/supabase'
import { lightTheme as theme } from '../../theme/colors'
import { useAuth } from '../../contexts/AuthContext'

const SubjectStatistics = () => {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { subjectId } = route.params || {}
  const { handleAuthError } = useAuth()

  const subjects = useSelector((state: any) => state.subjects?.items ?? [])
  const students = useSelector((state: any) => state.students?.items ?? [])
  const attendanceRecords = useSelector((state: any) => state.attendance?.records ?? {})
  const [enrolledStudentIds, setEnrolledStudentIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const subject = subjects.find((s: any) => s.id === subjectId)

  // Fetch enrolled students for this subject
  const fetchEnrollments = useCallback(async () => {
    if (!subjectId) {
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('student_subjects')
        .select('student_id')
        .eq('subject_id', subjectId)

      if (error) {
        handleAuthError(error)
      } else {
        setEnrolledStudentIds((data || []).map(d => d.student_id))
      }
    } catch (error) {
      console.error('Error fetching enrollments:', error)
    } finally {
      setLoading(false)
    }
  }, [subjectId, handleAuthError])

  useEffect(() => {
    fetchEnrollments()
  }, [fetchEnrollments])

  // Calculate student-wise statistics for this subject
  const studentStats = useMemo(() => {
    const enrolledStudents = students.filter((s: any) =>
      enrolledStudentIds.includes(s.id)
    )

    return enrolledStudents.map((student: any) => {
      let totalClasses = 0
      let attendedClasses = 0

      Object.values(attendanceRecords).forEach((record: any) => {
        if (record.subjectId === subjectId && record.attendance[student.id] !== undefined) {
          totalClasses++
          if (record.attendance[student.id]) {
            attendedClasses++
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
        badge
      }
    }).sort((a: any, b: any) => b.overallPercentage - a.overallPercentage)
  }, [students, subjectId, attendanceRecords, enrolledStudentIds])

  const getBadgeColor = (badge: string) => {
    switch (badge) {
      case 'Excellent': return '#000000'
      case 'Good': return '#12C25E'
      case 'Average': return '#FF7A00'
      default: return '#EF4444'
    }
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const getAvatarColor = (index: number) => {
    const colors = ['#4F39F6', '#12C25E', '#FF7A00', '#B35BFF', '#EF4444', '#3B82F6']
    return colors[index % colors.length]
  }

  const renderStudentCard = ({ item, index }: any) => (
    <TouchableOpacity
      style={styles.studentCard}
      onPress={() => navigation.navigate('StudentDetail', { studentId: item.id, subjectId })}
      activeOpacity={0.7}
    >
      <View style={styles.studentHeader}>
        <View style={styles.studentLeft}>
          <View style={[styles.avatar, { backgroundColor: getAvatarColor(index) }]}>
            <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
          </View>
          <View style={styles.studentInfo}>
            <Text style={styles.studentName}>{item.name}</Text>
            <Text style={styles.studentCode}>{item.roll_number || 'N/A'}</Text>
            {item.description && <Text style={styles.studentDescription}>{item.description}</Text>}
          </View>
        </View>
        <View style={[styles.badge, { backgroundColor: getBadgeColor(item.badge) }]}>
          <Text style={styles.badgeText}>{item.badge}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Total Classes</Text>
          <Text style={styles.statValue}>{item.totalClasses}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Attended</Text>
          <Text style={[styles.statValue, { color: '#12C25E' }]}>{item.attendedClasses}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Attendance</Text>
          <Text style={[styles.statValue, { color: '#4F39F6' }]}>{item.overallPercentage}%</Text>
        </View>
      </View>
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F39F6" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!subject) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Subject Not Found</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={moderateScale(24)} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{subject.name}</Text>
          <Text style={styles.headerSubtitle}>
            {subject.code || 'No Code'} • {studentStats.length} Students
          </Text>
        </View>
      </View>

      {studentStats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Image source={images.user} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>No Students Enrolled</Text>
          <Text style={styles.emptyText}>Add students to this subject to view statistics</Text>
        </View>
      ) : (
        <FlatList
          data={studentStats}
          keyExtractor={(item) => item.id}
          renderItem={renderStudentCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  )
}

export default SubjectStatistics

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
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
  studentCard: {
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
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  studentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: moderateScale(50),
    height: moderateScale(50),
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  studentCode: {
    fontSize: moderateScale(14),
    color: '#6B7280',
    marginBottom: 2,
  },
  studentDescription: {
    fontSize: moderateScale(12),
    color: '#9CA3AF',
  },
   badge: {
    marginTop: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: moderateScale(11),
    color: '#6B7280',
    marginBottom: 6,
    textAlign: 'center',
  },
  statValue: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: '#1A1A2E',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: moderateScale(14),
    color: '#6B7280',
  },
})
