
import React, {createContext, useContext, useState, useRef} from 'react';
import {Animated, View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import { darkTheme } from '../../theme';


type SnackbarContextType = {
  show: (
    message: string,
    actionText?: string,
    onActionPress?: () => void,
  ) => void;
};

const SnackbarContext = createContext<SnackbarContextType | undefined>(
  undefined,
);

export const useSnackbar = () => {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar must be used within a SnackbarProvider');
  }
  return context;
};

export const SnackbarProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [actionText, setActionText] = useState<string | null>(null);
  const [onActionPress, setOnActionPress] = useState<(() => void) | null>(null);

  const translateY = useRef(new Animated.Value(-100)).current; // Starts higher
  const opacity = useRef(new Animated.Value(0)).current;

  let hideTimeout: NodeJS.Timeout | null = null;

  const show = (msg: string, action?: string, actionCallback?: () => void) => {
    if (hideTimeout) clearTimeout(hideTimeout); // Reset previous timeout

    setMessage(msg);
    setActionText(action || null);
    setOnActionPress(() => actionCallback || null);
    setIsVisible(true);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        speed: 15,
        bounciness: 10, // Sexy bounce effect
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    hideTimeout = setTimeout(hide, 4000);
  };

  const hide = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setIsVisible(false));
  };

  return (
    <SnackbarContext.Provider value={{show}}>
      {children}
      {isVisible && (
        <Animated.View
          style={[styles.container, {transform: [{translateY}], opacity},{backgroundColor: darkTheme.primaryLight}]}>
          <Text style={styles.messageText}>{message}</Text>
          {actionText && (
            <TouchableOpacity
              onPress={() => {
                onActionPress && onActionPress();
                hide();
              }}>
              <Text style={styles.actionText}>{actionText}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}
    </SnackbarContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  messageText: {fontSize: 16, color: '#fff'},
  actionText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#FF9800',
    fontWeight: 'bold',
  },
});
