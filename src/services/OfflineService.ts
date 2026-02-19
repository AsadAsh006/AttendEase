import NetInfo, { NetInfoState } from '@react-native-community/netinfo'
import { MMKV } from 'react-native-mmkv'
import { supabase } from '../lib/supabase'

// Storage instances
const storage = new MMKV()
const SYNC_QUEUE_KEY = 'AttendEase.syncQueue'
const LAST_SYNC_KEY = 'AttendEase.lastSync'
const CACHED_DATA_KEY = 'AttendEase.cachedData'

// Sync operation types
export type SyncOperation = {
  id: string
  type: 'create' | 'update' | 'delete' | 'attendance'
  table: string
  data: any
  timestamp: number
  retryCount: number
}

// Cached data structure
export interface CachedData {
  subjects: any[]
  students: any[]
  studentSubjects: any[]
  attendance: any[]
  lastUpdated: number
}

class OfflineService {
  private isOnline: boolean = true
  private syncInProgress: boolean = false
  private listeners: ((isOnline: boolean) => void)[] = []

  constructor() {
    this.initNetworkListener()
  }

  private initNetworkListener() {
    NetInfo.addEventListener((state: NetInfoState) => {
      const wasOffline = !this.isOnline
      this.isOnline = state.isConnected ?? false

      // Notify listeners
      this.listeners.forEach(listener => listener(this.isOnline))

      // If coming back online, trigger sync
      if (wasOffline && this.isOnline) {
        console.log('Network restored, syncing...')
        this.syncPendingOperations()
      }
    })
  }

