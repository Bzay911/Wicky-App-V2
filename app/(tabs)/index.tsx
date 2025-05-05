import React, { useEffect, useState, useRef } from "react";
import { SafeAreaView, Text, View, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity, Image, RefreshControl, Dimensions, Animated } from "react-native";
import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { VideoView, useVideoPlayer } from 'expo-video';
import { SafeAreaView as SafeAreaViewRN } from 'react-native-safe-area-context';

// Get screen width for responsive image sizing
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_MAX_HEIGHT = 300;

// Define sport types
type SportType = 'all' | 'nrl' | 'afl' | 'nba';

// Define interfaces for TypeScript
interface MediaAttachment {
  media_key: string;
  type: string;
  url?: any;
  preview_image_url?: any;
  width?: number;
  height?: number;
}

interface User {
  id: string;
  name: string;
  username: string;
  profile_image_url?: any;
  verified?: boolean;
}

interface Tweet {
  id: string;
  text: string;
  created_at: string;
  user?: User;
  media?: MediaAttachment[];
  sport: SportType;
  fromCache?: boolean; // Flag to indicate if tweet came from cache
}

// Dummy data for NRL tweets
const NRL_TWEETS: Tweet[] = [
  {
    id: 'tweet-1',
    text: 'Zac Hosking has undergone surgery on a hand fracture & the Raiders expect him to miss 4-6 weeks.\n\nPositives of surgery is it stabilises fracture & can often allow accelerated rehab in the early stages.',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    sport: 'nrl',
    user: {
      id: 'nrlphysio',
      name: 'NRL PHYSIO',
      username: 'nrlphysio',
      profile_image_url: require('../../assets/images/tweets/nrl/nrlPhysioProfile.png'),
      verified: true
    },
    media: [
      {
        media_key: 'hosking-1',
        type: 'photo',
        url: require('@/assets/images/tweets/nrl/nrlPhysioTweetImage.png'),
        width: 800,
        height: 450
      }
    ]
  },
  {
    id: 'tweet-2',
    text: 'We are back!\nThe try map is back for 2025, and for all you keen supercoach players, this year we\'ve got a SC points scored and conceded map, all of this is brought to you by @wickyai\n\n#NRL\n#NRLSuperCoach',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    sport: 'nrl',
    user: {
      id: 'supercoachguns',
      name: 'SuperCoach Guns',
      username: 'SupercoachGuns',
      profile_image_url: require('@/assets/images/tweets/nrl/SuperCoachGunsProfile.png'),
      verified: false
    },
    media: [
      {
        media_key: 'trymap-1',
        type: 'photo',
        url: require('@/assets/images/tweets/nrl/SuperCoachGunsTweetImage.png'),
        width: 1200,
        height: 800
      }
    ]
  },
  {
    id: 'tweet-3',
    text: 'Mitch Moses indicated his rehab for a foot bone stress reaction is going slower than expected:\n\n"It\'s taking its time. It doesn\'t get much blood flow down there, hopefully it\'s another 5 or 6 weeks."\n\nBone stress injuries can be tricky recoveries - return date often delayed.',
    created_at: new Date(Date.now() - 10800000).toISOString(),
    sport: 'nrl',
    user: {
      id: 'nrlphysio',
      name: 'NRL PHYSIO',
      username: 'nrlphysio',
      profile_image_url: require('@/assets/images/tweets/nrl/nrlPhysioProfile.png'),
      verified: true
    },
    media: [
      {
        media_key: 'moses-1',
        type: 'photo',
        url: require('@/assets/images/tweets/nrl/nrlPhysioTweetImage2.png'),
        width: 800,
        height: 600
      }
    ]
  },
  {
    id: 'tweet-4',
    text: 'BREAKING: BRONCOS-COWBOYS DERBY EARLY MAIL\n\n* Tom Duffy set to be axed for Jake Clifford\n* Jason Taumalolo and Jeremiah Nanai win recalls\n* Brendan Piakura turns up heat on Gosiewski',
    created_at: new Date(Date.now() - 14400000).toISOString(),
    sport: 'nrl',
    user: {
      id: 'badel_cmail',
      name: 'Pete Badel',
      username: 'badel_cmail',
      profile_image_url: require('@/assets/images/tweets/nrl/PeteBadelProfile.png'),
      verified: true
    },
    media: [
      {
        media_key: 'derby-1',
        type: 'photo',
        url: require('@/assets/images/tweets/nrl/PeteBadelTweetImage.png'),
        width: 1200,
        height: 800
      }
    ]
  },
  {
    id: 'tweet-5',
    text: 'Duffy axed 😳\nTurbo and DCE named 🙏\nSitili starting 👀\nGosiewski gets another crack😆\n\nFormer Supercoach runner up @TimWill94 provides a 5000+ word analysis on the Round 3 teams lists 👉 tinyurl.com/2hewhdxm\n\n#nrl #nrlsupercoach',
    created_at: new Date(Date.now() - 18000000).toISOString(),
    sport: 'nrl',
    user: {
      id: 'scplaybook1',
      name: 'SC Playbook - NRL',
      username: 'scplaybook1',
      profile_image_url: require('@/assets/images/tweets/nrl/ScPlaybookProfile.png'),
      verified: true
    },
    media: [
      {
        media_key: 'round2-1',
        type: 'photo',
        url: require('@/assets/images/tweets/nrl/ScPlaybookTweetImage.png'),
        width: 1200,
        height: 800
      }
    ]
  }
];

