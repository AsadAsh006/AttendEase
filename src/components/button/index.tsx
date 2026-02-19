import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  Image,
} from 'react-native';
import { moderateScale } from 'react-native-size-matters';
import { useTheme, createThemedStyles } from '../../theme';
import CustomText from '../text';
import { CustomButtonProps } from '../../types';

const CustomButton: React.FC<CustomButtonProps> = ({
  title,
  onPress,
  buttonStyle,
  textStyle,
  iconStyle,
  icon,
  source,
  disabled = false,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <TouchableOpacity
      style={[styles.button, buttonStyle, disabled && styles.disabledButton]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <CustomText
        textStyle={[
          styles.buttonText,
          textStyle,
          disabled && styles.disabledText,
        ]}
        text={title}
      />
      {icon && (
        <Image source={source} style={iconStyle}/>
      )}
    </TouchableOpacity>
  );
};

const createStyles = createThemedStyles(colors => ({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#006848',
    height: moderateScale(48),
    flexDirection:'row',
    paddingHorizontal: 40,
    // paddingVertical:12, 
    borderRadius: 12,
    // marginTop: 15,
  },
  buttonText: {
    color: colors.primaryText,
    fontSize: moderateScale(18),
    fontFamily:'Poppins-Medium',
    // fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: colors.textTertiary,
  },
  disabledText: {
    color: colors.textInverse,
  },
}));

export default CustomButton;