  // Subscribe to network changes
  addNetworkListener(callback: (isOnline: boolean) => void) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback)
    }
  }

  getIsOnline(): boolean {
    return this.isOnline
  }

  async checkNetwork(): Promise<boolean> {
    const state = await NetInfo.fetch()
    this.isOnline = state.isConnected ?? false
    return this.isOnline
  }

  // Queue an operation for sync
  queueOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>) {
    const queue = this.getSyncQueue()
    const newOp: SyncOperation = {
      ...operation,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
    }
    queue.push(newOp)
    this.saveSyncQueue(queue)
    console.log('Operation queued:', newOp.type, newOp.table)

    // Try to sync immediately if online
    if (this.isOnline) {
      this.syncPendingOperations()
    }
  }

  getSyncQueue(): SyncOperation[] {
    try {
      const raw = storage.getString(SYNC_QUEUE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  private saveSyncQueue(queue: SyncOperation[]) {
    storage.set(SYNC_QUEUE_KEY, JSON.stringify(queue))
  }

  getPendingCount(): number {
    return this.getSyncQueue().length
  }

  // Sync all pending operations
  async syncPendingOperations(): Promise<{ success: boolean; synced: number; failed: number }> {
    if (this.syncInProgress) {
      console.log('Sync already in progress')
      return { success: false, synced: 0, failed: 0 }
    }

    if (!this.isOnline) {
      console.log('Cannot sync - offline')
      return { success: false, synced: 0, failed: 0 }
    }

    this.syncInProgress = true
    const queue = this.getSyncQueue()
    let synced = 0
    let failed = 0
    const remainingQueue: SyncOperation[] = []

    for (const operation of queue) {
      try {
        await this.executeOperation(operation)
        synced++
        console.log('Synced operation:', operation.id)
      } catch (error) {
        console.error('Failed to sync operation:', operation.id, error)
        operation.retryCount++
        
        // Keep in queue if under retry limit
        if (operation.retryCount < 3) {
          remainingQueue.push(operation)
        } else {
          failed++
          console.error('Operation failed permanently after 3 retries:', operation.id)
        }
      }
    }

    this.saveSyncQueue(remainingQueue)
    this.syncInProgress = false
    storage.set(LAST_SYNC_KEY, Date.now().toString())

    console.log(`Sync complete: ${synced} synced, ${failed} failed, ${remainingQueue.length} pending`)
    return { success: true, synced, failed }
  }

  private async executeOperation(operation: SyncOperation): Promise<void> {
    const { type, table, data } = operation

    // Special handling for offline attendance records
    if (type === 'attendance' && table === 'attendance') {
      await this.syncOfflineAttendance(data)
      return
    }

    switch (type) {
      case 'create':
        const { error: createError } = await supabase.from(table).insert(data)
        if (createError) throw createError
        break

      case 'update':
        const { id: updateId, ...updateData } = data
        const { error: updateError } = await supabase
          .from(table)
          .update(updateData)
          .eq('id', updateId)
        if (updateError) throw updateError
        break

      case 'delete':
        // For lectures, delete attendance records first (foreign key constraint)
        if (table === 'lectures') {
          const { error: attendanceDeleteError } = await supabase
            .from('attendance')
            .delete()
            .eq('lecture_id', data.id)
          if (attendanceDeleteError) {
            console.error('Error deleting attendance for lecture:', attendanceDeleteError)
            throw attendanceDeleteError
          }
        }
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .eq('id', data.id)
        if (deleteError) throw deleteError
        break
    }
  }

  // Sync offline attendance record
  private async syncOfflineAttendance(offlineRecord: any): Promise<void> {
    const { subjectId, date, attendance, students, createdBy, existingLectureId } = offlineRecord
    
    let lectureId = existingLectureId

    // Create lecture if it doesn't exist
    if (!lectureId) {
      const { data: newLecture, error: lectureError } = await supabase
        .from('lectures')
        .insert({
          subject_id: subjectId,
          date: date,
          title: `Lecture on ${new Date(date).toLocaleDateString()}`,
          created_by: createdBy,
        })
        .select('id')
        .single()

      if (lectureError) throw lectureError
      lectureId = newLecture.id
    }

    // Prepare attendance records
    const attendanceRecords = students
      .filter((s: any) => attendance[s.id] !== undefined)
      .map((s: any) => ({
        lecture_id: lectureId,
        student_id: s.id,
        status: attendance[s.id] ? 'present' : 'absent',
        marked_by: createdBy,
      }))

    if (attendanceRecords.length > 0) {
      const { error: attendanceError } = await supabase
        .from('attendance')
        .upsert(attendanceRecords, { onConflict: 'lecture_id,student_id' })

      if (attendanceError) throw attendanceError
    }

    // Remove from offline storage after successful sync
    this.removeOfflineAttendance(offlineRecord.id)
    
    console.log(`Synced offline attendance for ${subjectId} on ${date}`)
  }

  // Remove a synced offline attendance record
  private removeOfflineAttendance(recordId: string) {
    try {
      const key = 'AttendEase.offlineAttendance'
      const existing = storage.getString(key)
      if (existing) {
        const records = JSON.parse(existing)
        const filtered = records.filter((r: any) => r.id !== recordId)
        storage.set(key, JSON.stringify(filtered))
      }
    } catch (error) {
      console.error('Error removing offline attendance:', error)
    }
  }

  // Cache data locally
  cacheData(data: Partial<CachedData>) {
    try {
      const existing = this.getCachedData()
      const updated = {
        ...existing,
        ...data,
        lastUpdated: Date.now(),
      }
      storage.set(CACHED_DATA_KEY, JSON.stringify(updated))
    } catch (error) {
      console.error('Error caching data:', error)
    }
  }

  getCachedData(): CachedData {
    try {
      const raw = storage.getString(CACHED_DATA_KEY)
      return raw ? JSON.parse(raw) : {
        subjects: [],
        students: [],
        studentSubjects: [],
        attendance: [],
        lastUpdated: 0,
      }
    } catch {
      return {
        subjects: [],
        students: [],
        studentSubjects: [],
        attendance: [],
        lastUpdated: 0,
      }
    }
  }

  setCachedData(data: CachedData) {
    try {
      storage.set(CACHED_DATA_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('Error setting cached data:', error)
    }
  }

  getLastSyncTime(): number {
    try {
      const raw = storage.getString(LAST_SYNC_KEY)
      return raw ? parseInt(raw, 10) : 0
    } catch {
      return 0
    }
  }

  clearCache() {
    storage.delete(CACHED_DATA_KEY)
    storage.delete(SYNC_QUEUE_KEY)
    storage.delete(LAST_SYNC_KEY)
  }
}

export const offlineService = new OfflineService()
export default offlineService
