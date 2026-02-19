import React from 'react'
import { StyleSheet, View, Platform } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { moderateScale } from 'react-native-size-matters'
import { BlurView } from '@react-native-community/blur'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'

import StudentHome from '../../screens/home/StudentHome'
import StudentStanding from '../../screens/home/StudentStanding'
import StudentNotepad from '../../screens/home/StudentNotepad'
import StudentProfile from '../../screens/home/StudentProfile'

const Tab = createBottomTabNavigator()

interface TabBarIconProps {
  focused: boolean
  iconName: string
  iconNameOutline: string
}

const TabBarIcon = ({ focused, iconName, iconNameOutline }: TabBarIconProps) => (
  <View style={[styles.iconContainer, focused ? styles.iconContainerActive : styles.iconContainerInactive]}>
    <Icon 
      name={focused ? iconName : iconNameOutline} 
      size={moderateScale(20)} 
      color={focused ? '#FFFFFF' : '#6B7280'} 
    />
  </View>
)

const StudentBottomTab = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarShowLabel: false,
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarBackground: () => (
          <View style={styles.tabBarBackground}>
            <BlurView
              style={styles.blurView}
              blurType="light"
              blurAmount={20}
              reducedTransparencyFallbackColor="white"
            />
          </View>
        ),
      }}
    >
      <Tab.Screen
        name="StudentHome"
        component={StudentHome}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIcon focused={focused} iconName="home" iconNameOutline="home-outline" />
          ),
        }}
      />
      <Tab.Screen
        name="StudentStanding"
        component={StudentStanding}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIcon focused={focused} iconName="trophy" iconNameOutline="trophy-outline" />
          ),
        }}
      />
      <Tab.Screen
        name="StudentNotepad"
        component={StudentNotepad}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIcon focused={focused} iconName="notebook" iconNameOutline="notebook-outline" />
          ),
        }}
      />
      <Tab.Screen
        name="StudentProfile"
        component={StudentProfile}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIcon focused={focused} iconName="account" iconNameOutline="account-outline" />
          ),
        }}
      />
    </Tab.Navigator>
  )
}

export default StudentBottomTab

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? moderateScale(28) : moderateScale(25),
    height: moderateScale(56),
    marginHorizontal: moderateScale(20),
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: moderateScale(28),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    borderTopWidth: 0,
    paddingHorizontal: moderateScale(8),
  },
  tabBarItem: {
    paddingVertical: moderateScale(9),
  },
  tabBarBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: moderateScale(28),
    overflow: 'hidden',
  },
  blurView: {
    ...StyleSheet.absoluteFillObject,
  },
  iconContainer: {
    width: moderateScale(42),
    height: moderateScale(42),
    borderRadius: moderateScale(21),
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerInactive: {
    backgroundColor: '#F3F4F6',
  },
  iconContainerActive: {
    backgroundColor: '#0077B6',
    shadowColor: '#0077B6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
})
