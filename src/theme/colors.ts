export interface ColorPalette {
  // Primary colors
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryText: string;

  // Secondary colors
  secondary: string;
  secondaryLight: string;
  secondaryDark: string;
  secondaryText: string;

  // Background colors
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  surface: string;
  surfaceSecondary: string;

  // Text colors
  text: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  // Status colors
  success: string;
  successLight: string;
  successDark: string;
  warning: string;
  warningLight: string;
  warningDark: string;
  error: string;
  errorLight: string;
  errorDark: string;
  info: string;
  infoLight: string;
  infoDark: string;

  // Border colors
  border: string;
  borderLight: string;
  borderDark: string;

  // Shadow colors
  shadow: string;
  shadowLight: string;
  shadowDark: string;

  // Overlay colors
  overlay: string;
  overlayLight: string;
  overlayDark: string;

  // Special colors
  transparent: string;
  white: string;
  black: string;

  // Icon colors
  blue: string;
}

export const lightTheme: ColorPalette = {
  // Primary colors - Ocean Blue
  primary: '#5080BE', // Medium Ocean Blue
  primaryLight: '#7EBBDA', // Light Ocean Blue
  primaryDark: '#3B5998', // Deep Ocean Blue
  primaryText: '#FFFFFF',

  // Secondary colors - Aqua/Cyan
  secondary: '#7EBBDA', // Light Ocean Blue
  secondaryLight: '#C6DEF6', // Very Light Ocean
  secondaryDark: '#5080BE', // Medium Ocean
  secondaryText: '#FFFFFF',

  // Background colors - Light Ocean Tints
  background: '#E6F5FA', // Very Light Aqua
  backgroundSecondary: '#FFFFFF',
  backgroundTertiary: '#E0F2FC', // Pale Ocean
  surface: '#FFFFFF',
  surfaceSecondary: '#F0F9FF',

  // Text colors
  text: '#1A3A52', // Deep Ocean Text
  textPrimary: '#0F2942', // Darker Ocean Text
  textSecondary: '#5080BE', // Ocean Blue
  textTertiary: '#7EBBDA', // Light Ocean
  textInverse: '#FFFFFF',

  // Status colors
  success: '#10B981', // Keep green for success
  successLight: '#D1FAE5',
  successDark: '#047857',
  warning: '#F59E0B', // Keep amber for warning
  warningLight: '#FEF3C7',
  warningDark: '#B45309',
  error: '#EF4444', // Keep red for error
  errorLight: '#FEE2E2',
  errorDark: '#B91C1C',
  info: '#5080BE', // Ocean Blue for info
  infoLight: '#E0F2FC',
  infoDark: '#3B5998',

  // Border colors - Ocean tints
  border: '#C6DEF6', // Light Ocean
  borderLight: '#E0F2FC', // Pale Ocean
  borderDark: '#7EBBDA', // Medium Light Ocean

  // Shadow colors
  shadow: '#5080BE',
  shadowLight: '#7EBBDA',
  shadowDark: '#3B5998',

  // Overlay colors
  overlay: 'rgba(59, 89, 152, 0.5)', // Ocean Blue with opacity
  overlayLight: 'rgba(80, 128, 190, 0.3)',
  overlayDark: 'rgba(59, 89, 152, 0.7)',

  // Special colors
  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',

  // Icon colors
  blue: '#5080BE',
};

export const darkTheme: ColorPalette = {
  // Primary colors
  primary: '#4CAF50',
  primaryLight: '#66BB6A',
  primaryDark: '#2E7D32',
  primaryText: '#FFFFFF',

  // Secondary colors
  secondary: '#FF6B6B',
  secondaryLight: '#FF8A80',
  secondaryDark: '#D32F2F',
  secondaryText: '#FFFFFF',

  // Background colors
  background: '#121212',
  backgroundSecondary: '#1E1E1E',
  backgroundTertiary: '#2C2C2C',
  surface: '#1E1E1E',
  surfaceSecondary: '#2C2C2C',

  // Text colors
  text: '#FFFFFF',
  textPrimary: '#F8FAFC', // Slate 50
  textSecondary: '#B3B3B3',
  textTertiary: '#808080',
  textInverse: '#000000',

  // Status colors
  success: '#4CAF50',
  successLight: '#2E7D32',
  successDark: '#1B5E20',
  warning: '#FF9800',
  warningLight: '#F57C00',
  warningDark: '#E65100',
  error: '#F44336',
  errorLight: '#D32F2F',
  errorDark: '#B71C1C',
  info: '#2196F3',
  infoLight: '#1976D2',
  infoDark: '#0D47A1',

  // Border colors
  border: '#333333',
  borderLight: '#2C2C2C',
  borderDark: '#404040',

  // Shadow colors
  shadow: '#000000',
  shadowLight: '#00000040',
  shadowDark: '#00000080',

  // Overlay colors
  overlay: '#00000080',
  overlayLight: '#00000040',
  overlayDark: '#000000A0',

  // Special colors
  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',

  // Icon colors
  blue: '#3B82F6',
};

export type ThemeMode = 'light' | 'dark' | 'system';

export const getThemeColors = (mode: ThemeMode): ColorPalette => {
  switch (mode) {
    case 'light':
      return lightTheme;
    case 'dark':
      return darkTheme;
    case 'system':
      // In a real app, you would check the system theme here
      // For now, we'll default to light theme
      return lightTheme;
    default:
      return lightTheme;
  }
};