// Dummy data for AFL tweets
const AFL_TWEETS: Tweet[] = [
  {
    id: 'afl-tweet-1',
    text: '"Hopefully there\'s kids out there that see me and can believe in themselves" 🤗\n\nEsava Ratugolea hopes he\'s blazing a path for more Pacific Islanders to enter the AFL.',
    created_at: new Date(Date.now() - 2900000).toISOString(),
    sport: 'afl',
    user: {
      id: 'afl',
      name: 'AFL',
      username: 'AFL',
      profile_image_url: require('@/assets/images/tweets/afl/AFLProfile.png'),
      verified: true
    },
    media: [
      {
        media_key: 'esava-ratugolea-path',
        type: 'photo',
        url: require('@/assets/images/tweets/afl/aflTweet1.png'),
        width: 1080,
        height: 720
      }
    ]
  },
  {
    id: 'afl-tweet-2',
    text: 'A group of sidelined Western Bulldogs stars have all made encouraging appearances at training 👀',
    created_at: new Date(Date.now() - 4200000).toISOString(),
    sport: 'afl',
    user: {
      id: 'afl',
      name: 'AFL',
      username: 'AFL',
      profile_image_url: require('@/assets/images/tweets/afl/AFLProfile.png'),
      verified: true
    },
    media: [
      {
        media_key: 'western-bulldogs-training',
        type: 'photo',
        url: require('@/assets/images/tweets/afl/aflTweet2.png'),
        width: 1080,
        height: 720
      }
    ]
  },
  {
    id: 'afl-tweet-3',
    text: 'North Melbourne will unveil a prized draftee this weekend 👀\n\n@JoshGabelich has the details.',
    created_at: new Date(Date.now() - 5100000).toISOString(),
    sport: 'afl',
    user: {
      id: 'afl',
      name: 'AFL',
      username: 'AFL',
      profile_image_url: require('@/assets/images/tweets/afl/AFLProfile.png'),
      verified: true
    },
    media: [
      {
        media_key: 'north-melbourne-draftee',
        type: 'photo',
        url: require('@/assets/images/tweets/afl/aflTweet3.png'),
        width: 1080,
        height: 720
      }
    ]
  },
  {
    id: 'afl-tweet-4',
    text: 'Chris Scott has confirmed that Mitch Knevitt (foot) will miss round 4.\n\n#SuperCoach #AFL',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    sport: 'afl',
    user: {
      id: 'supercoach_afl',
      name: 'SuperCoach AFL',
      username: 'SuperCoachAFL',
      profile_image_url: require('@/assets/images/tweets/afl/SupercoachProfile.png'),
      verified: true
    },
    media: [
      {
        media_key: 'mitch-knevitt-injury',
        type: 'photo',
        url: require('@/assets/images/tweets/afl/aflTweet4.png'),
        width: 1080,
        height: 720
      }
    ]
  },
  {
    id: 'afl-tweet-5',
    text: 'Carlton\'s aggressive trade period landed them Jagga Smith... but at what cost?\n\nHere\'s where the Blues\' list is at 👉 bit.ly/3DS6gHj',
    created_at: new Date(Date.now() - 9000000).toISOString(),
    sport: 'afl',
    user: {
      id: 'supercoach_afl',
      name: 'SuperCoach AFL',
      username: 'SuperCoachAFL',
      profile_image_url: require('@/assets/images/tweets/afl/SupercoachProfile.png'),
      verified: true
    },
    media: [
      {
        media_key: 'carlton-trade-jagga',
        type: 'photo',
        url: require('@/assets/images/tweets/afl/aflTweet5.png'),
        width: 1080,
        height: 720
      }
    ]
  },
  {
    id: 'afl-tweet-6',
    text: 'AFL Executive General Manager of Football Laura Kane is pleased to confirm team updates to the AFL Football Department.',
    created_at: new Date(Date.now() - 10800000).toISOString(),
    sport: 'afl',
    user: {
      id: 'afl',
      name: 'AFL',
      username: 'AFL',
      profile_image_url: require('@/assets/images/tweets/afl/AFLProfile.png'),
      verified: true
    },
    media: [
      {
        media_key: 'laura-kane-football-dept',
        type: 'photo',
        url: require('@/assets/images/tweets/afl/aflTweet6.png'),
        width: 1080,
        height: 720
      }
    ]
  }
];

