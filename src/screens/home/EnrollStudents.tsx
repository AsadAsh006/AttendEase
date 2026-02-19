import React, { useState, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Image } from 'react-native'
import { moderateScale } from 'react-native-size-matters'
import Icon from 'react-native-vector-icons/Ionicons'
import { lightTheme as theme } from '../../theme/colors'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from 'react-native-vector-icons/Ionicons'
import images from '../../assets/images'

type Student = {
    id: string
    name: string
    code?: string
    description?: string
    subjects?: string[]
}

type Props = {
    route?: any
    navigation?: any
}

const EnrollStudents: React.FC<Props> = ({ route, navigation }) => {
    const { subjectId, subjectName, students, onEnroll } = route?.params || {}
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())

    const availableStudents = useMemo(() => {
        const filtered = students.filter(s => !s.subjects?.includes(subjectId))

        if (!searchQuery.trim()) return filtered

        const query = searchQuery.toLowerCase()
        return filtered.filter(s =>
            s.name.toLowerCase().includes(query) ||
            s.code?.toLowerCase().includes(query) ||
            s.description?.toLowerCase().includes(query)
        )
    }, [students, subjectId, searchQuery])

    const toggleStudent = (studentId: string) => {
        const newSelected = new Set(selectedStudents)
        if (newSelected.has(studentId)) {
            newSelected.delete(studentId)
        } else {
            newSelected.add(studentId)
        }
        setSelectedStudents(newSelected)
    }

    const selectAll = () => {
        if (selectedStudents.size === availableStudents.length) {
            setSelectedStudents(new Set())
        } else {
            setSelectedStudents(new Set(availableStudents.map(s => s.id)))
        }
    }

    const handleEnroll = () => {
        if (selectedStudents.size > 0) {
            onEnroll(Array.from(selectedStudents))
            navigation.goBack()
        }
    }

    const renderItem = ({ item }: { item: Student }) => {
        const isSelected = selectedStudents.has(item.id)

        return (
            <TouchableOpacity
                style={[styles.studentCard, isSelected && styles.studentCardSelected]}
                onPress={() => toggleStudent(item.id)}
                activeOpacity={0.7}
            >
                <View style={styles.studentInfo}>
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <Ionicons name="checkmark" size={16} color={theme.white} />}
                    </View>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {item.name.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                    <View style={styles.details}>
                        <Text style={styles.studentName}>{item.name}</Text>
                        {item.code && <Text style={styles.studentCode}>Roll: {item.code}</Text>}
                        {item.description && <Text style={styles.studentDescription}>{item.description}</Text>}
                    </View>
                </View>
            </TouchableOpacity>
        )
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backButton}>
                    <Icon name="arrow-back" size={moderateScale(24)} color="#1E293B" />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.title}>Enroll Students</Text>
                    <View style={styles.subjectBadge}>
                        <Ionicons name="book-outline" size={14} color={theme.primary} style={{ marginRight: 6 }} />
                        <Text style={styles.subjectName}>{subjectName}</Text>
                    </View>
                </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <Ionicons name="search-outline" size={20} color={theme.textTertiary} style={{ marginRight: 10 }} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search students..."
                    placeholderTextColor={theme.textTertiary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                        <Ionicons name="close-circle" size={20} color={theme.textTertiary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Selection Controls */}
            {availableStudents.length > 0 && (
                <View style={styles.controlsContainer}>
                    <TouchableOpacity onPress={selectAll} style={styles.selectAllButton}>
                        <View style={[styles.checkbox, selectedStudents.size === availableStudents.length && styles.checkboxSelected]}>
                            {selectedStudents.size === availableStudents.length && <Ionicons name="checkmark" size={16} color={theme.white} />}
                        </View>
                        <Text style={styles.selectAllText}>
                            {selectedStudents.size === availableStudents.length ? 'Deselect All' : 'Select All'}
                        </Text>
                    </TouchableOpacity>
                    <Text style={styles.selectedCount}>
                        {selectedStudents.size} selected
                    </Text>
                </View>
            )}

            {/* Student List */}
            {availableStudents.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <View style={styles.emptyIconContainer}>
                        <Ionicons name="people-outline" size={48} color={theme.borderDark} style={{ opacity: 0.5 }} />
                    </View>
                    <Text style={styles.emptyTitle}>
                        {searchQuery ? 'No students found' : 'All students enrolled'}
                    </Text>
                    <Text style={styles.emptyText}>
                        {searchQuery
                            ? 'Try a different search term'
                            : 'All available students are already enrolled in this subject'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={availableStudents}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Bottom Action Bar */}
            {selectedStudents.size > 0 && (
                <View style={styles.bottomBar}>
                    <View style={styles.bottomBarContent}>
                        <Text style={styles.bottomBarText}>
                            {selectedStudents.size} {selectedStudents.size === 1 ? 'student' : 'students'} selected
                        </Text>
                        <TouchableOpacity
                            style={styles.enrollButton}
                            onPress={handleEnroll}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="add-circle" size={20} color={theme.white} style={{ marginRight: 8 }} />
                            <Text style={styles.enrollButtonText}>
                                Enroll {selectedStudents.size === 1 ? 'Student' : 'Students'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </SafeAreaView>
    )
}

export default EnrollStudents

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: theme.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    backIcon: {
        width: moderateScale(24),
        height: moderateScale(24),
        tintColor: theme.textPrimary,
    },
    backText: {
        fontSize: moderateScale(28),
        color: theme.textPrimary,
        fontWeight: '600',
    },
    headerContent: {
        flex: 1,
    },
    title: {
        fontSize: moderateScale(22),
        fontWeight: '800',
        color: theme.textPrimary,
        marginBottom: 6,
    },
    subjectBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.primaryLight,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    subjectIcon: {
        width: moderateScale(14),
        height: moderateScale(14),
        tintColor: theme.primary,
        marginRight: 6,
    },
    subjectName: {
        fontSize: moderateScale(12),
        color: theme.primary,
        fontWeight: '700',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.surface,
        marginHorizontal: 20,
        marginTop: 16,
        marginBottom: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.border,
    },
    searchIcon: {
        width: moderateScale(18),
        height: moderateScale(18),
        tintColor: theme.textTertiary,
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 12,
        fontSize: moderateScale(15),
        color: theme.text,
    },
    clearButton: {
        padding: 4,
    },
    clearButtonText: {
        fontSize: 16,
        color: theme.textTertiary,
    },
    controlsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: theme.backgroundTertiary,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    selectAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    selectAllText: {
        fontSize: moderateScale(15),
        fontWeight: '600',
        color: theme.textPrimary,
        marginLeft: 12,
    },
    selectedCount: {
        fontSize: moderateScale(14),
        color: theme.primary,
        fontWeight: '700',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 100,
    },
    studentCard: {
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: theme.border,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    studentCardSelected: {
        borderColor: theme.primary,
        backgroundColor: theme.primaryLight,
    },
    studentInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: theme.borderDark,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        backgroundColor: theme.surface,
    },
    checkboxSelected: {
        backgroundColor: theme.primary,
        borderColor: theme.primary,
    },
    checkmark: {
        color: theme.white,
        fontSize: 14,
        fontWeight: '700',
    },
    avatar: {
        width: moderateScale(48),
        height: moderateScale(48),
        borderRadius: 24,
        backgroundColor: theme.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    avatarText: {
        fontSize: moderateScale(20),
        fontWeight: '700',
        color: theme.white,
    },
    details: {
        flex: 1,
    },
    studentName: {
        fontSize: moderateScale(16),
        fontWeight: '700',
        color: theme.textPrimary,
        marginBottom: 2,
    },
    studentCode: {
        fontSize: moderateScale(13),
        color: theme.textSecondary,
        fontWeight: '500',
    },
    studentDescription: {
        fontSize: moderateScale(12),
        color: theme.textTertiary,
        marginTop: 2,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    emptyIconContainer: {
        width: moderateScale(80),
        height: moderateScale(80),
        borderRadius: 40,
        backgroundColor: theme.backgroundTertiary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    emptyIcon: {
        width: moderateScale(40),
        height: moderateScale(40),
        tintColor: theme.borderDark,
        opacity: 0.5,
    },
    emptyTitle: {
        fontSize: moderateScale(18),
        fontWeight: '700',
        color: theme.textSecondary,
        marginBottom: 8,
        textAlign: 'center',
    },
    emptyText: {
        fontSize: moderateScale(14),
        color: theme.textTertiary,
        textAlign: 'center',
        lineHeight: 20,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: theme.surface,
        borderTopWidth: 1,
        borderTopColor: theme.border,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
    },
    bottomBarContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    bottomBarText: {
        fontSize: moderateScale(15),
        fontWeight: '600',
        color: theme.textSecondary,
    },
    enrollButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    enrollIcon: {
        width: moderateScale(16),
        height: moderateScale(16),
        tintColor: theme.white,
        marginRight: 8,
    },
    enrollButtonText: {
        color: theme.white,
        fontSize: moderateScale(15),
        fontWeight: '700',
    },
})
