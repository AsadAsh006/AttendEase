import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import Splash from '../../screens/auth/Splash'
import Login from '../../screens/auth/Login'
import SignUp from '../../screens/auth/SignUp'
import ClassSetup from '../../screens/setup/ClassSetup'
import AddSubjects from '../../screens/setup/AddSubjects'
import SelectClass from '../../screens/setup/SelectClass'
import EnrollmentPending from '../../screens/setup/EnrollmentPending'
import RoleSelection from '../../screens/setup/RoleSelection'
import Dashboard from '../../screens/home/Dashboad'
import StudentBottomTab from '../bottomtab/StudentBottomTab'
import MarkAttendence from '../../screens/home/MarkAttendence'
import Subject from '../../screens/home/Subject'
import AttendanceResult from '../../screens/home/AttendanceResult'
import SubjectStatistics from '../../screens/home/SubjectStatistics'
import StudentDetail from '../../screens/home/StudentDetail'
import EnrollStudents from '../../screens/home/EnrollStudents'
import EnrollmentRequests from '../../screens/home/EnrollmentRequests'
import SubjectLectures from '../../screens/home/SubjectLectures'
import Student from '../../screens/home/Student'
import AttendenceHistory from '../../screens/home/AttendenceHistory'
import Statistics from '../../screens/home/Statistics'
import StudentStats from '../../screens/home/StudentStats'
import StudentSubjectAttendance from '../../screens/home/StudentSubjectAttendance'
import ClassEnrollments from '../../screens/home/ClassEnrollments'
import RootNavigator from '../RootNavigator'

const Stack = createNativeStackNavigator()

const AuthStack = () => {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 300,
      }}
    >
      <Stack.Screen 
        name="Splash" 
        component={Splash}
        options={{
          animation: 'fade',
        }}
      />
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="SignUp" component={SignUp} />
      <Stack.Screen name="RootNavigator" component={RootNavigator} />
      <Stack.Screen name="ClassSetup" component={ClassSetup} />
      <Stack.Screen name="AddSubjects" component={AddSubjects} />
      <Stack.Screen name="SelectClass" component={SelectClass} />
      <Stack.Screen name="EnrollmentPending" component={EnrollmentPending} />
      <Stack.Screen name="RoleSelection" component={RoleSelection} />
      <Stack.Screen name="Main" component={Dashboard} />
      <Stack.Screen name="StudentDashboard" component={StudentBottomTab} />
      <Stack.Screen name="MarkAttendence" component={MarkAttendence} />
      <Stack.Screen name="Subject" component={Subject} />
      <Stack.Screen name="SubjectLectures" component={SubjectLectures} />
      <Stack.Screen name="AttendenceHistory" component={AttendenceHistory} />
      <Stack.Screen name="Statistics" component={Statistics} />
      <Stack.Screen name="AttendanceResult" component={AttendanceResult} />
      <Stack.Screen name="Student" component={Student} />
      <Stack.Screen name="EnrollStudents" component={EnrollStudents} />
      <Stack.Screen name="EnrollmentRequests" component={EnrollmentRequests} />
      <Stack.Screen name="SubjectStatistics" component={SubjectStatistics} />
      <Stack.Screen name="StudentDetail" component={StudentDetail} />
      <Stack.Screen name="StudentStats" component={StudentStats} />
      <Stack.Screen name="StudentSubjectAttendance" component={StudentSubjectAttendance} />
      <Stack.Screen name="ClassEnrollments" component={ClassEnrollments} />
    </Stack.Navigator>
  )
}

export default AuthStack