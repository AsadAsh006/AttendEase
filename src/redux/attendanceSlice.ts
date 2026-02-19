import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit'
import { MMKV } from 'react-native-mmkv'

export type AttendanceMap = Record<string, boolean> // studentId -> present

export type AttendanceRecord = {
  id: string // unique id, e.g., `${subjectId}__${dateKey}`
  subjectId: string
  dateKey: string // YYYY-MM-DD (or full ISO date)
  attendance: AttendanceMap
  updatedAt: number
}

type AttendanceState = {
  records: Record<string, AttendanceRecord>
  loaded: boolean
}

const initialState: AttendanceState = {
  records: {},
  loaded: false,
}

const STORAGE_KEY = 'AttendEase.attendance.records'
const storage = new MMKV()

export const loadAttendance = createAsyncThunk('attendance/load', async () => {
  try {
    const raw = storage.getString(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw || '{}') as Record<string, AttendanceRecord>
  } catch {
    return {}
  }
})

// Persist current records to storage; call from components if needed
export const persistAttendance = createAsyncThunk('attendance/persist', async (_, { getState }) => {
  const state: any = getState()
  const records = state.attendance?.records || {}
  storage.set(STORAGE_KEY, JSON.stringify(records))
  return true
})

// Helper to build record id
export const makeRecordId = (subjectId: string, dateKey: string) => `${subjectId}__${dateKey}`

const attendanceSlice = createSlice({
  name: 'attendance',
  initialState,
  reducers: {
    setRecord(
      state,
      action: PayloadAction<{ subjectId: string; dateKey: string; attendance: AttendanceMap }>
    ) {
      const { subjectId, dateKey, attendance } = action.payload
      const id = makeRecordId(subjectId, dateKey)
      state.records[id] = {
        id,
        subjectId,
        dateKey,
        attendance,
        updatedAt: Date.now(),
      }
    },
    updateStudentStatus(
      state,
      action: PayloadAction<{ subjectId: string; dateKey: string; studentId: string; present: boolean }>
    ) {
      const { subjectId, dateKey, studentId, present } = action.payload
      const id = makeRecordId(subjectId, dateKey)
      const existing = state.records[id]
      if (!existing) {
        state.records[id] = {
          id,
          subjectId,
          dateKey,
          attendance: { [studentId]: present },
          updatedAt: Date.now(),
        }
      } else {
        existing.attendance[studentId] = present
        existing.updatedAt = Date.now()
      }
    },
    setAttendanceRecords(state, action: PayloadAction<any[]>) {
      // Convert array from server to record format
      const records: Record<string, AttendanceRecord> = {}
      action.payload.forEach((record: any) => {
        const id = record.id || makeRecordId(record.subject_id, record.date)
        records[id] = {
          id,
          subjectId: record.subject_id || record.subjectId,
          dateKey: record.date || record.dateKey,
          attendance: record.attendance || {},
          updatedAt: record.created_at ? new Date(record.created_at).getTime() : (record.updated_at ? new Date(record.updated_at).getTime() : Date.now()),
        }
      })
      state.records = records
      state.loaded = true
    },
    clearAttendance(state) {
      state.records = {}
      state.loaded = false
    },
    removeRecord(state, action: PayloadAction<string>) {
      const id = action.payload
      delete state.records[id]
    }
  },
  extraReducers: (builder) => {
    builder.addCase(loadAttendance.fulfilled, (state, action) => {
      state.records = action.payload || {}
      state.loaded = true
    })
    builder.addCase(persistAttendance.fulfilled, (state) => {
      // no-op, we already updated state
    })
  },
})

export const { setRecord, updateStudentStatus, setAttendanceRecords, clearAttendance, removeRecord } = attendanceSlice.actions
export default attendanceSlice.reducer