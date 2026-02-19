import React, { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet, FlatList, TextInput, GestureResponderEvent, Image, ViewStyle } from 'react-native'
import { moderateScale } from 'react-native-size-matters'
import { lightTheme as theme } from '../../theme/colors'

export type Option = { label: string; value: string | number; subtitle?: string }

type Props = {
  options: Option[]
  value?: string | number | null
  onValueChange: (value: string | number) => void
  placeholder?: string
  searchable?: boolean
  disabled?: boolean
  style?: any
  dropdownStyle?: any
  optionStyle?: any
  selectedStyle?: any
  /** Optional title shown above the trigger (like CustomInputField) */
  Title?: string
  /** small icon shown next to the title */
  isIcon?: boolean
  source?: any
  iconStyle?: object
  /** icon inside the input/trigger (left) */
  inputIcon?: any
  inputIconStyle?: object
  containerStyle?: ViewStyle
}

const Dropdown: React.FC<Props> = ({
  options,
  value,
  onValueChange,
  placeholder = 'Select',
  searchable = false,
  disabled = false,
  style,
  dropdownStyle,
  optionStyle,
  selectedStyle,
  Title,
  isIcon,
  source,
  iconStyle,
  inputIcon,
  inputIconStyle,
  containerStyle,
}) => {
  const [visible, setVisible] = useState(false)
  const [query, setQuery] = useState('')

  const selected = useMemo(() => options.find(o => o.value === value) ?? null, [options, value])

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options
    const q = query.trim().toLowerCase()
    return options.filter(o => o.label.toLowerCase().includes(q) || String(o.value).toLowerCase().includes(q))
  }, [options, query, searchable])

  const open = (e?: GestureResponderEvent) => {
    if (disabled) return
    setVisible(true)
  }

  const close = () => {
    setVisible(false)
    setQuery('')
  }

  const handleSelect = (val: string | number) => {
    onValueChange(val)
    close()
  }

  return (
    <View style={[{ paddingVertical: 10 }, containerStyle]}>
      {/* Title row (optional) */}
      {Title ? (
        <View style={styles.titleRow}>
          {isIcon && source ? <Image source={source} style={[styles.titleIcon, iconStyle]} /> : null}
          <Text style={styles.titleText}>{Title}</Text>
        </View>
      ) : null}

      {/* Trigger styled like the input field */}
      <TouchableOpacity style={[styles.inputWrapper, style]} onPress={open} activeOpacity={disabled ? 1 : 0.7}>
        {inputIcon ? <Image source={inputIcon} style={[styles.inputLeftIcon, inputIconStyle]} /> : null}
        <Text style={[styles.triggerText, !selected && styles.placeholder]} numberOfLines={1}>{selected ? selected.label : placeholder}</Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={close}>
          <View style={[styles.dropdown, dropdownStyle]}>

            <FlatList
              keyboardShouldPersistTaps="handled"
              data={filtered}
              keyExtractor={(item) => String(item.value)}
              renderItem={({ item }) => {
                const isSelected = item.value === value
                return (
                  <TouchableOpacity onPress={() => handleSelect(item.value)} style={[styles.option, optionStyle, isSelected ? styles.optionSelected : null, isSelected ? selectedStyle : null]}>
                    <Text style={[styles.optionText, isSelected ? styles.optionTextSelected : null]}>
                      {item.label}{item.subtitle ? ` (${item.subtitle})` : ''}
                    </Text>
                    {isSelected ? <Text style={styles.checkmark}>✓</Text> : null}
                  </TouchableOpacity>
                )
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

export default Dropdown

const styles = StyleSheet.create({
  trigger: {
    borderWidth: moderateScale(1),
    borderColor: theme.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: theme.surface,
  },
  triggerText: {
    color: theme.textPrimary,
    fontSize: moderateScale(14),
    flex: 1,
  },
  placeholder: {
    color: theme.textTertiary,
  },
  backdrop: {
    flex: 1,
    backgroundColor: theme.overlayLight,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdown: {
    width: '100%',
    maxHeight: '60%',
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 8,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    elevation: 8,
  },
  search: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionText: {
    color: theme.text,
    fontSize: moderateScale(15),
    flex: 1,
  },
  optionSelected: {
    backgroundColor: theme.backgroundTertiary,
  },
  optionTextSelected: {
    color: theme.textPrimary,
    fontWeight: '600'
  },
  checkmark: {
    color: theme.primary,
    fontSize: moderateScale(18),
    marginLeft: 8,
  },
  /* styles matching CustomInputField */
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleIcon: {
    height: moderateScale(18),
    width: moderateScale(18),
    marginRight: 8,
    tintColor: theme.text,
  },
  titleText: {
    fontSize: moderateScale(14),
    fontWeight: '500',
    color: theme.text,
  },
  inputWrapper: {
    backgroundColor: theme.backgroundTertiary,
    borderRadius: 12,
    height: moderateScale(48),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.border, // Added border for better definition
  },
  inputLeftIcon: {
    height: moderateScale(18),
    width: moderateScale(18),
    tintColor: theme.textSecondary,
    position: 'absolute',
    left: 14,
  },
  chevron: {
    fontSize: moderateScale(16),
    color: theme.textTertiary,
    marginLeft: 8,
  },
})
