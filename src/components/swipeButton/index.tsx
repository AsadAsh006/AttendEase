import React, { useRef, useState } from 'react'
import { View, StyleSheet, Animated, PanResponder, Dimensions } from 'react-native'
import { moderateScale } from 'react-native-size-matters'
import Icon from 'react-native-vector-icons/MaterialIcons'
import { lightTheme } from '../../theme/colors'

const { width } = Dimensions.get('window')
const BUTTON_WIDTH = width - 48
const SWIPE_THRESHOLD = BUTTON_WIDTH * 0.7

type SwipeButtonProps = {
  onSwipeSuccess: () => void
  title?: string
  disabled?: boolean
}

const SwipeButton: React.FC<SwipeButtonProps> = ({
  onSwipeSuccess,
  title = 'Swipe to Start',
  disabled = false,
}) => {
  const [swiped, setSwiped] = useState(false)
  const translateX = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(1)).current

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && !swiped,
      onMoveShouldSetPanResponder: () => !disabled && !swiped,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx >= 0 && gestureState.dx <= BUTTON_WIDTH - 60) {
          translateX.setValue(gestureState.dx)
          // Fade out the text as user swipes
          const newOpacity = 1 - gestureState.dx / (BUTTON_WIDTH - 60)
          opacity.setValue(newOpacity)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx >= SWIPE_THRESHOLD) {
          // Complete the swipe
          setSwiped(true)
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: BUTTON_WIDTH - 60,
              useNativeDriver: true,
              speed: 12,
              bounciness: 0,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            setTimeout(onSwipeSuccess, 200)
          })
        } else {
          // Reset the swipe
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              speed: 12,
              bounciness: 8,
            }),
            Animated.timing(opacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start()
        }
      },
    })
  ).current

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <Animated.Text style={[styles.text, { opacity }]}>
          {title}
        </Animated.Text>
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.thumb,
            {
              transform: [{ translateX }],
            },
          ]}
        >
          <Icon name="arrow-forward" size={moderateScale(24)} color={lightTheme.primary} />
        </Animated.View>
      </View>
    </View>
  )
}

export default SwipeButton

const styles = StyleSheet.create({
  container: {
    width: BUTTON_WIDTH,
    alignSelf: 'center',
    marginBottom: moderateScale(32),
  },
  track: {
    height: moderateScale(60),
    backgroundColor: lightTheme.primary,
    borderRadius: moderateScale(30),
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: lightTheme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  text: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  thumb: {
    position: 'absolute',
    left: 4,
    width: moderateScale(52),
    height: moderateScale(52),
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(26),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
})
