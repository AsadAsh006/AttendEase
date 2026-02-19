import {
  StyleSheet,
  TextStyle,
  ViewStyle,
  ImageStyle,
  Platform,
} from 'react-native';
import { moderateScale } from 'react-native-size-matters';
import { ColorPalette } from './colors';

export const createThemedStyles = <
  T extends Record<string, ViewStyle | TextStyle | ImageStyle>,
>(
  styleCreator: (colors: ColorPalette) => T,
) => {
  return (colors: ColorPalette) => StyleSheet.create(styleCreator(colors));
};

export const getShadowStyle = (
  colors: ColorPalette,
  elevation: number = 3,
) => ({
  shadowColor: colors.shadow,
  shadowOffset: {
    width: moderateScale(0),
    height: moderateScale(elevation),
  },
  shadowOpacity: 0.1,
  shadowRadius: elevation * 2,
  elevation: elevation,
});

export const getCardStyle = (colors: ColorPalette) => ({
  backgroundColor: colors.surface,
  borderRadius: 12,
  ...getShadowStyle(colors, 2),
});

export const getButtonStyle = (
  colors: ColorPalette,
  variant: 'primary' | 'secondary' | 'outline' = 'primary',
) => {
  const baseStyle = {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  switch (variant) {
    case 'primary':
      return {
        ...baseStyle,
        backgroundColor: colors.primary,
      };
    case 'secondary':
      return {
        ...baseStyle,
        backgroundColor: colors.secondary,
      };
    case 'outline':
      return {
        ...baseStyle,
        backgroundColor: colors.transparent,
        borderWidth: 1,
        borderColor: colors.primary,
      };
    default:
      return baseStyle;
  }
};

export const getTextStyle = (
  colors: ColorPalette,
  variant: 'heading' | 'body' | 'caption' | 'button' = 'body',
) => {
  const baseStyle = {
    color: colors.text,
  };

  switch (variant) {
    case 'heading':
      return {
        ...baseStyle,
        fontSize: moderateScale(24),
        fontWeight: 'bold' as const,
        color: colors.text,
      };
    case 'body':
      return {
        ...baseStyle,
        fontSize: moderateScale(16),
        color: colors.text,
      };
    case 'caption':
      return {
        ...baseStyle,
        fontSize: moderateScale(12),
        color: colors.textSecondary,
      };
    case 'button':
      return {
        ...baseStyle,
        fontSize: moderateScale(16),
        fontWeight: '600' as const,
        color: colors.primaryText,
      };
    default:
      return baseStyle;
  }
};

export const getInputStyle = (
  colors: ColorPalette,
  focused: boolean = false,
) => ({
  borderWidth: 1,
  borderColor: focused ? colors.primary : colors.border,
  borderRadius: 8,
  paddingHorizontal: 16,
  paddingVertical: 12,
  backgroundColor: colors.surface,
  color: colors.text,
  fontSize: moderateScale(16),
});

export const getModalStyle = (colors: ColorPalette) => ({
  backgroundColor: colors.background,
  borderRadius: 16,
  padding: 20,
  margin: 20,
  ...getShadowStyle(colors, 8),
});

export const getTabBarStyle = (colors: ColorPalette) => ({
  backgroundColor: colors.surface,
  borderTopWidth: 1,
  borderTopColor: colors.border,
  paddingBottom: 0,
  paddingTop: 8,
  height: Platform.OS === 'ios' ? moderateScale(80) : moderateScale(60),
});

export const getStatusBadgeStyle = (
  colors: ColorPalette,
  status: 'success' | 'warning' | 'error' | 'info',
) => {
  const baseStyle = {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  };

  switch (status) {
    case 'success':
      return {
        ...baseStyle,
        backgroundColor: colors.successLight,
      };
    case 'warning':
      return {
        ...baseStyle,
        backgroundColor: colors.warningLight,
      };
    case 'error':
      return {
        ...baseStyle,
        backgroundColor: colors.errorLight,
      };
    case 'info':
      return {
        ...baseStyle,
        backgroundColor: colors.infoLight,
      };
    default:
      return baseStyle;
  }
};
