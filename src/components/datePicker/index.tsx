import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Image } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import images from '../../assets/images';
import { moderateScale } from 'react-native-size-matters';
import { lightTheme as theme } from '../../theme/colors';

interface DatePickerProps {
  onDateChange: (date: Date) => void;
  initialDate?: Date;
  label?: string;
  markedDates?: string[]; // Array of date strings in 'YYYY-MM-DD' format
}

const DatePicker: React.FC<DatePickerProps> = ({ onDateChange, initialDate = new Date(), label = 'Date', markedDates = [] }) => {
  const [date, setDate] = useState(initialDate);
  const [show, setShow] = useState(false);

  const onChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || date;
    setShow(false);
    setDate(currentDate);
    onDateChange(currentDate);
  };

  const two = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const formatted = `${two(date.getDate())} / ${two(date.getMonth() + 1)} / ${date.getFullYear()}`;
  
  // Check if current date has attendance marked
  const dateKey = date.toISOString().slice(0, 10);
  const isMarked = markedDates.includes(dateKey);

  return (
    <View style={styles.container}>
      {/* Title row matching Dropdown */}
      {label ? (
        <View style={styles.titleRow}>
          <Image source={images.calender} style={styles.titleIcon} />
          <Text style={styles.titleText}>{label}</Text>
          {isMarked && <Text style={styles.markedIndicator}>★</Text>}
        </View>
      ) : null}

      {/* Input wrapper matching Dropdown */}
      <TouchableOpacity onPress={() => setShow(true)} style={[styles.inputWrapper, isMarked && styles.inputWrapperMarked]} activeOpacity={0.7}>
        <Text style={styles.dateText}>{formatted}</Text>
        <View style={styles.rightContent}>
          {isMarked && <Text style={styles.markedBadge}>★</Text>}
          <Text style={styles.chevron}>▾</Text>
        </View>
      </TouchableOpacity>

      {show && (
        <DateTimePicker
          testID="dateTimePicker"
          value={date}
          mode="date"
          is24Hour={true}
          display="default"
          onChange={onChange}
          maximumDate={new Date()}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
  },
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
    borderColor: theme.border,
    justifyContent: 'space-between',
  },
  dateText: {
    color: theme.textPrimary,
    fontSize: moderateScale(14),
    flex: 1,
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevron: {
    fontSize: moderateScale(16),
    color: theme.textTertiary,
    marginLeft: 8,
  },
  markedIndicator: {
    color: '#F59E0B',
    fontSize: moderateScale(16),
    marginLeft: 8,
    fontWeight: 'bold',
  },
  markedBadge: {
    color: '#F59E0B',
    fontSize: moderateScale(16),
    fontWeight: 'bold',
    marginRight: 4,
  },
  inputWrapperMarked: {
    borderColor: '#F59E0B',
    borderWidth: 1.5,
  },
});

export default DatePicker;