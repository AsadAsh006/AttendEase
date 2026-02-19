import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';
import { moderateScale } from 'react-native-size-matters';
import { useTheme, createThemedStyles } from '../../theme';
import { CustomTextProps } from '../../types';

const CustomText: React.FC<CustomTextProps> = ({
  text,
  textStyle,
  onPress,
  children,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <Text style={[styles.defaultText, textStyle]} onPress={onPress}>
      {text} {children}
    </Text>
  );
};

const createStyles = createThemedStyles(colors => ({
  defaultText: {
    fontSize: moderateScale(14),
    color: colors.text,
  },
}));

export default CustomText;
