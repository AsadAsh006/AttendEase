import React, { useState, useEffect } from 'react'
import {
  StyleSheet,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { moderateScale } from 'react-native-size-matters'
import { useNavigation } from '@react-navigation/native'
import CustomText from '../../components/text'
import CustomButton from '../../components/button'
import { lightTheme } from '../../theme/colors'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationContext'

interface ClassItem {
  id: string
  name: string
  code: string
  created_by: string
  created_at: string
}

const SelectClass = () => {
  const navigation = useNavigation<any>()
  const { user, userProfile, refreshUserProfile } = useAuth()
  const { sendNotification } = useNotifications()
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [filteredClasses, setFilteredClasses] = useState<ClassItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchClasses()
  }, [])

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredClasses(classes)
    } else {
      const filtered = classes.filter(
        (cls) =>
          cls.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cls.code.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredClasses(filtered)
    }
  }, [searchQuery, classes])

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error

      // Get user's approved enrollments to filter them out
      if (user) {
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('class_id')
          .eq('student_id', user.id)
          .eq('status', 'approved')

        const enrolledClassIds = enrollments?.map((e) => e.class_id) || []
        
        // Filter out already enrolled classes
        const availableClasses = (data || []).filter(
          (cls) => !enrolledClassIds.includes(cls.id)
        )
        
        setClasses(availableClasses)
        setFilteredClasses(availableClasses)
      } else {
        setClasses(data || [])
        setFilteredClasses(data || [])
      }
    } catch (error) {
      console.error('Error fetching classes:', error)
      Alert.alert('Error', 'Failed to load classes')
    } finally {
      setLoading(false)
    }
  }

  const handleEnrollmentRequest = async () => {
    if (!selectedClass || !user) return

    setSubmitting(true)
    try {
      // Check if enrollment already exists
      const { data: existing } = await supabase
        .from('enrollments')
        .select('*')
        .eq('student_id', user.id)
        .eq('class_id', selectedClass.id)
        .single()

      if (existing) {
        if (existing.status === 'pending') {
          Alert.alert('Info', 'You already have a pending enrollment request for this class.')
          navigation.replace('EnrollmentPending')
          return
        } else if (existing.status === 'approved') {
          // Check if student record still exists in the class
          const { data: studentRecord } = await supabase
            .from('students')
            .select('id')
            .eq('class_id', selectedClass.id)
            .eq('email', userProfile?.email)
            .single()

          if (studentRecord) {
            // Student record exists - they're actually enrolled
            Alert.alert('Info', 'You are already enrolled in this class.')
            return
          } else {
            // Student was deleted but enrollment record remains - update it to pending
            const { error: updateError } = await supabase
              .from('enrollments')
              .update({ status: 'pending', requested_at: new Date().toISOString() })
              .eq('id', existing.id)

            if (updateError) throw updateError

            // Notify admin about the request
            await sendNotification(
              selectedClass.created_by,
              'enrollment_request',
              'New Enrollment Request 📋',
              `${userProfile?.name || 'A student'} has requested to join ${selectedClass.name}`,
              { student_id: user.id, student_name: userProfile?.name, class_id: selectedClass.id }
            )

            Alert.alert('Success', 'Enrollment request sent!')
            navigation.replace('EnrollmentPending')
            return
          }
        } else if (existing.status === 'rejected') {
          // Allow re-request for rejected enrollments
          const { error: updateError } = await supabase
            .from('enrollments')
            .update({ status: 'pending', requested_at: new Date().toISOString() })
            .eq('id', existing.id)

          if (updateError) throw updateError

          // Notify admin about re-request
          await sendNotification(
            selectedClass.created_by,
            'enrollment_request',
            'New Enrollment Request 📋',
            `${userProfile?.name || 'A student'} has requested to join ${selectedClass.name}`,
            { student_id: user.id, student_name: userProfile?.name, class_id: selectedClass.id }
          )
          
          Alert.alert('Success', 'Enrollment request sent again!')
          navigation.replace('EnrollmentPending')
          return
        }
      }

      // Create new enrollment request
      const { error } = await supabase.from('enrollments').insert({
        student_id: user.id,
        class_id: selectedClass.id,
        status: 'pending',
      })

      if (error) throw error

      // Notify the class admin (CR/GR) about the new request
      await sendNotification(
        selectedClass.created_by,
        'enrollment_request',
        'New Enrollment Request 📋',
        `${userProfile?.name || 'A student'} has requested to join ${selectedClass.name}`,
        { student_id: user.id, student_name: userProfile?.name, class_id: selectedClass.id }
      )

      // Navigate to student dashboard to show pending enrollment message
      navigation.replace('StudentDashboard')
    } catch (error: any) {
      console.error('Enrollment error:', error)
      Alert.alert('Error', error.message || 'Failed to submit enrollment request')
    } finally {
      setSubmitting(false)
    }
  }

  const renderClassItem = ({ item }: { item: ClassItem }) => {
    const isSelected = selectedClass?.id === item.id

    return (
      <TouchableOpacity
        style={[styles.classCard, isSelected && styles.classCardSelected]}
        onPress={() => setSelectedClass(item)}
        activeOpacity={0.7}
      >
        <View style={styles.classInfo}>
          <CustomText text={item.name} textStyle={styles.className} />
          <CustomText text={`Code: ${item.code}`} textStyle={styles.classCode} />
        </View>
        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
          {isSelected && <View style={styles.radioInner} />}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <CustomText text="🎓" textStyle={styles.headerEmoji} />
        <CustomText text="Select Your Class" textStyle={styles.title} />
        <CustomText
          text="Choose the class you want to join. Your request will be sent to the class administrator for approval."
          textStyle={styles.subtitle}
        />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <CustomText text="🔍" textStyle={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or code..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Class List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={lightTheme.primary} />
          <CustomText text="Loading classes..." textStyle={styles.loadingText} />
        </View>
      ) : filteredClasses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <CustomText text="📚" textStyle={styles.emptyEmoji} />
          <CustomText text="No Classes Found" textStyle={styles.emptyTitle} />
          <CustomText
            text={
              searchQuery
                ? 'Try a different search term'
                : 'No classes have been created yet. Please check back later.'
            }
            textStyle={styles.emptySubtitle}
          />
        </View>
      ) : (
        <FlatList
          data={filteredClasses}
          renderItem={renderClassItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Submit Button */}
      <View style={styles.footer}>
        <CustomButton
          title={submitting ? 'Submitting...' : 'Request Enrollment'}
          onPress={handleEnrollmentRequest}
          disabled={!selectedClass || submitting}
          containerStyle={[
            styles.submitButton,
            (!selectedClass || submitting) && styles.submitButtonDisabled,
          ]}
          textStyle={styles.submitButtonText}
        />
      </View>
    </SafeAreaView>
  )
}

