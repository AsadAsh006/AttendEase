import { Image, StyleSheet, Text, View, TouchableOpacity, FlatList, RefreshControl, Alert, TextInput, Modal } from 'react-native';
import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import images from '../../assets/images';
import { moderateScale } from 'react-native-size-matters';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import NotificationBell from '../../components/NotificationBell';
import { useOffline } from '../../contexts/OfflineContext';
import { setSubjects } from '../../redux/subjectsSlice';
import { setStudents } from '../../redux/studentsSlice';
import { setAttendanceRecords } from '../../redux/attendanceSlice';
import offlineService from '../../services/OfflineService';

const Dashboard = () => {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const { userProfile, isDualRole, setActiveRole, handleAuthError } = useAuth();
  const { isOnline, isSyncing, pendingOperations, fetchAndCacheData } = useOffline();
  const subjects = useSelector((state: any) => state.subjects?.items ?? []);
  const students = useSelector((state: any) => state.students?.items ?? []);
  const attendanceRecords = useSelector((state: any) => state.attendance?.records ?? {});
  const [pendingEnrollments, setPendingEnrollments] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [className, setClassName] = useState<string>('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingClassName, setEditingClassName] = useState('');
  const [stats, setStats] = useState({
    subjectsCount: 0,
    studentsCount: 0,
    recordsCount: 0,
    todayAttendance: 0,
  });

  const recordsCount = Object.keys(attendanceRecords).length;

  // Load cached data when offline
  const loadCachedData = useCallback(() => {
    const cached = offlineService.getCachedData();
    if (cached.subjects.length > 0) {
      dispatch(setSubjects(cached.subjects));
    }
    if (cached.students.length > 0) {
      dispatch(setStudents(cached.students));
    }
    if (cached.attendance.length > 0) {
      dispatch(setAttendanceRecords(cached.attendance));
    }
    
    // Update stats from cached data
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = cached.attendance.filter((r: any) => r.date === today || r.dateKey === today);
    
    setStats({
      subjectsCount: cached.subjects.length,
      studentsCount: cached.students.length,
      recordsCount: cached.attendance.length,
      todayAttendance: todayRecords.length,
    });
  }, [dispatch]);

  // Fetch all data from Supabase
  const fetchDashboardData = useCallback(async () => {
    if (!userProfile?.class_id && !userProfile?.admin_class_id) return;
    
    // If offline, load from cache
    if (!isOnline) {
      loadCachedData();
      return;
    }
    
    const classId = userProfile.admin_class_id || userProfile.class_id;

    try {
      // Fetch class information
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('name')
        .eq('id', classId)
        .single();

      if (classError) {
        handleAuthError(classError);
      } else if (classData) {
        setClassName(classData.name);
      }

      // Fetch subjects
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('*')
        .eq('class_id', classId)
        .order('created_at', { ascending: false });

      if (subjectsError) {
        handleAuthError(subjectsError);
      } else if (subjectsData) {
        dispatch(setSubjects(subjectsData));
      }

      // Fetch students from 'students' table (not profiles)
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classId)
        .order('name', { ascending: true });

      if (studentsError) {
        handleAuthError(studentsError);
      } else if (studentsData) {
        dispatch(setStudents(studentsData));
      }

      // Fetch lectures with attendance data
      const { data: lecturesData, error: lecturesError } = await supabase
        .from('lectures')
        .select(`
          id,
          subject_id,
          date,
          title,
          attendance (student_id, status)
        `)
        .in('subject_id', subjectsData?.map((s: any) => s.id) || [])
        .order('date', { ascending: false });

      if (lecturesError) {
        handleAuthError(lecturesError);
      } else if (lecturesData) {
        // Transform lectures to attendance records format
        const records = lecturesData.map((lecture: any) => {
          const attendanceMap: Record<string, boolean> = {};
          (lecture.attendance || []).forEach((a: any) => {
            attendanceMap[a.student_id] = a.status === 'present';
          });
          return {
            id: lecture.id,
            subject_id: lecture.subject_id,
            subjectId: lecture.subject_id,
            date: lecture.date,
            dateKey: lecture.date,
            attendance: attendanceMap,
          };
        });
        dispatch(setAttendanceRecords(records));
      }

      // Update stats
      const today = new Date().toISOString().split('T')[0];
      const todayRecords = lecturesData?.filter((r: any) => r.date === today) || [];
      
      setStats({
        subjectsCount: subjectsData?.length || 0,
        studentsCount: studentsData?.length || 0,
        recordsCount: lecturesData?.length || 0,
        todayAttendance: todayRecords.length,
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      handleAuthError(error);
    }
  }, [userProfile, dispatch, handleAuthError, isOnline, loadCachedData]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    if (!isOnline) {
      loadCachedData();
      return;
    }
    setRefreshing(true);
    await fetchDashboardData();
    await fetchAndCacheData();
    setRefreshing(false);
  }, [isOnline, fetchDashboardData, fetchAndCacheData, loadCachedData]);

  useEffect(() => {
    if (userProfile) {
      if (isOnline) {
        fetchDashboardData();
      } else {
        loadCachedData();
      }
    }
  }, [userProfile, isOnline, fetchDashboardData, loadCachedData]);

  // Real-time subscriptions for dashboard updates
  useEffect(() => {
    if (!userProfile?.class_id && !userProfile?.admin_class_id) return;
    if (!isOnline) return;

    const classId = userProfile.admin_class_id || userProfile.class_id;

    // Subscribe to students table changes
    const studentsChannel = supabase
      .channel('dashboard_students')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'students',
          filter: `class_id=eq.${classId}`,
        },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    // Subscribe to attendance changes
    const attendanceChannel = supabase
      .channel('dashboard_attendance')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
        },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    // Subscribe to lectures changes
    const lecturesChannel = supabase
      .channel('dashboard_lectures')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lectures',
        },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      studentsChannel.unsubscribe();
      attendanceChannel.unsubscribe();
      lecturesChannel.unsubscribe();
    };
  }, [userProfile, isOnline, fetchDashboardData]);

  useEffect(() => {
    // Update stats when local data changes
    setStats(prev => ({
      ...prev,
      subjectsCount: subjects.length,
      studentsCount: students.length,
      recordsCount: recordsCount,
    }));
  }, [subjects.length, students.length, recordsCount]);

  useEffect(() => {
    if (userProfile?.role === 'cr_gr' && userProfile?.class_id) {
      fetchPendingEnrollments();    
    }
  }, [userProfile]);

  const fetchPendingEnrollments = async () => {
    try {
      const { count, error } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', userProfile?.class_id)
        .eq('status', 'pending');
      
      if (error) {
        handleAuthError(error);
        return;
      }
      
      setPendingEnrollments(count || 0);
    } catch (error) {
      console.error('Error fetching pending enrollments:', error);
      handleAuthError(error);
    }
  };

  const baseTiles = [
    { key: 'Subject', label: 'Subjects', icon: images.book, color: '#5080BE', bgColor: '#E0F2FC', onPress: () => navigation.navigate('Subject') },
    { key: 'Student', label: 'Students', icon: images.userSettings, color: '#7EBBDA', bgColor: '#E6F5FA', onPress: () => navigation.navigate('Student') },
    { key: 'MarkAttendence', label: 'Mark Attendance', icon: images.calender, color: '#5080BE', bgColor: '#C6DEF6', onPress: () => navigation.navigate('MarkAttendence') },
    { key: 'AttendenceHistory', label: 'History', icon: images.download, color: '#7EBBDA', bgColor: '#E0F2FC', onPress: () => navigation.navigate('AttendenceHistory') },
    { key: 'Statistics', label: 'Statistics', icon: images.statistic, color: '#5080BE', bgColor: '#E6F5FA', onPress: () => navigation.navigate('Statistics') },
  ];

  // Add Enrollment Requests tile for CR/GR
  const tiles = userProfile?.role === 'cr_gr'
    ? [
        ...baseTiles,
        { key: 'EnrollmentRequests', label: `Requests${pendingEnrollments > 0 ? ` (${pendingEnrollments})` : ''}`, icon: images.user, color: '#F59E0B', bgColor: '#FEF3C7', onPress: () => navigation.navigate('EnrollmentRequests') },
      ]
    : baseTiles;

  const handleSwitchToStudent = () => {
    setActiveRole('student');
    navigation.replace('StudentDashboard');
  };

  const handleEditClassName = () => {
    setEditingClassName(className);
    setEditModalVisible(true);
  };

  const handleSaveClassName = async () => {
    if (!editingClassName.trim()) {
      Alert.alert('Error', 'Class name cannot be empty');
      return;
    }
    setEditModalVisible(false);
    await updateClassName(editingClassName.trim());
  };

  const updateClassName = async (newName: string) => {
    const classId = userProfile?.admin_class_id || userProfile?.class_id;
    if (!classId) return;

    try {
      const { error } = await supabase
        .from('classes')
        .update({ name: newName, updated_at: new Date().toISOString() })
        .eq('id', classId);

      if (error) {
        handleAuthError(error);
        Alert.alert('Error', 'Failed to update class name');
      } else {
        setClassName(newName);
        Alert.alert('Success', 'Class name updated successfully');
      }
    } catch (error) {
      console.error('Error updating class name:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  return (
    <SafeAreaView
      style={{
        backgroundColor: '#E6F5FA',
        flex: 1,
        paddingTop: 16,
      }}
    >
      {/* Offline/Sync Banner */}
      {(!isOnline || pendingOperations > 0) && (
        <View style={[styles.syncBanner, { backgroundColor: isOnline ? '#FEF3C7' : '#FEE2E2' }]}>
          <View style={styles.syncBannerContent}>
            <Icon 
              name={!isOnline ? 'cloud-offline-outline' : isSyncing ? 'sync-outline' : 'time-outline'} 
              size={moderateScale(16)} 
              color={isOnline ? '#92400E' : '#B91C1C'} 
              style={styles.bannerIcon} 
            />
            <Text style={[styles.syncBannerText, { color: isOnline ? '#92400E' : '#B91C1C' }]}>
              {!isOnline 
                ? 'Offline Mode - Changes will sync when online'
                : isSyncing 
                  ? `Syncing ${pendingOperations} pending changes...`
                  : `${pendingOperations} changes pending sync`
              }
            </Text>
          </View>
        </View>
      )}

      <FlatList
        data={[1]} // Dummy data to enable scroll
        keyExtractor={() => 'main'}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#5080BE']}
            tintColor="#5080BE"
          />
        }
        renderItem={() => (
          <>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.greeting}>
                  Welcome Back{userProfile?.name ? `, ${userProfile.name.split(' ')[0]}` : ''}! 👋
                </Text>
                {className && (
                  <TouchableOpacity 
                    style={styles.classNameContainer}
                    onPress={handleEditClassName}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.classNameLabel}>Class:</Text>
                    <Text style={styles.className}>{className}</Text>
                    <Image source={images.pencilIcon} style={styles.editIcon} />
                  </TouchableOpacity>
                )}
                <Text style={styles.headerSubtitle}>
                  {isDualRole ? 'Managing as Admin • Student' : 'Manage your attendance efficiently'}
                </Text>
              </View>
              <View style={styles.headerRight}>
                {isDualRole && (
                  <TouchableOpacity style={styles.switchRoleButton} onPress={handleSwitchToStudent}>
                    <Text style={styles.switchRoleEmoji}>🎓</Text>
                  </TouchableOpacity>
                )}
                <NotificationBell />
              </View>
            </View>

            <View style={styles.statsContainer}>
              <View style={[styles.statCard, { backgroundColor: '#E0F2FC' }]}>
                <View style={[styles.statIconContainer, { backgroundColor: '#5080BE' }]}>
                  <Image source={images.book} style={styles.statIcon} />
                </View>
                <Text style={styles.statNumber}>{stats.subjectsCount}</Text>
                <Text style={styles.statLabel}>Subjects</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: '#E6F5FA' }]}>
                <View style={[styles.statIconContainer, { backgroundColor: '#7EBBDA' }]}>
                  <Image source={images.user} style={styles.statIcon} />
                </View>
                <Text style={styles.statNumber}>{stats.studentsCount}</Text>
                <Text style={styles.statLabel}>Students</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: '#C6DEF6' }]}>
                <View style={[styles.statIconContainer, { backgroundColor: '#5080BE' }]}>
                  <Image source={images.calender} style={styles.statIcon} />
                </View>
                <Text style={styles.statNumber}>{stats.recordsCount}</Text>
                <Text style={styles.statLabel}>Records</Text>
              </View>
            </View>

            <View style={styles.actionsContainer}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.tilesGrid}>
                {tiles.map((item, index) => (
                  <TouchableOpacity key={item.key} onPress={item.onPress} style={styles.tile}>
                    <View style={[styles.tileIconContainer, { backgroundColor: item.bgColor }]}>
                      <Image source={item.icon} style={[styles.tileIcon, { tintColor: item.color }]} />
                    </View>
                    <Text style={styles.tileText}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}
      />

      {/* Edit Class Name Modal */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Edit Class Name</Text>
            <Text style={styles.modalSubtitle}>Enter the new name for your class</Text>
            
            <TextInput
              style={styles.modalInput}
              value={editingClassName}
              onChangeText={setEditingClassName}
              placeholder="Class name"
              placeholderTextColor="#9CA3AF"
              autoFocus={true}
              selectTextOnFocus={true}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveClassName}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Dashboard;

const styles = StyleSheet.create({
  syncBanner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 8,
  },
  syncBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerIcon: {
    marginRight: moderateScale(8),
  },
  syncBannerText: {
    fontSize: moderateScale(12),
    fontWeight: '500',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchRoleButton: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#5080BE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  switchRoleEmoji: {
    fontSize: moderateScale(20),
  },
  greeting: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: '#1A3A52',
    marginBottom: 4,
  },
  classNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 6,
    marginBottom: 6,
    alignSelf: 'flex-start',
    shadowColor: '#5080BE',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  classNameLabel: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: '#5080BE',
    marginRight: 4,
  },
  className: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: '#1A3A52',
    marginRight: 6,
  },
  editIcon: {
    width: moderateScale(14),
    height: moderateScale(14),
    tintColor: '#5080BE',
  },
  headerSubtitle: {
    fontSize: moderateScale(12),
    color: '#5080BE',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#5080BE',
    shadowOffset: { width: moderateScale(0), height: moderateScale(2) },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconContainer: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statIcon: {
    width: moderateScale(24),
    height: moderateScale(24),
    tintColor: '#FFFFFF',
  },
  statNumber: {
    fontSize: moderateScale(24),
    fontWeight: '700',
    color: '#1A3A52',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: moderateScale(13),
    color: '#5080BE',
    fontWeight: '500',
  },
  actionsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: '#1A3A52',
    marginBottom: 16,
  },
  tile: {
    width: '48%',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#5080BE',
    shadowOffset: { width: moderateScale(0), height: moderateScale(2) },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    minHeight: moderateScale(120),
    justifyContent: 'center',
  },
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tileIconContainer: {
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  tileIcon: {
    height: moderateScale(28),
    width: moderateScale(28),
  },
  tileText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#1A3A52',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: '#1A3A52',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: moderateScale(14),
    color: '#5080BE',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#E6F5FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: moderateScale(16),
    color: '#1A3A52',
    borderWidth: 1,
    borderColor: '#5080BE40',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#E6F5FA',
  },
  cancelButtonText: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: '#5080BE',
  },
  saveButton: {
    backgroundColor: '#5080BE',
  },
  saveButtonText: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
