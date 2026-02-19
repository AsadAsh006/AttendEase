import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit'
import { MMKV } from 'react-native-mmkv'

export type Subject = {
  id: string
  name: string
  code?: string
  description?: string
  color?: string
}

type SubjectsState = {
  items: Subject[]
  loaded: boolean
}

const initialState: SubjectsState = {
  items: [],
  loaded: false,
}

const STORAGE_KEY = 'AttendEase.subjects'
const storage = new MMKV()

export const loadSubjects = createAsyncThunk('subjects/load', async () => {
  try {
    const raw = storage.getString(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Subject[]
  } catch {
    return []
  }
})

export const persistSubjects = createAsyncThunk('subjects/persist', async (_, { getState }) => {
  const state: any = getState()
  const items = state.subjects?.items || []
  storage.set(STORAGE_KEY, JSON.stringify(items))
  return true
})

const subjectsSlice = createSlice({
  name: 'subjects',
  initialState,
  reducers: {
    addSubject(state, action: PayloadAction<Omit<Subject, 'id'>>) {
      const id = Date.now().toString()
      state.items.push({ id, ...action.payload })
    },
    removeSubject(state, action: PayloadAction<string>) {
      state.items = state.items.filter(s => s.id !== action.payload)
    },
    updateSubject(state, action: PayloadAction<Subject>) {
      const idx = state.items.findIndex(s => s.id === action.payload.id)
      if (idx !== -1) {
        state.items[idx] = { ...state.items[idx], ...action.payload }
      }
    },
    setSubjects(state, action: PayloadAction<Subject[]>) {
      state.items = action.payload
      state.loaded = true
    },
    clearSubjects(state) {
      state.items = []
      state.loaded = false
    }
  },
  extraReducers: (builder) => {
    builder.addCase(loadSubjects.fulfilled, (state, action) => {
      state.items = action.payload || []
      state.loaded = true
    })
    builder.addCase(persistSubjects.fulfilled, () => {
      // no-op, already persisted
    })
  }
})

export const { addSubject, removeSubject, updateSubject, setSubjects, clearSubjects } = subjectsSlice.actions
export default subjectsSlice.reducer
