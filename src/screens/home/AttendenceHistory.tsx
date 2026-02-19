import { StyleSheet, Text, View, FlatList, TouchableOpacity, Image, Animated } from 'react-native'
import React, { useMemo, useRef, useEffect } from 'react'
import { moderateScale } from 'react-native-size-matters'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSelector } from 'react-redux'
import images from '../../assets/images'
import { useNavigation } from '@react-navigation/native'

const AttendenceHistory = () => {
  const navigation = useNavigation<any>()
  const subjects = useSelector((state: any) => state.subjects?.items ?? [])
  const students = useSelector((state: any) => state.students?.items ?? [])
  const attendanceRecords = useSelector((state: any) => state.attendance?.records ?? {})
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start()
  }, [])

  // Group attendance records by subject
  const subjectSummaries = useMemo(() => {
    const summaries: any[] = []

    subjects.forEach((subject: any) => {
      const subjectRecords = Object.values(attendanceRecords).filter(
        (record: any) => record.subjectId === subject.id
      )

      if (subjectRecords.length === 0) return

      const subjectStudents = students.filter(
        (s: any) => Array.isArray(s.subjects) && s.subjects.includes(subject.id)
      )

      let totalPresent = 0
      let totalPossible = 0

      subjectRecords.forEach((record: any) => {
        const presentCount = Object.values(record.attendance).filter(Boolean).length
        totalPresent += presentCount
        totalPossible += subjectStudents.length
      })

      const avgPercentage = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 0

      summaries.push({
        subjectId: subject.id,
        subjectName: subject.name,
        subjectCode: subject.code,
        lectureCount: subjectRecords.length,
        totalStudents: subjectStudents.length,
        avgPercentage,
      })
    })

    return summaries
  }, [attendanceRecords, subjects, students])

  const renderSubjectItem = ({ item, index }: any) => {
    return (
      <Animated.View style={{ opacity: fadeAnim }}>
        <TouchableOpacity
          style={styles.subjectCard}
          onPress={() => navigation.navigate('SubjectLectures', {
            subjectId: item.subjectId,
            subjectName: item.subjectName,
            subjectCode: item.subjectCode,
          })}
          activeOpacity={0.7}
        >
          <View style={styles.subjectHeader}>
            <View style={styles.subjectLeft}>
              <View style={styles.subjectIconContainer}>
                <Image source={images.book} style={styles.subjectIcon} />
              </View>
              <View style={styles.subjectInfo}>
                <View style={styles.subjectTitleRow}>
                  <Text style={styles.subjectName} numberOfLines={1}>{item.subjectName}</Text>
                </View>
                {item.subjectCode ? (
                  <View style={styles.codeBadge}>
                    <Text style={styles.codeBadgeText}>{item.subjectCode}</Text>
                  </View>
                ) : null}
                <View style={styles.subjectMeta}>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaValue}>{item.lectureCount}</Text>
                    <Text style={styles.metaLabel}> {item.lectureCount === 1 ? 'lecture' : 'lectures'}</Text>
                  </View>
                  <Text style={styles.metaDivider}>•</Text>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaValue}>{item.totalStudents}</Text>
                    <Text style={styles.metaLabel}> {item.totalStudents === 1 ? 'student' : 'students'}</Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.subjectRight}>
              <View style={[
                styles.avgPercentageBadge,
                { backgroundColor: item.avgPercentage >= 75 ? '#D1FAE5' : item.avgPercentage >= 50 ? '#FEF3C7' : '#FEE2E2' }
              ]}>
                <Text style={styles.avgPercentageLabel}>Avg</Text>
                <Text style={[
                  styles.avgPercentageValue,
                  { color: item.avgPercentage >= 75 ? '#047857' : item.avgPercentage >= 50 ? '#92400E' : '#B91C1C' }
                ]}>
                  {item.avgPercentage}%
                </Text>
              </View>
              <Image source={images.download} style={styles.chevronIcon} />
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>📊 Attendance History</Text>
          <Text style={styles.headerSubtitle}>
            {subjectSummaries.length} {subjectSummaries.length === 1 ? 'subject' : 'subjects'} • Track your progress
          </Text>
        </View>
        <View style={styles.headerDecoration} />
      </View>

      <FlatList
        data={subjectSummaries}
        keyExtractor={(item: any) => item.subjectId}
        contentContainerStyle={styles.listContent}
        renderItem={renderSubjectItem}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Image source={images.calender} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>No Records Yet</Text>
            <Text style={styles.emptyText}>Mark attendance to see records here</Text>
          </View>
        )}
      />
    </SafeAreaView>
  )
}

export default AttendenceHistory

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerContent: {
    marginBottom: 0,
  },
  headerDecoration: {
    position: 'absolute',
    bottom: -1,
    left: 20,
    right: 20,
    height: 3,
    backgroundColor: '#4F46E5',
    borderRadius: 2,
    width: 60,
  },
  headerTitle: {
    fontSize: moderateScale(28),
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: moderateScale(14),
    color: '#64748B',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
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
  subjectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subjectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  subjectIconContainer: {
    width: moderateScale(52),
    height: moderateScale(52),
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 2,
    borderColor: '#E0E7FF',
  },
  subjectIcon: {
    width: moderateScale(26),
    height: moderateScale(26),
    tintColor: '#4F46E5',
  },
  subjectInfo: {
    flex: 1,
  },
  subjectTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
    flexWrap: 'wrap',
  },
  subjectName: {
    fontSize: moderateScale(17),
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  codeBadge: {
    backgroundColor: '#F1F5F9',
    alignSelf: 'flex-start',
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  codeBadgeText: {
    fontSize: moderateScale(11),
    color: '#475569',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subjectMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  metaValue: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: '#4F46E5',
  },
  metaLabel: {
    fontSize: moderateScale(13),
    color: '#64748B',
    fontWeight: '500',
  },
  metaDivider: {
    fontSize: moderateScale(12),
    color: '#CBD5E1',
  },
  subjectRight: {
    alignItems: 'center',
    gap: 8,
  },
  avgPercentageBadge: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: moderateScale(72),
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  avgPercentageLabel: {
    fontSize: moderateScale(9),
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  avgPercentageValue: {
    fontSize: moderateScale(20),
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  chevronIcon: {
    width: moderateScale(18),
    height: moderateScale(18),
    tintColor: '#CBD5E1',
    marginTop: 8,
  },
})