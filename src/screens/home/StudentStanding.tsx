import React, { useState, useEffect, useCallback } from 'react'
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { moderateScale } from 'react-native-size-matters'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import CustomText from '../../components/text'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useOffline } from '../../contexts/OfflineContext'
import { MMKV } from 'react-native-mmkv'
import images from '../../assets/images'

const storage = new MMKV()
const STANDING_CACHE_KEY = 'AttendEase.studentStanding'

interface StudentRanking {
  id: string
  name: string
  roll_number: string
  totalAttended: number
  totalLectures: number
  percentage: number
  rank: number
  isCurrentUser: boolean
}

interface CachedStandingData {
  rankings: StudentRanking[]
  myRank: number
  totalStudents: number
  lastUpdated: number
}

const StudentStanding = () => {
  const navigation = useNavigation<any>()
  const { user, userProfile, handleAuthError } = useAuth()
  const { isOnline } = useOffline()
  const [rankings, setRankings] = useState<StudentRanking[]>([])
  const [myRank, setMyRank] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'top10' | 'myPosition'>('all')
  const fadeAnim = useState(new Animated.Value(0))[0]

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
      fetchRankings()
    }
  }, [isOnline])

  // Refetch when active class changes
  useEffect(() => {
    if (isOnline && (userProfile?.active_class_id || userProfile?.class_id)) {
      fetchRankings()
    }
  }, [userProfile?.active_class_id, userProfile?.class_id, isOnline, fetchRankings])

  // Refetch data when screen comes into focus (e.g., after leaving a class)
  useFocusEffect(
    useCallback(() => {
      if (isOnline && (userProfile?.active_class_id || userProfile?.class_id)) {
        fetchRankings()
      }
    }, [isOnline, userProfile?.active_class_id, userProfile?.class_id, fetchRankings])
  )

  const loadCachedData = () => {
    try {
      const cached = storage.getString(STANDING_CACHE_KEY)
      if (cached) {
        const data: CachedStandingData = JSON.parse(cached)
        setRankings(data.rankings)
        setMyRank(data.myRank)
        setLoading(false)
      }
    } catch (error) {
      console.error('Error loading cached standings:', error)
    }
  }

  const cacheData = (rankings: StudentRanking[], myRank: number) => {
    try {
      const data: CachedStandingData = {
        rankings,
        myRank,
        totalStudents: rankings.length,
        lastUpdated: Date.now(),
      }
      storage.set(STANDING_CACHE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('Error caching standings:', error)
    }
  }

  const fetchRankings = useCallback(async () => {
    const activeClassId = userProfile?.active_class_id || userProfile?.class_id
    if (!activeClassId) return

    try {
      // Fetch all students in the class
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, name, roll_number, email')
        .eq('class_id', activeClassId)

      if (studentsError) {
        handleAuthError(studentsError)
        return
      }

      // Fetch all subjects for the class
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id')
        .eq('class_id', activeClassId)

      if (!subjects || subjects.length === 0) {
        setLoading(false)
        return
      }

      // Fetch all lectures
      const { data: lectures } = await supabase
        .from('lectures')
        .select('id')
        .in('subject_id', subjects.map(s => s.id))

      const totalLectures = lectures?.length || 0

      // Calculate attendance for each student
      const studentStats: StudentRanking[] = []

      for (const student of students || []) {
        if (totalLectures === 0) {
          studentStats.push({
            id: student.id,
            name: student.name,
            roll_number: student.roll_number,
            totalAttended: 0,
            totalLectures: 0,
            percentage: 0,
            rank: 0,
            isCurrentUser: student.email === userProfile.email || student.roll_number === userProfile.roll_number,
          })
          continue
        }

        const { data: attendance } = await supabase
          .from('attendance')
          .select('id')
          .eq('student_id', student.id)
          .in('lecture_id', lectures?.map(l => l.id) || [])
          .eq('status', 'present')

        const attended = attendance?.length || 0
        const percentage = totalLectures > 0 ? Math.round((attended / totalLectures) * 100) : 0

        studentStats.push({
          id: student.id,
          name: student.name,
          roll_number: student.roll_number,
          totalAttended: attended,
          totalLectures,
          percentage,
          rank: 0,
          isCurrentUser: student.email === userProfile.email || student.roll_number === userProfile.roll_number,
        })
      }

      // Sort by percentage and assign ranks
      studentStats.sort((a, b) => b.percentage - a.percentage)
      let currentRank = 1
      studentStats.forEach((student, index) => {
        if (index > 0 && student.percentage < studentStats[index - 1].percentage) {
          currentRank = index + 1
        }
        student.rank = currentRank
      })

      // Find current user's rank
      const myStudent = studentStats.find(s => s.isCurrentUser)
      const userRank = myStudent?.rank || 0

      setRankings(studentStats)
      setMyRank(userRank)
      cacheData(studentStats, userRank)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching rankings:', error)
      handleAuthError(error)
      setLoading(false)
    }
  }, [userProfile, handleAuthError])

  const onRefresh = async () => {
    if (!isOnline) return
    setRefreshing(true)
    await fetchRankings()
    setRefreshing(false)
  }

  const getBadge = (rank: number, total: number) => {
    const percentile = ((total - rank + 1) / total) * 100
    if (rank === 1) return { icon: 'crown', text: 'Champion', color: '#FFD700' }
    if (rank === 2) return { icon: 'medal', text: 'Runner Up', color: '#C0C0C0' }
    if (rank === 3) return { icon: 'medal-outline', text: 'Third Place', color: '#CD7F32' }
    if (percentile >= 90) return { icon: 'star', text: 'Star Performer', color: '#0077B6' }
    if (percentile >= 75) return { icon: 'star-outline', text: 'Top Performer', color: '#00B4D8' }
    if (percentile >= 50) return { icon: 'trending-up', text: 'Rising Star', color: '#48CAE4' }
    return { icon: 'arm-flex', text: 'Keep Going', color: '#6B7280' }
  }

  const getFilteredRankings = () => {
    switch (selectedFilter) {
      case 'top10':
        return rankings.slice(0, 10)
      case 'myPosition':
        const myIndex = rankings.findIndex(r => r.isCurrentUser)
        if (myIndex === -1) return rankings
        const start = Math.max(0, myIndex - 2)
        const end = Math.min(rankings.length, myIndex + 3)
        return rankings.slice(start, end)
      default:
        return rankings
    }
  }

  const renderStudentCard = ({ item, index }: { item: StudentRanking; index: number }) => {
    const badge = getBadge(item.rank, rankings.length)
    const isMe = item.isCurrentUser

    return (
      <Animated.View style={{ opacity: fadeAnim }}>
        <View style={[styles.studentCard, isMe && styles.myCard]}>
          <View style={styles.rankContainer}>
            <View style={[styles.rankBadge, { backgroundColor: item.rank <= 3 ? badge.color : '#F3F4F6' }]}>
              {item.rank <= 3 ? (
                <Icon name={badge.icon} size={moderateScale(18)} color="#FFFFFF" />
              ) : (
                <CustomText text={`#${item.rank}`} textStyle={[styles.rankText, { color: '#374151' }]} />
              )}
            </View>
          </View>

          <View style={styles.studentInfo}>
            <View style={styles.nameRow}>
              <CustomText text={item.name} textStyle={[styles.studentName, isMe && styles.myName]} />
              {isMe && (
                <View style={styles.youBadge}>
                  <CustomText text="You" textStyle={styles.youText} />
                </View>
              )}
            </View>
            <CustomText text={`Roll: ${item.roll_number}`} textStyle={styles.rollNumber} />
            <View style={styles.statsRow}>
              <CustomText 
                text={`${item.totalAttended}/${item.totalLectures} lectures`} 
                textStyle={styles.lectureStats} 
              />
              {item.rank <= Math.ceil(rankings.length * 0.25) && (
                <View style={[styles.badgeContainer, { backgroundColor: badge.color + '20' }]}>
                  <Icon name={badge.icon} size={moderateScale(12)} color={badge.color} />
                  <CustomText text={` ${badge.text}`} textStyle={[styles.badgeText, { color: badge.color }]} />
                </View>
              )}
            </View>
          </View>

          <View style={styles.percentageContainer}>
            <CustomText 
              text={`${item.percentage}%`} 
              textStyle={[styles.percentage, { color: item.percentage >= 75 ? '#10B981' : item.percentage >= 50 ? '#F59E0B' : '#EF4444' }]} 
            />
            <View style={styles.progressBarSmall}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${item.percentage}%`,
                    backgroundColor: item.percentage >= 75 ? '#10B981' : item.percentage >= 50 ? '#F59E0B' : '#EF4444'
                  }
                ]} 
              />
            </View>
          </View>
        </View>
      </Animated.View>
    )
  }

  const myStudent = rankings.find(r => r.isCurrentUser)
  const myBadge = myStudent ? getBadge(myStudent.rank, rankings.length) : null

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Icon name="trophy" size={moderateScale(28)} color="#00B4D8" />
          <CustomText text=" Class Standing" textStyle={styles.headerTitle} />
        </View>
        <CustomText text={`${rankings.length} Students`} textStyle={styles.headerSubtitle} />
      </View>

      {/* My Position Card */}
      {myStudent && (
        <View style={styles.myPositionCard}>
          <View style={styles.myPositionLeft}>
            <View style={[styles.myRankCircle, { borderColor: myBadge?.color }]}>
              <CustomText text={`#${myStudent.rank}`} textStyle={styles.myRankNumber} />
            </View>
            <View style={styles.myPositionInfo}>
              <CustomText text="Your Position" textStyle={styles.myPositionLabel} />
              <View style={styles.myBadgeRow}>
                <Icon name={myBadge?.icon || 'star'} size={moderateScale(14)} color={myBadge?.color} />
                <CustomText text={` ${myBadge?.text}`} textStyle={[styles.myPositionBadge, { color: myBadge?.color }]} />
              </View>
            </View>
          </View>
          <View style={styles.myPositionRight}>
            <CustomText text={`${myStudent.percentage}%`} textStyle={styles.myPositionPercentage} />
            <CustomText text="Attendance" textStyle={styles.myPositionAttLabel} />
          </View>
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {(['all', 'top10', 'myPosition'] as const).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterTab, selectedFilter === filter && styles.filterTabActive]}
            onPress={() => setSelectedFilter(filter)}
          >
            <CustomText 
              text={filter === 'all' ? 'All' : filter === 'top10' ? 'Top 10' : 'Near Me'} 
              textStyle={[styles.filterTabText, selectedFilter === filter && styles.filterTabTextActive]} 
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Rankings List */}
      <FlatList
        data={getFilteredRankings()}
        renderItem={renderStudentCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="chart-bar" size={moderateScale(48)} color="#9CA3AF" />
            <CustomText text="No rankings yet" textStyle={styles.emptyTitle} />
            <CustomText text="Rankings will appear once attendance is recorded" textStyle={styles.emptySubtitle} />
          </View>
        }
      />
    </SafeAreaView>
  )
}

