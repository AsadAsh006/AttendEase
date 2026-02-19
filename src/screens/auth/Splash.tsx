import { StyleSheet, View, Image, StatusBar, Animated, Text, Dimensions } from 'react-native'
import React, { useEffect, useRef, useState } from 'react'
import { moderateScale } from 'react-native-size-matters'
import { useNavigation } from '@react-navigation/native'
import CustomText from '../../components/text'
import SwipeButton from '../../components/swipeButton'
import images from '../../assets/images'
import { lightTheme } from '../../theme/colors'
import { useAuth } from '../../contexts/AuthContext'

const { width, height } = Dimensions.get('window')

const Splash = () => {
  const navigation = useNavigation<any>()
  const { user, loading } = useAuth()
  const [showGetStarted, setShowGetStarted] = useState(false)

  // Animation values
  const logoScale = useRef(new Animated.Value(0)).current
  const logoOpacity = useRef(new Animated.Value(0)).current
  const titleTranslateY = useRef(new Animated.Value(30)).current
  const titleOpacity = useRef(new Animated.Value(0)).current
  const taglineTranslateY = useRef(new Animated.Value(20)).current
  const taglineOpacity = useRef(new Animated.Value(0)).current
  const bottomOpacity = useRef(new Animated.Value(0)).current
  const bottomTranslateX = useRef(new Animated.Value(-100)).current

  useEffect(() => {
    // Check for existing session
    if (!loading) {
      if (user) {
        // User is already logged in, navigate to RootNavigator
        navigation.replace('RootNavigator')
      } else {
        // No user, show the get started button
        setShowGetStarted(true)
      }
    }
  }, [loading, user, navigation])

  useEffect(() => {
    // Logo animation - pop up effect (scale from 0 -> 1.2 -> 1)
    Animated.sequence([
      Animated.parallel([
        Animated.sequence([
          Animated.timing(logoScale, {
            toValue: 1.2,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(logoScale, {
            toValue: 1,
            tension: 100,
            friction: 5,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      // Title animation
      Animated.parallel([
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
      // Tagline animation
      Animated.parallel([
        Animated.timing(taglineTranslateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      // Bottom section animation - slide in from left
      Animated.parallel([
        Animated.spring(bottomTranslateX, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(bottomOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]).start()
  }, [])

  const handleSwipeSuccess = () => {
    navigation.replace('Login')
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={lightTheme.background} />
      
      {/* Background decorative shapes */}
      <View style={styles.backgroundShapes}>
        <View style={[styles.circle, styles.circle1]} />
        <View style={[styles.circle, styles.circle2]} />
        <View style={[styles.circle, styles.circle3]} />
        <View style={[styles.circle, styles.circle4]} />
        <View style={[styles.wave, styles.wave1]} />
        <View style={[styles.wave, styles.wave2]} />
      </View>

      <View style={styles.content}>
        <Animated.Image
          source={images.logo1}
          style={[
            styles.logo,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
          resizeMode="contain"
        />

        <Animated.View
          style={{
            opacity: titleOpacity,
            transform: [{ translateY: titleTranslateY }],
          }}
        >
          <Text style={styles.appName}>
            <Text style={styles.appNameAttend}>Attend</Text>
            <Text style={styles.appNameEase}>Ease</Text>
          </Text>
        </Animated.View>

        <Animated.View
          style={{
            opacity: taglineOpacity,
            transform: [{ translateY: taglineTranslateY }],
          }}
        >
          <CustomText
            text="Manage attendance efficiently"
            textStyle={styles.tagline}
          />
        </Animated.View>
      </View>

      {showGetStarted && (
        <Animated.View
          style={[
            styles.bottom,
            {
              opacity: bottomOpacity,
              transform: [{ translateX: bottomTranslateX }],
            },
          ]}
        >
          <SwipeButton onSwipeSuccess={handleSwipeSuccess} title="Swipe to Start" />
          <CustomText
            text="Version 1.0.0"
            textStyle={styles.version}
          />
        </Animated.View>
      )}
    </View>
  )
}

export default Splash

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightTheme.background,
  },
  backgroundShapes: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
  },
  circle1: {
    width: width * 0.6,
    height: width * 0.6,
    backgroundColor: lightTheme.primaryLight + '20',
    top: -width * 0.2,
    right: -width * 0.2,
  },
  circle2: {
    width: width * 0.4,
    height: width * 0.4,
    backgroundColor: lightTheme.primary + '15',
    top: height * 0.15,
    left: -width * 0.15,
  },
  circle3: {
    width: width * 0.5,
    height: width * 0.5,
    backgroundColor: lightTheme.secondary + '15',
    bottom: height * 0.1,
    right: -width * 0.2,
  },
  circle4: {
    width: width * 0.3,
    height: width * 0.3,
    backgroundColor: lightTheme.primaryDark + '10',
    bottom: height * 0.25,
    left: -width * 0.1,
  },
  wave: {
    position: 'absolute',
    width: width * 1.5,
    height: 200,
    borderRadius: 100,
  },
  wave1: {
    backgroundColor: lightTheme.primaryLight + '12',
    bottom: -100,
    left: -width * 0.25,
    transform: [{ rotate: '-5deg' }],
  },
  wave2: {
    backgroundColor: lightTheme.primary + '08',
    bottom: -130,
    left: -width * 0.2,
    transform: [{ rotate: '-8deg' }],
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: moderateScale(120),
    height: moderateScale(120),
    marginBottom: 8,
  },
  appName: {
    fontSize: moderateScale(30),
    fontWeight: '600',
    marginBottom: 0,
  },
  appNameAttend: {
    color: '#464a52',
  },
  appNameEase: {
    color: lightTheme.primaryDark,
  },
  tagline: {
    fontSize: moderateScale(16),
    color: '#6B7280',
    fontWeight: '400',
  },
  bottom: {
    alignItems: 'center',
    paddingBottom: moderateScale(24),
  },
  version: {
    fontSize: moderateScale(12),
    color: '#9CA3AF',
    marginTop: 16,
  },
})