// Dummy data for NBA tweets
const NBA_TWEETS: Tweet[] = [
  {
    id: 'nba-tweet-1',
    text: 'NBA STANDINGS UPDATE ‼️\n\n▪️ OKC (West #1) wins 11th straight\n▪️ MIA (East #9) wins 6th straight\n▪️ HOU (West #2) moves to 13-2 in L15\n▪️ LAC rises to 7th in West',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    sport: 'nba',
    user: {
      id: 'nba',
      name: 'NBA',
      username: 'NBA',
      profile_image_url: require('@/assets/images/tweets/nba/NBA.png'),
      verified: true
    },
    media: [
      {
        media_key: 'nba-standings-update',
        type: 'photo',
        url: require('@/assets/images/tweets/nba/nbaTweet1.png'),
        width: 1080,
        height: 720
      }
    ]
  },
  {
    id: 'nba-tweet-2',
    text: '🏆 PLAYOFF PICTURE 🏆\n\n▪️ LAC wins, moves into 3-way tie with MEM, MIN for West 6-8 (MIN currently #6)\n▪️ LAL now #3 in West, tied with DEN at West #4\n▪️ HOU clinches top 6 seed\n\nThe #NBAPlayoffs presented by Google begin April 19!',
    created_at: new Date(Date.now() - 5100000).toISOString(),
    sport: 'nba',
    user: {
      id: 'nba',
      name: 'NBA',
      username: 'NBA',
      profile_image_url: require('@/assets/images/tweets/nba/NBA.png'),
      verified: true
    },
    media: [
      {
        media_key: 'nba-playoff-picture',
        type: 'photo',
        url: require('@/assets/images/tweets/nba/nbaTweet2.png'),
        width: 1080,
        height: 720
      }
    ]
  },
  {
    id: 'nba-tweet-3',
    text: 'History was made tonight by this @WashWizards rookie trio!\n\nThe Wizards are the first team in NBA history to have 3-or-more rookies make 100+ 3PM in a single season 🎯🎯🎯\n\nBub Carrington - 121\nKyshawn George - 107\nAlex Sarr - 100',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    sport: 'nba',
    user: {
      id: 'nba',
      name: 'NBA',
      username: 'NBA',
      profile_image_url: require('@/assets/images/tweets/nba/NBA.png'),
      verified: true
    },
    media: [
      {
        media_key: 'wizards-rookie-trio',
        type: 'photo',
        url: require('@/assets/images/tweets/nba/nbaTweet3.png'),
        width: 1080,
        height: 720
      }
    ]
  },
  {
    id: 'nba-tweet-4',
    text: '🏀 WEDNESDAY\'S FINAL SCORES 🏀\n\nKawhi Leonard and the @LAClippers move to 8-2 in their last 10 games!\n\nJames Harden: 21 PTS, 10 AST, 3 BLK\nIvica Zubac: 17 PTS, 10 REB, 6 AST\nBogdan Bogdanović: 16 PTS, 4 3PM',
    created_at: new Date(Date.now() - 8100000).toISOString(),
    sport: 'nba',
    user: {
      id: 'nba',
      name: 'NBA',
      username: 'NBA',
      profile_image_url: require('@/assets/images/tweets/nba/NBA.png'),
      verified: true
    },
    media: [
      {
        media_key: 'kawhi-leonard-clippers',
        type: 'photo',
        url: require('@/assets/images/tweets/nba/nbaTweet4.png'),
        width: 1080,
        height: 720
      }
    ]
  },
  {
    id: 'nba-tweet-5',
    text: 'Keldon Johnson (back) out Wednesday. fantasylabs.com/nba/news/?id=6 ...',
    created_at: new Date(Date.now() - 5500000).toISOString(),
    sport: 'nba',
    user: {
      id: 'fantasylabsnba',
      name: 'Fantasy Labs NBA',
      username: 'FantasyLabsNBA',
      profile_image_url: require('@/assets/images/tweets/nba/Fantasy Labs NBA.png'),
      verified: true
    },
    media: []
  },
  {
    id: 'nba-tweet-6',
    text: 'Mavericks will start Dinwiddie, Thompson, Marshall, Davis, Lively on Wednesday. fantasylabs.com/nba/news/',
    created_at: new Date(Date.now() - 6400000).toISOString(),
    sport: 'nba',
    user: {
      id: 'fantasylabsnba',
      name: 'Fantasy Labs NBA',
      username: 'FantasyLabsNBA',
      profile_image_url: require('@/assets/images/tweets/nba/Fantasy Labs NBA.png'),
      verified: true
    },
    media: []
  },
  {
    id: 'nba-tweet-7',
    text: 'Hawks will start Young, Daniels, Risacher, Gueye, Okongwu on Wednesday. fantasylabs.com/nba/news/',
    created_at: new Date(Date.now() - 6500000).toISOString(),
    sport: 'nba',
    user: {
      id: 'fantasylabsnba',
      name: 'Fantasy Labs NBA',
      username: 'FantasyLabsNBA',
      profile_image_url: require('@/assets/images/tweets/nba/Fantasy Labs NBA.png'),
      verified: true
    },
    media: []
  },
  {
    id: 'nba-tweet-8',
    text: 'Peyton Watson (knee) doubtful Wednesday. fantasylabs.com/nba/news/?id=1...',
    created_at: new Date(Date.now() - 6600000).toISOString(),
    sport: 'nba',
    user: {
      id: 'fantasylabsnba',
      name: 'Fantasy Labs NBA',
      username: 'FantasyLabsNBA',
      profile_image_url: require('@/assets/images/tweets/nba/Fantasy Labs NBA.png'),
      verified: true
    },
    media: []
  },
  {
    id: 'nba-tweet-9',
    text: 'Jazz will start Collier, Sexton, Sensabaugh, Filipowski, and Kessler on Wednesday. fantasylabs.com/nba/news/',
    created_at: new Date(Date.now() - 6700000).toISOString(),
    sport: 'nba',
    user: {
      id: 'fantasylabsnba',
      name: 'Fantasy Labs NBA',
      username: 'FantasyLabsNBA',
      profile_image_url: require('@/assets/images/tweets/nba/Fantasy Labs NBA.png'),
      verified: true
    },
    media: []
  }
];

