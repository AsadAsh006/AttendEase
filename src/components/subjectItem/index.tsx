import React from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { moderateScale } from 'react-native-size-matters'
import images from '../../assets/images'
import { lightTheme as theme } from '../../theme/colors'

type Subject = {
  id: string
  // support both shapes: `name`/`code` (redux) and `subjectName`/`subjectCode` (legacy)
  name?: string
  code?: string
  subjectName?: string
  subjectCode?: string
  description?: string
  color?: string
}

type Props = {
  item: Subject
  onEdit?: (item: Subject) => void
  onDelete?: (item: Subject) => void
  source?: any
}

const SubjectItem: React.FC<Props> = ({ item, onEdit, onDelete, source }) => {
  const displayName = item.name ?? item.subjectName
  const displayCode = item.code ?? item.subjectCode
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: item.color ?? theme.primary }]}>
          <Image source={source ?? images.book} style={styles.icon} />
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{displayName}</Text>
          {displayCode ? <Text style={styles.code}>{displayCode}</Text> : null}
          {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => onEdit && onEdit(item)} style={styles.editButton}>
          <Image source={images.pencilIcon} style={styles.editIcon} />
          <Text style={styles.buttonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDelete && onDelete(item)} style={styles.deleteButton}>
          <Image source={images.deleteIcon} style={styles.deleteIcon} />
          <Text style={styles.buttonTextDelete}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: theme.border,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    height: moderateScale(64),
    width: moderateScale(64),
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  icon: {
    height: moderateScale(32),
    width: moderateScale(32),
    tintColor: theme.white,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  code: {
    fontSize: moderateScale(14),
    color: theme.textSecondary,
    fontWeight: '600',
    marginBottom: 2,
  },
  description: {
    fontSize: moderateScale(13),
    color: theme.textTertiary,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    backgroundColor: theme.backgroundTertiary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  deleteButton: {
    backgroundColor: theme.errorLight,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  buttonText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: theme.text,
  },
  buttonTextDelete: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: theme.error,
  },
  editIcon: {
    height: moderateScale(16),
    width: moderateScale(16),
    tintColor: theme.text,
  },
  deleteIcon: {
    height: moderateScale(16),
    width: moderateScale(16),
    tintColor: theme.error,
  },
})

export default SubjectItem