export default StudentStanding

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(16),
    paddingBottom: moderateScale(12),
  },
  headerTitle: {
    fontSize: moderateScale(28),
    fontWeight: '700',
    color: '#1A1A2E',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: moderateScale(14),
    color: '#6B7280',
    marginTop: moderateScale(4),
  },
  myPositionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: moderateScale(20),
    padding: moderateScale(20),
    borderRadius: moderateScale(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: moderateScale(16),
  },
  myPositionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  myRankCircle: {
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: moderateScale(28),
    borderWidth: 3,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  myRankNumber: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: '#1A1A2E',
  },
  myBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  myPositionInfo: {},
  myPositionLabel: {
    fontSize: moderateScale(12),
    color: '#6B7280',
    marginBottom: moderateScale(2),
  },
  myPositionBadge: {
    fontSize: moderateScale(16),
    fontWeight: '600',
  },
  myPositionRight: {
    alignItems: 'flex-end',
  },
  myPositionPercentage: {
    fontSize: moderateScale(24),
    fontWeight: '700',
    color: '#10B981',
  },
  myPositionAttLabel: {
    fontSize: moderateScale(12),
    color: '#6B7280',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: moderateScale(20),
    marginBottom: moderateScale(16),
    gap: moderateScale(8),
  },
  filterTab: {
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(8),
    borderRadius: moderateScale(20),
    backgroundColor: '#F3F4F6',
  },
  filterTabActive: {
    backgroundColor: '#0077B6',
  },
  filterTabText: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: moderateScale(20),
    paddingBottom: moderateScale(100),
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(12),
    padding: moderateScale(16),
    marginBottom: moderateScale(10),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  myCard: {
    backgroundColor: '#E0F7FA',
    borderWidth: 2,
    borderColor: '#0077B6',
  },
  rankContainer: {
    marginRight: moderateScale(12),
  },
  rankBadge: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: moderateScale(14),
    fontWeight: '700',
  },
  studentInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(2),
  },
  studentName: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    color: '#1A1A2E',
  },
  myName: {
    color: '#0077B6',
  },
  youBadge: {
    backgroundColor: '#0077B6',
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(2),
    borderRadius: moderateScale(8),
    marginLeft: moderateScale(8),
  },
  youText: {
    fontSize: moderateScale(10),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rollNumber: {
    fontSize: moderateScale(12),
    color: '#6B7280',
    marginBottom: moderateScale(4),
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: moderateScale(8),
  },
  lectureStats: {
    fontSize: moderateScale(11),
    color: '#9CA3AF',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(2),
    borderRadius: moderateScale(8),
  },
  badgeText: {
    fontSize: moderateScale(10),
    fontWeight: '600',
  },
  percentageContainer: {
    alignItems: 'flex-end',
    minWidth: moderateScale(60),
  },
  percentage: {
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  progressBarSmall: {
    width: moderateScale(50),
    height: moderateScale(4),
    backgroundColor: '#E5E7EB',
    borderRadius: moderateScale(2),
    marginTop: moderateScale(4),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: moderateScale(2),
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: moderateScale(60),
  },
  emptyEmoji: {
    fontSize: moderateScale(48),
    marginBottom: moderateScale(12),
  },
  emptyTitle: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: moderateScale(4),
  },
  emptySubtitle: {
    fontSize: moderateScale(14),
    color: '#6B7280',
    textAlign: 'center',
  },
})
