import React, { useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { moderateScale } from 'react-native-size-matters';

interface InputFieldProps {
  Title?: string;
  placeholder?: string;
  value?: string;
  errorText?: string;
  onChangeText?: (text: string) => void;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  secureTextEntry?: boolean;
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
  multiline?: boolean;
  maxLength?: number;
  autoCorrect?: boolean;
  spellCheck?: boolean;
  containerStyle?: ViewStyle;
  reference?: React.Ref<TextInput>;
  onSubmitEditing?: () => void;
  isIcon?: boolean;
  source?: any;
  iconStyle?: object;
  /** icon shown inside the input on the left */
  inputIcon?: any;
  inputIconStyle?: object;
}

const CustomInputField: React.FC<InputFieldProps> = ({
  Title,
  placeholder,
  value,
  errorText,
  onChangeText,
  keyboardType = 'default',
  secureTextEntry = false,
  returnKeyType = 'next',
  multiline = false,
  maxLength = 100,
  autoCorrect = true,
  spellCheck = true,
  containerStyle,
  reference,
  onSubmitEditing,
  isIcon,
  source,
  iconStyle,
  inputIcon,
  inputIconStyle,
}) => {
  const [isSecure, setSecure] = useState(secureTextEntry);
  // const { colors } = useTheme();
  // const styles = createStyles(colors);

  return (
    <View style={{backgroundColor:'lightgray', paddingVertical:10, paddingHorizontal:12, borderRadius:12, marginBottom:10}}>
      {/* Title row with optional icon */}
      {Title ? (
        <View style={styles.titleRow}>
          {isIcon && source ? <Image source={source} style={[styles.titleIcon, iconStyle]} /> : null}
          <Text style={styles.titleText}>{Title}</Text>
        </View>
      ) : null}

      {/* Input with rounded background and left icon */}
      <View style={[styles.inputWrapper, containerStyle]}>
        {inputIcon ? (
          <Image source={inputIcon} style={[styles.inputLeftIcon, inputIconStyle]} />
        ) : null}

        <TextInput
          style={[styles.input, inputIcon ? { marginLeft: 40 } : null]}
          placeholder={placeholder}
          placeholderTextColor="#A9A9A9"
          keyboardType={keyboardType}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isSecure}
          multiline={multiline}
          maxLength={maxLength}
          autoCorrect={autoCorrect}
          returnKeyType={returnKeyType}
          scrollEnabled={true}
          spellCheck={spellCheck}
          underlineColorAndroid="transparent"
          ref={reference}
          onSubmitEditing={onSubmitEditing}
        />

        {secureTextEntry && (
          <TouchableOpacity
            style={styles.eyeContainer}
            onPress={() => setSecure(!isSecure)}
          />
        )}
      </View>

      {errorText && <Text style={styles.errorText}>{errorText}</Text>}
    </View>
  );
};

const styles = StyleSheet.create ({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleIcon: {
    height: moderateScale(18),
    width: moderateScale(18),
    marginRight: 8,
    tintColor: '#111'
  },
  titleText: {
    fontSize: moderateScale(14),
    fontWeight: '400',
    color: '#111'
  },
  inputWrapper: {
    backgroundColor: '#F2F2F4',
    borderRadius: 8,
    height: moderateScale(44),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  input: {
    color: 'black',
    fontSize: moderateScale(14),
    fontFamily: 'Poppins-Regular',
    flex: 1,
  },
  inputLeftIcon: {
    height: moderateScale(18),
    width: moderateScale(18),
    tintColor: '#111',
    position: 'absolute',
    left: 14,
  },
  eyeContainer: {
    position: 'absolute',
    right: 15,
    top: 10,
  },
  errorText: {
    color: 'red',
    fontSize: moderateScale(9),
  },
});

export default CustomInputField;
