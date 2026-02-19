import React, { useState } from 'react'
import { Modal, View, Text, StyleSheet, TextInput, TouchableOpacity, Pressable, ScrollView, ViewStyle } from 'react-native'
import { moderateScale } from 'react-native-size-matters'
import { lightTheme as theme } from '../../theme/colors'

export type SubjectData = {
  name: string
  code?: string
  description?: string
  color?: string
  credit_hours?: string
}

type FieldKey = 'name' | 'code' | 'description' | 'color' | 'subjects' | 'credit_hours'

type Props = {
  visible: boolean
  onClose: () => void
  onSubmit: (data: SubjectData) => void
  /** Optional initial values to prefill the form */
  initialData?: Partial<SubjectData>
  /** Which fields to render (order preserved) */
  fields?: FieldKey[]
  title?: string
  submitText?: string
  firstFieldTitle?: string
  secondFieldTitle?: string
  thirdFieldTitle?: string
  subtitle?: string
  confirmButtonTitle?: string
  cancelButtonTitle?: string
  descriptionInputStyle?: ViewStyle,
  firstFieldPlaceholder?: string
  secondFieldPlaceholder?: string
  thirdFieldPlaceholder?: string
  fourthFieldTitle?: string
  fourthFieldPlaceholder?: string
  multiline?: boolean
  /** List of all available subjects for enrollment management */
  allSubjects?: any[]
}

const COLORS = [
  '#2B8AFF',
  '#12C25E',
  '#B35BFF',
  '#FF3B30',
  '#FF7A00',
  '#FF2DA6',
  '#6B63FF',
  '#00C1A4',
  //   'cyan',
]

const SubjectModal: React.FC<Props> = ({
  visible,
  onClose,
  onSubmit,
  initialData,
  fields = ['name', 'code', 'description', 'credit_hours', 'color'],
  firstFieldTitle = 'Subject Name',
  title = 'Add New Subject',
  submitText = 'Add Subject',
  secondFieldTitle = 'Subject Code',
  thirdFieldTitle = 'Description (Optional)',
  fourthFieldTitle = 'Credit Hours',
  subtitle = 'Create a new subject. All pre-enrolled students will be automatically added.',
  confirmButtonTitle,
  cancelButtonTitle = 'Cancel',
  descriptionInputStyle,
  firstFieldPlaceholder,
  secondFieldPlaceholder,
  thirdFieldPlaceholder,
  fourthFieldPlaceholder,
  multiline = false,
}) => {
  const [name, setName] = useState(initialData?.name ?? '')
  const [code, setCode] = useState(initialData?.code ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [creditHours, setCreditHours] = useState(initialData?.credit_hours ?? '')
  const [color, setColor] = useState(initialData?.color ?? COLORS[0])

  React.useEffect(() => {
    if (visible) {
      setName(initialData?.name ?? '')
      setCode(initialData?.code ?? '')
      setDescription(initialData?.description ?? '')
      setCreditHours(initialData?.credit_hours ?? '')
      setColor(initialData?.color ?? COLORS[0])
    }
  }, [visible, initialData])

  const reset = () => {
    setName('')
    setCode('')
    setDescription('')
    setCreditHours('')
    setColor(COLORS[0])
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleAdd = () => {
    onSubmit({ name: name.trim(), code: code.trim(), description: description.trim(), credit_hours: creditHours.trim(), color })
    reset()
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <ScrollView contentContainerStyle={{ paddingVertical: 12 }} style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {fields.includes('name') && (
              <>
                <Text style={styles.label}>{firstFieldTitle}</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={firstFieldPlaceholder ?? "e.g., Mathematics"}
                  placeholderTextColor={theme.textTertiary}
                  style={styles.input}
                />
              </>
            )}

            {fields.includes('code') && (
              <>
                <Text style={styles.label}>{secondFieldTitle}</Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder={secondFieldPlaceholder ?? "e.g., MATH101"}
                  placeholderTextColor={theme.textTertiary}
                  style={styles.input}
                />
              </>
            )}

            {fields.includes('description') && (
              <>
                <Text style={styles.label}>{thirdFieldTitle}</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder={thirdFieldPlaceholder ?? "Brief description about the subject"}
                  placeholderTextColor={theme.textTertiary}
                  style={[styles.input, descriptionInputStyle]}
                  multiline={multiline}
                />
              </>
            )}

            {fields.includes('credit_hours') && (
              <>
                <Text style={styles.label}>{fourthFieldTitle}</Text>
                <TextInput
                  value={creditHours}
                  onChangeText={setCreditHours}
                  placeholder={fourthFieldPlaceholder ?? "e.g., 3"}
                  placeholderTextColor={theme.textTertiary}
                  style={styles.input}
                  keyboardType="numeric"
                />
              </>
            )}

            {fields.includes('color') && (
              <>
                <Text style={styles.label}>Color</Text>
                <View style={styles.colorGrid}>
                  {COLORS.map((c) => (
                    <Pressable key={c} onPress={() => setColor(c)} style={[styles.colorWrap]}>
                      <View style={[styles.colorSwatch, { backgroundColor: c, borderColor: c === color ? theme.textPrimary : 'transparent', borderWidth: c === color ? 4 : 0 }]} />
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelText}>{cancelButtonTitle}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
              <Text style={styles.addText}>{confirmButtonTitle ?? submitText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

export default SubjectModal

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
    maxHeight: '90%',
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 24,
    shadowColor: theme.shadow,
    shadowOffset: { width: moderateScale(0), height: moderateScale(4) },
    shadowOpacity: 0.2,
    elevation: 8,
  },
  title: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    color: theme.textSecondary,
    marginBottom: 16,
    fontSize: moderateScale(14),
  },
  label: {
    marginTop: 12,
    fontSize: moderateScale(14),
    marginBottom: 8,
    fontWeight: '600',
    color: theme.text,
  },
  input: {
    backgroundColor: theme.backgroundTertiary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: theme.text,
    fontSize: moderateScale(14),
    borderWidth: 1,
    borderColor: theme.border,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  } as any,
  colorWrap: {
    width: '20%',
    padding: 6,
  },
  colorSwatch: {
    height: moderateScale(40),
    borderRadius: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
  },
  cancelBtn: {
    backgroundColor: theme.background,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: theme.border
  },
  cancelText: {
    color: theme.text,
    fontWeight: '600'
  },
  addBtn: {
    backgroundColor: theme.textPrimary, // Changed to dark textPrimary for button background as per previous design, or could use primary. Using theme.textPrimary (blackish) for strong action.
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  addText: {
    color: theme.textInverse,
    fontWeight: '600'
  }
})
