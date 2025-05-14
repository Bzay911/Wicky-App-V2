import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ChatbotIconProps {
  onPress?: () => void;
}

export default function ChatbotIcon({ onPress }: ChatbotIconProps) {
  const [pulseAnim] = useState(new Animated.Value(1));
  const [showTooltip, setShowTooltip] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const isChatScreen = pathname === '/ChatScreen';

  // Debug logging for component mounting
  useEffect(() => {
    console.log('ChatbotIcon mounted');
    return () => console.log('ChatbotIcon unmounted');
  }, []);

  // Update visibility based on current screen
  useEffect(() => {
    setIsVisible(!isChatScreen);
  }, [isChatScreen]);

  // Start the pulse animation when component mounts
  useEffect(() => {
    if (!isVisible) {
      console.log('ChatbotIcon not visible, skipping animation');
      return;
    }

    console.log('Starting ChatbotIcon animation');
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    ).start();

    // Show tooltip briefly when component mounts
    setShowTooltip(true);
    const timer = setTimeout(() => {
      setShowTooltip(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isVisible]);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push('/ChatScreen');
    }
  };

  // Don't render if not visible
  if (!isVisible) {
    console.log('ChatbotIcon not rendering due to visibility state');
    return null;
  }

  // Calculate bottom position to be above tab bar
  const bottomPosition = Platform.OS === 'ios' ? 80 + insets.bottom : 80;

  return (
    <View style={[styles.container, { bottom: bottomPosition }]}>
      {showTooltip && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipText}>Chat with NRL Assistant</Text>
        </View>
      )}
      <Animated.View style={[styles.animatedContainer, { transform: [{ scale: pulseAnim }] }]}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handlePress}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 20,
    zIndex: 9999, // Increased z-index to ensure visibility
  },
  animatedContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  iconButton: {
    backgroundColor: '#8BCEA9',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltip: {
    position: 'absolute',
    bottom: 70,
    right: 0,
    backgroundColor: '#2A2E35',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    width: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  }
}); 