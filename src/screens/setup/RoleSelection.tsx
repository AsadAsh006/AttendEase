import React from 'react'
import {
  View,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  Text,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { moderateScale } from 'react-native-size-matters'
import { useNavigation } from '@react-navigation/native'
import Icon from 'react-native-vector-icons/MaterialIcons'
import CustomText from '../../components/text'
import { useAuth } from '../../contexts/AuthContext'
import { lightTheme } from '../../theme/colors'

const RoleSelection = () => {
  const navigation = useNavigation<any>()
  const { userProfile, setActiveRole } = useAuth()

  const handleSelectRole = (role: 'student' | 'admin') => {
    setActiveRole(role)
    if (role === 'admin') {
      navigation.replace('Main')
    } else {
      navigation.replace('StudentDashboard')
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={lightTheme.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.waveIconContainer}>
          <Text style={{ fontSize: moderateScale(33),paddingBottom:3, paddingRight:3 }}>👋</Text> 
        </View>
        <Text style={styles.title}>
          <Text style={styles.welcomeText}>Welcome back, </Text>
          <Text style={styles.userName}>{userProfile?.name?.split(' ')[0] || 'User'}!</Text>
        </Text>
        <CustomText
          text="You have access to multiple roles. How would you like to continue?"
          textStyle={styles.subtitle}
        />
      </View>

      {/* Role Cards */}
      <View style={styles.cardsContainer}>
        {/* Admin Card */}
        <TouchableOpacity
          style={[styles.roleCard, styles.adminCard]}
          onPress={() => handleSelectRole('admin')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconContainer, { backgroundColor: lightTheme.primaryLight + '30' }]}>
            <Icon name="admin-panel-settings" size={moderateScale(28)} color={lightTheme.primary} />
          </View>
          <View style={styles.cardContent}>
            <CustomText text="Continue as Admin" textStyle={styles.cardTitle} />
            <CustomText
              text="Manage your class, students, subjects, and attendance"
              textStyle={styles.cardDescription}
            />
          </View>
          <View style={styles.arrowContainer}>
            <Icon name="arrow-forward" size={moderateScale(18)} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* Student Card */}
        <TouchableOpacity
          style={[styles.roleCard, styles.studentCard]}
          onPress={() => handleSelectRole('student')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconContainer, { backgroundColor: lightTheme.success + '20' }]}>
            <Icon name="school" size={moderateScale(28)} color={lightTheme.success} />
          </View>
          <View style={styles.cardContent}>
            <CustomText text="Continue as Student" textStyle={styles.cardTitle} />
            <CustomText
              text="View your subjects, attendance records, and notifications"
              textStyle={styles.cardDescription}
            />
          </View>
          <View style={[styles.arrowContainer, { backgroundColor: lightTheme.success }]}>
            <Icon name="arrow-forward" size={moderateScale(18)} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Info */}
      <View style={styles.infoContainer}>
        <Icon name="lightbulb-outline" size={moderateScale(20)} color={lightTheme.warningDark} style={styles.infoIcon} />
        <CustomText
          text="You can switch between roles anytime from the dashboard settings"
          textStyle={styles.infoText}
        />
      </View>
    </SafeAreaView>
  )
}

export default RoleSelection

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightTheme.background,
    paddingHorizontal: moderateScale(24),
  },
  header: {
    alignItems: 'center',
    marginTop: moderateScale(40),
    marginBottom: moderateScale(40),
  },
  waveIconContainer: {
    width: moderateScale(70),
    height: moderateScale(70),
    borderRadius: moderateScale(35),
    backgroundColor: lightTheme.primaryLight + '30',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: moderateScale(16),
  },
  title: {
    fontSize: moderateScale(26),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: moderateScale(8),
  },
  welcomeText: {
    color: lightTheme.primary,
  },
  userName: {
    color: '#464a52',
  },
  subtitle: {
    fontSize: moderateScale(15),
    color: lightTheme.textSecondary,
    textAlign: 'center',
    lineHeight: moderateScale(22),
    paddingHorizontal: moderateScale(20),
  },
  cardsContainer: {
    flex: 1,
    gap: moderateScale(16),
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(16),
    padding: moderateScale(20),
    borderWidth: 2,
    borderColor: lightTheme.primaryLight + '40',
    shadowColor: lightTheme.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  adminCard: {
    borderColor: lightTheme.primaryLight + '60',
  },
  studentCard: {
    borderColor: lightTheme.success + '40',
  },
  iconContainer: {
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: moderateScale(16),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(16),
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: lightTheme.primaryDark,
    marginBottom: moderateScale(4),
  },
  cardDescription: {
    fontSize: moderateScale(13),
    color: lightTheme.textSecondary,
    lineHeight: moderateScale(18),
  },
  arrowContainer: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    backgroundColor: lightTheme.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightTheme.warningLight,
    borderRadius: moderateScale(12),
    padding: moderateScale(16),
    marginBottom: moderateScale(32),
    borderWidth: 1,
    borderColor: lightTheme.warning + '30',
  },
  infoIcon: {
    marginRight: moderateScale(12),
  },
  infoText: {
    flex: 1,
    fontSize: moderateScale(13),
    color: lightTheme.warningDark,
    lineHeight: moderateScale(18),
  },
})
