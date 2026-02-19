import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import Dashboard from '../../screens/home/Dashboad';
import MarkAttendence from '../../screens/home/MarkAttendence';
import Subject from '../../screens/home/Subject';
import AttendanceResult from '../../screens/home/AttendanceResult';
import SubjectStatistics from '../../screens/home/SubjectStatistics';
import StudentDetail from '../../screens/home/StudentDetail';
import EnrollStudents from '../../screens/home/EnrollStudents';
import SubjectLectures from '../../screens/home/SubjectLectures';
import Student from '../../screens/home/Student';
import AttendenceHistory from '../../screens/home/AttendenceHistory';
import Statistics from '../../screens/home/Statistics';

const AppStack = () => {
    const Stack = createNativeStackNavigator();

    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name='Main' component={Dashboard} />
            <Stack.Screen name='MarkAttendence' component={MarkAttendence} />
            <Stack.Screen name='Subject' component={Subject} />
            <Stack.Screen name='SubjectLectures' component={SubjectLectures} />
            <Stack.Screen name='AttendenceHistory' component={AttendenceHistory} />
            <Stack.Screen name='Statistics' component={Statistics} />
            <Stack.Screen name='AttendanceResult' component={AttendanceResult} />
            <Stack.Screen name='Student' component={Student} />
            <Stack.Screen name='EnrollStudents' component={EnrollStudents} />
            <Stack.Screen name='SubjectStatistics' component={SubjectStatistics} />
            <Stack.Screen name='StudentDetail' component={StudentDetail} />
        </Stack.Navigator>
    )

}

export default AppStack

const styles = StyleSheet.create({})