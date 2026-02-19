import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit'
import { MMKV } from 'react-native-mmkv'

export type Student = {
  id: string
  name: string
  code?: string
  description?: string
  subjects?: string[] // list of enrolled subject IDs
}

type StudentsState = {
  items: Student[]
  loaded: boolean
}

const initialState: StudentsState = {
  items: [],
  loaded: false,
}

const STORAGE_KEY = 'AttendEase.students'
const storage = new MMKV()

export const loadStudents = createAsyncThunk('students/load', async () => {
  try {
    const raw = storage.getString(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Student[]
  } catch {
    return []
  }
})

export const persistStudents = createAsyncThunk('students/persist', async (_, { getState }) => {
  const state: any = getState()
  const items = state.students?.items || []
  storage.set(STORAGE_KEY, JSON.stringify(items))
  return true
})

const studentsSlice = createSlice({
  name: 'students',
  initialState,
  reducers: {
    // payload can contain optional `subjects` or a single `subjectId` to enroll upon creation
    addStudent(state, action: PayloadAction<Omit<Student, 'id'> & { subjectId?: string }>) {
      const id = Date.now().toString()
      const payload = action.payload as any
      const subjects = payload.subjects ?? (payload.subjectId ? [payload.subjectId] : [])
      const student: Student = { id, ...action.payload, subjects }
      state.items.push(student)
    },
    removeStudent(state, action: PayloadAction<string>) {
      state.items = state.items.filter(s => s.id !== action.payload)
    },
    updateStudent(state, action: PayloadAction<Partial<Student> & { id: string }>) {
      const idx = state.items.findIndex(s => s.id === action.payload.id)
      if (idx !== -1) {
        state.items[idx] = { ...state.items[idx], ...action.payload }
      }
    },
    setStudents(state, action: PayloadAction<Student[]>) {
      state.items = action.payload
      state.loaded = true
    },
    clearStudents(state) {
      state.items = []
      state.loaded = false
    }
  },
  extraReducers: (builder) => {
    builder.addCase(loadStudents.fulfilled, (state, action) => {
      state.items = action.payload || []
      state.loaded = true
    })
    builder.addCase(persistStudents.fulfilled, () => {
      // no-op, already persisted
    })
  }
})

export const { addStudent, removeStudent, updateStudent, setStudents, clearStudents } = studentsSlice.actions
export default studentsSlice.reducer
