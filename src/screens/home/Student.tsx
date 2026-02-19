import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View, Alert, LayoutAnimation, Platform, UIManager, ActivityIndicator, RefreshControl } from 'react-native'
import React, { useState, useEffect, useCallback } from 'react'
import { moderateScale } from 'react-native-size-matters'
import Icon from 'react-native-vector-icons/Ionicons'
import images from '../../assets/images'
import SubjectModal from '../../components/SubjectModal'
import StudentItem from '../../components/studentItem'
import Dropdown from '../../components/Dropdown'
import { SafeAreaView } from 'react-native-safe-area-context'
import RNFS from 'react-native-fs'
import { pick, types } from '@react-native-documents/picker'
import { lightTheme as theme } from '../../theme/colors'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useOffline } from '../../contexts/OfflineContext'
import offlineService from '../../services/OfflineService'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const Student = ({ navigation }: any) => {
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
  const [students, setStudents] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [studentSubjects, setStudentSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const { userProfile, user } = useAuth()
  const { isOnline } = useOffline()

  // Load cached data when offline
  const loadCachedData = useCallback(() => {
    const cached = offlineService.getCachedData()
    if (cached.students.length > 0) {
      setStudents(cached.students)
    }
    if (cached.subjects.length > 0) {
      setSubjects(cached.subjects)
    }
    if (cached.studentSubjects) {
      setStudentSubjects(cached.studentSubjects)
    }
    setLoading(false)
  }, [])

  // Fetch students from Supabase
  const fetchStudents = useCallback(async () => {
    const classId = userProfile?.admin_class_id || userProfile?.class_id
    if (!classId) return

    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classId)
        .order('roll_number')

      if (error) throw error
      setStudents(data || [])
    } catch (error) {
      console.error('Error fetching students:', error)
    }
  }, [userProfile?.class_id, userProfile?.admin_class_id])

  // Fetch subjects from Supabase
  const fetchSubjects = useCallback(async () => {
    const classId = userProfile?.admin_class_id || userProfile?.class_id
    if (!classId) return

    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('class_id', classId)
        .order('name')

      if (error) throw error
      setSubjects(data || [])
    } catch (error) {
      console.error('Error fetching subjects:', error)
    }
  }, [userProfile?.class_id, userProfile?.admin_class_id])

  // Fetch student-subject enrollments
  const fetchStudentSubjects = useCallback(async () => {
    const classId = userProfile?.admin_class_id || userProfile?.class_id
    if (!classId) return

    try {
      // Get all student IDs in this class first
      const { data: classStudents } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', classId)

      if (!classStudents || classStudents.length === 0) {
        setStudentSubjects([])
        return
      }

      const studentIds = classStudents.map(s => s.id)

      const { data, error } = await supabase
        .from('student_subjects')
        .select('*')
        .in('student_id', studentIds)

      if (error) throw error
      setStudentSubjects(data || [])
    } catch (error) {
      console.error('Error fetching student subjects:', error)
    }
  }, [userProfile?.class_id, userProfile?.admin_class_id])

  useEffect(() => {
    const loadData = async () => {
      if (!isOnline) {
        loadCachedData()
        return
      }
      setLoading(true)
      await Promise.all([fetchStudents(), fetchSubjects(), fetchStudentSubjects()])
      setLoading(false)
    }
    loadData()
  }, [fetchStudents, fetchSubjects, fetchStudentSubjects, isOnline, loadCachedData])

  // Real-time subscription for students
  useEffect(() => {
    const classId = userProfile?.admin_class_id || userProfile?.class_id
    if (!classId) return

    const studentsChannel = supabase
      .channel('students_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'students',
          filter: `class_id=eq.${classId}`,
        },
        () => {
          fetchStudents()
        }
      )
      .subscribe()

    // Also subscribe to student_subjects changes
    const enrollmentsChannel = supabase
      .channel('student_subjects_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_subjects',
        },
        () => {
          fetchStudentSubjects()
        }
      )
      .subscribe()

    return () => {
      studentsChannel.unsubscribe()
      enrollmentsChannel.unsubscribe()
    }
  }, [userProfile?.class_id, userProfile?.admin_class_id, fetchStudents, fetchStudentSubjects])

  const onRefresh = async () => {
    if (!isOnline) {
      loadCachedData()
      return
    }
    setRefreshing(true)
    await Promise.all([fetchStudents(), fetchSubjects(), fetchStudentSubjects()])
    setRefreshing(false)
  }

  const handleSubmit = async (data: any) => {
    const classId = userProfile?.admin_class_id || userProfile?.class_id
    if (!classId) return

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)

    try {
      if (editing) {
        // Update existing student
        const { error } = await supabase
          .from('students')
          .update({
            name: data.name,
            roll_number: data.code || data.roll_number,
            email: data.email,
          })
          .eq('id', editing.id)

        if (error) throw error
        setEditing(null)
      } else {
        // Create new student
        const { error } = await supabase
          .from('students')
          .insert({
            name: data.name,
            roll_number: data.code || '',
            email: data.email || '',
            class_id: classId,
          })

        if (error) throw error
      }

      setModalVisible(false)
      fetchStudents()
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save student')
    }
  }



  const handleAddPress = () => {
    if (selectedSubject && selectedSubject !== 'all') {
      // In a specific subject view -> Navigate to enrollment screen
      const currentSubjectName = subjects.find((s: any) => s.id === selectedSubject)?.name
      
      // Enrich students with their enrolled subject IDs
      const enrichedStudents = students.map(student => ({
        ...student,
        subjects: studentSubjects
          .filter(ss => ss.student_id === student.id)
          .map(ss => ss.subject_id)
      }))
      
      navigation.navigate('EnrollStudents', {
        subjectId: selectedSubject,
        subjectName: currentSubjectName,
        students: enrichedStudents,
        onEnroll: handleEnrollMultipleStudents
      })
    } else {
      // In 'All' view -> Create new student
      setModalVisible(true)
    }
  }

  const handleEnrollMultipleStudents = async (studentIds: string[]) => {
    if (!selectedSubject || selectedSubject === 'all' || !user) return

    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.spring)
      
      const enrollments = studentIds.map(studentId => ({
        student_id: studentId,
        subject_id: selectedSubject,
        enrolled_by: user.id,
      }))

      const { error } = await supabase
        .from('student_subjects')
        .upsert(enrollments, { onConflict: 'student_id,subject_id' })

      if (error) throw error

      Alert.alert('Success', `Enrolled ${studentIds.length} student(s) in the subject`)
      fetchStudentSubjects()
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to enroll students')
    }
  }

  const handleImportCSV = async () => {
    const classId = userProfile?.admin_class_id || userProfile?.class_id
    if (!classId) {
      Alert.alert('Error', 'Class not found')
      return
    }

    try {
      const result = await pick({
        type: [types.csv, types.plainText],
        allowMultiSelection: false,
      })

      if (!result || result.length === 0) return

      const file = result[0]
      const content = await RNFS.readFile(file.uri, 'utf8')

      // Parse CSV
      const lines = content.split('\n').filter(line => line.trim())
      if (lines.length < 2) {
        Alert.alert('Invalid CSV', 'CSV file must have a header row and at least one data row')
        return
      }

      // Parse header
      const header = lines[0].split(',').map(h => h.trim().toLowerCase())
      const nameIndex = header.findIndex(h => h.includes('name') || h.includes('student'))
      const codeIndex = header.findIndex(h => h.includes('code') || h.includes('roll'))
      const emailIndex = header.findIndex(h => h.includes('email'))

      if (nameIndex === -1) {
        Alert.alert('Invalid CSV', 'CSV must have a "Name" or "Student" column')
        return
      }

      // Parse data rows and prepare for batch insert
      const studentsToInsert: any[] = []
      let skippedCount = 0

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const name = values[nameIndex]?.trim()

        if (!name) {
          skippedCount++
          continue
        }

        studentsToInsert.push({
          name,
          roll_number: codeIndex !== -1 ? values[codeIndex]?.trim() || '' : '',
          email: emailIndex !== -1 ? values[emailIndex]?.trim() || '' : '',
          class_id: classId,
        })
      }

      if (studentsToInsert.length === 0) {
        Alert.alert('No Students', 'No valid students found in CSV')
        return
      }

      // Insert all students
      const { error } = await supabase
        .from('students')
        .insert(studentsToInsert)

      if (error) throw error

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      fetchStudents()
      
      Alert.alert(
        'Import Successful',
        `Imported ${studentsToInsert.length} student(s).${skippedCount > 0 ? ` Skipped ${skippedCount} invalid row(s).` : ''}`,
        [{ text: 'OK' }]
      )
    } catch (err: any) {
      if (err?.message?.includes('User canceled')) {
        // User cancelled
      } else {
        Alert.alert('Import Failed', err.message || 'Unknown error')
        console.error(err)
      }
    }
  } 

  // Filter students based on selected subject
  const getFilteredStudents = () => {
    if (!selectedSubject || selectedSubject === 'all') {
      return students
    }
    // Get student IDs enrolled in this subject
    const enrolledStudentIds = studentSubjects
      .filter(ss => ss.subject_id === selectedSubject)
      .map(ss => ss.student_id)
    return students.filter(s => enrolledStudentIds.includes(s.id))
  }

  const data = getFilteredStudents()

  const subjectOptions = [
    { label: 'All Students', value: 'all' },
    ...subjects.map((s: any) => ({
      label: s.name ?? 'Unnamed',
      subtitle: s.code,
      value: s.id,
    }))
  ]

  const currentSubjectName = subjects.find((s: any) => s.id === selectedSubject)?.name

  const handleUnenrollStudent = async (student: any) => {
    if (!selectedSubject || selectedSubject === 'all') return

    Alert.alert(
      'Unenroll Student',
      `Remove ${student.name} from ${currentSubjectName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unenroll',
          style: 'destructive',
          onPress: async () => {
            try {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.spring)
              const { error } = await supabase
                .from('student_subjects')
                .delete()
                .eq('student_id', student.id)
                .eq('subject_id', selectedSubject)

              if (error) throw error
              fetchStudentSubjects()
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to unenroll student')
            }
          },
        },
      ]
    )
  }

  const handleDeleteStudent = async (student: any) => {
    Alert.alert(
      'Delete Student',
      `Are you sure you want to remove ${student.name} from the class? This will also remove them from all subjects.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.spring)
              
              const classId = userProfile?.admin_class_id || userProfile?.class_id

              // First, find the user's profile by email to get their ID
              const { data: studentProfile } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', student.email)
                .single()

              if (!studentProfile) {
                throw new Error('Student profile not found')
              }

              // Delete the student record first (this will cascade delete student_subjects due to foreign key)
              const { error: studentError } = await supabase
                .from('students')
                .delete()
                .eq('id', student.id)

              if (studentError) throw studentError

              // Delete all enrollment records for this student and class
              const { error: enrollmentError } = await supabase
                .from('enrollments')
                .delete()
                .eq('student_id', studentProfile.id)
                .eq('class_id', classId!)

              if (enrollmentError) {
                console.warn('Enrollment delete error:', enrollmentError)
              }

              // Update the student's profile to remove class assignment
              const { error: profileError } = await supabase
                .from('profiles')
                .update({
                  class_id: null,
                  has_completed_setup: false,
                })
                .eq('id', studentProfile.id)

              if (profileError) {
                console.warn('Profile update error:', profileError)
              }

              Alert.alert('Success', `${student.name} has been removed from the class.`)
            } catch (error: any) {
              console.error('Delete student error:', error)
              Alert.alert('Error', error.message || 'Failed to delete student')
            }
          },
        },
      ]
    )
  }

  const handleMakeAdmin = async (student: any) => {
    Alert.alert(
      'Make Admin',
      `Are you sure you want to make ${student.name} an admin (CR/GR) of this class? They will be able to manage attendance, subjects, and students.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Make Admin',
          onPress: async () => {
            try {
              // Find the profile for this student by email
              console.log('Making admin - finding profile for:', student.email)
              const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id, class_id, is_admin, admin_class_id')
                .eq('email', student.email)
                .single()

              console.log('Profile found:', profile, 'Error:', profileError)

              if (profileError || !profile) {
                Alert.alert('Error', 'This student does not have an account yet. They need to sign up first.')
                return
              }

              // Update the profile to make them admin
              const classId = userProfile?.admin_class_id || userProfile?.class_id
              console.log('Updating profile with is_admin=true, admin_class_id=', classId)
              const { error: updateError } = await supabase
                .from('profiles')
                .update({
                  is_admin: true,
                  admin_class_id: classId,
                })
                .eq('id', profile.id)

              console.log('Profile update error:', updateError)
              if (updateError) throw updateError

              // Update the student record
              const { error: studentError } = await supabase
                .from('students')
                .update({ is_admin: true })
                .eq('id', student.id)

              console.log('Student update error:', studentError)
              if (studentError) throw studentError

              Alert.alert('Success', `${student.name} is now an admin of this class.`)
              fetchStudents()
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to make student an admin')
            }
          },
        },
      ]
    )
  }

  const handleRemoveAdmin = async (student: any) => {
    Alert.alert(
      'Remove Admin',
      `Are you sure you want to remove admin privileges from ${student.name}? They will no longer be able to manage attendance, subjects, and students.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove Admin',
          style: 'destructive',
          onPress: async () => {
            try {
              // Find the profile for this student by email
              const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', student.email)
                .single()

              if (profileError || !profile) {
                Alert.alert('Error', 'Could not find this student\'s profile.')
                return
              }

              // Update the profile to remove admin status
              const { error: updateError } = await supabase
                .from('profiles')
                .update({
                  is_admin: false,
                  admin_class_id: null,
                })
                .eq('id', profile.id)

              if (updateError) throw updateError

              // Update the student record
              const { error: studentError } = await supabase
                .from('students')
                .update({ is_admin: false })
                .eq('id', student.id)

              if (studentError) throw studentError

              Alert.alert('Success', `${student.name} is no longer an admin.`)
              fetchStudents()
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to remove admin privileges')
            }
          },
        },
      ]
    )
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading students...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={moderateScale(24)} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Students</Text>
          <Text style={styles.headerSubtitle}>
            {data.length} {data.length === 1 ? 'student' : 'students'} {selectedSubject && selectedSubject !== 'all' ? 'in this subject' : 'total'}
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={handleImportCSV} style={styles.iconButton}>
            <Image source={images.download} style={styles.iconButtonIcon} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleAddPress} style={styles.addButton}>
            <Image source={images.plusIcon} style={styles.addButtonIcon} />
            <Text style={styles.addButtonText}>
              {selectedSubject && selectedSubject !== 'all' ? 'Enroll' : 'Add New'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <SubjectModal
        title={editing ? 'Edit Student' : 'Create New Student'}
        subtitle={editing ? 'Update student details.' : 'Create a new student profile.'}
        cancelButtonTitle='Cancel'
        confirmButtonTitle={editing ? 'Save Changes' : 'Create Student'}
        firstFieldTitle='Full Name'
        secondFieldTitle='Roll Number'
        thirdFieldTitle='Email (Optional)'
        firstFieldPlaceholder='e.g., John Doe'
        secondFieldPlaceholder='e.g., ST-2024-001'
        thirdFieldPlaceholder='e.g., student@example.com'
        fields={['name', 'code', 'description']}
        visible={modalVisible}
        initialData={editing ?? undefined}
        onClose={() => {
          setModalVisible(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
      />

      <View style={styles.filterContainer}>
        <Dropdown
          Title="Filter by Subject"
          isIcon
          source={images.book}
          options={subjectOptions}
          value={selectedSubject}
          onValueChange={(v) => setSelectedSubject(String(v))}
          placeholder="All Students"
          searchable
        />
      </View>

      <FlatList
        data={data}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        renderItem={({ item }) => (
          <StudentItem
            item={{
              ...item,
              code: item.roll_number,
              is_admin: item.is_admin,
            }}
            onMakeAdmin={(!selectedSubject || selectedSubject === 'all') ? handleMakeAdmin : undefined}
            onRemoveAdmin={(!selectedSubject || selectedSubject === 'all') ? handleRemoveAdmin : undefined}
            onEdit={(student) => {
              const initialData = {
                name: item.name,
                code: item.roll_number,
                description: item.email,
              }
              setEditing({ id: item.id, ...initialData })
              setModalVisible(true)
            }}
            onDelete={() => {
              if (selectedSubject && selectedSubject !== 'all') {
                // In subject view - unenroll from subject
                handleUnenrollStudent(item)
              } else {
                // In all view - delete student
                handleDeleteStudent(item)
              }
            }}
          />
        )}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Image source={images.user} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>No Students Found</Text>
            <Text style={styles.emptyText}>
              {selectedSubject && selectedSubject !== 'all'
                ? 'No students enrolled in this subject. Tap "Enroll" to add students.'
                : 'Students will appear here when their enrollment is approved'}
            </Text>
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  )
}

export default Student

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: theme.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: {
    padding: moderateScale(3),
    marginRight: moderateScale(12),
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: moderateScale(22),
    fontWeight: '800',
    color: theme.textPrimary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: moderateScale(12),
    color: theme.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: 20,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  iconButtonIcon: {
    width: moderateScale(20),
    height: moderateScale(20),
    tintColor: theme.textPrimary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonIcon: {
    height: moderateScale(18),
    width: moderateScale(18),
    marginRight: 8,
    tintColor: theme.white,
  },
  addButtonText: {
    color: theme.white,
    fontSize: moderateScale(14),
    fontWeight: '700',
  },
  filterContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
    marginTop: 16,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    width: moderateScale(80),
    height: moderateScale(80),
    tintColor: theme.borderDark,
    marginBottom: 20,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: theme.textSecondary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: moderateScale(15),
    color: theme.textTertiary,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: moderateScale(16),
    color: theme.textSecondary,
  },
})