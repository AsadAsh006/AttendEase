import React, { useState, useEffect, useCallback } from 'react'
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Text,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { moderateScale } from 'react-native-size-matters'
import { useNavigation } from '@react-navigation/native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import CustomText from '../../components/text'
import CustomButton from '../../components/button'
import { useAuth } from '../../contexts/AuthContext'
import { useOffline } from '../../contexts/OfflineContext'
import { supabase } from '../../lib/supabase'

interface Enrollment {
  enrollment_id: string
  class_id: string
  status: 'pending' | 'approved' | 'rejected'
  requested_at: string
  reviewed_at?: string
  class_name: string
  class_code: string
  admin_name?: string
  student_record_exists: number
}

const ClassEnrollments = () => {
  const navigation = useNavigation<any>()
  const { user, userProfile, refreshUserProfile } = useAuth()
  const { isOnline } = useOffline()
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [switchingClass, setSwitchingClass] = useState<string | null>(null)
  const activeClassId = userProfile?.active_class_id || userProfile?.class_id

  useEffect(() => {
    fetchEnrollments()
  }, [user])

  const fetchEnrollments = useCallback(async () => {
    if (!user) return

    try {
      // First, try to get from the view
      const { data: viewData, error: viewError } = await supabase
        .from('student_active_enrollments')
        .select('*')
        .eq('student_id', user.id)
        .order('requested_at', { ascending: false })

      // If view query succeeds, use it
      if (!viewError && viewData) {
        setEnrollments(viewData as any[])
      } else {
        // Fallback: manually construct enrollment data
        const { data: enrollmentData, error: enrollError } = await supabase
          .from('enrollments')
          .select(`
            id,
            class_id,
            status,
            requested_at,
            reviewed_at,
            classes (
              name,
              code,
              created_by
            )
          `)
          .eq('student_id', user.id)
          .in('status', ['approved', 'pending'])
          .order('requested_at', { ascending: false })

        if (enrollError) throw enrollError

        // Check which ones have student records
        const enrichedData = await Promise.all(
          (enrollmentData || []).map(async (enrollment: any) => {
            const { data: studentData } = await supabase
              .from('students')
              .select('id')
              .eq('class_id', enrollment.class_id)
              .eq('email', userProfile?.email)
              .single()

            return {
              enrollment_id: enrollment.id,
              student_id: user.id,
              class_id: enrollment.class_id,
              status: enrollment.status,
              requested_at: enrollment.requested_at,
              reviewed_at: enrollment.reviewed_at,
              class_name: enrollment.classes?.name || 'Unknown',
              class_code: enrollment.classes?.code || 'N/A',
              admin_id: enrollment.classes?.created_by,
              student_record_exists: studentData ? 1 : 0,
            }
          })
        )

        setEnrollments(enrichedData)
      }
    } catch (error) {
      console.error('Error fetching enrollments:', error)
      Alert.alert('Error', 'Failed to load enrollments')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user, userProfile])

  const onRefresh = async () => {
    if (!isOnline) return
    setRefreshing(true)
    await fetchEnrollments()
  }

  const handleSwitchClass = async (classId: string) => {
    if (!isOnline) {
      Alert.alert('Offline', 'You need to be online to switch classes')
      return
    }

    setSwitchingClass(classId)
    try {
      // Call the database function to switch active class
      const { data, error } = await supabase.rpc('switch_active_class', {
        new_class_id: classId,
      })

      if (error) throw error

      if (data?.success) {
        await refreshUserProfile()
        Alert.alert('Success', 'Class switched successfully!', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ])
      } else {
        Alert.alert('Error', data?.error || 'Failed to switch class')
      }
    } catch (error: any) {
      console.error('Error switching class:', error)
      Alert.alert('Error', error.message || 'Failed to switch class')
    } finally {
      setSwitchingClass(null)
    }
  }

  const handleCancelEnrollment = (enrollmentId: string, className: string) => {
    Alert.alert(
      'Cancel Enrollment',
      `Are you sure you want to cancel your enrollment request for ${className}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!user) {
                Alert.alert('Error', 'User not found')
                return
              }

              const { error } = await supabase
                .from('enrollments')
                .delete()
                .eq('id', enrollmentId)
                .eq('student_id', user.id)

              if (error) {
                console.error('Delete error:', error)
                throw error
              }
              
              Alert.alert('Success', 'Enrollment request cancelled')
              fetchEnrollments()
            } catch (error: any) {
              console.error('Error cancelling enrollment:', error)
              Alert.alert('Error', error.message || 'Failed to cancel enrollment')
            }
          },
        },
      ]
    )
  }

  const handleLeaveClass = (classId: string, className: string) => {
    Alert.alert(
      'Leave Class',
      `Are you sure you want to leave ${className}? Your attendance records will be preserved but you will no longer have access to this class.`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!userProfile?.email || !user) {
                Alert.alert('Error', 'User profile not found')
                return
              }

              // Delete the student record from the class
              const { error: deleteStudentError } = await supabase
                .from('students')
                .delete()
                .eq('class_id', classId)
                .eq('email', userProfile.email)

              if (deleteStudentError) {
                console.error('Error deleting student:', deleteStudentError)
                throw deleteStudentError
              }

              // Also mark the enrollment as left/inactive by deleting it
              // This ensures the class won't show up in enrolled classes
              const { error: deleteEnrollmentError } = await supabase
                .from('enrollments')
                .delete()
                .eq('student_id', user.id)
                .eq('class_id', classId)
                .eq('status', 'approved')

              if (deleteEnrollmentError) {
                console.error('Error removing enrollment:', deleteEnrollmentError)
                // Don't throw - student is already removed, this is just cleanup
              }

              // Clear all cached data to force refresh
              const MMKV = require('react-native-mmkv').MMKV
              const storage = new MMKV()
              storage.delete('AttendEase.studentHome')
              storage.delete('AttendEase.standings')
              storage.delete('AttendEase.notepad')
              storage.delete('AttendEase.stats')

              // Refresh profile to update active_class_id
              await refreshUserProfile()
              
              // Small delay to ensure profile is updated
              await new Promise<void>(resolve => setTimeout(resolve, 500))
              
              // Reload enrollments to update UI
              await fetchEnrollments()
              
              Alert.alert(
                'Success', 
                'You have left the class successfully.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Navigate back to force refresh of dashboard
                      navigation.goBack()
                    },
                  },
                ]
              )
            } catch (error: any) {
              console.error('Error leaving class:', error)
              Alert.alert('Error', error.message || 'Failed to leave class')
            }
          },
        },
      ]
    )
  }

  const handleApplyForClass = () => {
    navigation.navigate('SelectClass', { multiEnrollment: true })
  }

  const getStatusBadge = (status: string) => {
    const config = {
      approved: { bg: '#DCFCE7', color: '#166534', icon: 'check-circle', label: 'Approved' },
      pending: { bg: '#FEF3C7', color: '#92400E', icon: 'clock-outline', label: 'Pending' },
      rejected: { bg: '#FEE2E2', color: '#991B1B', icon: 'close-circle', label: 'Rejected' },
    }
    return config[status as keyof typeof config] || config.pending
  }

  const approvedEnrollments = enrollments.filter(
    (e) => e.status === 'approved' && e.student_record_exists > 0
  )
  const pendingEnrollments = enrollments.filter((e) => e.status === 'pending')
  const rejectedEnrollments = enrollments.filter((e) => e.status === 'rejected')

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0077B6" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={moderateScale(24)} color="#1A1A2E" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <CustomText text="My Classes" textStyle={styles.headerTitle} />
          </View>
          <View style={styles.headerRight} />
        </View>

        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Icon name="wifi-off" size={moderateScale(14)} color="#B91C1C" />
            <CustomText text=" Offline Mode" textStyle={styles.offlineBannerText} />
          </View>
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Icon name="information-outline" size={moderateScale(20)} color="#0077B6" />
          <CustomText
            text="You can enroll in multiple classes. Switch between them anytime to view different attendance records."
            textStyle={styles.infoText}
          />
        </View>

        {/* Active Classes Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Icon name="school" size={moderateScale(18)} color="#0077B6" />
              <CustomText text=" Enrolled Classes" textStyle={styles.sectionTitle} />
            </View>
            <View style={styles.badge}>
              <CustomText text={`${approvedEnrollments.length}`} textStyle={styles.badgeText} />
            </View>
          </View>

          {approvedEnrollments.length === 0 ? (
            <View style={styles.emptyCard}>
              <Icon name="school-outline" size={moderateScale(40)} color="#9CA3AF" />
              <CustomText text="No enrolled classes" textStyle={styles.emptyTitle} />
              <CustomText
                text="Apply for a class to start tracking attendance"
                textStyle={styles.emptySubtitle}
              />
            </View>
          ) : (
            approvedEnrollments.map((enrollment) => {
              const isActive = enrollment.class_id === activeClassId
              const badge = getStatusBadge(enrollment.status)

              return (
                <View
                  key={enrollment.enrollment_id || enrollment.class_id}
                  style={[styles.enrollmentCard, isActive && styles.activeEnrollmentCard]}
                >
                  <View style={styles.enrollmentHeader}>
                    <View style={styles.enrollmentInfo}>
                      <View style={styles.classNameRow}>
                        <CustomText text={enrollment.class_name} textStyle={styles.className} />
                        {isActive && (
                          <View style={styles.activeTag}>
                            <CustomText text="Active" textStyle={styles.activeTagText} />
                          </View>
                        )}
                      </View>
                      <CustomText text={enrollment.class_code} textStyle={styles.classCode} />
                      {enrollment.admin_name && (
                        <View style={styles.adminRow}>
                          <Icon name="account-tie" size={moderateScale(12)} color="#6B7280" />
                          <CustomText
                            text={` ${enrollment.admin_name}`}
                            textStyle={styles.adminName}
                          />
                        </View>
                      )}
                    </View>

                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                      <Icon name={badge.icon} size={moderateScale(16)} color={badge.color} />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', marginTop: moderateScale(12) }}>
                    {!isActive && (
                      <View style={{ flex: 1, marginRight: moderateScale(8) }}>
                        <TouchableOpacity
                          onPress={() => handleSwitchClass(enrollment.class_id)}
                          disabled={!!switchingClass}
                          activeOpacity={0.7}
                        >
                          <View style={{
                            flexDirection: 'row',
                            backgroundColor: '#0077B6',
                            paddingHorizontal: moderateScale(16),
                            paddingVertical: moderateScale(10),
                            borderRadius: moderateScale(10),
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}>
                            {switchingClass === enrollment.class_id ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Icon name="swap-horizontal" size={moderateScale(16)} color="#FFFFFF" />
                                <Text style={{ 
                                  fontSize: moderateScale(13), 
                                  fontWeight: '600',
                                  color: '#FFFFFF',
                                  marginLeft: moderateScale(6),
                                }}>
                                  Switch
                                </Text>
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <TouchableOpacity
                        onPress={() => handleLeaveClass(enrollment.class_id, enrollment.class_name)}
                        activeOpacity={0.7}
                      >
                        <View style={{
                          flexDirection: 'row',
                          backgroundColor: '#FEE2E2',
                          paddingHorizontal: moderateScale(16),
                          paddingVertical: moderateScale(10),
                          borderRadius: moderateScale(10),
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}>
                          <Icon name="exit-to-app" size={moderateScale(16)} color="#EF4444" />
                          <Text style={{ 
                            fontSize: moderateScale(13), 
                            fontWeight: '600',
                            color: '#EF4444',
                            marginLeft: moderateScale(6),
                          }}>
                            Leave Class
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )
            })
          )}
        </View>

        {/* Pending Requests Section */}
        {pendingEnrollments.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Icon name="clock-outline" size={moderateScale(18)} color="#F59E0B" />
                <CustomText text=" Pending Requests" textStyle={styles.sectionTitle} />
              </View>
              <View style={[styles.badge, { backgroundColor: '#FEF3C7' }]}>
                <CustomText
                  text={`${pendingEnrollments.length}`}
                  textStyle={[styles.badgeText, { color: '#92400E' }]}
                />
              </View>
            </View>

            {pendingEnrollments.map((enrollment) => {
              const badge = getStatusBadge(enrollment.status)

              return (
                <View key={enrollment.enrollment_id || enrollment.class_id} style={styles.enrollmentCard}>
                  <View style={styles.enrollmentHeader}>
                    <View style={styles.enrollmentInfo}>
                      <CustomText text={enrollment.class_name} textStyle={styles.className} />
                      <CustomText text={enrollment.class_code} textStyle={styles.classCode} />
                      <CustomText
                        text={`Requested ${new Date(enrollment.requested_at).toLocaleDateString()}`}
                        textStyle={styles.dateText}
                      />
                    </View>

                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                      <Icon name={badge.icon} size={moderateScale(16)} color={badge.color} />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => handleCancelEnrollment(enrollment.enrollment_id, enrollment.class_name)}
                  >
                    <Icon name="close" size={moderateScale(16)} color="#EF4444" />
                    <CustomText text=" Cancel Request" textStyle={styles.cancelButtonText} />
                  </TouchableOpacity>
                </View>
              )
            })}
          </View>
        )}

        {/* Rejected Requests Section */}
        {rejectedEnrollments.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Icon name="close-circle-outline" size={moderateScale(18)} color="#EF4444" />
                <CustomText text=" Rejected Requests" textStyle={styles.sectionTitle} />
              </View>
            </View>

            {rejectedEnrollments.map((enrollment) => {
              const badge = getStatusBadge(enrollment.status)

              return (
                <View key={enrollment.enrollment_id || enrollment.class_id} style={styles.enrollmentCard}>
                  <View style={styles.enrollmentHeader}>
                    <View style={styles.enrollmentInfo}>
                      <CustomText text={enrollment.class_name} textStyle={styles.className} />
                      <CustomText text={enrollment.class_code} textStyle={styles.classCode} />
                      {enrollment.reviewed_at && (
                        <CustomText
                          text={`Rejected on ${new Date(enrollment.reviewed_at).toLocaleDateString()}`}
                          textStyle={styles.dateText}
                        />
                      )}
                    </View>

                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                      <Icon name={badge.icon} size={moderateScale(16)} color={badge.color} />
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* Apply Button */}
        <View style={styles.applySection}>
          <CustomButton
            title="Apply for Another Class"
            buttonStyle={styles.applyButton}
            textStyle={styles.applyButtonText}
            onPress={handleApplyForClass}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

export default ClassEnrollments

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(16),
  },
  backButton: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: '#1A1A2E',
  },
  headerRight: {
    width: moderateScale(40),
  },
  offlineBanner: {
    backgroundColor: '#FEE2E2',
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(16),
    marginHorizontal: moderateScale(20),
    marginBottom: moderateScale(12),
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
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    marginHorizontal: moderateScale(20),
    marginBottom: moderateScale(16),
    padding: moderateScale(16),
    borderRadius: moderateScale(12),
    borderLeftWidth: 4,
    borderLeftColor: '#0077B6',
  },
  infoText: {
    flex: 1,
    fontSize: moderateScale(12),
    color: '#1E40AF',
    marginLeft: moderateScale(12),
    lineHeight: moderateScale(16),
  },
  section: {
    marginBottom: moderateScale(24),
    paddingHorizontal: moderateScale(20),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: moderateScale(12),
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
  badge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(12),
  },
  badgeText: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: '#166534',
  },
  enrollmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(16),
    padding: moderateScale(16),
    marginBottom: moderateScale(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  activeEnrollmentCard: {
    borderWidth: 2,
    borderColor: '#0077B6',
  },
  enrollmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  enrollmentInfo: {
    flex: 1,
  },
  classNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(4),
  },
  className: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: '#1A1A2E',
  },
  activeTag: {
    backgroundColor: '#0077B6',
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(2),
    borderRadius: moderateScale(8),
    marginLeft: moderateScale(8),
  },
  activeTagText: {
    fontSize: moderateScale(10),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  classCode: {
    fontSize: moderateScale(13),
    color: '#6B7280',
    marginBottom: moderateScale(4),
  },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: moderateScale(4),
  },
  adminName: {
    fontSize: moderateScale(12),
    color: '#6B7280',
  },
  dateText: {
    fontSize: moderateScale(11),
    color: '#9CA3AF',
    marginTop: moderateScale(4),
  },
  statusBadge: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchButton: {
    flexDirection: 'row',
    backgroundColor: '#0077B6',
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(10),
    borderRadius: moderateScale(10),
    marginTop: moderateScale(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchButtonText: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: moderateScale(12),
  },
  leaveButton: {
    flexDirection: 'row',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(10),
    borderRadius: moderateScale(10),
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaveButtonText: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: '#EF4444',
  },
  cancelButton: {
    flexDirection: 'row',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(10),
    borderRadius: moderateScale(10),
    marginTop: moderateScale(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: '#EF4444',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(16),
    padding: moderateScale(32),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: '#1A1A2E',
    marginTop: moderateScale(12),
    marginBottom: moderateScale(4),
  },
  emptySubtitle: {
    fontSize: moderateScale(13),
    color: '#6B7280',
    textAlign: 'center',
  },
  applySection: {
    paddingHorizontal: moderateScale(20),
    paddingBottom: moderateScale(100),
  },
  applyButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: moderateScale(15),
    fontWeight: '600',
    marginLeft: moderateScale(8),
  },
})
