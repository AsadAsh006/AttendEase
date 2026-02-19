import React, { useState, useEffect } from 'react'
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { moderateScale } from 'react-native-size-matters'
import { useNavigation } from '@react-navigation/native'
import CustomText from '../../components/text'
import CustomButton from '../../components/button'
import Icon from 'react-native-vector-icons/Ionicons'
import { lightTheme } from '../../theme/colors'
import { lightTheme as theme } from '../../theme/colors'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationContext'

interface EnrollmentRequest {
  id: string
  student_id: string
  class_id: string
  status: 'pending' | 'approved' | 'rejected'
  requested_at: string
  profiles?: {
    name: string
    email: string
    roll_number: string
  }
}

const EnrollmentRequests = () => {
  const navigation = useNavigation<any>()
  const { user, userProfile } = useAuth()
  const { sendNotification } = useNotifications()
  const [requests, setRequests] = useState<EnrollmentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [className, setClassName] = useState('')

  useEffect(() => {
    fetchRequests()
    fetchClassName()

    // Real-time subscription for new requests
    const subscription = supabase
      .channel('enrollment_requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'enrollments',
        },
        () => {
          fetchRequests()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const fetchClassName = async () => {
    if (!userProfile?.class_id) return
    try {
      const { data } = await supabase
        .from('classes')
        .select('name')
        .eq('id', userProfile.class_id)
        .single()
      if (data) setClassName(data.name)
    } catch (error) {
      console.error('Error fetching class name:', error)
    }
  }

  const fetchRequests = async () => {
    if (!userProfile?.class_id) {
      setLoading(false)
      return
    }

    try {
      // Get enrollments for the CR/GR's class
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select('*')
        .eq('class_id', userProfile.class_id)
        .order('requested_at', { ascending: false })

      if (enrollmentsError) throw enrollmentsError

      // Fetch profiles for each enrollment
      const enrichedRequests = await Promise.all(
        (enrollmentsData || []).map(async (enrollment) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('name, email, roll_number')
            .eq('id', enrollment.student_id)
            .single()

          return {
            ...enrollment,
            profiles: profileData || { name: 'Unknown', email: '', roll_number: 'N/A' }
          }
        })
      )

      setRequests(enrichedRequests)
    } catch (error) {
      console.error('Error fetching enrollment requests:', error)
      Alert.alert('Error', 'Failed to load enrollment requests')
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchRequests()
    setRefreshing(false)
  }

  const handleApprove = async (request: EnrollmentRequest) => {
    setProcessingId(request.id)

    try {
      // Update enrollment status
      const { error: enrollmentError } = await supabase
        .from('enrollments')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq('id', request.id)

      if (enrollmentError) throw enrollmentError

      // Update student's profile with class_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          class_id: request.class_id,
          has_completed_setup: true,
        })
        .eq('id', request.student_id)

      if (profileError) throw profileError

      // Add student to students table if not exists
      const studentProfile = request.profiles
      if (studentProfile) {
        await supabase.from('students').upsert({
          class_id: request.class_id,
          user_id: request.student_id,
          name: studentProfile.name,
          roll_number: studentProfile.roll_number,
          email: studentProfile.email,
        }, {
          onConflict: 'class_id,roll_number'
        })
      }

      // Send notification to student
      await sendNotification(
        request.student_id,
        'enrollment_approved',
        'Enrollment Approved!',
        `Your request to join ${className || 'the class'} has been approved. Welcome aboard!`,
        { class_id: request.class_id, class_name: className }
      )

      Alert.alert('Success', `${studentProfile?.name || 'Student'} has been approved!`)
      fetchRequests()
    } catch (error: any) {
      console.error('Error approving enrollment:', error)
      Alert.alert('Error', error.message || 'Failed to approve enrollment')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (request: EnrollmentRequest) => {
    Alert.alert(
      'Reject Enrollment',
      `Are you sure you want to reject ${request.profiles?.name || 'this student'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(request.id)

            try {
              const { error } = await supabase
                .from('enrollments')
                .update({
                  status: 'rejected',
                  reviewed_at: new Date().toISOString(),
                  reviewed_by: user?.id,
                })
                .eq('id', request.id)

              if (error) throw error

              // Send notification to student
              await sendNotification(
                request.student_id,
                'enrollment_rejected',
                'Enrollment Update',
                `Your request to join ${className || 'the class'} was not approved. You can try another class.`,
                { class_id: request.class_id, class_name: className }
              )

              Alert.alert('Done', 'Enrollment request rejected')
              fetchRequests()
            } catch (error: any) {
              console.error('Error rejecting enrollment:', error)
              Alert.alert('Error', error.message || 'Failed to reject enrollment')
            } finally {
              setProcessingId(null)
            }
          },
        },
      ]
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { color: '#F59E0B', bg: '#FEF3C7', text: 'Pending' }
      case 'approved':
        return { color: '#10B981', bg: '#D1FAE5', text: 'Approved' }
      case 'rejected':
        return { color: '#EF4444', bg: '#FEE2E2', text: 'Rejected' }
      default:
        return { color: '#6B7280', bg: '#F3F4F6', text: status }
    }
  }

  const renderRequestCard = ({ item }: { item: EnrollmentRequest }) => {
    const statusBadge = getStatusBadge(item.status)
    const isProcessing = processingId === item.id

    return (
      <View style={styles.requestCard}>
        {/* Student Info */}
        <View style={styles.studentInfo}>
          <View style={styles.avatarContainer}>
            <Icon name="person" size={moderateScale(24)} color="#3B82F6" />
          </View>
          <View style={styles.details}>
            <CustomText text={item.profiles?.name || 'Unknown'} textStyle={styles.studentName} />
            <CustomText text={item.profiles?.email || ''} textStyle={styles.studentEmail} />
            <CustomText text={`Roll: ${item.profiles?.roll_number || 'N/A'}`} textStyle={styles.rollNumber} />
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
            <CustomText text={statusBadge.text} textStyle={[styles.statusText, { color: statusBadge.color }]} />
          </View>
        </View>

        {/* Request Date */}
        <CustomText
          text={`Requested: ${new Date(item.requested_at).toLocaleDateString()}`}
          textStyle={styles.requestDate}
        />

        {/* Action Buttons - Only for pending requests */}
        {item.status === 'pending' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.rejectButton, isProcessing && styles.disabledButton]}
              onPress={() => handleReject(item)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <CustomText text="✕ Reject" textStyle={styles.rejectButtonText} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.approveButton, isProcessing && styles.disabledButton]}
              onPress={() => handleApprove(item)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <CustomText text="✓ Approve" textStyle={styles.approveButtonText} />
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    )
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={moderateScale(24)} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <CustomText text="Enrollment Requests" textStyle={styles.title} />
          {pendingCount > 0 && (
            <View style={styles.pendingBadge}>
              <CustomText text={`${pendingCount} pending`} textStyle={styles.pendingText} />
            </View>
          )}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={lightTheme.primary} />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Icon name="clipboard-outline" size={moderateScale(64)} color="#9CA3AF" />
          </View>
          <CustomText text="No Enrollment Requests" textStyle={styles.emptyTitle} />
          <CustomText
            text="Students will appear here when they request to join your class."
            textStyle={styles.emptySubtitle}
          />
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderRequestCard}
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

export default EnrollmentRequests

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(16),
    backgroundColor: theme.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: {
    padding: moderateScale(3),
    marginRight: moderateScale(12),
  },
  backIcon: {
    fontSize: moderateScale(24),
    color: '#1A3A52',
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: '#1A3A52',
  },
  pendingBadge: {
    marginLeft: moderateScale(8),
    backgroundColor: '#FEF3C7',
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(12),
  },
  pendingText: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: '#F59E0B',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: moderateScale(40),
  },
  emptyIconContainer: {
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
  listContent: {
    padding: moderateScale(16),
  },
  requestCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: moderateScale(12),
    padding: moderateScale(16),
    marginBottom: moderateScale(12),
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(12),
  },
  avatarContainer: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    backgroundColor: '#E0F2FC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  details: {
    flex: 1,
  },
  studentName: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: '#1A3A52',
    marginBottom: moderateScale(2),
  },
  studentEmail: {
    fontSize: moderateScale(13),
    color: '#6B7280',
    marginBottom: moderateScale(2),
  },
  rollNumber: {
    fontSize: moderateScale(12),
    color: '#9CA3AF',
  },
  statusBadge: {
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(12),
  },
  statusText: {
    fontSize: moderateScale(12),
    fontWeight: '600',
  },
  requestDate: {
    fontSize: moderateScale(12),
    color: '#9CA3AF',
    marginBottom: moderateScale(12),
  },
  actionButtons: {
    flexDirection: 'row',
    gap: moderateScale(12),
  },
  rejectButton: {
    flex: 1,
    height: moderateScale(44),
    borderRadius: moderateScale(10),
    borderWidth: 1,
    borderColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButtonText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#EF4444',
  },
  approveButton: {
    flex: 1,
    height: moderateScale(44),
    borderRadius: moderateScale(10),
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  approveButtonText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.6,
  },
})
