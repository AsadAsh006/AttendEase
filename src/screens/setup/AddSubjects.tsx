import { StyleSheet, View, TouchableOpacity, ScrollView, StatusBar, TextInput, Alert, FlatList } from 'react-native'
import React, { useState } from 'react'
import { moderateScale } from 'react-native-size-matters'
import { useNavigation, useRoute } from '@react-navigation/native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import CustomText from '../../components/text'
import { lightTheme } from '../../theme/colors'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface Subject {
  name: string
  code?: string
  description?: string
  credit_hours?: string
  // teacher_email: string
}

const AddSubjects = () => {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { classId } = route.params
  const { userProfile } = useAuth()

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectName, setSubjectName] = useState('')
  const [subjectCode, setSubjectCode] = useState('')
  const [description, setDescription] = useState('')
  const [creditHours, setCreditHours] = useState('')
  // const [teacherEmail, setTeacherEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const addSubject = () => {
    if (!subjectName.trim()) {
      Alert.alert('Error', 'Please enter subject name')
      return
    }
    // if (!teacherEmail.trim()) {
    //   Alert.alert('Error', 'Please enter teacher email')
    //   return
    // }

    // const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    // if (!emailRegex.test(teacherEmail)) {
    //   Alert.alert('Error', 'Please enter a valid email')
    //   return
    // }

    setSubjects([...subjects, { 
      name: subjectName,
      code: subjectCode,
      description: description,
      credit_hours: creditHours,
    }])
    setSubjectName('')
    setSubjectCode('')
    setDescription('')
    setCreditHours('')
    // setTeacherEmail('')
  }

  const removeSubject = (index: number) => {
    setSubjects(subjects.filter((_, i) => i !== index))
  }

  const handleFinishSetup = async () => {
    if (subjects.length === 0) {
      Alert.alert('Error', 'Please add at least one subject')
      return
    }

    setLoading(true)
    try {
      // Insert all subjects
      const subjectPromises = subjects.map(async (subject) => {
        const { error } = await supabase.from('subjects').insert({
          class_id: classId,
          name: subject.name,
          code: subject.code,
          description: subject.description,
          credit_hours: subject.credit_hours,
          teacher_email: userProfile?.email || '',
        })
        if (error) throw error
      })

      await Promise.all(subjectPromises)

      Alert.alert('Success', 'Class setup completed successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.replace('Main'),
        },
      ])
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add subjects')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Icon name="book-open-page-variant" size={moderateScale(48)} color={lightTheme.primary} style={styles.headerIcon} />
          <CustomText text="Add Subjects" textStyle={styles.title} />
          <CustomText
            text="Add subjects for your class"
            textStyle={styles.subtitle}
          />
        </View>

        {/* Subject Name Input */}
        <View style={styles.inputContainer}>
          <Icon name="book-multiple" size={moderateScale(20)} color="#6B7280" />
          <TextInput
            style={styles.input}
            placeholder="Subject name (e.g., Mathematics)"
            placeholderTextColor="#9CA3AF"
            value={subjectName}
            onChangeText={setSubjectName}
          />
        </View>

        {/* Subject Code Input */}
        <View style={styles.inputContainer}>
          <Icon name="identifier" size={moderateScale(20)} color="#6B7280" />
          <TextInput
            style={styles.input}
            placeholder="Subject code (e.g., MATH101)"
            placeholderTextColor="#9CA3AF"
            value={subjectCode}
            onChangeText={setSubjectCode}
          />
        </View>

        {/* Description Input */}
        <View style={styles.inputContainer}>
          <Icon name="text" size={moderateScale(20)} color="#6B7280" />
          <TextInput
            style={styles.input}
            placeholder="Description (optional)"
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
          />
        </View>

        {/* Credit Hours Input */}
        <View style={styles.inputContainer}>
          <Icon name="clock-outline" size={moderateScale(20)} color="#6B7280" />
          <TextInput
            style={styles.input}
            placeholder="Credit hours (e.g., 3)"
            placeholderTextColor="#9CA3AF"
            value={creditHours}
            onChangeText={setCreditHours}
            keyboardType="numeric"
          />
        </View>

        {/* Teacher Email Input
        <View style={styles.inputContainer}>
          <CustomText text="👨‍🏫" textStyle={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Teacher email"
            placeholderTextColor="#9CA3AF"
            value={teacherEmail}
            onChangeText={setTeacherEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View> */}

        {/* Add Button */}
        <TouchableOpacity style={styles.addButton} onPress={addSubject}>
          <CustomText text="+ Add Subject" textStyle={styles.addButtonText} />
        </TouchableOpacity>

        {/* Subjects List */}
        {subjects.length > 0 && (
          <View style={styles.subjectsSection}>
            <CustomText text="Added Subjects" textStyle={styles.sectionTitle} />
            {subjects.map((subject, index) => (
              <View key={index} style={styles.subjectCard}>
                <View style={styles.subjectInfo}>
                  <CustomText text={subject.name} textStyle={styles.subjectName} />
                  {subject.code && (
                    <CustomText text={`Code: ${subject.code}`} textStyle={styles.subjectDetail} />
                  )}
                  {subject.description && (
                    <CustomText text={subject.description} textStyle={styles.subjectDetail} />
                  )}
                  {subject.credit_hours && (
                    <CustomText text={`${subject.credit_hours} credit hours`} textStyle={styles.subjectDetail} />
                  )}
                  {/* <CustomText text={subject.teacher_email} textStyle={styles.teacherEmail} /> */}
                </View>
                <TouchableOpacity onPress={() => removeSubject(index)} style={styles.removeButton}>
                  <Icon name="close" size={moderateScale(18)} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Finish Button */}
        <TouchableOpacity
          style={[styles.finishButton, loading && styles.finishButtonDisabled]}
          onPress={handleFinishSetup}
          disabled={loading}
        >
          <CustomText
            text={loading ? 'Saving...' : 'Finish Setup'}
            textStyle={styles.finishButtonText}
          />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

export default AddSubjects

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  headerIcon: {
    marginBottom: 12,
  },
  title: {
    fontSize: moderateScale(24),
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: moderateScale(14),
    color: '#6B7280',
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: moderateScale(14),
    color: '#111827',
    padding: 0,
  },
  addButton: {
    backgroundColor: lightTheme.primaryLight,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 32,
  },
  addButtonText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: lightTheme.primary,
  },
  subjectsSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  subjectCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  subjectDetail: {
    fontSize: moderateScale(12),
    color: '#6B7280',
    marginBottom: 2,
  },
  teacherEmail: {
    fontSize: moderateScale(13),
    color: '#6B7280',
  },
  removeButton: {
    width: 32,
    height: 32,
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finishButton: {
    backgroundColor: lightTheme.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  finishButtonDisabled: {
    opacity: 0.6,
  },
  finishButtonText: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#FFFFFF',
  },
})