export default SelectClass

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: moderateScale(24),
    paddingTop: moderateScale(20),
    paddingBottom: moderateScale(16),
  },
  headerEmoji: {
    fontSize: moderateScale(48),
    textAlign: 'center',
    marginBottom: moderateScale(12),
  },
  title: {
    fontSize: moderateScale(28),
    fontWeight: '700',
    color: '#1A3A52',
    textAlign: 'center',
    marginBottom: moderateScale(8),
  },
  subtitle: {
    fontSize: moderateScale(14),
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: moderateScale(20),
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: moderateScale(24),
    marginBottom: moderateScale(16),
    paddingHorizontal: moderateScale(16),
    backgroundColor: '#F3F4F6',
    borderRadius: moderateScale(12),
    height: moderateScale(48),
  },
  searchIcon: {
    fontSize: moderateScale(18),
    marginRight: moderateScale(8),
  },
  searchInput: {
    flex: 1,
    fontSize: moderateScale(16),
    color: '#1F2937',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: moderateScale(12),
    fontSize: moderateScale(14),
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: moderateScale(40),
  },
  emptyEmoji: {
    fontSize: moderateScale(64),
    marginBottom: moderateScale(16),
  },
  emptyTitle: {
    fontSize: moderateScale(20),
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
    paddingHorizontal: moderateScale(24),
    paddingBottom: moderateScale(20),
  },
  classCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: moderateScale(16),
    borderRadius: moderateScale(12),
    marginBottom: moderateScale(12),
    borderWidth: 2,
    borderColor: 'transparent',
  },
  classCardSelected: {
    borderColor: lightTheme.primary,
    backgroundColor: '#E0F2FC',
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: '#1A3A52',
    marginBottom: moderateScale(4),
  },
  classCode: {
    fontSize: moderateScale(13),
    color: '#6B7280',
  },
  radioOuter: {
    width: moderateScale(24),
    height: moderateScale(24),
    borderRadius: moderateScale(12),
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: lightTheme.primary,
  },
  radioInner: {
    width: moderateScale(12),
    height: moderateScale(12),
    borderRadius: moderateScale(6),
    backgroundColor: lightTheme.primary,
  },
  footer: {
    paddingHorizontal: moderateScale(24),
    paddingBottom: moderateScale(24),
    paddingTop: moderateScale(12),
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  submitButton: {
    backgroundColor: lightTheme.primary,
    borderRadius: moderateScale(12),
    height: moderateScale(52),
  },
  submitButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: moderateScale(16),
    fontWeight: '600',
  },
})
