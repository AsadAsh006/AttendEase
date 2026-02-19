import { StyleSheet, Text, View, FlatList, Image, ScrollView, TouchableOpacity } from 'react-native'
import React, { useMemo } from 'react'
import { moderateScale } from 'react-native-size-matters'
import Icon from 'react-native-vector-icons/Ionicons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSelector } from 'react-redux'
import { useRoute, useNavigation } from '@react-navigation/native'
import images from '../../assets/images'
import { lightTheme as theme } from '../../theme/colors'

const StudentDetail = () => {
  const route = useRoute<any>()
  const navigation = useNavigation<any>()
  const { studentId, subjectId } = route.params || {}

  const subjects = useSelector((state: any) => state.subjects?.items ?? [])
  const students = useSelector((state: any) => state.students?.items ?? [])
  const attendanceRecords = useSelector((state: any) => state.attendance?.records ?? {})

  const student = students.find((s: any) => s.id === studentId)
  const subject = subjects.find((s: any) => s.id === subjectId)

  // Calculate statistics for this student in this subject
  const stats = useMemo(() => {
    let totalClasses = 0
    let attendedClasses = 0
    const records: any[] = []

    Object.entries(attendanceRecords).forEach(([id, record]: [string, any]) => {
      if (record.subjectId === subjectId && record.attendance[studentId] !== undefined) {
        totalClasses++
        const isPresent = record.attendance[studentId]
        if (isPresent) {
          attendedClasses++
        }

        const date = new Date(record.dateKey)
        records.push({
          id,
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          status: isPresent ? 'Present' : 'Absent'
        })
      }
    })

    const overallPercentage = totalClasses > 0 ? Math.round((attendedClasses / totalClasses) * 100) : 0

    // Sort records by date (newest first)
    records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return {
      totalClasses,
      attendedClasses,
      overallPercentage,
      records
    }
  }, [studentId, subjectId, attendanceRecords])

  const getBadgeColor = (percentage: number) => {
    if (percentage >= 90) return '#000000'
    if (percentage >= 75) return '#12C25E'
    if (percentage >= 60) return '#FF7A00'
    return '#EF4444'
  }

  const getBadgeText = (percentage: number) => {
    if (percentage >= 90) return 'Excellent'
    if (percentage >= 75) return 'Good'
    if (percentage >= 60) return 'Average'
    return 'Poor'
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const renderRecordItem = ({ item }: any) => (
    <View style={styles.recordRow}>
      <View style={styles.recordLeft}>
        <Text style={styles.recordDate}>{item.date}</Text>
        {/* <Text style={styles.recordTime}>{item.time}</Text> */}
      </View>
      <View style={styles.recordRight}>
        <View style={[
          styles.statusBadge,
          { backgroundColor: item.status === 'Present' ? '#000000' : '#EF4444' }
        ]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
    </View>
  )

  if (!student || !subject) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Data Not Found</Text>
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
        <Text style={styles.headerTitle}>Student Details</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Student Header */}
        <View style={styles.studentHeader}>
          <View style={[styles.avatar, { backgroundColor: '#4F39F6' }]}>
            <Text style={styles.avatarText}>{getInitials(student.name)}</Text>
          </View>
          <View style={styles.studentInfo}>
            <Text style={styles.studentName}>{student.name}</Text>
            <Text style={styles.studentCode}>{student.roll_number || 'N/A'}</Text>
            {student.description && <Text style={styles.studentDescription}>{student.description}</Text>}
          </View>
          <View style={[styles.badge, { backgroundColor: getBadgeColor(stats.overallPercentage) }]}>
            <Text style={styles.badgeText}>{getBadgeText(stats.overallPercentage)}</Text>
          </View>
        </View>

        {/* Stats Cards
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: '#EEF4FF' }]}>
            <Text style={styles.statCardLabel}>Total Classes</Text>
            <Text style={[styles.statCardValue, { color: '#4F39F6' }]}>{stats.totalClasses}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#E8F9EE' }]}>
            <Text style={styles.statCardLabel}>Classes Attended</Text>
            <Text style={[styles.statCardValue, { color: '#12C25E' }]}>{stats.attendedClasses}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#F8F0FF' }]}>
            <Text style={styles.statCardLabel}>Overall Attendance</Text>
            <View style={styles.percentageContainer}>
              <Text style={[styles.statCardValue, { color: '#B35BFF' }]}>{stats.overallPercentage}%</Text>
            </View>
          </View>
        </View> */}

        {/* Subject Info */}
        <View style={styles.subjectSection}>
          <Text style={styles.sectionTitle}>Subject-wise Attendance</Text>
          <View style={styles.subjectCard}>
            <View style={styles.subjectHeader}>
              <View style={[styles.subjectIcon, { backgroundColor: '#4F39F6' }]}>
                <Image source={images.book} style={styles.subjectIconImage} />
              </View>
              <View style={styles.subjectInfo}>
                <Text style={styles.subjectName}>{subject.name}</Text>
                <Text style={styles.subjectCode}>{subject.code || 'No Code'}</Text>
              </View>
            </View>
            <View style={styles.subjectStats}>
              <Text style={styles.subjectStatsText}>
                {stats.attendedClasses} / {stats.totalClasses} classes attended
              </Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${stats.overallPercentage}%`,
                      backgroundColor: getBadgeColor(stats.overallPercentage)
                    }
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: getBadgeColor(stats.overallPercentage) }]}>
                {stats.overallPercentage}%
              </Text>
            </View>
          </View>
        </View>

        {/* Recent Records */}
        <View style={styles.recordsSection}>
          <Text style={styles.sectionTitle}>Recent Attendance Records</Text>
          {stats.records.length === 0 ? (
            <View style={styles.emptyRecords}>
              <Text style={styles.emptyRecordsText}>No attendance records found</Text>
            </View>
          ) : (
            <>
              {/* <View style={styles.tableHeader}>
                <Text style={styles.tableHeaderText}>Date</Text>
                 <Text style={styles.tableHeaderText}>Time</Text> 
                <Text style={styles.tableHeaderText}>Status</Text>
              </View> */}
              <FlatList
                data={stats.records}
                keyExtractor={(item) => item.id}
                renderItem={renderRecordItem}
                scrollEnabled={false}
              />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

export default StudentDetail

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(16),
    backgroundColor: theme.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: {
    padding: moderateScale(3),
    marginRight: moderateScale(12),
  },
  headerTitle: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: '#1E293B',
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    backgroundColor: theme.background,
    marginBottom: 16,
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
    fontSize: moderateScale(20),
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
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statCardLabel: {
    fontSize: moderateScale(11),
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  statCardValue: {
    fontSize: moderateScale(24),
    fontWeight: '700',
  },
  percentageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subjectSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 12,
  },
  subjectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: moderateScale(0), height: moderateScale(2) },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  subjectIcon: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  subjectIconImage: {
    width: moderateScale(24),
    height: moderateScale(24),
    tintColor: '#FFFFFF',
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  subjectCode: {
    fontSize: moderateScale(13),
    color: '#6B7280',
  },
  subjectStats: {
    marginBottom: 12,
  },
  subjectStatsText: {
    fontSize: moderateScale(13),
    color: '#6B7280',
  },
  progressBarContainer: {
    gap: 8,
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
  progressText: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    textAlign: 'right',
  },
  recordsSection: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F5F7FA',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  tableHeaderText: {
    flex: 1,
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: '#6B7280',
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: moderateScale(0), height: moderateScale(1) },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  recordLeft: {
    flex: 2,
  },
  recordDate: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  recordTime: {
    fontSize: moderateScale(13),
    color: '#6B7280',
  },
  recordRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: '#1A1A2E',
  },
  emptyRecords: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyRecordsText: {
    fontSize: moderateScale(14),
    color: '#6B7280',
  },
})
