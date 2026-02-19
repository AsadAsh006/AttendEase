import { StyleSheet, View, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, StatusBar, TextInput, Alert } from 'react-native'
import React, { useState } from 'react'
import { moderateScale } from 'react-native-size-matters'
import { useNavigation } from '@react-navigation/native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Icon from 'react-native-vector-icons/MaterialIcons'
import CustomText from '../../components/text'
import CustomButton from '../../components/button'
import Dropdown from '../../components/Dropdown'
import { lightTheme } from '../../theme/colors'
import { useAuth } from '../../contexts/AuthContext'

const SignUp = () => {
  const navigation = useNavigation<any>()
  const { signUp } = useAuth()
  const [name, setName] = useState('')
  const [rollNumber, setRollNumber] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<string | number>('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  
  const [nameError, setNameError] = useState('')
  const [rollNumberError, setRollNumberError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [roleError, setRoleError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [confirmPasswordError, setConfirmPasswordError] = useState('')

  const roleOptions = [
    { label: 'Student', value: 'student' },
    // { label: 'Teacher', value: 'teacher' },
    { label: 'CR / GR', value: 'cr_gr' },
  ]

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSignUp = async () => {
    // Reset errors
    setNameError('')
    setRollNumberError('')
    setEmailError('')
    setRoleError('')
    setPasswordError('')
    setConfirmPasswordError('')

    let isValid = true

    // Validate name
    if (!name.trim()) {
      setNameError('Name is required')
      isValid = false
    } else if (name.trim().length < 2) {
      setNameError('Name must be at least 2 characters')
      isValid = false
    }

    // Validate roll number
    if (!rollNumber.trim()) {
      setRollNumberError('Roll number is required')
      isValid = false
    } else if (rollNumber.trim().length < 2) {
      setRollNumberError('Roll number must be at least 2 characters')
      isValid = false
    }

    // Validate email
    if (!email.trim()) {
      setEmailError('Email is required')
      isValid = false
    } else if (!validateEmail(email)) {
      setEmailError('Please enter a valid email')
      isValid = false
    }

    // Validate role
    if (!role) {
      setRoleError('Please select a role')
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

    // Validate confirm password
    if (!confirmPassword.trim()) {
      setConfirmPasswordError('Please confirm your password')
      isValid = false
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match')
      isValid = false
    }

    if (isValid) {
      setLoading(true)
      try {
        const response = await signUp(email, password, name, rollNumber, role.toString())
        console.log('SignUp auth response:', response)
        const { error } = response
        
        if (error) {
          Alert.alert('Sign Up Failed', error.message || 'Could not create account')
          setLoading(false)
        } else {
          Alert.alert('Success', 'Account created successfully! Please sign in.')
          navigation.navigate('Login')
          setLoading(false)
        }
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Something went wrong')
        setLoading(false)
      }
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={moderateScale(24)} color={lightTheme.primaryDark} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <CustomText text="Register" textStyle={styles.title} />
          </View>

          {/* Full Name Input */}
          <View style={styles.inputContainer}>
            <Icon name="person-outline" size={moderateScale(20)} color={lightTheme.primary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={(text) => {
                setName(text)
                setNameError('')
              }}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>
          {nameError ? <CustomText text={nameError} textStyle={styles.errorText} /> : null}

          {/* Roll Number Input */}
          <View style={styles.inputContainer}>
            <Icon name="badge" size={moderateScale(20)} color={lightTheme.primary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your roll number"
              placeholderTextColor="#9CA3AF"
              value={rollNumber}
              onChangeText={(text) => {
                setRollNumber(text)
                setRollNumberError('')
              }}
              autoCorrect={false}
            />
          </View>
          {rollNumberError ? <CustomText text={rollNumberError} textStyle={styles.errorText} /> : null}

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Icon name="mail-outline" size={moderateScale(20)} color={lightTheme.primary} style={styles.inputIcon} />
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

          {/* Role Dropdown */}
          <View style={styles.dropdownWrapper}>
            <Dropdown
              options={roleOptions}
              value={role}
              onValueChange={(value) => {
                setRole(value)
                setRoleError('')
              }}
              placeholder="Select your role (Student / CR/GR)"
              style={styles.dropdownInput}
              containerStyle={styles.dropdownContainer}
            />
          </View>
          {roleError ? <CustomText text={roleError} textStyle={styles.errorText} /> : null}

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Icon name="lock-outline" size={moderateScale(20)} color={lightTheme.primary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Create a password (6 digits)"
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

          {/* Confirm Password Input */}
          <View style={styles.inputContainer}>
            <Icon name="lock" size={moderateScale(20)} color={lightTheme.primary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Confirm your password"
              placeholderTextColor="#9CA3AF"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text)
                setConfirmPasswordError('')
              }}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {confirmPasswordError ? <CustomText text={confirmPasswordError} textStyle={styles.errorText} /> : null}

          {/* Register Button */}
          <TouchableOpacity
            style={[styles.registerButton, loading && styles.registerButtonDisabled]}
            onPress={handleSignUp}
            disabled={loading}
          >
            <CustomText
              text={loading ? 'Creating Account...' : 'Register'}
              textStyle={styles.registerButtonText}
            />
          </TouchableOpacity>

          {/* Terms and Privacy */}
          <View style={styles.termsContainer}>
            <CustomText
              text="By signing up you agree to our Terms of Service and Privacy Policy."
              textStyle={styles.termsText}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export default SignUp

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  backButton: {
    width: moderateScale(40),
    height: moderateScale(40),
    justifyContent: 'center',
    marginBottom: 20,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: moderateScale(28),
    fontWeight: '700',
    color: lightTheme.primaryDark,
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightTheme.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: lightTheme.primaryLight + '50',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: moderateScale(14),
    color: '#111827',
    padding: 0,
  },
  dropdownWrapper: {
    marginBottom: 16,
  },
  dropdownContainer: {
    paddingVertical: 0,
  },
  dropdownInput: {
    backgroundColor: lightTheme.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: lightTheme.primaryLight + '50',
  },
  errorText: {
    fontSize: moderateScale(12),
    color: '#EF4444',
    marginTop: -12,
    marginBottom: 12,
    marginLeft: 4,
  },
  registerButton: {
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
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  termsContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  termsText: {
    fontSize: moderateScale(12),
    color: lightTheme.textSecondary,
    textAlign: 'center',
    lineHeight: moderateScale(18),
  },
})