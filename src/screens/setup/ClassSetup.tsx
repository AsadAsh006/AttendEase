import { StyleSheet, View, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, StatusBar, TextInput, Alert } from 'react-native'
import React, { useState } from 'react'
import { moderateScale } from 'react-native-size-matters'
import { useNavigation } from '@react-navigation/native'
import { SafeAreaView } from 'react-native-safe-area-context'
import CustomText from '../../components/text'
import { lightTheme } from '../../theme/colors'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const ClassSetup = () => {
  const navigation = useNavigation<any>()
  const { user, refreshUserProfile } = useAuth()
  const [className, setClassName] = useState('')
  const [classCode, setClassCode] = useState('')
  const [loading, setLoading] = useState(false)

  const generateClassCode = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    setClassCode(code)
  }

  const handleCreateClass = async () => {
    if (!className.trim()) {
      Alert.alert('Error', 'Please enter a class name')
      return
    }

    if (!classCode.trim()) {
      Alert.alert('Error', 'Please generate or enter a class code')
      return
    }

    setLoading(true)
    try {
      // Create class
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .insert({
          name: className,
          code: classCode,
          created_by: user?.id,
        })
        .select()
        .single()

      if (classError) throw classError

      // Get user profile for name and roll number
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, roll_number, email')
        .eq('id', user?.id)
        .single()

      // Add admin as a student in the class
      const { error: studentError } = await supabase
        .from('students')
        .insert({
          name: profile?.name || 'Admin',
          roll_number: profile?.roll_number || 'CR001',
          email: profile?.email || user?.email,
          class_id: classData.id,
        })

      if (studentError) {
        console.log('Error adding admin as student:', studentError)
        // Continue even if student insert fails
      }

      // Update user profile with class_id, admin_class_id, is_admin and completed setup
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          class_id: classData.id,
          admin_class_id: classData.id,
          is_admin: true,
          has_completed_setup: true,
        })
        .eq('id', user?.id)

      if (profileError) throw profileError

      await refreshUserProfile()
      navigation.replace('AddSubjects', { classId: classData.id })
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create class')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    generateClassCode()
  }, [])

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
          {/* Header */}
          <View style={styles.header}>
            <CustomText text="🎓" textStyle={styles.emoji} />
            <CustomText text="Create Your Class" textStyle={styles.title} />
            <CustomText
              text="As a CR/GR, set up your class to start managing attendance"
              textStyle={styles.subtitle}
            />
          </View>

          {/* Class Name Input */}
          <View style={styles.inputContainer}>
            <CustomText text="📚" textStyle={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter class name (e.g., CS-3A)"
              placeholderTextColor="#9CA3AF"
              value={className}
              onChangeText={setClassName}
              autoCapitalize="words"
            />
          </View>

          {/* Class Code Input */}
          <View style={styles.codeSection}>
            <CustomText text="Class Code" textStyle={styles.label} />
            <View style={styles.codeContainer}>
              <View style={styles.codeInputWrapper}>
                <CustomText text="🔑" textStyle={styles.inputIcon} />
                <TextInput
                  style={styles.codeInput}
                  placeholder="Class code"
                  placeholderTextColor="#9CA3AF"
                  value={classCode}
                  onChangeText={setClassCode}
                  autoCapitalize="characters"
                  maxLength={6}
                />
              </View>
              <TouchableOpacity style={styles.generateButton} onPress={generateClassCode}>
                <CustomText text="Generate" textStyle={styles.generateButtonText} />
              </TouchableOpacity>
            </View>
            <CustomText
              text="Students will use this code to join your class"
              textStyle={styles.helperText}
            />
          </View>

          {/* Create Button */}
          <TouchableOpacity
            style={[styles.createButton, loading && styles.createButtonDisabled]}
            onPress={handleCreateClass}
            disabled={loading}
          >
            <CustomText
              text={loading ? 'Creating Class...' : 'Create Class'}
              textStyle={styles.createButtonText}
            />
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export default ClassSetup

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
    paddingTop: 40,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  emoji: {
    fontSize: moderateScale(60),
    marginBottom: 16,
  },
  title: {
    fontSize: moderateScale(28),
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: moderateScale(14),
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: moderateScale(20),
    paddingHorizontal: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 24,
  },
  inputIcon: {
    fontSize: moderateScale(20),
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: moderateScale(14),
    color: '#111827',
    padding: 0,
  },
  codeSection: {
    marginBottom: 32,
  },
  label: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  codeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  codeInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  codeInput: {
    flex: 1,
    fontSize: moderateScale(14),
    color: '#111827',
    padding: 0,
    fontWeight: '600',
  },
  generateButton: {
    backgroundColor: lightTheme.primaryLight,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
  },
  generateButtonText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: lightTheme.primary,
  },
  helperText: {
    fontSize: moderateScale(12),
    color: '#6B7280',
    marginLeft: 4,
  },
  createButton: {
    backgroundColor: lightTheme.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#FFFFFF',
  },
})
