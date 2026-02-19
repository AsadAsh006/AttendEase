import { StyleSheet, View, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, StatusBar, TextInput, Alert, Animated, Dimensions, Image, Text } from 'react-native'
import React, { useState, useEffect, useRef } from 'react'
import { moderateScale } from 'react-native-size-matters'
import { useNavigation } from '@react-navigation/native'
import CustomText from '../../components/text'
import Icon from 'react-native-vector-icons/MaterialIcons'
import CustomButton from '../../components/button'
import { lightTheme } from '../../theme/colors'
import { useAuth } from '../../contexts/AuthContext'
import images from '../../assets/images'

const { width, height } = Dimensions.get('window')

const Login = () => {
  const navigation = useNavigation<any>()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [loading, setLoading] = useState(false)

  // Animation values
  const logoTranslateY = useRef(new Animated.Value(height * 0.15)).current
  const logoScale = useRef(new Animated.Value(1)).current
  const cardTranslateY = useRef(new Animated.Value(height)).current
  const headerOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Start animations on mount
    Animated.parallel([
      // Logo moves up and scales down
      Animated.timing(logoTranslateY, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 0.8,
        duration: 600,
        useNativeDriver: true,
      }),
      // Card slides up from bottom
      Animated.spring(cardTranslateY, {
        toValue: 0,
        tension: 50,
        friction: 10,
        useNativeDriver: true,
        delay: 200,
      }),
      // Header fades in
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 400,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleLogin = async () => {
    // Reset errors
    setEmailError('')
    setPasswordError('')

    let isValid = true

    // Validate email
    if (!email.trim()) {
      setEmailError('Email is required')
      isValid = false
    } else if (!validateEmail(email)) {
      setEmailError('Please enter a valid email')
      isValid = false
    }

    // Validate password
    if (!password.trim()) {
      setPasswordError('Password is required')
      isValid = false
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters')
      isValid = false
    }

    if (isValid) {
      setLoading(true)
      try {
        const response = await signIn(email, password)
        console.log('Login response:', response)
        const { error } = response
        
        if (error) {
          Alert.alert('Login Failed', error.message || 'Invalid credentials')
          setLoading(false)
        } else {
          console.log('Login successful, navigating to RootNavigator...')
          // Wait a bit longer for auth state to fully update
          setTimeout(() => {
            navigation.replace('RootNavigator')
            setLoading(false)
          }, 500)
        }
      } catch (error: any) {
        console.error('Login error:', error)
        Alert.alert('Error', error.message || 'Something went wrong')
        setLoading(false)
      }
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={lightTheme.background} />
      
      {/* Background decorative shapes */}
      <View style={styles.backgroundShapes}>
        <View style={[styles.circle, styles.circle1]} />
        <View style={[styles.circle, styles.circle2]} />
      </View>

      {/* Top section with logo */}
      <Animated.View 
        style={[
          styles.topSection,
          {
            transform: [
              { translateY: logoTranslateY },
              { scale: logoScale },
            ],
          },
        ]}
      >
        <Image
          source={images.logo1}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.appName}>
          <Text style={styles.appNameAttend}>Attend</Text>
          <Text style={styles.appNameEase}>Ease</Text>
        </Text>
      </Animated.View>

      {/* Login Card sliding up from bottom */}
      <Animated.View
        style={[
          styles.cardContainer,
          {
            transform: [{ translateY: cardTranslateY }],
          },
        ]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header with back button */}
            <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.replace('Splash')}>
                <Icon name="arrow-back" style={styles.backIcon} />
              </TouchableOpacity>
              <CustomText text="Login" textStyle={styles.title} />
            </Animated.View>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter your email address"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={(text) => {
                  setEmail(text)
                  setEmailError('')
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {emailError ? <CustomText text={emailError} textStyle={styles.errorText} /> : null}

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={(text) => {
                  setPassword(text)
                  setPasswordError('')
                }}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {passwordError ? <CustomText text={passwordError} textStyle={styles.errorText} /> : null}

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <CustomText
                text={loading ? 'Signing in...' : 'Login'}
                textStyle={styles.loginButtonText}
              />
            </TouchableOpacity>

            {/* Footer Links */}
            <View style={styles.footer}>
              <CustomText text="Don't have an account? " textStyle={styles.footerText} />
              <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                <CustomText text="Sign up" textStyle={styles.signUpLink} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.forgotPassword}>
              <CustomText text="Forgot password?" textStyle={styles.forgotPasswordText} />
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  )
}

export default Login

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightTheme.background,
  },
  backgroundShapes: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
  },
  circle1: {
    width: width * 0.6,
    height: width * 0.6,
    backgroundColor: lightTheme.primaryLight + '20',
    top: -width * 0.2,
    right: -width * 0.2,
  },
  circle2: {
    width: width * 0.4,
    height: width * 0.4,
    backgroundColor: lightTheme.primary + '15',
    top: height * 0.1,
    left: -width * 0.15,
  },
  topSection: {
    alignItems: 'center',
    paddingTop: moderateScale(60),
    paddingBottom: moderateScale(50),
  },
  backButton: {
    width: moderateScale(36),
    height: moderateScale(36),
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor: lightTheme.primaryLight + '30',
    // borderRadius: moderateScale(18),
    // marginRight: moderateScale(12),
  },
  backIcon: {
    fontSize: moderateScale(24),
    color: lightTheme.primaryDark,
    fontWeight: '400',
  },
  logo: {
    width: moderateScale(100),
    height: moderateScale(100),
    marginBottom: 8,
  },
  appName: {
    fontSize: moderateScale(26),
    fontWeight: '600',
  },
  appNameAttend: {
    color: '#464a52',
  },
  appNameEase: {
    color: lightTheme.primaryDark,
  },
  cardContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: moderateScale(30),
    borderTopRightRadius: moderateScale(30),
    shadowColor: lightTheme.primaryDark,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    marginTop: moderateScale(10),
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: moderateScale(30),
    paddingBottom: moderateScale(32),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(30),
  },
  title: {
    fontSize: moderateScale(28),
    fontWeight: '700',
    color: lightTheme.primaryDark,
  },
  inputContainer: {
    backgroundColor: lightTheme.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: lightTheme.primaryLight + '50',
  },
  input: {
    fontSize: moderateScale(14),
    color: '#111827',
    paddingVertical: 14,
  },
  errorText: {
    fontSize: moderateScale(12),
    color: '#EF4444',
    marginTop: -12,
    marginBottom: 12,
    marginLeft: 4,
  },
  loginButton: {
    backgroundColor: lightTheme.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    shadowColor: lightTheme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    
  },
  footerText: {
    fontSize: moderateScale(14),
    color: lightTheme.textSecondary,
  },
  signUpLink: {
    fontSize: moderateScale(14),
    color: lightTheme.primary,
    fontWeight: '600',
  },
  forgotPassword: {
    alignItems: 'center',
  },
  forgotPasswordText: {
    fontSize: moderateScale(14),
    color: lightTheme.textSecondary,
    textDecorationLine: 'underline',
  },
})