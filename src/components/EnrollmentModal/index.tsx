import React, { useState, useMemo } from 'react'
import { Modal, View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Image } from 'react-native'
import { moderateScale } from 'react-native-size-matters'
import { lightTheme as theme } from '../../theme/colors'
import images from '../../assets/images'

type Student = {
    id: string
    name: string
    code?: string
    description?: string
    subjects?: string[]
}

type Props = {
    visible: boolean
    onClose: () => void
    onEnroll: (student: Student) => void
    students: Student[]
    /** ID of the subject we are enrolling into, to filter out already enrolled students */
    subjectId: string | null
    subjectName?: string
}

const EnrollmentModal: React.FC<Props> = ({
    visible,
    onClose,
    onEnroll,
    students,
    subjectId,
    subjectName
}) => {
    const [searchQuery, setSearchQuery] = useState('')

    const availableStudents = useMemo(() => {
        if (!subjectId) return []
        const filtered = students.filter(s => !s.subjects?.includes(subjectId))

        if (!searchQuery.trim()) return filtered

        const query = searchQuery.toLowerCase()
        return filtered.filter(s =>
            s.name.toLowerCase().includes(query) ||
            s.code?.toLowerCase().includes(query) ||
            s.description?.toLowerCase().includes(query)
        )
    }, [students, subjectId, searchQuery])

    const handleEnroll = (student: Student) => {
        onEnroll(student)
        setSearchQuery('') // Reset search after enrollment
    }

    const handleClose = () => {
        setSearchQuery('')
        onClose()
    }

    const renderItem = ({ item }: { item: Student }) => (
        <View style={styles.studentCard}>
            <View style={styles.studentInfo}>
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
            <TouchableOpacity
                style={styles.enrollButton}
                onPress={() => handleEnroll(item)}
                activeOpacity={0.7}
            >
                <Image source={images.plusIcon} style={styles.enrollIcon} />
                <Text style={styles.enrollButtonText}>Enroll</Text>
            </TouchableOpacity>
        </View>
    )

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
            <View style={styles.backdrop}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerContent}>
                            <Text style={styles.title}>Enroll Student</Text>
                            {subjectName && (
                                <View style={styles.subjectBadge}>
                                    <Image source={images.book} style={styles.subjectIcon} />
                                    <Text style={styles.subjectName}>{subjectName}</Text>
                                </View>
                            )}
                        </View>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Search Bar */}
                    <View style={styles.searchContainer}>
                        <Image source={images.search} style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search students..."
                            placeholderTextColor={theme.textTertiary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                                <Text style={styles.clearButtonText}>✕</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Student List */}
                    {availableStudents.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconContainer}>
                                <Image source={images.user} style={styles.emptyIcon} />
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
                        <>
                            <View style={styles.listHeader}>
                                <Text style={styles.listHeaderText}>
                                    {availableStudents.length} {availableStudents.length === 1 ? 'student' : 'students'} available
                                </Text>
                            </View>
                            <FlatList
                                data={availableStudents}
                                renderItem={renderItem}
                                keyExtractor={item => item.id}
                                contentContainerStyle={styles.listContent}
                                showsVerticalScrollIndicator={false}
                            />
                        </>
                    )}
                </View>
            </View>
        </Modal>
    )
}

export default EnrollmentModal

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: theme.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    container: {
        width: '100%',
        maxHeight: '85%',
        backgroundColor: theme.surface,
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        elevation: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 16,
        backgroundColor: theme.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    headerContent: {
        flex: 1,
    },
    title: {
        fontSize: moderateScale(24),
        fontWeight: '800',
        color: theme.textPrimary,
        marginBottom: 8,
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
        fontSize: moderateScale(13),
        color: theme.primary,
        fontWeight: '700',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: theme.backgroundTertiary,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 12,
    },
    closeButtonText: {
        fontSize: 18,
        color: theme.textSecondary,
        fontWeight: '600',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.backgroundTertiary,
        marginHorizontal: 24,
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
    listHeader: {
        paddingHorizontal: 24,
        paddingVertical: 12,
    },
    listHeaderText: {
        fontSize: moderateScale(13),
        color: theme.textSecondary,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    listContent: {
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
    studentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.backgroundSecondary,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: theme.border,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    studentInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
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
    enrollButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.primary,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    enrollIcon: {
        width: moderateScale(14),
        height: moderateScale(14),
        tintColor: theme.white,
        marginRight: 6,
    },
    enrollButtonText: {
        color: theme.white,
        fontSize: moderateScale(14),
        fontWeight: '700',
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
})
