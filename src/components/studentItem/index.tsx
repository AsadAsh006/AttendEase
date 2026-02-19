import React from 'react'
import { View, Text, StyleSheet, Pressable, TouchableOpacity, Image } from 'react-native'
import { moderateScale } from 'react-native-size-matters'
import Icon from 'react-native-vector-icons/Ionicons'
import { lightTheme as theme } from '../../theme/colors'
import images from '../../assets/images'

type Student = {
    id: string
    name: string
    code?: string
    description?: string
    subjects?: string[] // List of subject IDs this student is enrolled in
    is_admin?: boolean
}

type Props = {
    item: Student
    onEdit?: (item: Student) => void
    onDelete?: (item: Student) => void
    onMakeAdmin?: (item: Student) => void
    onRemoveAdmin?: (item: Student) => void
    present?: boolean
    onTogglePresent?: (item: Student) => void
    showColors?: boolean // Only show green/red colors when true
}

const StudentItem: React.FC<Props> = ({ item, onEdit, onDelete, onMakeAdmin, onRemoveAdmin, present = false, onTogglePresent, showColors = false }) => {
    // If we have edit/delete handlers, show management UI. Otherwise show attendance UI
    const isManagementMode = !!(onEdit || onDelete || onMakeAdmin || onRemoveAdmin)

    return (
        <Pressable
            onPress={() => onTogglePresent && onTogglePresent(item)}
            disabled={isManagementMode}
            style={({ pressed }) => [
                styles.container,
                showColors && present ? styles.containerPresent : showColors && !present ? styles.containerAbsent : null,
                pressed && styles.pressed
            ]}
        >
            <View style={styles.content}>
                <View style={[styles.avatar, showColors && present ? styles.avatarPresent : styles.avatarAbsent]}>
                    <Text style={[styles.avatarText, showColors && present ? styles.avatarTextPresent : styles.avatarTextAbsent]}>
                        {item.name.charAt(0).toUpperCase()}
                    </Text>
                </View>
                <View style={styles.info}>
                    <Text style={styles.name}>{item.name}</Text>
                    {item.code ? <Text style={styles.code}>{item.code}</Text> : null}
                    {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
                </View>

                {isManagementMode ? (
                    <View style={styles.actions}>
                        {onMakeAdmin && !item.is_admin && (
                            <TouchableOpacity
                                onPress={() => onMakeAdmin(item)}
                                style={styles.actionButton}
                            >
                                <Text style={styles.adminIcon}>👑</Text>
                            </TouchableOpacity>
                        )}
                        {item.is_admin && onRemoveAdmin && (
                            <TouchableOpacity 
                                onPress={() => onRemoveAdmin(item)}
                                style={styles.adminBadgeTouchable}
                            >
                                <View style={styles.adminBadgeContent}>
                                    <Text style={styles.adminBadgeText}>Admin</Text>
                                    <Icon name="close" size={moderateScale(12)} color="#92400E" style={styles.adminCloseIcon} />
                                </View>
                            </TouchableOpacity>
                        )}
                        {item.is_admin && !onRemoveAdmin && (
                            <View style={styles.adminBadge}>
                                <Text style={styles.adminBadgeText}>Admin</Text>
                            </View>
                        )}
                        {onEdit && (
                            <TouchableOpacity
                                onPress={() => onEdit(item)}
                                style={styles.actionButton}
                            >
                                <Image source={images.pencilIcon} style={styles.editIcon} />
                            </TouchableOpacity>
                        )}
                        {onDelete && (
                            <TouchableOpacity
                                onPress={() => onDelete(item)}
                                style={styles.actionButton}
                            >
                                <Image source={images.deleteIcon} style={styles.deleteIcon} />
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <View style={[styles.checkContainer, showColors && present ? styles.checkPresent : styles.checkAbsent]}>
                        {showColors && present ? (
                            <Icon name="checkmark" size={moderateScale(18)} color={theme.white} />
                        ) : null}
                    </View>
                )}
            </View>
        </Pressable>
    )
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 14,
        marginBottom: 10,
        backgroundColor: theme.surface,
        borderWidth: 1.5,
        borderColor: theme.border,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
        overflow: 'hidden',
    },
    containerPresent: {
        backgroundColor: '#F0FDF4',
        borderColor: '#10B981',
        shadowColor: '#10B981',
        shadowOpacity: 0.12,
    },
    containerAbsent: {
        backgroundColor: '#FEF2F2',
        borderColor: '#EF4444',
        shadowColor: '#EF4444',
        shadowOpacity: 0.12,
    },
    pressed: {
        opacity: 0.92,
        transform: [{ scale: 0.98 }],
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    avatar: {
        height: moderateScale(42),
        width: moderateScale(42),
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    avatarPresent: {
        backgroundColor: '#10B981',
    },
    avatarAbsent: {
        backgroundColor: theme.backgroundTertiary,
    },
    avatarText: {
        fontSize: moderateScale(18),
        fontWeight: '700',
    },
    avatarTextPresent: {
        color: theme.white,
    },
    avatarTextAbsent: {
        color: theme.textSecondary,
    },
    info: {
        flex: 1,
    },
    name: {
        fontSize: moderateScale(15),
        fontWeight: '600',
        color: theme.textPrimary,
        marginBottom: 3,
    },
    code: {
        fontSize: moderateScale(13),
        color: theme.textSecondary,
        fontWeight: '500',
    },
    description: {
        fontSize: moderateScale(12),
        color: theme.textTertiary,
        marginTop: 2,
    },
    checkContainer: {
        height: moderateScale(28),
        width: moderateScale(28),
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 10,
    },
    checkPresent: {
        backgroundColor: '#10B981',
    },
    checkAbsent: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: theme.borderDark,
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
        marginLeft: 12,
    },
    actionButton: {
        width: moderateScale(36),
        height: moderateScale(36),
        borderRadius: 18,
        backgroundColor: theme.backgroundTertiary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: theme.border,
    },
    editIcon: {
        width: moderateScale(16),
        height: moderateScale(16),
        tintColor: theme.primary,
    },
    deleteIcon: {
        width: moderateScale(16),
        height: moderateScale(16),
        tintColor: theme.error,
    },
    adminIcon: {
        fontSize: moderateScale(16),
    },
    adminBadgeTouchable: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    adminBadgeContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 10,
        gap: 4,
    },
    adminCloseIcon: {
        marginLeft: 2,
    },
    adminBadgeText: {
        fontSize: moderateScale(11),
        fontWeight: '600',
        color: '#92400E',
    },
})

export default StudentItem
