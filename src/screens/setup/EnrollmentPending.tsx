import React, { useState, useEffect } from 'react'
import { StyleSheet, View, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { moderateScale } from 'react-native-size-matters'
import { useNavigation } from '@react-navigation/native'
import CustomText from '../../components/text'
import CustomButton from '../../components/button'
import { lightTheme } from '../../theme/colors'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface Enrollment {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  class_id: string
  requested_at: string
  classes?: {
    name: string
    code: string
  }
}

const EnrollmentPending = () => {
  const navigation = useNavigation<any>()
  const { user, refreshUserProfile } = useAuth()
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEnrollment()
    
    // Set up real-time subscription for enrollment updates
    const subscription = supabase
      .channel('enrollment_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'enrollments',
          filter: `student_id=eq.${user?.id}`,
        },
        (payload) => {
          const updatedEnrollment = payload.new as Enrollment
          setEnrollment((prev) =>
            prev ? { ...prev, ...updatedEnrollment } : null
          )
          
          if (updatedEnrollment.status === 'approved') {
            handleApproval(updatedEnrollment.class_id)
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [user?.id])

  const fetchEnrollment = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          *,
          classes (
            name,
            code
          )
        `)
        .eq('student_id', user.id)
        .order('requested_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      
      if (data) {
        setEnrollment(data)
        
        if (data.status === 'approved') {
          handleApproval(data.class_id)
        }
      }
    } catch (error) {
      console.error('Error fetching enrollment:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproval = async (classId: string) => {
    try {
      // Update profile with class_id and mark setup as complete
      await supabase
        .from('profiles')
        .update({
          class_id: classId,
          has_completed_setup: true,
        })
        .eq('id', user?.id)

      // Refresh user profile and navigate to dashboard
      await refreshUserProfile()
      navigation.replace('StudentDashboard')
    } catch (error) {
      console.error('Error updating profile:', error)
    }
  }

  const handleChangeClass = () => {
    navigation.replace('SelectClass')
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={lightTheme.primary} />
        </View>
      </SafeAreaView>
    )
  }

  const getStatusContent = () => {
    if (!enrollment) {
      return {
        emoji: '❓',
        title: 'No Enrollment Found',
        subtitle: 'You haven\'t requested to join any class yet.',
        color: '#6B7280',
      }
    }

    switch (enrollment.status) {
      case 'pending':
        return {
          emoji: '⏳',
          title: 'Awaiting Approval',
          subtitle: `Your enrollment request for "${enrollment.classes?.name}" has been sent. Please wait for the class administrator to approve your request.`,
          color: '#F59E0B',
        }
      case 'approved':
        return {
          emoji: '✅',
          title: 'Approved!',
          subtitle: `You have been approved to join "${enrollment.classes?.name}". Redirecting to dashboard...`,
          color: '#10B981',
        }
      case 'rejected':
        return {
          emoji: '❌',
          title: 'Request Declined',
          subtitle: `Your enrollment request for "${enrollment.classes?.name}" was not approved. You can try requesting to join another class.`,
          color: '#EF4444',
        }
      default:
        return {
          emoji: '❓',
          title: 'Unknown Status',
          subtitle: 'Please try again.',
          color: '#6B7280',
        }
    }
  }

  const content = getStatusContent()

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Status Icon */}
        <View style={[styles.iconContainer, { backgroundColor: content.color + '20' }]}>
          <CustomText text={content.emoji} textStyle={styles.statusEmoji} />
        </View>

        {/* Status Text */}
        <CustomText text={content.title} textStyle={[styles.title, { color: content.color }]} />
        <CustomText text={content.subtitle} textStyle={styles.subtitle} />

        {/* Class Info Card */}
        {enrollment?.classes && (
          <View style={styles.classCard}>
            <View style={styles.classInfo}>
              <CustomText text="📚 Class" textStyle={styles.classLabel} />
              <CustomText text={enrollment.classes.name} textStyle={styles.className} />
            </View>
            <View style={styles.classInfo}>
              <CustomText text="🔑 Code" textStyle={styles.classLabel} />
              <CustomText text={enrollment.classes.code} textStyle={styles.classCode} />
            </View>
          </View>
        )}

        {/* Pending Animation Indicator */}
        {enrollment?.status === 'pending' && (
          <View style={styles.pendingIndicator}>
            <ActivityIndicator size="small" color={lightTheme.primary} />
            <CustomText text="Checking for updates..." textStyle={styles.pendingText} />
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.footer}>
        {(enrollment?.status === 'rejected' || !enrollment) && (
          <CustomButton
            title="Select Another Class"
            onPress={handleChangeClass}
            containerStyle={styles.primaryButton}
            textStyle={styles.primaryButtonText}
          />
        )}
        
        {enrollment?.status === 'pending' && (
          <CustomButton
            title="Change Class Selection"
            onPress={handleChangeClass}
            containerStyle={styles.secondaryButton}
            textStyle={styles.secondaryButtonText}
          />
        )}
      </View>
    </SafeAreaView>
  )
}

export default EnrollmentPending

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: moderateScale(32),
  },
  iconContainer: {
    width: moderateScale(120),
    height: moderateScale(120),
    borderRadius: moderateScale(60),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: moderateScale(24),
  },
  statusEmoji: {
    fontSize: moderateScale(56),
  },
  title: {
    fontSize: moderateScale(24),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: moderateScale(12),
  },
  subtitle: {
    fontSize: moderateScale(15),
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: moderateScale(22),
    marginBottom: moderateScale(24),
  },
  classCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: moderateScale(16),
    padding: moderateScale(20),
    width: '100%',
    marginTop: moderateScale(8),
  },
  classInfo: {
    marginBottom: moderateScale(12),
  },
  classLabel: {
    fontSize: moderateScale(13),
    color: '#6B7280',
    marginBottom: moderateScale(4),
  },
  className: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    color: '#1A3A52',
  },
  classCode: {
    fontSize: moderateScale(16),
    fontWeight: '500',
    color: lightTheme.primary,
  },
  pendingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: moderateScale(24),
  },
  pendingText: {
    fontSize: moderateScale(13),
    color: '#6B7280',
    marginLeft: moderateScale(8),
  },
  footer: {
    paddingHorizontal: moderateScale(24),
    paddingBottom: moderateScale(24),
    paddingTop: moderateScale(12),
  },
  primaryButton: {
    backgroundColor: lightTheme.primary,
    borderRadius: moderateScale(12),
    height: moderateScale(52),
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: moderateScale(16),
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: moderateScale(12),
    height: moderateScale(52),
    borderWidth: 1,
    borderColor: lightTheme.primary,
  },
  secondaryButtonText: {
    color: lightTheme.primary,
    fontSize: moderateScale(16),
    fontWeight: '600',
  },
})
