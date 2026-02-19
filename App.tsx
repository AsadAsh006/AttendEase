import { StyleSheet } from 'react-native'
import React, { useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import AppStack from './src/navigation/stack/AppStack'
import { Provider, useDispatch } from 'react-redux'
import store from './src/redux/store'
import { loadSubjects } from './src/redux/subjectsSlice'
import { loadStudents } from './src/redux/studentsSlice'
import { loadAttendance } from './src/redux/attendanceSlice'

const AppContent = () => {
  const dispatch = useDispatch()

  useEffect(() => {
  
    dispatch(loadSubjects() as any)
    dispatch(loadStudents() as any)
    dispatch(loadAttendance() as any)
  }, [dispatch])

  return (
    <NavigationContainer>
      <AppStack/>
    </NavigationContainer>
  )
}

const App = () => {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  )
}

export default App

const styles = StyleSheet.create({})