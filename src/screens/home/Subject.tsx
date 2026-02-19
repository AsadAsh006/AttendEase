import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View, LayoutAnimation, Platform, UIManager, Alert, ActivityIndicator, RefreshControl } from 'react-native'
import React, { useState, useEffect, useCallback } from 'react'
import { moderateScale } from 'react-native-size-matters'
import Icon from 'react-native-vector-icons/Ionicons'
import images from '../../assets/images'
import SubjectModal from '../../components/SubjectModal'
import SubjectItem from '../../components/subjectItem'
import { SafeAreaView } from 'react-native-safe-area-context'
import { lightTheme as theme } from '../../theme/colors'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationContext'
import { useOffline } from '../../contexts/OfflineContext'
import { supabase } from '../../lib/supabase'
import offlineService from '../../services/OfflineService'
import { useNavigation } from '@react-navigation/native'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Subject = {
  id: string
  name: string
  code?: string
  // teacher_email?: string
  description?: string
  color?: string
  credit_hours?: string
  class_id: string
}

const Subject = () => {
  const navigation = useNavigation<any>()
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const { userProfile } = useAuth()
  const { sendNotification } = useNotifications()
  const { isOnline } = useOffline()

  // Load cached data when offline
  const loadCachedData = useCallback(() => {
    const cached = offlineService.getCachedData()
    if (cached.subjects.length > 0) {
      setSubjects(cached.subjects)
    }
    setLoading(false)
  }, [])

  const fetchSubjects = useCallback(async () => {
    if (!userProfile?.class_id) return

    // If offline, load from cache
    if (!isOnline) {
      loadCachedData()
      return
    }

    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('class_id', userProfile.class_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setSubjects(data || [])
    } catch (error) {
      console.error('Error fetching subjects:', error)
    } finally {
      setLoading(false)
    }
  }, [userProfile?.class_id, isOnline, loadCachedData])

  useEffect(() => {
    fetchSubjects()
  }, [fetchSubjects])

  // Real-time subscription for subjects
  useEffect(() => {
    if (!userProfile?.class_id) return

    const channel = supabase
      .channel('subjects_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subjects',
          filter: `class_id=eq.${userProfile.class_id}`,
        },
        () => {
          fetchSubjects()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [userProfile?.class_id, fetchSubjects])

  const sendNotificationsToStudents = async (subjectName: string, type: 'subject_added' | 'subject_updated') => {
    if (!userProfile?.class_id) return

    try {
      // Get all approved students in this class
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('class_id', userProfile.class_id)
        .eq('status', 'approved')

      if (!enrollments || enrollments.length === 0) return

      // Send notification to each student
      for (const enrollment of enrollments) {
        await sendNotification(
          enrollment.student_id,
          type,
          type === 'subject_added' ? 'New Subject Added' : 'Subject Updated',
          type === 'subject_added' 
            ? `New subject "${subjectName}" has been added to your class`
            : `Subject "${subjectName}" has been updated`,
          { subject_name: subjectName }
        )
      }
    } catch (error) {
      console.error('Error sending notifications:', error)
    }
  }

  const handleSubmit = async (data: any) => {
    if (!userProfile?.class_id) return

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)

    try {
      if (editing) {
        // Update existing subject
        const { error } = await supabase
          .from('subjects')
          .update({
            name: data.name,
            code: data.code,
            description: data.description,
            credit_hours: data.credit_hours,
            color: data.color,
            // teacher_email: userProfile.email,
          })
          .eq('id', editing.id)

        if (error) throw error

        // Send notification to students
        await sendNotificationsToStudents(data.name, 'subject_updated')
        
        setEditing(null)
      } else {
        // Create new subject
        const { error } = await supabase
          .from('subjects')
          .insert({
            name: data.name,
            code: data.code,
            description: data.description,
            credit_hours: data.credit_hours,
            color: data.color,
            // teacher_email: userProfile.email,
            class_id: userProfile.class_id,
          })

        if (error) throw error

        // Send notification to students
        await sendNotificationsToStudents(data.name, 'subject_added')
      }

      setModalVisible(false)
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save subject')
    }
  }

  const handleDelete = async (subject: Subject) => {
    Alert.alert(
      'Delete Subject',
      `Are you sure you want to delete "${subject.name}"? This will also delete all associated lectures and attendance records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.spring)
              
              const { error } = await supabase
                .from('subjects')
                .delete()
                .eq('id', subject.id)

              if (error) throw error
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete subject')
            }
          },
        },
      ]
    )
  }

  const onRefresh = async () => {
    if (!isOnline) {
      loadCachedData()
      return
    }
    setRefreshing(true)
    await fetchSubjects()
    setRefreshing(false)
  }

  const renderItem = ({ item }: { item: Subject }) => {
    return (
      <SubjectItem
        item={{
          ...item,
          subjectName: item.name,
          subjectCode: item.code,
        }}
        source={images.book}
        onEdit={() => {
          const initialData = {
            name: item.name,
            code: item.code,
            description: item.description,
            credit_hours: item.credit_hours,
            color: item.color,
            // teacher_email: item.teacher_email,
          }
          setEditing({ id: item.id, ...initialData })
          setModalVisible(true)
        }}
        onDelete={() => handleDelete(item)}
      />
    )
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading subjects...</Text>
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
          <Text style={styles.headerTitle}>Subjects</Text>
          <Text style={styles.headerSubtitle}>{subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'} available</Text>
        </View>
        <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addButton}>
          <Image source={images.plusIcon} style={styles.addButtonIcon} />
          <Text style={styles.addButtonText}>Add New</Text>
        </TouchableOpacity>
      </View>
      <SubjectModal
        title={editing ? 'Edit Subject' : 'Add New Subject'}
        subtitle='Create a new subject. All enrolled students will be notified.'
        cancelButtonTitle='Cancel'
        confirmButtonTitle={editing ? 'Save Changes' : 'Add Subject'}
        firstFieldTitle='Subject Name'
        secondFieldTitle='Subject Code'
        thirdFieldTitle='Description'
        fourthFieldTitle='Credit Hours'
        fields={['name', 'code', 'description', 'credit_hours', 'color']}
        visible={modalVisible}
        initialData={editing ?? undefined}
        onClose={() => {
          setModalVisible(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
      />
      <FlatList
        data={subjects}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Image source={images.book} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>No Subjects Yet</Text>
            <Text style={styles.emptyText}>Add your first subject to get started</Text>
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  )
}

export default Subject

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
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
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
  backButton: {
    padding: moderateScale(3),
    marginRight: moderateScale(12),
  },
})