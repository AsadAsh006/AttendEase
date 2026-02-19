import React, { useEffect } from 'react'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../contexts/AuthContext'

/**
 * AuthNavigator watches for auth state changes and handles navigation to Login
 * when user signs out. This component should be mounted at the app level.
 */
const AuthNavigator: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userProfile, loading } = useAuth()
  const navigation = useNavigation<any>()
  const previousUser = React.useRef(user)

  useEffect(() => {
    // Don't navigate while still loading initial auth state
    if (loading) return

    // Detect when user goes from authenticated to not authenticated (signout)
    const wasAuthenticated = previousUser.current !== null
    const isNowAuthenticated = user !== null

    if (wasAuthenticated && !isNowAuthenticated) {
      console.log('User signed out, navigating to Login')
      // Use reset to clear navigation stack
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      })
    }

    // Update ref for next comparison
    previousUser.current = user
  }, [user, loading, navigation])

  return <>{children}</>
}

export default AuthNavigator
