import { StyleSheet, Text, View, FlatList, TouchableOpacity, Image, Alert, Platform, ActivityIndicator } from 'react-native'
import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute, useNavigation } from '@react-navigation/native'
import { useSelector } from 'react-redux'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { moderateScale } from 'react-native-size-matters'
import RNPrint from 'react-native-print'
import RNFS from 'react-native-fs'
import images from '../../assets/images'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const AttendanceResult = () => {
  const route = useRoute<any>()
  const navigation = useNavigation<any>()
  const { recordId } = route.params || {}
  const { handleAuthError } = useAuth()

  const subjects = useSelector((state: any) => state.subjects?.items ?? [])
  const students = useSelector((state: any) => state.students?.items ?? [])
  const attendanceRecords = useSelector((state: any) => state.attendance?.records ?? {})

  const [enrolledStudentIds, setEnrolledStudentIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const record = attendanceRecords[recordId]
  const subject = subjects.find((s: any) => s.id === record?.subjectId)
  const subjectColor = subject?.color || '#4F46E5'

  // Fetch enrolled students for this subject
  const fetchEnrolledStudents = useCallback(async () => {
    if (!record?.subjectId) {
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('student_subjects')
        .select('student_id')
        .eq('subject_id', record.subjectId)

      if (error) {
        handleAuthError(error)
      } else {
        setEnrolledStudentIds((data || []).map(d => d.student_id))
      }
    } catch (error) {
      console.error('Error fetching enrolled students:', error)
    } finally {
      setLoading(false)
    }
  }, [record?.subjectId, handleAuthError])

  useEffect(() => {
    fetchEnrolledStudents()
  }, [fetchEnrolledStudents])

  // Filter students by enrollment
  const subjectStudents = useMemo(() => (
    students.filter((s: any) => enrolledStudentIds.includes(s.id))
  ), [students, enrolledStudentIds])

  const rows = useMemo(() => {
    if (!record) return []
    
    // Get all student IDs that have attendance marked in this record
    const attendanceStudentIds = Object.keys(record.attendance || {})
    
    // If we have enrolled students, use them; otherwise use students from attendance record
    if (subjectStudents.length > 0) {
      return subjectStudents.map((s: any, idx: number) => ({
        srNo: idx + 1,
        id: s.id,
        name: s.name,
        code: s.roll_number || s.code || '',
        status: record.attendance[s.id] ? 'Present' : 'Absent' as 'Present' | 'Absent',
      }))
    }
    
    // Fallback: use attendance record data and match with students list
    return attendanceStudentIds.map((studentId: string, idx: number) => {
      const student = students.find((s: any) => s.id === studentId)
      return {
        srNo: idx + 1,
        id: studentId,
        name: student?.name || 'Unknown Student',
        code: student?.roll_number || student?.code || '',
        status: record.attendance[studentId] ? 'Present' : 'Absent' as 'Present' | 'Absent',
      }
    })
  }, [record, subjectStudents, students])

  const presentCount = rows.filter((r: any) => r.status === 'Present').length
  const total = rows.length
  const pct = total ? Math.round((presentCount / total) * 100) : 0

  const handleSavePDF = async () => {
    const dateStr = new Date(record.dateKey).toLocaleDateString()
    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            @page {
              size: A4;
              margin: 10mm;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body { 
              font-family: 'Segoe UI', Arial, sans-serif; 
              padding: 12px;
              font-size: 10px;
              line-height: 1.2;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 12px 16px;
              border-radius: 8px;
              margin-bottom: 12px;
            }
            .header-content {
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            h1 { 
              font-size: 18px;
              font-weight: 700;
              margin-bottom: 4px;
            }
            .meta { 
              font-size: 11px;
              opacity: 0.95;
            }
            .date-badge {
              background: rgba(255,255,255,0.2);
              padding: 6px 12px;
              border-radius: 6px;
              font-size: 11px;
              font-weight: 600;
            }
            .stats { 
              display: flex;
              gap: 10px;
              margin-bottom: 12px;
            }
            .stat-card {
              flex: 1;
              background: #F8FAFC;
              border-radius: 8px;
              padding: 10px;
              text-align: center;
              border: 1px solid #E2E8F0;
            }
            .stat-number { 
              font-size: 24px;
              font-weight: 900;
              margin-bottom: 3px;
              line-height: 1;
            }
            .stat-label { 
              font-size: 9px;
              color: #64748B;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .present-stat .stat-number { color: #10B981; }
            .absent-stat .stat-number { color: #EF4444; }
            .total-stat .stat-number { color: #3B82F6; }
            
            table { 
              width: 100%;
              border-collapse: collapse;
              font-size: 9px;
              background: white;
            }
            thead {
              background: linear-gradient(to right, #F1F5F9, #E2E8F0);
            }
            th { 
              padding: 6px 8px;
              text-align: left;
              font-weight: 700;
              color: #1E293B;
              border: 1px solid #CBD5E1;
              font-size: 9px;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            th:first-child { width: 8%; }
            th:nth-child(2) { width: 50%; }
            th:nth-child(3) { width: 22%; }
            th:nth-child(4) { width: 20%; }
            
            td { 
              padding: 5px 8px;
              border: 1px solid #E2E8F0;
              color: #334155;
            }
            tbody tr:nth-child(even) {
              background-color: #F8FAFC;
            }
            tbody tr:hover {
              background-color: #F1F5F9;
            }
            .status-cell {
              text-align: center;
              font-weight: 700;
              font-size: 8px;
            }
            .status-present { 
              color: #059669;
              background: #D1FAE5;
              padding: 3px 8px;
              border-radius: 4px;
              display: inline-block;
            }
            .status-absent { 
              color: #DC2626;
              background: #FEE2E2;
              padding: 3px 8px;
              border-radius: 4px;
              display: inline-block;
            }
            .sr-no {
              text-align: center;
              font-weight: 600;
              color: #64748B;
            }
            .footer {
              margin-top: 12px;
              text-align: center;
              font-size: 8px;
              color: #94A3B8;
              padding-top: 8px;
              border-top: 1px solid #E2E8F0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-content">
              <div>
                <h1>${subject.name}</h1>
                <div class="meta">${subject.code ? subject.code : 'Attendance Report'}</div>
              </div>
              <div class="date-badge">${dateStr}</div>
            </div>
          </div>
          
          <div class="stats">
            <div class="stat-card present-stat">
              <div class="stat-number">${presentCount}</div>
              <div class="stat-label">Present (${pct}%)</div>
            </div>
            <div class="stat-card absent-stat">
              <div class="stat-number">${total - presentCount}</div>
              <div class="stat-label">Absent (${100 - pct}%)</div>
            </div>
            <div class="stat-card total-stat">
              <div class="stat-number">${total}</div>
              <div class="stat-label">Total Students</div>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Sr.</th>
                <th>Student Name</th>
                <th>Roll Number</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((r: any) => `
                <tr>
                  <td class="sr-no">${r.srNo}</td>
                  <td>${r.name}</td>
                  <td>${r.code}</td>
                  <td class="status-cell">
                    <span class="status-${r.status.toLowerCase()}">${r.status}</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            Generated on ${new Date().toLocaleString()} • AttendEase Manage Attendance Efficiently
          </div>
        </body>
      </html>
    `
    try {
      await RNPrint.print({ html })
    } catch (e) {
      console.warn('Print failed', e)
    }
  }

  const handleExportCSV = async () => {
    const dateStr = new Date(record.dateKey).toLocaleDateString().replace(/\//g, '-')
    const header = ['Sr.', 'Student Name', 'Roll Number', 'Status']
    const csv = [
      `Subject: ${subject.name}`,
      `Code: ${subject.code || 'N/A'}`,
      `Date: ${dateStr}`,
      `Present: ${presentCount} (${pct}%)`,
      `Absent: ${total - presentCount} (${100 - pct}%)`,
      '',
      header.join(','),
      ...rows.map((r: any) => [r.srNo, r.name, r.code, r.status].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    try {
      const fileName = `${subject.name.replace(/[^a-zA-Z0-9]/g, '_')}_Attendance_${dateStr}.csv`
      const downloadFolder = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath
      const filePath = `${downloadFolder}/${fileName}`

      await RNFS.writeFile(filePath, csv, 'utf8')

      Alert.alert(
        'CSV Exported Successfully',
        `File saved to: ${Platform.OS === 'android' ? 'Downloads' : 'Documents'} folder\n\nFilename: ${fileName}`,
        [{ text: 'OK' }]
      )
    } catch (e) {
      console.warn('Export failed', e)
      Alert.alert('Export Failed', 'Could not save CSV file. Please try again.')
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.headerGradient, { backgroundColor: '#4F46E5' }]}>
          <View style={styles.headerContainer}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Image source={images.back} style={styles.backIcon} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Attendance Result</Text>
            </View>
            <View style={styles.headerRight} />
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading attendance...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!record || !subject) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.headerGradient, { backgroundColor: '#4F46E5' }]}>
          <View style={styles.headerContainer}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Image source={images.back} style={styles.backIcon} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Attendance Result</Text>
            </View>
            <View style={styles.headerRight} />
          </View>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Record not found.</Text>
        </View>
      </SafeAreaView>
    )
  }

  const dateStr = new Date(record.dateKey).toLocaleDateString()

  return (
    <SafeAreaView style={styles.container}>
      {/* Professional Header */}
      <View style={[styles.headerGradient, { backgroundColor: subjectColor }]}>
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={2}>{subject.name}</Text>
            <View style={styles.headerBadges}>
              {subject.code && (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{subject.code}</Text>
                </View>
              )}
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{dateStr}</Text>
              </View>
            </View>
          </View>

          <View style={styles.headerRight} />
        </View>
      </View>

      {/* Attendance Overview */}
      <View style={styles.statsSection}>
        <View style={styles.mainStatsCard}>
          {/* Circular Chart */}
          <View style={styles.circularChartContainer}>
            <Text style={styles.chartTitle}>Attendance</Text>
            
            {/* Legend */}
            <View style={styles.legendContainer}>
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.legendText}>Present: {pct}%</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.legendText}>Absent: {100 - pct}%</Text>
                </View>
              </View>
              
              {/* Total count */}
              <View style={styles.totalInfo}>
                <Text style={styles.totalText}>Total: {presentCount} / {total} students</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Student List */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>Student List ({total})</Text>
        <FlatList
          data={rows}
          keyExtractor={(item, index) => String(index)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.studentCard}>
              <View style={styles.studentInfo}>
                <View style={[styles.studentAvatar, { backgroundColor: item.status === 'Present' ? '#10B981' : '#94A3B8' }]}>
                  <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.studentDetails}>
                  <Text style={styles.studentName}>{item.name}</Text>
                  <Text style={styles.studentCode}>Roll: {item.code}</Text>
                </View>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: item.status === 'Present' ? '#10B981' : '#EF4444' }]}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No students found for this subject.</Text>
            </View>
          )}
        />
      </View>

      {/* Export Buttons */}
      {rows.length > 0 && (
        <View style={styles.exportButtons}>
          <TouchableOpacity onPress={handleSavePDF} style={[styles.exportButton, { backgroundColor: subjectColor }]}>
            <Image source={images.download} style={styles.exportIcon} />
            <Text style={styles.exportButtonText}>Save PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleExportCSV} style={[styles.exportButton, { backgroundColor: '#10B981' }]}>
            <Image source={images.download} style={styles.exportIcon} />
            <Text style={styles.exportButtonText}>Export CSV</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  )
}

export default AttendanceResult

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  // Professional Header Styles
  headerGradient: {
    paddingBottom: 20,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    width: moderateScale(22),
    height: moderateScale(22),
    tintColor: '#FFFFFF',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: moderateScale(22),
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  headerBadges: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  headerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerBadgeText: {
    fontSize: moderateScale(11),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerRight: {
    width: moderateScale(36),
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: moderateScale(16),
    color: '#EF4444',
    fontWeight: '600',
  },
  // Modern Stats Section
  statsSection: {
    paddingHorizontal: 16,
    marginTop: -12,
    marginBottom: 16,
  },
  mainStatsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  circularChartContainer: {
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 24,
    letterSpacing: -0.3,
  },
  donutWrapper: {
    marginBottom: 28,
  },
  donutChart: {
    width: moderateScale(180),
    height: moderateScale(180),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  donutRing: {
    position: 'absolute',
    width: moderateScale(180),
    height: moderateScale(180),
    borderRadius: moderateScale(90),
  },
  donutCover: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#EF4444',
    borderRadius: moderateScale(90),
    transformOrigin: 'center',
  },
  donutCenter: {
    width: moderateScale(120),
    height: moderateScale(120),
    borderRadius: moderateScale(60),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
  },
  donutPercentage: {
    fontSize: moderateScale(36),
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -1.5,
  },
  donutSubtext: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: '#64748B',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  legendContainer: {
    width: '100%',
    alignItems: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 32,
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#475569',
  },
  totalInfo: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    width: '80%',
    alignItems: 'center',
  },
  totalText: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  // Student List Section
  listSection: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  listContent: {
    paddingBottom: 100,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  studentAvatar: {
    width: moderateScale(42),
    height: moderateScale(42),
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 3,
  },
  studentCode: {
    fontSize: moderateScale(13),
    color: '#64748B',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: moderateScale(14),
    color: '#94A3B8',
  },
  // Export Buttons
  exportButtons: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 12,
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  exportIcon: {
    width: moderateScale(18),
    height: moderateScale(18),
    tintColor: '#FFFFFF',
    marginRight: 8,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: moderateScale(14),
    color: '#6B7280',
  },
})