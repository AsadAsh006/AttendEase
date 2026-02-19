import {
  Image,
  ImageURISource,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewStyle,
} from 'react-native';
import React, { useState } from 'react';
import { useTheme } from '../../theme';
import ThemeContext from '../../theme/ThemeContext';

interface ShowInputTextProps {
  onPress?: () => void;
  containerstyle?: ViewStyle;
  innerContainer?: ViewStyle;
  title?: string;
  iconSource?: any;
  container?: ViewStyle;
  TextInputStyle?: TextInputProps;
  placeholder?: string;
  inputContainer?: ViewStyle;
  isShowInput?: boolean;
  onChangeText?: (text: string) => void;
  value?: string;
  editable?: boolean;
}

const ShowInputText: React.FC<ShowInputTextProps> = ({
  containerstyle,
  onPress,
  title,
  iconSource,
  innerContainer,
  container,
  placeholder,
  TextInputStyle,
  inputContainer,
  isShowInput,
  onChangeText,
  value,
  editable,
}) => {
  return (
    <View style={container}>
      {isShowInput ? (
        <View style={inputContainer}>
          <TextInput
            editable={editable}
            onChangeText={onChangeText}
            value={value}
            placeholder={placeholder}
            placeholderTextColor={'black'}
            style={[TextInputStyle, { width: '90%' }]}
          />
        </View>
      ) : (
        <View style={containerstyle}>
          <View style={innerContainer}>
            <Image style={styles.menuIcon} source={iconSource} />
            <Text style={styles.menuTitle}>{title}</Text>
          </View>
          {/* <Text style={styles.menuArrow}>›</Text> */}
        </View>
      )}
    </View>
  );
};

export default ShowInputText;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: colors.backgroundSecondary,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    // backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 30,
    borderBottomWidth: 1,
    // borderBottomColor: colors.border,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 20,
    // tintColor: colors.textSecondary,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    // color: colors.text,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    // color: colors.textSecondary,
    marginBottom: 2,
  },
  profilePhone: {
    fontSize: 14,
    // color: colors.textTertiary,
  },
  menuSection: {
    // backgroundColor: colors.surface,
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 12,
    // shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    // borderBottomColor: colors.borderLight,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 16,
    width: 24,
    textAlign: 'center',
  },
  menuTitle: {
    fontSize: 16,
    // color: colors.text,
    fontWeight: '500',
  },
  menuArrow: {
    fontSize: 20,
    // color: colors.textTertiary,
  },
  logoutSection: {
    marginTop: 30,
    marginHorizontal: 20,
    marginBottom: 30,
  },
  logoutButton: {
    // backgroundColor: colors.error,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutText: {
    // color: colors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },
});
