import React, { useState, useEffect } from 'react'
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { moderateScale } from 'react-native-size-matters'
import { useNavigation } from '@react-navigation/native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import CustomText from '../../components/text'
import { useAuth } from '../../contexts/AuthContext'
import { useOffline } from '../../contexts/OfflineContext'
import { supabase } from '../../lib/supabase'
import { MMKV } from 'react-native-mmkv'
import images from '../../assets/images'

const storage = new MMKV()

const StudentProfile = () => {
  const navigation = useNavigation<any>()
  const { user, userProfile, signOut, isDualRole, setActiveRole, activeRole } = useAuth()
  const { isOnline } = useOffline()
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [darkModeEnabled, setDarkModeEnabled] = useState(false)
  const [isRemovedFromClass, setIsRemovedFromClass] = useState(false)
  const [enrolledClassesCount, setEnrolledClassesCount] = useState(0)
  const [activeClassName, setActiveClassName] = useState<string>('')

  // Watch for when user becomes dual role and needs to select role
  useEffect(() => {
    if (isDualRole && !activeRole) {
      console.log('StudentProfile: User is now dual role, redirecting to RoleSelection')
      navigation.replace('RoleSelection')
    }
  }, [isDualRole, activeRole, navigation])

  // Check enrollment status and count enrolled classes
  useEffect(() => {
    const checkEnrollment = async () => {
      if (!user) return

      try {
        // Get all approved enrollments
        const { data: approvedEnrollments, error: enrollError } = await supabase
          .from('student_active_enrollments')
          .select('*')
          .eq('student_id', user.id)
          .eq('status', 'approved')

        if (enrollError) throw enrollError

        const validEnrollments = approvedEnrollments?.filter(e => e.student_record_exists > 0) || []
        setEnrolledClassesCount(validEnrollments.length)

        if (validEnrollments.length === 0) {
          setIsRemovedFromClass(true)
          setActiveClassName('')
        } else {
          setIsRemovedFromClass(false)
          
          // Get active class name
          const activeClassId = userProfile?.active_class_id || userProfile?.class_id
          const activeClass = validEnrollments.find(e => e.class_id === activeClassId)
          setActiveClassName(activeClass?.class_name || validEnrollments[0]?.class_name || '')
        }
      } catch (error) {
        console.error('Error checking enrollment:', error)
      }
    }

    checkEnrollment()
  }, [userProfile, user])

  useEffect(() => {
    // Load saved preferences
    const notifPref = storage.getBoolean('AttendEase.notifications')
    const darkPref = storage.getBoolean('AttendEase.darkMode')
    if (notifPref !== undefined) setNotificationsEnabled(notifPref)
    if (darkPref !== undefined) setDarkModeEnabled(darkPref)
  }, [])

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Sign Out', 
        style: 'destructive', 
        onPress: async () => {
          await signOut()
          // RootNavigator will automatically handle navigation to Login
        }
      },
    ])
  }

  const handleSelectClass = () => {
    navigation.navigate('SelectClass')
  }

  const handleSwitchToAdmin = () => {
    setActiveRole('admin')
    navigation.replace('Main')
  }

  const toggleNotifications = (value: boolean) => {
    setNotificationsEnabled(value)
    storage.set('AttendEase.notifications', value)
  }

  const toggleDarkMode = (value: boolean) => {
    setDarkModeEnabled(value)
    storage.set('AttendEase.darkMode', value)
    // TODO: Implement actual dark mode theming
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const MenuItem = ({ 
    icon, 
    title, 
    subtitle, 
    onPress, 
    rightElement,
    danger = false 
  }: {
    icon: string
    title: string
    subtitle?: string
    onPress?: () => void
    rightElement?: React.ReactNode
    danger?: boolean
  }) => (
    <TouchableOpacity 
      style={styles.menuItem} 
      onPress={onPress}
      disabled={!onPress && !rightElement}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.menuItemLeft}>
        <View style={[styles.menuIconContainer, danger && styles.menuIconDanger]}>
          <Icon name={icon} size={moderateScale(20)} color={danger ? '#EF4444' : '#0077B6'} />
        </View>
        <View style={styles.menuTextContainer}>
          <CustomText text={title} textStyle={[styles.menuTitle, danger && styles.menuTitleDanger]} />
          {subtitle && <CustomText text={subtitle} textStyle={styles.menuSubtitle} />}
        </View>
      </View>
      {rightElement || (onPress && (
        <Icon name="chevron-right" size={moderateScale(20)} color="#9CA3AF" />
      ))}
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Icon name="account" size={moderateScale(28)} color="#0077B6" />
            <CustomText text=" Profile" textStyle={styles.headerTitle} />
          </View>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <CustomText 
                text={getInitials(userProfile?.name || 'U')} 
                textStyle={styles.avatarText} 
              />
            </View>
            <View style={[styles.onlineIndicator, { backgroundColor: isOnline ? '#10B981' : '#EF4444' }]} />
          </View>

          <View style={styles.profileInfo}>
            <CustomText text={userProfile?.name || 'Student'} textStyle={styles.profileName} />
            <CustomText text={userProfile?.email || ''} textStyle={styles.profileEmail} />
            <View style={styles.profileBadges}>
              <View style={styles.roleBadge}>
                <CustomText text="📚 Student" textStyle={styles.roleBadgeText} />
              </View>
              {isDualRole && (
                <View style={[styles.roleBadge, styles.adminBadge]}>
                  <CustomText text="👑 CR/GR" textStyle={styles.roleBadgeText} />
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <CustomText text={userProfile?.roll_number || 'N/A'} textStyle={styles.statValue} />
            <CustomText text="Roll No." textStyle={styles.statLabel} />
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <CustomText text={isOnline ? 'Online' : 'Offline'} textStyle={[styles.statValue, { color: isOnline ? '#10B981' : '#EF4444' }]} />
            <CustomText text="Status" textStyle={styles.statLabel} />
          </View>
        </View>

        {/* Menu Sections */}
        <View style={styles.menuSection}>
          <CustomText text="CLASS ENROLLMENT" textStyle={styles.sectionTitle} />
          <View style={styles.menuCard}>
            <MenuItem
              icon="school"
              title="My Classes"
              subtitle={enrolledClassesCount > 1 
                ? `Enrolled in ${enrolledClassesCount} classes • Active: ${activeClassName}`
                : activeClassName || 'No classes enrolled'
              }
              onPress={() => navigation.navigate('ClassEnrollments')}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="plus-circle-outline"
              title="Apply for Another Class"
              subtitle="Join additional classes"
              onPress={handleSelectClass}
            />
          </View>
        </View>

        <View style={styles.menuSection}>
          <CustomText text="ACCOUNT" textStyle={styles.sectionTitle} />
          <View style={styles.menuCard}>
            <MenuItem
              icon="card-account-details"
              title="Roll Number"
              subtitle={userProfile?.roll_number || 'Not set'}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="email-outline"
              title="Email"
              subtitle={userProfile?.email || 'Not set'}
            />
          </View>
        </View>

        {isDualRole && (
          <View style={styles.menuSection}>
            <CustomText text="ROLE" textStyle={styles.sectionTitle} />
            <View style={styles.menuCard}>
              <MenuItem
                icon="crown"
                title="Switch to Admin"
                subtitle="Manage class as CR/GR"
                onPress={handleSwitchToAdmin}
              />
            </View>
          </View>
        )}

        <View style={styles.menuSection}>
          <CustomText text="PREFERENCES" textStyle={styles.sectionTitle} />
          <View style={styles.menuCard}>
            <MenuItem
              icon="bell-outline"
              title="Notifications"
              subtitle="Receive attendance alerts"
              rightElement={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={toggleNotifications}
                  trackColor={{ false: '#E5E7EB', true: '#0077B6' }}
                  thumbColor="#FFFFFF"
                />
              }
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="weather-night"
              title="Dark Mode"
              subtitle="Coming soon"
              rightElement={
                <Switch
                  value={darkModeEnabled}
                  onValueChange={toggleDarkMode}
                  trackColor={{ false: '#E5E7EB', true: '#0077B6' }}
                  thumbColor="#FFFFFF"
                  disabled
                />
              }
            />
          </View>
        </View>

        <View style={styles.menuSection}>
          <CustomText text="ABOUT" textStyle={styles.sectionTitle} />
          <View style={styles.menuCard}>
            <MenuItem
              icon="information-outline"
              title="App Version"
              subtitle="1.0.0"
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="file-document-outline"
              title="Terms of Service"
              onPress={() => {}}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="lock-outline"
              title="Privacy Policy"
              onPress={() => {}}
            />
          </View>
        </View>

        <View style={styles.menuSection}>
          <View style={styles.menuCard}>
            <MenuItem
              icon="logout"
              title="Sign Out"
              onPress={handleSignOut}
              danger
            />
          </View>
        </View>

        <View style={styles.footer}>
          <CustomText text="AttendEase" textStyle={styles.footerTitle} />
          <View style={styles.footerRow}>
            <CustomText text="Made with " textStyle={styles.footerSubtitle} />
            <Icon name="heart" size={moderateScale(12)} color="#EF4444" />
            <CustomText text=" for students" textStyle={styles.footerSubtitle} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

export default StudentProfile

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(16),
    paddingBottom: moderateScale(12),
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: moderateScale(28),
    fontWeight: '700',
    color: '#1A1A2E',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: moderateScale(20),
    padding: moderateScale(20),
    borderRadius: moderateScale(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: moderateScale(16),
  },
  avatar: {
    width: moderateScale(72),
    height: moderateScale(72),
    borderRadius: moderateScale(36),
    backgroundColor: '#0077B6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: moderateScale(24),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: moderateScale(2),
    right: moderateScale(2),
    width: moderateScale(18),
    height: moderateScale(18),
    borderRadius: moderateScale(9),
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: moderateScale(4),
  },
  profileEmail: {
    fontSize: moderateScale(13),
    color: '#6B7280',
    marginBottom: moderateScale(8),
  },
  profileBadges: {
    flexDirection: 'row',
    gap: moderateScale(8),
  },
  roleBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(12),
  },
  adminBadge: {
    backgroundColor: '#FEF3C7',
  },
  roleBadgeText: {
    fontSize: moderateScale(11),
    fontWeight: '600',
    color: '#374151',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: moderateScale(20),
    marginTop: moderateScale(16),
    padding: moderateScale(20),
    borderRadius: moderateScale(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: moderateScale(4),
  },
  statLabel: {
    fontSize: moderateScale(12),
    color: '#6B7280',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: moderateScale(16),
  },
  menuSection: {
    marginTop: moderateScale(24),
    paddingHorizontal: moderateScale(20),
  },
  sectionTitle: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: moderateScale(8),
    marginLeft: moderateScale(4),
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(16),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(14),
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIconContainer: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(10),
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  menuIconDanger: {
    backgroundColor: '#FEE2E2',
  },
  menuIcon: {
    fontSize: moderateScale(18),
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: moderateScale(15),
    fontWeight: '500',
    color: '#1A1A2E',
  },
  menuTitleDanger: {
    color: '#DC2626',
  },
  menuSubtitle: {
    fontSize: moderateScale(12),
    color: '#6B7280',
    marginTop: moderateScale(2),
  },
  menuArrow: {
    fontSize: moderateScale(20),
    color: '#9CA3AF',
    fontWeight: '300',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: moderateScale(64),
  },
  footer: {
    alignItems: 'center',
    paddingVertical: moderateScale(32),
    paddingBottom: moderateScale(120),
  },
  footerTitle: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: '#0077B6',
    marginBottom: moderateScale(4),
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerSubtitle: {
    fontSize: moderateScale(12),
    color: '#9CA3AF',
  },
  noClassCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: moderateScale(16),
    padding: moderateScale(24),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  noClassTitle: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#991B1B',
    marginTop: moderateScale(12),
    marginBottom: moderateScale(4),
  },
  noClassSubtitle: {
    fontSize: moderateScale(13),
    color: '#B91C1C',
    textAlign: 'center',
    marginBottom: moderateScale(16),
  },
  selectClassButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0077B6',
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(12),
    borderRadius: moderateScale(24),
  },
  selectClassButtonText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
