import React, { useEffect, useState } from 'react'
import { ActivityIndicator, View, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../contexts/AuthContext'
import { lightTheme } from '../theme/colors'
import { supabase } from '../lib/supabase'

interface Enrollment {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  class_id: string
}

const RootNavigator = () => {
  const { user, userProfile, loading, isDualRole, activeRole, refreshUserProfile } = useAuth()
  const navigation = useNavigation<any>()
  const [checkingEnrollment, setCheckingEnrollment] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const profileFetchAttempted = React.useRef(false)
  const lastUserId = React.useRef<string | null>(null)

  // Reset profile fetch flag when user changes (login/logout)
  useEffect(() => {
    const currentUserId = user?.id || null
    if (currentUserId !== lastUserId.current) {
      console.log('User changed, resetting profile fetch flag')
      profileFetchAttempted.current = false
      setLoadingProfile(false)
      lastUserId.current = currentUserId
    }
  }, [user?.id])

  useEffect(() => {
    const checkAndNavigate = async () => {
      console.log('RootNavigator check:', { 
        loading, 
        hasUser: !!user, 
        hasProfile: !!userProfile, 
        loadingProfile,
        fetchAttempted: profileFetchAttempted.current 
      })
      
      // Still loading auth state
      if (loading) {
        console.log('Still loading auth state, waiting...')
        return
      }
      
      // If we have user but no profile, try to refresh it (only once)
      if (user && !userProfile && !loadingProfile && !profileFetchAttempted.current) {
        console.log('User exists but no profile, fetching profile...')
        setLoadingProfile(true)
        profileFetchAttempted.current = true
        try {
          await refreshUserProfile()
          console.log('Profile fetch completed')
        } catch (error) {
          console.error('Failed to refresh profile:', error)
        } finally {
          setLoadingProfile(false)
        }
        return // Wait for next effect trigger
      }

      // If we're loading profile, wait
      if (loadingProfile) {
        console.log('Loading profile, waiting...')
        return
      }

      // If we tried to fetch profile but still don't have one after user exists, log out
      if (user && !userProfile && profileFetchAttempted.current && !loadingProfile) {
        console.log('ERROR: Profile fetch completed but no profile found, navigating to Login')
        profileFetchAttempted.current = false // Reset before logout
        navigation.replace('Login')
        return
      }

      if (!user) {
        // Not authenticated - go back to login
        console.log('No user authenticated, navigating to Login')
        navigation.replace('Login')
        return
      }

      // If no profile yet, wait for it to load
      if (!userProfile) {
        console.log('Waiting for profile to load...')
        return
      }

      console.log('Navigating for user:', userProfile.email, 'role:', userProfile.role, 'is_admin:', userProfile.is_admin, 'isDualRole:', isDualRole, 'activeRole:', activeRole)

      // CR/GR first login - redirect to class setup
      if (userProfile.role === 'cr_gr' && !userProfile.has_completed_setup) {
        navigation.replace('ClassSetup')
        return
      }

      // Check if user has dual role (is both admin and student)
      // This should be checked BEFORE the student flow
      if (isDualRole) {
        console.log('User has dual role, checking activeRole:', activeRole)
        // If no role selected yet, show role selection screen
        if (!activeRole) {
          console.log('No active role, showing RoleSelection')
          navigation.replace('RoleSelection')
          return
        }
        
        // Navigate based on selected role
        if (activeRole === 'admin') {
          navigation.replace('Main')
        } else {
          navigation.replace('StudentDashboard')
        }
        return
      }

      // Check if user is an admin (is_admin=true) but not enrolled as student yet
      // They should go to admin dashboard
      if (userProfile.is_admin && userProfile.admin_class_id) {
        console.log('User is admin only, going to Main')
        navigation.replace('Main')
        return
      }

      // Student flow - check enrollment status
      if (userProfile.role === 'student') {
        setCheckingEnrollment(true)
        
        try {
          // Check if student has completed setup (has class_id)
          if (userProfile.class_id && userProfile.has_completed_setup) {
            navigation.replace('StudentDashboard')
            return
          }

          // Check for existing enrollment
          const { data: enrollment } = await supabase
            .from('enrollments')
            .select('*')
            .eq('student_id', user.id)
            .order('requested_at', { ascending: false })
            .limit(1)
            .single()

          if (!enrollment) {
            // No enrollment - go to class selection
            navigation.replace('SelectClass')
          } else if (enrollment.status === 'pending') {
            // Pending approval - show on dashboard
            navigation.replace('StudentDashboard')
          } else if (enrollment.status === 'approved') {
            // Approved - update profile and go to dashboard
            await supabase
              .from('profiles')
              .update({
                class_id: enrollment.class_id,
                has_completed_setup: true,
              })
              .eq('id', user.id)
            
            navigation.replace('StudentDashboard')
          } else if (enrollment.status === 'rejected') {
            // Rejected - allow re-selection
            navigation.replace('SelectClass')
          }
        } catch (error) {
          console.error('Error checking enrollment:', error)
          navigation.replace('SelectClass')
        } finally {
          setCheckingEnrollment(false)
        }
        return
      }

      // Teacher and other roles - go to main dashboard
      navigation.replace('Main')
    }

    checkAndNavigate()
  }, [user, userProfile, loading, navigation, isDualRole, activeRole, loadingProfile])

  // Show loading while checking auth state, loading profile, or enrollment
  if (loading || loadingProfile || checkingEnrollment) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={lightTheme.primary} />
      </View>
    )
  }

  // Return loading indicator while navigation is happening
  // This prevents blank screen flash
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={lightTheme.primary} />
    </View>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
})

export default RootNavigator
