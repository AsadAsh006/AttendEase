import { StyleSheet, Text, View, FlatList, TouchableOpacity, Image, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native'
import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { moderateScale } from 'react-native-size-matters'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSelector, useDispatch } from 'react-redux'
import images from '../../assets/images'
import { useNavigation, useRoute } from '@react-navigation/native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import RNFS from 'react-native-fs'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useOffline } from '../../contexts/OfflineContext'
import { removeRecord, persistAttendance } from '../../redux/attendanceSlice'
import offlineService from '../../services/OfflineService'

const SubjectLectures = () => {
    const navigation = useNavigation<any>()
    const route = useRoute<any>()
    const dispatch = useDispatch()
    const { subjectId, subjectName, subjectCode } = route.params
    const { handleAuthError } = useAuth()
    const { isOnline } = useOffline()

    const subjects = useSelector((state: any) => state.subjects?.items ?? [])
    const students = useSelector((state: any) => state.students?.items ?? [])
    const attendanceRecords = useSelector((state: any) => state.attendance?.records ?? {})
    
    const [enrolledStudentIds, setEnrolledStudentIds] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [exporting, setExporting] = useState(false)

    // Export all lectures to Excel (CSV)
    const handleExportAllLectures = useCallback(async () => {
        if (lectureData.lectures.length === 0) {
            Alert.alert('No Data', 'There are no lectures to export')
            return
        }

        setExporting(true)
        try {
            // Get enrolled students
            const subjectStudents = students.filter((s: any) => enrolledStudentIds.includes(s.id))
            
            // Create CSV header
            const header = ['Student Name', 'Roll Number', ...lectureData.lectures.map((l: any) => 
                new Date(l.dateKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            ), 'Total Present', 'Total Absent', 'Attendance %']
            
            // Create rows for each student
            const rows = subjectStudents.map((student: any) => {
                let totalPresent = 0
                let totalAbsent = 0
                
                const attendanceData = lectureData.lectures.map((lecture: any) => {
                    const status = lecture.attendance[student.id]
                    if (status === true) {
                        totalPresent++
                        return 'P'
                    } else if (status === false) {
                        totalAbsent++
                        return 'A'
                    }
                    return '-'
                })
                
                const totalLectures = lectureData.lectures.length
                const percentage = totalLectures > 0 ? Math.round((totalPresent / totalLectures) * 100) : 0
                
                return [
                    student.name,
                    student.roll_number || student.code || '',
                    ...attendanceData,
                    totalPresent.toString(),
                    totalAbsent.toString(),
                    `${percentage}%`
                ]
            })
            
            // Add summary rows
            const summaryRows = [
                [],
                ['Summary'],
                ['Subject', subjectName],
                ['Code', subjectCode || 'N/A'],
                ['Total Lectures', lectureData.totalLectures.toString()],
                ['Total Students', lectureData.totalStudents.toString()],
                ['Average Attendance', `${lectureData.avgPercentage}%`],
                ['Export Date', new Date().toLocaleString()]
            ]
            
            // Combine all data
            const csvContent = [
                header.join(','),
                ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
                ...summaryRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            ].join('\n')
            
            // Save file
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
            const fileName = `${subjectName.replace(/[^a-zA-Z0-9]/g, '_')}_All_Lectures_${timestamp}.csv`
            const downloadFolder = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath
            const filePath = `${downloadFolder}/${fileName}`
            
            await RNFS.writeFile(filePath, csvContent, 'utf8')
            
            Alert.alert(
                'Export Successful',
                `All lectures attendance exported successfully!\n\nFile saved to: ${Platform.OS === 'android' ? 'Downloads' : 'Documents'} folder\n\nFilename: ${fileName}`,
                [{ text: 'OK' }]
            )
        } catch (error) {
            console.error('Export failed:', error)
            Alert.alert('Export Failed', 'Could not export attendance data. Please try again.')
        } finally {
            setExporting(false)
        }
    }, [lectureData, students, enrolledStudentIds, subjectName, subjectCode])

    // Delete attendance/lecture record
    const handleDeleteAttendance = useCallback(async (lectureId: string, dateLabel: string) => {
        Alert.alert(
            'Delete Attendance',
            `Are you sure you want to delete attendance for ${dateLabel}? This action cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        setDeleting(lectureId)
                        try {
                            if (isOnline) {
                                console.log('Deleting lecture:', lectureId)
                                
                                // Delete attendance records first (due to foreign key)
                                const { error: attendanceError } = await supabase
                                    .from('attendance')
                                    .delete()
                                    .eq('lecture_id', lectureId)

                                if (attendanceError) {
                                    console.error('Error deleting attendance:', attendanceError)
                                    handleAuthError(attendanceError)
                                    throw attendanceError
                                }
                                console.log('Deleted attendance records for lecture:', lectureId)

                                // Then delete the lecture
                                const { error: lectureError, data: deletedLecture } = await supabase
                                    .from('lectures')
                                    .delete()
                                    .eq('id', lectureId)
                                    .select()

                                if (lectureError) {
                                    console.error('Error deleting lecture:', lectureError)
                                    handleAuthError(lectureError)
                                    throw lectureError
                                }
                                
                                console.log('Deleted lecture:', deletedLecture)
                                
                                if (!deletedLecture || deletedLecture.length === 0) {
                                    console.warn('No lecture was deleted - may not have permission or lecture not found')
                                }
                            } else {
                                // Queue delete operation for later sync
                                offlineService.queueOperation({
                                    type: 'delete',
                                    table: 'lectures',
                                    data: { id: lectureId },
                                })
                            }

                            // Remove from Redux store
                            dispatch(removeRecord(lectureId))
                            
                            // Persist changes to local storage
                            dispatch(persistAttendance() as any)
                            
                            // Update offline cache
                            const cached = offlineService.getCachedData()
                            if (cached.attendance.length > 0) {
                                cached.attendance = cached.attendance.filter((a: any) => a.id !== lectureId)
                                offlineService.setCachedData(cached)
                            }
                            
                            Alert.alert('Success', 'Attendance record deleted successfully')
                        } catch (error) {
                            console.error('Error deleting attendance:', error)
                            Alert.alert('Error', 'Failed to delete attendance record')
                        } finally {
                            setDeleting(null)
                        }
                    }
                }
            ]
        )
    }, [isOnline, handleAuthError, dispatch])

    // Fetch enrolled students for this subject
    const fetchEnrolledStudents = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('student_subjects')
                .select('student_id')
                .eq('subject_id', subjectId)

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
    }, [subjectId, handleAuthError])

    useEffect(() => {
        fetchEnrolledStudents()
    }, [fetchEnrolledStudents])

    // Get the subject to access its color
    const subject = subjects.find((s: any) => s.id === subjectId)
    const subjectColor = subject?.color || '#4F46E5' // Fallback to purple if no color

    const lectureData = useMemo(() => {
        const subjectRecords = Object.values(attendanceRecords).filter(
            (record: any) => record.subjectId === subjectId
        )

        // Filter students by enrollment
        const subjectStudents = students.filter(
            (s: any) => enrolledStudentIds.includes(s.id)
        )

        const lectures = subjectRecords.map((record: any) => {
            const attendanceEntries = Object.entries(record.attendance || {})
            const presentCount = attendanceEntries.filter(([_, status]) => status === true).length
            // Use enrolled student count, or fall back to attendance record count
            const total = subjectStudents.length > 0 ? subjectStudents.length : attendanceEntries.length
            const pct = total > 0 ? Math.round((presentCount / total) * 100) : 0

            return {
                ...record,
                presentCount,
                absentCount: total - presentCount,
                total,
                pct,
                date: new Date(record.dateKey),
            }
        }).sort((a: any, b: any) => b.date.getTime() - a.date.getTime())

        // Calculate overall stats
        let totalPresent = 0
        let totalAbsent = 0
        let totalPossible = 0
        lectures.forEach((lecture: any) => {
            totalPresent += lecture.presentCount
            totalAbsent += lecture.absentCount
            totalPossible += lecture.total
        })
        const avgPercentage = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 0

        return {
            lectures,
            totalLectures: lectures.length,
            totalStudents: subjectStudents.length > 0 ? subjectStudents.length : (lectures[0]?.total || 0),
            totalPresent,
            totalAbsent,
            avgPercentage,
        }
    }, [attendanceRecords, subjectId, students, enrolledStudentIds])

    const getAttendanceColor = (percentage: number) => {
        if (percentage >= 75) return { bg: '#ECFDF5', text: '#059669', border: '#10B981' }
        if (percentage >= 50) return { bg: '#FFFBEB', text: '#D97706', border: '#F59E0B' }
        return { bg: '#FEF2F2', text: '#DC2626', border: '#EF4444' }
    }

    const renderLectureItem = ({ item, index }: any) => {
        const dateLabel = item.date.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
        const timeLabel = new Date(item.updatedAt).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit'
        })

        const colors = getAttendanceColor(item.pct)

        return (
            <TouchableOpacity
                style={[styles.lectureCard, { marginTop: index === 0 ? 0 : 10 }]}
                onPress={() => navigation.navigate('AttendanceResult', { recordId: item.id })}
                activeOpacity={0.7}
            >
                {/* Header with date */}
                <View style={styles.lectureHeader}>
                    <View style={styles.lectureLeft}>
                        <View style={[styles.lectureNumberBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                            <Text style={[styles.lectureNumber, { color: colors.text }]}>#{lectureData.lectures.length - index}</Text>
                        </View>
                        <View style={styles.lectureHeaderInfo}>
                            <Text style={styles.lectureDate}>{dateLabel}</Text>
                            <View style={styles.timeRow}>
                                <Image source={images.calender} style={styles.timeIcon} />
                                <Text style={styles.lectureTime}>{timeLabel}</Text>
                            </View>
                        </View>
                    </View>
                    <View style={[styles.percentageCircle, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                        <Text style={[styles.percentageValue, { color: colors.text }]}>{item.pct}%</Text>
                    </View>
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                        <View style={styles.statContent}>
                            <Text style={[styles.statValue, { color: '#059669' }]}>{item.presentCount}</Text>
                            <Text style={styles.statLabel}>Present</Text>
                            
                        </View>
                    </View>

                    <View style={styles.statDivider} />

                    <View style={styles.statBox}>
                        <View style={styles.statContent}>
                            <Text style={[styles.statValue, { color: '#DC2626' }]}>{item.absentCount}</Text>
                            <Text style={styles.statLabel}>Absent</Text>
                        </View>
                    </View>

                    <View style={styles.statDivider} />

                    <View style={styles.statBox}>
                        <View style={styles.statContent}>
                            <Text style={[styles.statValue, { color: '#4F46E5' }]}>{item.total}</Text>
                            <Text style={styles.statLabel}>Total</Text>
                        </View>
                    </View>
                </View>

                {/* View Details Button */}
                <View style={styles.buttonRow}>
                    <TouchableOpacity
                        style={[styles.viewDetailsButton, { backgroundColor: subjectColor, flex: 1 }]}
                        onPress={() => navigation.navigate('AttendanceResult', { recordId: item.id })}
                    >
                        <Text style={styles.viewDetailsText}>View Full Details</Text>
                        <Image source={images.download} style={styles.viewDetailsIcon} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteAttendance(item.id, dateLabel)}
                        disabled={deleting === item.id}
                    >
                        {deleting === item.id ? (
                            <ActivityIndicator size="small" color="#DC2626" />
                        ) : (
                            <Image source={images.deleteIcon} style={styles.deleteIcon} />
                        )}
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        )
    }

    const colors = getAttendanceColor(lectureData.avgPercentage)

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4F46E5" />
                    <Text style={styles.loadingText}>Loading lectures...</Text>
                </View>
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header - Professional Design */}
            <View style={[styles.headerGradient, { backgroundColor: subjectColor }]}>
                <View style={styles.headerContainer}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Icon name="arrow-left" size={18} color="#FFFFFF" />
                    </TouchableOpacity>

                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle} numberOfLines={2}>{subjectName}</Text>

                    </View>
                    <View style={styles.headerRight} />
                </View>

            </View>

            {/* Summary Cards */}
            <View style={styles.summarySection}>
                <View style={styles.summaryRow}>
                    {/* Average Attendance Card - Modern Design */}
                    <View style={[styles.modernAttendanceCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                        <View style={styles.cardTopRow}>
                            <View style={styles.cardLabelContainer}>
                                <View style={[styles.iconCircle, { backgroundColor: colors.text }]}>
                                    <Icon name="chart-line" size={18} color="#FFFFFF" />
                                </View>
                                <Text style={styles.cardTitle}>Avg Attendance</Text>
                            </View>
                            <View style={[styles.trendBadge, { backgroundColor: colors.text + '20' }]}>
                                <Text style={[styles.trendText, { color: colors.text }]}>
                                    {lectureData.avgPercentage >= 75 ? '↑ Good' : lectureData.avgPercentage >= 50 ? '→ Fair' : '↓ Low'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.cardContent}>
                            <View style={[styles.percentageRing, { borderColor: colors.text }]}>
                                <Text style={[styles.percentageText, { color: colors.text }]}>{lectureData.avgPercentage}%</Text>
                            </View>

                            <View style={styles.statsColumn}>
                                <View style={styles.statRow}>
                                    <Text style={styles.statLabel}>Total Lectures</Text>
                                    <Text style={styles.statValue}>{lectureData.totalLectures}</Text>
                                </View>
                                <View style={styles.statDividerLine} />
                                <View style={styles.statRow}>
                                    <Text style={styles.statLabel}>Students</Text>
                                    <Text style={styles.statValue}>{lectureData.totalStudents}</Text>
                                </View>
                            </View>
                        </View>
                    </View>


                </View>
            </View>

            {/* Lectures List */}
            <View style={styles.lecturesSection}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>All Lectures</Text>
                    <View style={styles.headerActions}>
                        <TouchableOpacity 
                            style={[styles.exportButton, { backgroundColor: subjectColor }]}
                            onPress={handleExportAllLectures}
                            disabled={exporting || lectureData.totalLectures === 0}
                            activeOpacity={0.7}
                        >
                            {exporting ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <Icon name="file-excel" size={16} color="#FFFFFF" />
                                    <Text style={styles.exportButtonText}>Export All</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        <View style={[styles.lectureBadge, { backgroundColor: subjectColor }]}>
                            <Text style={styles.lectureBadgeText}>{lectureData.totalLectures}</Text>
                        </View>
                    </View>
                </View>

                <FlatList
                    data={lectureData.lectures}
                    keyExtractor={(item: any) => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    renderItem={renderLectureItem}
                    ListEmptyComponent={() => (
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconContainer}>
                                <Image source={images.calender} style={styles.emptyIcon} />
                            </View>
                            <Text style={styles.emptyTitle}>No Lectures Yet</Text>
                            <Text style={styles.emptyText}>Start marking attendance to see lecture records here</Text>
                        </View>
                    )}
                />
            </View>
        </SafeAreaView>
    )
}

export default SubjectLectures

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    headerGradient: {
        paddingBottom: 20,
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 8,
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
        marginBottom: 0,
        letterSpacing: -0.5,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    statBadgeText: {
        fontSize: moderateScale(11),
        fontWeight: '600',
        color: '#FFFFFF',
    },
    statDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
    headerRight: {
        width: moderateScale(36),
    },

    summarySection: {
        paddingHorizontal: 16,
        marginTop: -12,
        marginBottom: 12,
    },
    summaryRow: {
        flexDirection: 'row',
        gap: 10,
    },
    modernAttendanceCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
        borderWidth: 2,
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    cardLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    iconCircle: {
        width: moderateScale(32),
        height: moderateScale(32),
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    iconImage: {
        width: moderateScale(16),
        height: moderateScale(16),
        tintColor: '#FFFFFF',
    },
    cardTitle: {
        fontSize: moderateScale(14),
        fontWeight: '700',
        color: '#0F172A',
        letterSpacing: -0.3,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    percentageRing: {
        width: moderateScale(90),
        height: moderateScale(90),
        borderRadius: 45,
        borderWidth: 6,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    percentageText: {
        fontSize: moderateScale(28),
        fontWeight: '900',
        letterSpacing: -1,
    },
    statsColumn: {
        flex: 1,
        gap: 8,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statLabel: {
        fontSize: moderateScale(12),
        color: '#64748B',
        fontWeight: '600',
        textAlign: 'center',
    },
    statValue: {
        fontSize: moderateScale(18),
        textAlign: 'center',
        fontWeight: '800',
        color: '#0F172A',
    },
    statDividerLine: {
        height: 1,
        backgroundColor: '#E2E8F0',
    },
    summaryCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingTop: 12,
        paddingBottom: 12,
        paddingHorizontal: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 2,
    },
    summaryCardLarge: {
        flex: 3,
    },
    summaryCardSmall: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        // marginBottom: 8,
    },
    summaryCardLabel: {
        fontSize: moderateScale(11),
        fontWeight: '600',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    trendBadge: {
        paddingHorizontal: 8,
        // paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.1)',
    },
    trendText: {
        fontSize: moderateScale(11),
        fontWeight: '700',
    },
    summaryCardValue: {
        fontSize: moderateScale(32),
        fontWeight: '900',
        marginBottom: 6,
    },
    progressBar: {
        height: 5,
        backgroundColor: '#E2E8F0',
        borderRadius: 2.5,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        // backgroundColor: '#4F46E5',
        borderRadius: 2.5,
    },
    iconBadge: {
        width: moderateScale(36),
        height: moderateScale(36),
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    iconBadgeImage: {
        width: moderateScale(18),
        height: moderateScale(18),
        tintColor: '#4F46E5',
    },
    iconEmoji: {
        fontSize: moderateScale(18),
    },
    summaryCardValueSmall: {
        fontSize: moderateScale(22),
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 3,
    },
    summaryCardLabelSmall: {
        fontSize: moderateScale(10),
        fontWeight: '600',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    lecturesSection: {
        flex: 1,
        paddingHorizontal: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: moderateScale(18),
        fontWeight: '700',
        color: '#0F172A',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    exportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        gap: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    exportButtonText: {
        fontSize: moderateScale(12),
        fontWeight: '700',
        color: '#FFFFFF',
    },
    lectureBadge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        minWidth: moderateScale(32),
        alignItems: 'center',
    },
    lectureBadgeText: {
        fontSize: moderateScale(13),
        fontWeight: '700',
        color: '#FFFFFF',
    },
    listContent: {
        paddingBottom: 24,
    },
    lectureCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    lectureHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    lectureLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    lectureNumberBadge: {
        width: moderateScale(40),
        height: moderateScale(40),
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
        borderWidth: 2,
    },
    lectureNumber: {
        fontSize: moderateScale(14),
        fontWeight: '800',
    },
    lectureHeaderInfo: {
        flex: 1,
    },
    lectureDate: {
        fontSize: moderateScale(15),
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 3,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    timeIcon: {
        width: moderateScale(12),
        height: moderateScale(12),
        tintColor: '#64748B',
    },
    lectureTime: {
        fontSize: moderateScale(12),
        color: '#64748B',
        fontWeight: '500',
    },
    percentageCircle: {
        width: moderateScale(52),
        height: moderateScale(52),
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2.5,
    },
    percentageValue: {
        fontSize: moderateScale(14),
        fontWeight: '900',
    },
    divider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginBottom: 12,
    },
    statsGrid: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    statBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statIconContainer: {
        width: moderateScale(32),
        height: moderateScale(32),
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statIcon: {
        fontSize: moderateScale(14),
        fontWeight: '700',
    },
    statContent: {
        flex: 1,
    },
    statDivider: {
        width: 1,
        backgroundColor: '#E2E8F0',
        marginHorizontal: 8,
    },
    buttonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    viewDetailsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        gap: 8,
    },
    viewDetailsText: {
        fontSize: moderateScale(14),
        fontWeight: '700',
        color: '#FFFFFF',
    },
    viewDetailsIcon: {
        width: moderateScale(14),
        height: moderateScale(14),
        tintColor: '#FFFFFF',
        transform: [{ rotate: '270deg' }],
    },
    deleteButton: {
        width: moderateScale(44),
        height: moderateScale(44),
        borderRadius: 10,
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteIcon: {
        width: moderateScale(20),
        height: moderateScale(20),
        tintColor: '#DC2626',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyIconContainer: {
        width: moderateScale(100),
        height: moderateScale(100),
        borderRadius: 50,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    emptyIcon: {
        width: moderateScale(50),
        height: moderateScale(50),
        tintColor: '#CBD5E1',
    },
    emptyTitle: {
        fontSize: moderateScale(20),
        fontWeight: '700',
        color: '#475569',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: moderateScale(14),
        color: '#94A3B8',
        fontWeight: '500',
        textAlign: 'center',
        paddingHorizontal: 40,
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
