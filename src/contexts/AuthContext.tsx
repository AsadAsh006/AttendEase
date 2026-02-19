import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { MMKV } from 'react-native-mmkv'
import NetInfo from '@react-native-community/netinfo'
import * as RootNavigation from '../navigation/navigationRef'

const storage = new MMKV()
const PROFILE_CACHE_KEY = 'AttendEase.userProfile'
const SESSION_CACHE_KEY = 'AttendEase.session'
const ACTIVE_ROLE_CACHE_KEY = 'AttendEase.activeRole'

interface UserProfile {
  id: string
  email: string
  name: string
  roll_number: string
  role: 'student' | 'teacher' | 'cr_gr'
  has_completed_setup: boolean
  class_id?: string
  admin_class_id?: string
  active_class_id?: string // NEW: Active class for multi-enrollment support
  is_admin?: boolean
  created_at: string
}

interface AuthContextType {
  session: Session | null
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  activeRole: 'student' | 'admin' | null
  setActiveRole: (role: 'student' | 'admin' | null) => void
  isDualRole: boolean
  signUp: (email: string, password: string, name: string, rollNumber: string, role: string) => Promise<{ error: any }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  refreshUserProfile: () => Promise<void>
  handleAuthError: (error: any) => void
  validateSession: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Helper functions for caching
const cacheProfile = (profile: UserProfile | null) => {
  if (profile) {
    storage.set(PROFILE_CACHE_KEY, JSON.stringify(profile))
  } else {
    storage.delete(PROFILE_CACHE_KEY)
  }
}

const getCachedProfile = (): UserProfile | null => {
  try {
    const cached = storage.getString(PROFILE_CACHE_KEY)
    return cached ? JSON.parse(cached) : null
  } catch {
    return null
  }
}

const cacheActiveRole = (role: 'student' | 'admin' | null) => {
  if (role) {
    storage.set(ACTIVE_ROLE_CACHE_KEY, role)
  } else {
    storage.delete(ACTIVE_ROLE_CACHE_KEY)
  }
}

const getCachedActiveRole = (): 'student' | 'admin' | null => {
  try {
    const cached = storage.getString(ACTIVE_ROLE_CACHE_KEY)
    return cached as 'student' | 'admin' | null
  } catch {
    return null
  }
}

const clearAllCache = () => {
  storage.delete(PROFILE_CACHE_KEY)
  storage.delete(SESSION_CACHE_KEY)
  storage.delete(ACTIVE_ROLE_CACHE_KEY)
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(getCachedProfile())
  const [loading, setLoading] = useState(true)
  const [activeRole, setActiveRole] = useState<'student' | 'admin' | null>(getCachedActiveRole())
  const [isOnline, setIsOnline] = useState(true)

  // Check if user has dual role (is_admin and has class_id as student)
  // A user is dual role if they have is_admin=true AND have a class_id (enrolled as student)
  const isDualRole = Boolean(
    userProfile?.is_admin && 
    userProfile?.class_id
  )

  // Monitor network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? true)
    })
    return () => unsubscribe()
  }, [])

  // Update active role with caching
  const updateActiveRole = useCallback((role: 'student' | 'admin' | null) => {
    setActiveRole(role)
    cacheActiveRole(role)
  }, [])

  // Force logout function for invalid sessions
  const forceLogout = async (reason?: string) => {
    console.log('Force logout triggered:', reason)
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Error during force logout:', error)
    }
    clearAllCache()
    setSession(null)
    setUser(null)
    setUserProfile(null)
    setActiveRole(null)
    setLoading(false)
  }

  useEffect(() => {
    // Get initial session - OFFLINE FIRST approach
    const initializeAuth = async () => {
      // STEP 1: Load cached profile immediately (before any network calls)
      const cachedProfile = getCachedProfile()
      if (cachedProfile) {
        console.log('Loading cached profile on startup')
        setUserProfile(cachedProfile)
      }

      // STEP 2: Check network status
      let online = true
      try {
        const networkState = await NetInfo.fetch()
        online = networkState.isConnected ?? true
      } catch (e) {
        console.log('Failed to check network, assuming offline')
        online = false
      }

      // STEP 3: If offline, just use cached data and stop
      if (!online) {
        console.log('Offline startup: Using cached data only')
        setLoading(false)
        return
      }

      // STEP 4: Try to get session (only when online)
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Session error:', error)
          
          // Network error - keep cached profile
          if (error.message?.toLowerCase().includes('network') || 
              error.message?.toLowerCase().includes('fetch') ||
              error.message?.toLowerCase().includes('failed')) {
            console.log('Network error during session fetch, using cached profile')
            setLoading(false)
            return
          }
          
          // Token expired or invalid - force logout (only when truly online)
          if (error.message?.includes('expired') || error.message?.includes('invalid')) {
            forceLogout('Session expired or invalid')
            return
          }
          
          // Other errors - keep cached profile
          setLoading(false)
          return
        }
        
        if (session?.user) {
          setSession(session)
          setUser(session.user)
          fetchUserProfile(session.user.id)
        } else {
          // No session and online - user is logged out
          if (!cachedProfile) {
            setLoading(false)
          } else {
            // We have cached profile but no session - might be offline issue
            setLoading(false)
          }
        }
      } catch (error: any) {
        console.error('Auth initialization error:', error)
        // Keep cached profile on any error
        setLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, 'session:', !!session, 'user:', !!session?.user)
      
      // Check if online (with error handling)
      let online = true
      try {
        const networkState = await NetInfo.fetch()
        online = networkState.isConnected ?? true
      } catch (e) {
        online = false
      }
      
      // Handle token refresh failure
      if (event === 'TOKEN_REFRESHED' && !session) {
        // Only force logout if online - offline token refresh will naturally fail
        if (online) {
          console.log('Token refresh failed, clearing state')
          clearAllCache()
          setSession(null)
          setUser(null)
          setUserProfile(null)
          setActiveRole(null)
          setLoading(false)
        }
        return
      }
      
      // Handle sign out - just clear state, don't call signOut again
      if (event === 'SIGNED_OUT') {
        console.log('SIGNED_OUT event detected, clearing state and navigating')
        if (online) {
          clearAllCache()
          setSession(null)
          setUser(null)
          setUserProfile(null)
          setActiveRole(null)
          
          // Navigate to Login using global navigation
          setTimeout(() => {
            RootNavigation.replace('Login')
          }, 100)
        }
        setLoading(false)
        return
      }

      // Handle successful sign in or session restoration
      if (session?.user) {
        console.log('Setting user and fetching profile for:', session.user.id)
        setSession(session)
        setUser(session.user)
        fetchUserProfile(session.user.id)
      } else {
        // No session and not a sign out event - handle carefully
        if (online) {
          setSession(null)
          setUser(null)
          // Only clear profile if we're online and there's genuinely no session
          const cachedProfile = getCachedProfile()
          if (!cachedProfile) {
            setUserProfile(null)
          }
        }
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Subscribe to profile changes for the current user
  useEffect(() => {
    if (!user?.id || !isOnline) return

    console.log('Setting up profile subscription for user:', user.id)

    const profileChannel = supabase
      .channel(`profile-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Profile updated via realtime:', payload)
          // Refresh user profile when it changes (e.g., when made admin)
          if (payload.new && payload.old) {
            const updatedProfile = payload.new as UserProfile
            const oldProfile = payload.old as UserProfile
            console.log('Auto-refreshing profile - old is_admin:', oldProfile.is_admin, 'new is_admin:', updatedProfile.is_admin)
            
            // Check if is_admin status changed - if so, clear activeRole to trigger role selection
            if (updatedProfile.is_admin !== oldProfile.is_admin) {
              console.log('Admin status changed from', oldProfile.is_admin, 'to', updatedProfile.is_admin, '- clearing active role')
              setActiveRole(null)
              cacheActiveRole(null)
            }
            
            setUserProfile(updatedProfile)
            cacheProfile(updatedProfile)
          }
        }
      )
      .subscribe()

    return () => {
      console.log('Cleaning up profile subscription')
      supabase.removeChannel(profileChannel)
    }
  }, [user?.id, isOnline])

  const fetchUserProfile = async (userId: string) => {
    // Check network status
    const networkState = await NetInfo.fetch()
    const online = networkState.isConnected ?? true

    // If offline, try to use cached profile
    if (!online) {
      console.log('Offline: Using cached profile')
      const cachedProfile = getCachedProfile()
      if (cachedProfile && cachedProfile.id === userId) {
        setUserProfile(cachedProfile)
        setLoading(false)
        return
      }
      // No cached profile, still try to fetch but expect it may fail
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        // If offline and we have cached data, use it instead of logging out
        if (!online || error.message?.includes('network') || error.message?.includes('fetch')) {
          const cachedProfile = getCachedProfile()
          if (cachedProfile && cachedProfile.id === userId) {
            console.log('Network error: Using cached profile')
            setUserProfile(cachedProfile)
            setLoading(false)
            return
          }
        }

        // PGRST116 = "The result contains 0 rows" - user profile doesn't exist
        if (error.code === 'PGRST116' || error.message?.includes('not found')) {
          console.log('User profile not found, logging out...')
          forceLogout('User profile not found')
          return
        }
        // JWT expired or invalid token errors
        if (error.message?.includes('JWT') || error.message?.includes('token')) {
          console.log('Token expired or invalid, logging out...')
          forceLogout('Token expired')
          return
        }
        throw error
      }
      
      if (!data) {
        console.log('No profile data returned, logging out...')
        forceLogout('User profile not found')
        return
      }
      
      // Cache the profile for offline use
      cacheProfile(data)
      setUserProfile(data)
    } catch (error: any) {
      console.error('Error fetching user profile:', error)
      
      // If fetch failed due to network, try cached profile
      const cachedProfile = getCachedProfile()
      if (cachedProfile && cachedProfile.id === userId) {
        console.log('Fetch failed: Using cached profile')
        setUserProfile(cachedProfile)
        setLoading(false)
        return
      }

      // Check for auth related errors
      if (error?.status === 401 || error?.status === 403) {
        forceLogout('Unauthorized - session invalid')
        return
      }
    } finally {
      setLoading(false)
    }
  }

  const refreshUserProfile = async () => {
    if (user) {
      await fetchUserProfile(user.id)
    }
  }

  // Handle auth errors from API calls throughout the app
  const handleAuthError = (error: any) => {
    if (!error) return
    
    const errorMessage = error?.message || error?.error_description || ''
    const errorCode = error?.code || error?.status
    
    // Check for common auth error patterns
    const isAuthError = 
      errorCode === 401 ||
      errorCode === 403 ||
      errorCode === 'PGRST301' || // JWT expired
      errorMessage.toLowerCase().includes('jwt') ||
      errorMessage.toLowerCase().includes('token') ||
      errorMessage.toLowerCase().includes('expired') ||
      errorMessage.toLowerCase().includes('invalid') ||
      errorMessage.toLowerCase().includes('unauthorized') ||
      errorMessage.toLowerCase().includes('not authenticated') ||
      errorMessage.toLowerCase().includes('session')

    if (isAuthError) {
      console.log('Auth error detected, forcing logout:', errorMessage)
      forceLogout(errorMessage || 'Authentication error')
    }
  }

  // Validate current session is still valid
  const validateSession = async (): Promise<boolean> => {
    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession()
      
      if (error || !currentSession) {
        console.log('Session validation failed:', error?.message || 'No session')
        forceLogout('Session validation failed')
        return false
      }

      // Check if token is expired
      if (currentSession.expires_at) {
        const expiresAt = new Date(currentSession.expires_at * 1000)
        if (expiresAt < new Date()) {
          console.log('Session expired')
          forceLogout('Session expired')
          return false
        }
      }

      // Verify user still exists by checking profile
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', currentSession.user.id)
        .single()

      if (profileError || !data) {
        console.log('User profile no longer exists')
        forceLogout('User no longer exists')
        return false
      }

      return true
    } catch (error) {
      console.error('Session validation error:', error)
      return false
    }
  }

  // Periodic session validation (every 5 minutes when app is active)
  useEffect(() => {
    if (!session) return

    const intervalId = setInterval(() => {
      validateSession()
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(intervalId)
  }, [session])

  // Validate session when app comes to foreground
  const appState = useRef(AppState.currentState)
  
  useEffect(() => {
    if (!session) return

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // App coming from background to foreground
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('App came to foreground, validating session...')
        validateSession()
      }
      appState.current = nextAppState
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange)

    return () => {
      subscription.remove()
    }
  }, [session])

  const signUp = async (
    email: string,
    password: string,
    name: string,
    rollNumber: string,
    role: string
  ) => {
    try {
      const normalizedEmail = email.toLowerCase().trim()
      const normalizedRollNumber = rollNumber.trim()

      // Check if email already exists in profiles (bypass cache with count query)
      const { count: emailCount, error: emailCheckError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('email', normalizedEmail)

      if (emailCheckError) {
        console.error('Email check error:', emailCheckError)
      }

      if (emailCount && emailCount > 0) {
        return { error: { message: 'An account with this email already exists' } }
      }

      // Check if roll number already exists (bypass cache with count query)
      const { count: rollCount, error: rollCheckError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('roll_number', normalizedRollNumber)

      if (rollCheckError) {
        console.error('Roll number check error:', rollCheckError)
      }

      if (rollCount && rollCount > 0) {
        return { error: { message: 'An account with this roll number already exists' } }
      }

      // Try to sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            name,
            roll_number: normalizedRollNumber,
            role: role === 'cr_gr' ? 'cr_gr' : role,
          }
        }
      })

      console.log('SignUp response:', { 
        hasUser: !!authData?.user, 
        hasSession: !!authData?.session,
        identitiesLength: authData?.user?.identities?.length,
        authError: authError?.message 
      })

      // Helper function to recover orphaned auth user (exists in auth but not in profiles)
      const recoverOrphanedUser = async () => {
        console.log('Attempting to recover orphaned auth user...')
        
        // Try to sign in with the provided credentials
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        })

        if (signInError) {
          console.log('Sign in failed for orphaned user:', signInError.message)
          // Password doesn't match the existing auth user
          return { error: { message: 'An account with this email exists but with a different password. Please use the correct password or try a different email.' } }
        }

        // Successfully signed in - this is an orphaned auth user, recreate profile
        if (signInData.user) {
          console.log('Signed in orphaned user, creating profile...')
          
          // Double check profile doesn't exist
          const { count: profileExists } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('id', signInData.user.id)

          if (profileExists && profileExists > 0) {
            console.log('Profile already exists for this user')
            return { error: null } // Profile exists, just return success
          }
          
          const { error: profileError } = await supabase.from('profiles').insert({
            id: signInData.user.id,
            email: normalizedEmail,
            name,
            roll_number: normalizedRollNumber,
            role: role === 'cr_gr' ? 'cr_gr' : role,
            has_completed_setup: role !== 'cr_gr',
          })

          if (profileError) {
            // If profile creation fails due to duplicate, user might need to just sign in
            if (profileError.code === '23505') {
              console.log('Profile duplicate error, considering success')
              return { error: null }
            }
            console.error('Profile creation error for orphaned user:', profileError)
            return { error: profileError }
          }

          console.log('Successfully recovered orphaned user')
          return { error: null }
        }

        return { error: { message: 'Failed to recover account. Please contact support.' } }
      }

      // Handle case where user exists in auth but not in profiles (orphaned auth user)
      // This happens when profile was deleted but auth user wasn't
      if (authError) {
        // Check if the error indicates user already exists
        const errorMessage = authError.message?.toLowerCase() || ''
        console.log('Auth error message:', errorMessage)
        
        if (errorMessage.includes('already registered') || 
            errorMessage.includes('already exists') ||
            errorMessage.includes('user already registered') ||
            errorMessage.includes('email address is already registered')) {
          return await recoverOrphanedUser()
        }
        
        return { error: authError }
      }

      if (!authData.user) {
        return { error: { message: 'User creation failed' } }
      }

      // Check if this is a fake signup (user already exists, Supabase returns user without session)
      // This happens when email confirmation is disabled and user already exists
      // Supabase returns the existing user but with empty identities array
      if (authData.user.identities?.length === 0) {
        console.log('Detected fake signup - user already exists in auth (empty identities)')
        return await recoverOrphanedUser()
      }

      // For new users, we have the user from authData - no need to call getUser()
      // The session might not be immediately available depending on email confirmation settings
      console.log('New user created successfully:', authData.user.id)

      // Create user profile using the user ID from signup response
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        email: normalizedEmail,
        name,
        roll_number: normalizedRollNumber,
        role: role === 'cr_gr' ? 'cr_gr' : role,
        has_completed_setup: role !== 'cr_gr', // CR/GR needs setup
      })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        return { error: profileError }
      }

      console.log('Profile created successfully')

      // If we have a session, the auth state listener will pick it up
      // If not (email confirmation required), user needs to verify email first
      if (!authData.session) {
        console.log('No session after signup - email confirmation may be required')
        // Still return success - profile is created, user just needs to confirm email
      }

      return { error: null }

      return { error: null }
    } catch (error) {
      console.error('SignUp error:', error)
      return { error }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      // Clear active role on login so dual-role users see role selection
      setActiveRole(null)
      cacheActiveRole(null)
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return { error }
    } catch (error) {
      return { error }
    }
  }

  const signOut = async () => {
    console.log('SignOut called')
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      // Clear all state immediately
      clearAllCache()
      setSession(null)
      setUser(null)
      setUserProfile(null)
      setActiveRole(null)
      
      // Navigate to Login immediately using global navigation
      console.log('Navigating to Login after signout')
      setTimeout(() => {
        RootNavigation.replace('Login')
      }, 100)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        userProfile,
        loading,
        activeRole,
        setActiveRole: updateActiveRole,
        isDualRole,
        signUp,
        signIn,
        signOut,
        refreshUserProfile,
        handleAuthError,
        validateSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
