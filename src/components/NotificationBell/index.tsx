import React, { useState } from 'react'
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Modal,
  FlatList,
  Pressable,
} from 'react-native'
import { moderateScale } from 'react-native-size-matters'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import CustomText from '../text'
import { lightTheme } from '../../theme/colors'
import { useNotifications, Notification } from '../../contexts/NotificationContext'

const NotificationBell = () => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications()
  const [modalVisible, setModalVisible] = useState(false)

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'enrollment_request':
        return 'clipboard-text-outline'
      case 'enrollment_approved':
        return 'check-circle'
      case 'enrollment_rejected':
        return 'close-circle'
      case 'attendance_marked':
        return 'pencil'
      case 'subject_added':
        return 'book-plus'
      case 'subject_updated':
        return 'book-edit'
      default:
        return 'bell'
    }
  }

  const getNotificationIconColor = (type: Notification['type']) => {
    switch (type) {
      case 'enrollment_request':
        return '#3B82F6'
      case 'enrollment_approved':
        return '#10B981'
      case 'enrollment_rejected':
        return '#EF4444'
      case 'attendance_marked':
        return '#8B5CF6'
      case 'subject_added':
        return '#F59E0B'
      case 'subject_updated':
        return '#06B6D4'
      default:
        return '#6B7280'
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id)
    }
    // Could navigate to relevant screen based on notification type
  }

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notificationItem, !item.is_read && styles.unreadItem]}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.notificationIcon}>
        <Icon 
          name={getNotificationIcon(item.type)} 
          size={moderateScale(24)} 
          color={getNotificationIconColor(item.type)} 
        />
      </View>
      <View style={styles.notificationContent}>
        <CustomText text={item.title} textStyle={styles.notificationTitle} numberOfLines={1} />
        <CustomText text={item.message} textStyle={styles.notificationMessage} numberOfLines={2} />
        <CustomText text={formatTime(item.created_at)} textStyle={styles.notificationTime} />
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteNotification(item.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <CustomText text="✕" textStyle={styles.deleteText} />
      </TouchableOpacity>
    </TouchableOpacity>
  )

  return (
    <>
      <TouchableOpacity
        style={styles.bellContainer}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Icon name="bell" size={moderateScale(24)} color={lightTheme.primary} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <CustomText
              text={unreadCount > 9 ? '9+' : unreadCount.toString()}
              textStyle={styles.badgeText}
            />
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <CustomText text="Notifications" textStyle={styles.modalTitle} />
              <View style={styles.headerActions}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
                    <CustomText text="Mark all read" textStyle={styles.markAllText} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                  <CustomText text="✕" textStyle={styles.closeText} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Notifications List */}
            {notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <CustomText text="🔕" textStyle={styles.emptyEmoji} />
                <CustomText text="No notifications" textStyle={styles.emptyTitle} />
                <CustomText text="You're all caught up!" textStyle={styles.emptySubtitle} />
              </View>
            ) : (
              <FlatList
                data={notifications}
                renderItem={renderNotification}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

export default NotificationBell

const styles = StyleSheet.create({
  bellContainer: {
    position: 'relative',
    padding: moderateScale(8),
  },
  bellIcon: {
    fontSize: moderateScale(24),
  },
  badge: {
    position: 'absolute',
    top: moderateScale(4),
    right: moderateScale(4),
    backgroundColor: '#EF4444',
    borderRadius: moderateScale(10),
    minWidth: moderateScale(18),
    height: moderateScale(18),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: moderateScale(4),
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: moderateScale(10),
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: moderateScale(20),
    borderTopRightRadius: moderateScale(20),
    maxHeight: '80%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: moderateScale(16),
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: '#1A3A52',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(12),
  },
  markAllButton: {
    paddingVertical: moderateScale(4),
    paddingHorizontal: moderateScale(8),
  },
  markAllText: {
    fontSize: moderateScale(13),
    color: lightTheme.primary,
    fontWeight: '500',
  },
  closeButton: {
    padding: moderateScale(4),
  },
  closeText: {
    fontSize: moderateScale(18),
    color: '#6B7280',
  },
  listContent: {
    padding: moderateScale(12),
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderRadius: moderateScale(12),
    padding: moderateScale(12),
    marginBottom: moderateScale(8),
  },
  unreadItem: {
    backgroundColor: '#E0F2FC',
    borderLeftWidth: 3,
    borderLeftColor: lightTheme.primary,
  },
  notificationIcon: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  iconText: {
    fontSize: moderateScale(20),
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#1A3A52',
    marginBottom: moderateScale(2),
  },
  notificationMessage: {
    fontSize: moderateScale(13),
    color: '#6B7280',
    marginBottom: moderateScale(4),
    lineHeight: moderateScale(18),
  },
  notificationTime: {
    fontSize: moderateScale(11),
    color: '#9CA3AF',
  },
  deleteButton: {
    padding: moderateScale(4),
  },
  deleteText: {
    fontSize: moderateScale(14),
    color: '#9CA3AF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: moderateScale(60),
  },
  emptyEmoji: {
    fontSize: moderateScale(48),
    marginBottom: moderateScale(12),
  },
  emptyTitle: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    color: '#1A3A52',
    marginBottom: moderateScale(4),
  },
  emptySubtitle: {
    fontSize: moderateScale(14),
    color: '#6B7280',
  },
})