// Combine all tweets
const ALL_TWEETS: Tweet[] = [...NRL_TWEETS, ...AFL_TWEETS, ...NBA_TWEETS];

export default function SportsNews() {
  const [selectedSport, setSelectedSport] = useState<SportType>('all');
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  
  // Animation values for tab transitions
  const allTabAnim = useRef(new Animated.Value(1)).current;
  const nrlTabAnim = useRef(new Animated.Value(0)).current;
  const aflTabAnim = useRef(new Animated.Value(0)).current;
  const nbaTabAnim = useRef(new Animated.Value(0)).current;
  
  // Create a ref to store media URLs for each media key
  const mediaUrlsRef = useRef<Map<string, string>>(new Map());
  
  // Create a single video player that we'll reuse
  const videoPlayer = useVideoPlayer(null, player => {
    player.loop = true;
  });
  
  // Animate tab change
  useEffect(() => {
    // Reset all animations to 0
    Animated.parallel([
      Animated.timing(allTabAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.timing(nrlTabAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.timing(aflTabAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.timing(nbaTabAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start(() => {
      // Animate the selected tab to 1
      let selectedAnim;
      switch (selectedSport) {
        case 'all':
          selectedAnim = allTabAnim;
          break;
        case 'nrl':
          selectedAnim = nrlTabAnim;
          break;
        case 'afl':
          selectedAnim = aflTabAnim;
          break;
        case 'nba':
          selectedAnim = nbaTabAnim;
          break;
      }
      
      Animated.spring(selectedAnim, {
        toValue: 1,
        friction: 7,
        tension: 70,
        useNativeDriver: false,
      }).start();
    });
  }, [selectedSport]);

  // Load tweets on component mount or when selected sport changes
  useEffect(() => {
    setLoading(true);
    
    // Apply filter based on selected sport
    const tweetData = selectedSport === 'all' 
      ? ALL_TWEETS 
      : ALL_TWEETS.filter(tweet => tweet.sport === selectedSport);
    
    // Sort by date (newest first)
    const sortedTweets = [...tweetData].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    setTweets(sortedTweets);
    setLoading(false);
  }, [selectedSport]);

  // When tweets change, store all media URLs in our ref
  useEffect(() => {
    tweets.forEach(tweet => {
      if (tweet.media && tweet.media.length > 0) {
        tweet.media.forEach(media => {
          if (media.media_key && (media.url || media.preview_image_url)) {
            mediaUrlsRef.current.set(
              media.media_key, 
              media.url || media.preview_image_url || ''
            );
          }
        });
      }
    });
  }, [tweets]);

  // Function to refresh the data
  const onRefresh = () => {
    setRefreshing(true);
    
    // Get appropriate tweets based on selected sport
    let tweetData = selectedSport === 'all' 
      ? ALL_TWEETS 
      : ALL_TWEETS.filter(tweet => tweet.sport === selectedSport);
    
    // Randomize the order to simulate refresh
    const refreshedTweets = [...tweetData].sort(() => Math.random() - 0.5);
    
    setTweets(refreshedTweets);
    setRefreshing(false);
  };

  // Format the created_at date string
  const formatTweetDate = (dateString: string) => {
    try {
      // If it's already a relative time string
      if (dateString.includes('ago')) {
        return dateString;
      }
      
      // Otherwise parse the ISO date string
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return dateString; // Return original if parsing fails
    }
  };

  // Calculate image dimensions while maintaining aspect ratio
  const calculateImageDimensions = (width?: number, height?: number) => {
    if (!width || !height) return { width: SCREEN_WIDTH - 32, height: 200 };
    
    const aspectRatio = width / height;
    const calculatedWidth = SCREEN_WIDTH - 32; // Full width minus padding
    const calculatedHeight = calculatedWidth / aspectRatio;
    
    // Cap the height to prevent overly tall images
    return {
      width: calculatedWidth,
      height: Math.min(calculatedHeight, IMAGE_MAX_HEIGHT)
    };
  };

  // Handle video playback
  const handleVideoPress = (mediaKey: string) => {
    // If this video is already playing, stop it
    if (playingVideo === mediaKey) {
      videoPlayer.pause();
      setPlayingVideo(null);
    } else {
      // Otherwise play this video and stop any other
      const mediaUrl = mediaUrlsRef.current.get(mediaKey) || '';
      if (mediaUrl) {
        // Replace the current source with the new video
        videoPlayer.replace(mediaUrl);
        videoPlayer.play();
        setPlayingVideo(mediaKey);
      }
    }
  };

  // Get sport specific icon and color
  const getSportIcon = (sport: SportType) => {
    switch (sport) {
      case 'nrl':
        return <MaterialCommunityIcons name="football-australian" size={18} color="#FF6B6B" />;
      case 'afl':
        return <MaterialCommunityIcons name="football-australian" size={18} color="#4ECDC4" />;
      case 'nba':
        return <Ionicons name="basketball" size={18} color="#FFD166" />;
      default:
        return null;
    }
  };

  const renderTweet = ({ item, index }: { item: Tweet; index: number }) => {
    // Check if it's an AFL tweet to apply white background to profile image
    const isAflTweet = item.sport === 'afl';
    
    return (
      <View style={styles.tweetCard}>
        <View style={styles.tweetHeader}>
          <Image 
            source={item.user?.profile_image_url || require('@/assets/images/icon.png')}
            style={[
              styles.avatar, 
              isAflTweet && styles.aflAvatar
            ]} 
            defaultSource={require('@/assets/images/icon.png')}
          />
          <View style={styles.userInfo}>
            <View style={styles.nameContainer}>
              <Text style={styles.userName}>{item.user?.name}</Text>
              {item.user?.verified && (
                <View style={styles.verifiedBadgeContainer}>
                  <View style={styles.verifiedBadge}>
                    <Feather name="check" size={10} color="#FFFFFF" />
                  </View>
                </View>
              )}
            </View>
            <Text style={styles.userHandle}>@{item.user?.username}</Text>
          </View>
          <Text style={styles.tweetTime}>{formatTweetDate(item.created_at)}</Text>
        </View>

        <Text style={styles.tweetText}>{item.text}</Text>

        {/* Display media attachments if available */}
        {item.media && item.media.length > 0 && (
          <View style={styles.mediaContainer}>
            {item.media.map((media, mediaIndex) => {
              const dimensions = calculateImageDimensions(media.width, media.height);
              const uniqueMediaKey = `${item.id}-${mediaIndex}-${media.media_key || ''}`;
              
              if (media.type === 'photo' && media.url) {
                return (
                  <Image
                    key={uniqueMediaKey}
                    source={media.url}
                    style={[styles.mediaImage, dimensions]}
                    resizeMode="cover"
                  />
                );
              } else if (media.type === 'video' && (media.url || media.preview_image_url)) {
                const isPlaying = playingVideo === media.media_key;
                
                return (
                  <View key={uniqueMediaKey} style={[styles.videoContainer, dimensions]}>
                    {isPlaying ? (
                      <VideoView
                        style={{ width: dimensions.width, height: dimensions.height }}
                        player={videoPlayer}
                        allowsFullscreen
                        contentFit="contain"
                      />
                    ) : (
                      <TouchableOpacity 
                        activeOpacity={0.8}
                        onPress={() => handleVideoPress(media.media_key)}
                      >
                        <Image
                          source={media.preview_image_url || media.url}
                          style={{ width: dimensions.width, height: dimensions.height }}
                          resizeMode="cover"
                        />
                        <View style={styles.playButtonContainer}>
                          <Feather name="play-circle" size={48} color="#FFFFFF" />
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }
              return null;
            })}
          </View>
        )}
      </View>
    );
  };

  // Sport tab selection
  const renderSportTabs = () => {
    return (
      <View style={styles.tabsContainer}>
        <View style={styles.tabsScrollContainer}>
          <TouchableOpacity 
            style={styles.tabWrapper} 
            onPress={() => setSelectedSport('all')}
            activeOpacity={0.7}
          >
            <Animated.View 
              style={[
                styles.tab, 
                selectedSport === 'all' && styles.activeTab,
                {
                  backgroundColor: allTabAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['#262F3C', '#8BCEA9']
                  }),
                  transform: [
                    { scale: allTabAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.95, 1]
                      }) 
                    }
                  ]
                }
              ]}
            >
              <Feather 
                name="grid" 
                size={16} 
                color={selectedSport === 'all' ? "#FFFFFF" : "#AAAAAA"} 
              />
              <Text style={[styles.tabText, selectedSport === 'all' && styles.activeTabText]}>All</Text>
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.tabWrapper}
            onPress={() => setSelectedSport('nrl')}
            activeOpacity={0.7}
          >
            <Animated.View 
              style={[
                styles.tab, 
                selectedSport === 'nrl' && styles.activeTab,
                {
                  backgroundColor: nrlTabAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['#262F3C', '#8BCEA9']
                  }),
                  transform: [
                    { scale: nrlTabAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.95, 1]
                      }) 
                    }
                  ]
                }
              ]}
            >
              <MaterialCommunityIcons 
                name="football-australian" 
                size={16} 
                color={selectedSport === 'nrl' ? "#FFFFFF" : "#AAAAAA"} 
              />
              <Text style={[styles.tabText, selectedSport === 'nrl' && styles.activeTabText]}>NRL</Text>
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.tabWrapper}
            onPress={() => setSelectedSport('afl')}
            activeOpacity={0.7}
          >
            <Animated.View 
              style={[
                styles.tab, 
                selectedSport === 'afl' && styles.activeTab,
                {
                  backgroundColor: aflTabAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['#262F3C', '#8BCEA9']
                  }),
                  transform: [
                    { scale: aflTabAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.95, 1]
                      }) 
                    }
                  ]
                }
              ]}
            >
              <MaterialCommunityIcons 
                name="football-australian" 
                size={16} 
                color={selectedSport === 'afl' ? "#FFFFFF" : "#AAAAAA"} 
              />
              <Text style={[styles.tabText, selectedSport === 'afl' && styles.activeTabText]}>AFL</Text>
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.tabWrapper}
            onPress={() => setSelectedSport('nba')}
            activeOpacity={0.7}
          >
            <Animated.View 
              style={[
                styles.tab, 
                selectedSport === 'nba' && styles.activeTab,
                {
                  backgroundColor: nbaTabAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['#262F3C', '#8BCEA9']
                  }),
                  transform: [
                    { scale: nbaTabAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.95, 1]
                      }) 
                    }
                  ]
                }
              ]}
            >
              <Ionicons 
                name="basketball" 
                size={16} 
                color={selectedSport === 'nba' ? "#FFFFFF" : "#AAAAAA"} 
              />
              <Text style={[styles.tabText, selectedSport === 'nba' && styles.activeTabText]}>NBA</Text>
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaViewRN style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        {renderSportTabs()}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8BCEA9" />
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Feather 
              name="wifi-off" 
              size={48} 
              color="#8BCEA9" 
            />
            <Text style={styles.errorText}>{error}</Text>
            
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                const tweetData = selectedSport === 'all' 
                  ? ALL_TWEETS 
                  : ALL_TWEETS.filter(tweet => tweet.sport === selectedSport);
                setTweets(tweetData);
                setLoading(false);
              }}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={tweets}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            renderItem={renderTweet}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#8BCEA9"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Feather name="twitter" size={48} color="#8BCEA9" />
                <Text style={styles.emptyText}>No posts available</Text>
              </View>
            }
            onScroll={() => {
              // Stop video playback when scrolling
              if (playingVideo) {
                videoPlayer.pause();
                setPlayingVideo(null);
              }
            }}
          />
        )}
      </View>
    </SafeAreaViewRN>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#1C2732",
  },
  container: {
    flex: 1,
    backgroundColor: "#1C2732",
  },
  tabsContainer: {
    backgroundColor: "#1C2732",
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  tabsScrollContainer: {
    flexDirection: "row",
    justifyContent: 'center',
    backgroundColor: "#262F3C",
    borderRadius: 20,
    padding: 4,
  },
  tabWrapper: {
    marginHorizontal: 2,
  },
  tab: {
    flexDirection: 'row',
    alignItems: "center",
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#262F3C",
  },
  activeTab: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    marginLeft: 5,
    color: "#AAAAAA",
    fontWeight: "600",
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  sportIndicator: {
    marginLeft: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1C2732",
  },
  header: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingBottom: 20,
  },
  tweetCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2E35",
    backgroundColor: "#1C2732",
  },
  tweetHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,

  },
  aflAvatar: {
    backgroundColor: "#FFFFFF",
  },
  userInfo: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  userName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  verifiedBadgeContainer: {
    marginLeft: 4,
  },
  verifiedBadge: {
    backgroundColor: "#1DA1F2",
    borderRadius: 10,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userHandle: {
    fontSize: 14,
    color: "#8A8D91",
  },
  tweetTime: {
    fontSize: 14,
    color: "#8A8D91",
  },
  tweetText: {
    fontSize: 16,
    lineHeight: 22,
    color: "#FFFFFF",
    marginBottom: 12,
  },
  mediaContainer: {
    marginBottom: 12,
  },
  mediaImage: {
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#2A2E35",
  },
  videoContainer: {
    position: 'relative',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    backgroundColor: "#000",
  },
  playButtonContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: "#FFFFFF",
    fontSize: 16,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: "#8BCEA9",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    color: "#1A1D24",
    fontSize: 16,
    fontWeight: "bold",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    height: 300,
  },
  emptyText: {
    color: "#FFFFFF",
    fontSize: 16,
    marginTop: 16,
  },
});
