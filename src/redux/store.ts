import { configureStore } from '@reduxjs/toolkit'
import subjectsReducer from './subjectsSlice'
import studentsReducer from './studentsSlice'
import attendanceReducer from './attendanceSlice'

export const store = configureStore({
  reducer: {
    subjects: subjectsReducer,
    students: studentsReducer,
    attendance: attendanceReducer,
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export default store
