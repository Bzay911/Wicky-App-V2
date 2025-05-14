import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import aflDefeats from "../assets/afl/AFL_Goalscorers_in_Defeats.json";
import aflHomeAway from "../assets/afl/AFL_Home_Away_Goalscorers.json";
import aflPlayerSummary from "../assets/afl/AFL_player_summary_with_odds.json";
import nrlPlayerTries from "../assets/NRL_Player_tries_2025.json";
import { ChatBot } from '../Services/ChatBot';
import { ChatHistoryManager } from '../Services/ChatHistoryManager';
import { DataProcessor } from '../Services/DataProcessor';
import { VectorStoreManager } from '../Services/VectorStoreManager';
import { ChatMessage } from '../types';
import { PlayerStats } from '../types/chat';
import { logger } from '../utils/logger';

interface CombinedContext {
  players: { [key: string]: PlayerStats };
  team: string | null;
  position: string | null;
  isComparison: boolean;
}

interface Sport {
  id: string;
  name: string;
  icon: string;
}

export default function ChatScreen() {
  const [message, setMessage] = useState('');
  const [selectedMarket, setSelectedMarket] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showMarketPicker, setShowMarketPicker] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [sessionId, setSessionId] = useState('');
  
  // Add vector store cache
  const vectorStoreCache = useRef<Map<string, any>>(new Map());
  
  // Add query cache
  const queryCache = useRef<Map<string, {
    context: string;
    playerContext: string;
    response: string;
    timestamp: number;
  }>>(new Map());

  // Cache expiration time (5 minutes)
  const CACHE_EXPIRATION = 5 * 60 * 1000;

  // Function to generate cache key
  const generateCacheKey = (message: string, sport: string) => {
    return `${sport}:${message.toLowerCase().trim()}`;
  };

  // Function to check and get cached result
  const getCachedResult = (message: string, sport: string) => {
    const cacheKey = generateCacheKey(message, sport);
    const cached = queryCache.current.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRATION) {
      return cached;
    }
    
    // Remove expired cache entry
    if (cached) {
      queryCache.current.delete(cacheKey);
    }
    
    return null;
  };

  // Function to cache result
  const cacheResult = (
    message: string, 
    sport: string, 
    context: string, 
    playerContext: string, 
    response: string
  ) => {
    const cacheKey = generateCacheKey(message, sport);
    queryCache.current.set(cacheKey, {
      context,
      playerContext,
      response,
      timestamp: Date.now()
    });
  };

  const [suggestedQuestions, setSuggestedQuestions] = useState([
    'Daniel Tupou or Alex Johnston to score anytime?',
    'How is Xavier Coates for first tryscorer?',
    'David Fifita 13s or Pat Carrigan 18s for LTS?',
    'Best ATS in Panthers v Storm?'
  ]);
  
  // Add AFL suggested questions
  const aflSuggestedQuestions = [
    'How many goals has Charlie Curnow scored this season?',
    'What are Marcus Bontempelli\'s disposal stats?',
    'Who is the best first goal scorer for Geelong?',
    'Compare Jeremy Cameron and Tom Hawkins goal scoring'
  ];

  // Update suggested questions based on selected sport
  const [selectedSport, setSelectedSport] = useState('NRL');
  const [showSportPicker, setShowSportPicker] = useState(false);

  const router = useRouter();
  
  // Initialize services
  const chatBot = new ChatBot();
  const chatHistory = new ChatHistoryManager();
  const dataProcessor = new DataProcessor(process.env.BASE_DIR || '');
  const vectorStore = new VectorStoreManager();

  const sports: Sport[] = [
    { id: 'NRL', name: 'NRL', icon: 'https://imgs.search.brave.com/tU3JEUVqITvAEUmT4Fg2PVxvx-KOAc6mm6twfghxh94/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly91cGxv/YWQud2lraW1lZGlh/Lm9yZy93aWtpcGVk/aWEvZW4vdGh1bWIv/NS81MC9OYXRpb25h/bF9SdWdieV9MZWFn/dWUuc3ZnLzUxMnB4/LU5hdGlvbmFsX1J1/Z2J5X0xlYWd1ZS5z/dmcucG5n' },
    { id: 'AFL', name: 'AFL', icon: 'https://imgs.search.brave.com/cnFDH_O3DRvuN_hjMKv46ANyRpssEU3Ak6uO1aNHGD8/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly91cGxv/YWQud2lraW1lZGlh/Lm9yZy93aWtpcGVk/aWEvZW4vdGh1bWIv/ZS9lNC9BdXN0cmFs/aWFuX0Zvb3RiYWxs/X0xlYWd1ZS5zdmcv/NTEycHgtQXVzdHJh/bGlhbl9Gb290YmFs/bF9MZWFndWUuc3Zn/LnBuZw' },
  ];

  const markets = [
    'Any Time Try Scorer',
    'First Try Scorer',
    'Last Try Scorer',
    'Player Performance'
  ];

  // Add AFL market types
  const aflMarkets = [
    'Anytime Goal Scorer',
    'First Goal Scorer',
    'Player Performance',
    'Disposals'
  ];

  // Add keyboard state tracking
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Add player context cache
  const playerContextCache = useRef<Map<string, {
    stats: PlayerStats;
    timestamp: number;
  }>>(new Map());

  // Cache expiration time (1 hour)
  const PLAYER_CACHE_EXPIRATION = 60 * 60 * 1000;

  // Function to generate player cache key
  const generatePlayerCacheKey = (playerName: string, sport: string) => {
    return `${sport}:${playerName.toLowerCase().trim()}`;
  };

  // Function to get cached player data
  const getCachedPlayerData = (playerName: string, sport: string) => {
    const cacheKey = generatePlayerCacheKey(playerName, sport);
    const cached = playerContextCache.current.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < PLAYER_CACHE_EXPIRATION) {
      return cached.stats;
    }
    
    // Remove expired cache entry
    if (cached) {
      playerContextCache.current.delete(cacheKey);
    }
    
    return null;
  };

  // Function to cache player data
  const cachePlayerData = (playerName: string, sport: string, stats: PlayerStats) => {
    const cacheKey = generatePlayerCacheKey(playerName, sport);
    playerContextCache.current.set(cacheKey, {
      stats,
      timestamp: Date.now()
    });
  };

  // Add a loading state for initialization
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    initializeSession();
    initializeVectorStore();

    // Add keyboard state tracking
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        // Scroll to bottom when keyboard opens
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  useEffect(() => {
    setSuggestedQuestions(selectedSport === 'AFL' ? aflSuggestedQuestions : [
      'Daniel Tupou or Alex Johnston to score anytime?',
      'How is Xavier Coates for first tryscorer?',
      'David Fifita 13s or Pat Carrigan 18s for LTS?',
      'Best ATS in Panthers v Storm?'
    ]);
  }, [selectedSport]);

  // Update markets when sport changes
  useEffect(() => {
    setSelectedMarket('');
  }, [selectedSport]);

  const getCurrentMarkets = () => {
    return selectedSport === 'AFL' ? aflMarkets : markets;
  };

  const initializeSession = async () => {
    const newSessionId = `session_${Date.now()}`;
    await chatHistory.createSession(newSessionId, { market: selectedMarket });
    setSessionId(newSessionId);
  };

  const initializeVectorStore = async () => {
    try {
      setIsInitializing(true);
      // Initialize vector store in chunks
      await vectorStore.initializeStore('nrl');
      await vectorStore.initializeStore('afl');
      
      // Use imported data directly
      const parsedNrlPlayerData = nrlPlayerTries;
      
      // Add context documents in batches
      const batchSize = 10;
      const nrlContextDocs = [
        "NRL try scoring statistics and analysis for the 2025 season",
        "Player performance data including first try scorer, anytime try scorer, and last try scorer markets",
        "Historical odds and performance data for NRL players in various positions",
        ...markets.map(market => `${market} odds and statistics for NRL players`),
        ...suggestedQuestions
      ];
      
      for (let i = 0; i < nrlContextDocs.length; i += batchSize) {
        const batch = nrlContextDocs.slice(i, i + batchSize);
        await vectorStore.addDocuments(batch, { type: 'context' }, 'nrl');
      }
      
      // Similar batching for AFL data
      const aflContextDocs = [
        "AFL goal scoring statistics and analysis for the 2025 season",
        "Player performance data including goal scorer and disposal markets",
        "Historical odds and performance data for AFL players in various positions",
        ...aflMarkets.map(market => `${market} odds and statistics for AFL players`),
        ...aflSuggestedQuestions
      ];
      
      for (let i = 0; i < aflContextDocs.length; i += batchSize) {
        const batch = aflContextDocs.slice(i, i + batchSize);
        await vectorStore.addDocuments(batch, { type: 'context' }, 'afl');
      }
      
    } catch (error) {
      logger.error('Error initializing vector store:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleMarketSelect = async (market: string) => {
    setSelectedMarket(market);
    if (sessionId) {
      await chatHistory.addMessage(sessionId, 'system', `Market selected: ${market}`);
    }
  };

  // Pre-compile regex patterns for player extraction
  const PLAYER_PATTERNS = {
    // Combined patterns for better performance
    fullName: new RegExp(
      '([A-Z][a-z]+\\s+[A-Z][a-z]+)' + // First and last name
      '(?:\\s+(?:is|has|does|plays|tries|goals|stats|record|performance|odds|chances|\\?)|' + // Verbs
      '(?:\\\'s|\\s+\\\'s)(?:\\s+(?:stats|record|performance|tries|goals|scoring|disposals|odds))|' + // Possessive
      '(?:\\s+(?:and|vs|versus|with|to|or))|' + // Comparisons
      '(?:\\s+for|\\s+in|\\s+at)?\\b)', // Additional context
      'gi'
    ),
    positionName: new RegExp(
      '(?:player|forward|back|winger|centre|fullback|prop|hooker|halfback|midfielder|defender|ruckman)\\s+' +
      '([A-Z][a-z]+\\s+[A-Z][a-z]+)',
      'gi'
    ),
    analysisPhrase: new RegExp(
      '(?:how many (?:tries|goals) has|(?:try|goal) scoring record for|statistics for|performance of|disposal stats for)\\s+' +
      '([A-Z][a-z]+\\s+[A-Z][a-z]+)',
      'gi'
    ),
    howIs: new RegExp(
      '\\bhow\\s+is\\s+([A-Z][a-z]+\\s+[A-Z][a-z]+)(?:\\s+for|\\s+in|\\s+at)?\\b',
      'gi'
    ),
    standalone: new RegExp(
      '\\b([A-Z][a-z]+\\s+[A-Z][a-z]+)\\b',
      'gi'
    ),
    scoringOdds: new RegExp(
      '([A-Z][a-z]+\\s+[A-Z][a-z]+)\\s+(?:\\d+s|\\d+\\+)\\s+(?:for|to|in)\\s+\\w+',
      'gi'
    )
  };

  // Pre-compile team patterns
  const TEAM_PATTERNS = {
    nrl: new RegExp(
      '(Broncos|Raiders|Bulldogs|Sharks|Titans|Sea Eagles|Storm|Knights|Cowboys|Eels|Panthers|Rabbitohs|Dragons|Roosters|Warriors|Tigers|Dolphins|' +
      'Brisbane|Canberra|Canterbury|Cronulla|Gold Coast|Manly|Melbourne|Newcastle|North Queensland|Parramatta|Penrith|South Sydney|St\\.? George|Sydney|Wests)',
      'gi'
    ),
    afl: new RegExp(
      '(Adelaide|Brisbane Lions|Carlton|Collingwood|Essendon|Fremantle|Geelong|Gold Coast|GWS|Giants|Greater Western Sydney|Hawthorn|Melbourne|North Melbourne|Port Adelaide|Richmond|St Kilda|Sydney|West Coast|Western Bulldogs)',
      'gi'
    )
  };

  // Pre-compile position patterns
  const POSITION_PATTERNS = {
    nrl: new RegExp(
      '(?:as|at|in|on|playing|played)\\s+(?:a|the)?\\s+' +
      '(winger|centre|fullback|five-eighth|halfback|hooker|prop|lock|second row|second-row|interchange|bench)',
      'gi'
    ),
    afl: new RegExp(
      '(?:as|at|in|on|playing|played)\\s+(?:a|the)?\\s+' +
      '(forward|midfielder|defender|ruckman|wing|ruck|rover)',
      'gi'
    )
  };

  // Optimized player extraction function
  const extractPlayerInfo = (message: string, sport: string) => {
    const playerNames = new Set<string>();
    let teamFromMessage = null;
    let positionFromMessage = null;

    // Extract player names using optimized patterns
    for (const pattern of Object.values(PLAYER_PATTERNS)) {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        if (match[1] && match[1].trim()) {
          playerNames.add(match[1].trim());
        }
      }
    }

    // Extract team name
    const teamPattern = sport === 'AFL' ? TEAM_PATTERNS.afl : TEAM_PATTERNS.nrl;
    const teamMatch = teamPattern.exec(message);
    if (teamMatch && teamMatch[1]) {
      teamFromMessage = teamMatch[1];
    }

    // Extract position
    const positionPattern = sport === 'AFL' ? POSITION_PATTERNS.afl : POSITION_PATTERNS.nrl;
    const positionMatch = positionPattern.exec(message);
    if (positionMatch && positionMatch[1]) {
      positionFromMessage = positionMatch[1];
    }

    return {
      playerNames: Array.from(playerNames),
      team: teamFromMessage,
      position: positionFromMessage
    };
  };

  const sendMessage = async () => {
    console.log('Sending message: pressed button');
    if (!message.trim() || !sessionId || isLoading) return;

    setIsLoading(true);
    const userMessage = message.trim();
    setMessage('');

    try {
      // Add user message to chat
      await chatHistory.addMessage(sessionId, 'user', userMessage);
      setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date().toISOString() }]);

      // Check cache first
      const cachedResult = getCachedResult(userMessage, selectedSport);
      if (cachedResult) {
        console.log('Using cached result');
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: cachedResult.response, 
          timestamp: new Date().toISOString() 
        }]);
        setIsLoading(false);
        return;
      }

      // Get relevant context from vector store
      let context = '';
      try {
        const vectorResults = await vectorStore.search(userMessage, selectedSport.toLowerCase(), 3);
        if (vectorResults && vectorResults.length > 0) {
          context = vectorResults.map(result => result.text).join('\n');
        }
      } catch (searchError) {
        logger.error('Error searching vector store:', searchError);
      }
      
      // Get player stats if message contains player name(s)
      let playerContext = '';
      try {
        // Replace the existing player extraction logic with the optimized function
        const { playerNames: playerNamesFromText, team: teamFromMessage, position: positionFromMessage } = extractPlayerInfo(userMessage, selectedSport);

        // Build context that includes player statistics
        let combinedContext: CombinedContext = {
          players: {},
          team: teamFromMessage,
          position: positionFromMessage,
          isComparison: playerNamesFromText.length > 1
        };

        // Define query type analyzers for later use
        const isGoalScoringQuery = /goal|goals|scorer|scoring/i.test(userMessage);
        const isDisposalQuery = /disposal|disposals|possession|touches/i.test(userMessage);
        const isTryScoringQuery = /try|tries|tryscorer|scoring/i.test(userMessage);

        // Fetch player data based on sport
        if (playerNamesFromText.length > 0) {
          // Create an array of promises for parallel execution
          const playerDataPromises = playerNamesFromText.map(async (playerName) => {
            // Check cache first
            const cachedStats = getCachedPlayerData(playerName, selectedSport);
            if (cachedStats) {
              console.log(`Using cached stats for player: ${playerName}`);
              return { playerName, stats: cachedStats };
            }

            if (selectedSport === 'AFL') {
              // Get AFL player data - parallel implementation
              const [aflPlayerData, homeAwayStats, defeatStats] = await Promise.all([
                dataProcessor.getAFLPlayerStats(playerName),
                dataProcessor.getAFLHomeAwayStats(playerName),
                dataProcessor.getAFLDefeatStats(playerName)
              ]);

              if (aflPlayerData) {
                const playerStats: PlayerStats = {
                  name: aflPlayerData.Player,
                  gamesPlayed: aflPlayerData.Total_Games,
                  goals: {
                    onePlus: {
                      count: aflPlayerData.Games_with_1_or_more_goals,
                      odds: aflPlayerData.Odds_1_or_more_goals,
                      percentage: aflPlayerData.Total_Games > 0 ? 
                        (aflPlayerData.Games_with_1_or_more_goals / aflPlayerData.Total_Games) * 100 : 0
                    },
                    twoPlus: {
                      count: aflPlayerData.Games_with_2_or_more_goals,
                      odds: aflPlayerData.Odds_2_or_more_goals,
                      percentage: aflPlayerData.Total_Games > 0 ? 
                        (aflPlayerData.Games_with_2_or_more_goals / aflPlayerData.Total_Games) * 100 : 0
                    },
                    threePlus: {
                      count: aflPlayerData.Games_with_3_or_more_goals,
                      odds: aflPlayerData.Odds_3_or_more_goals,
                      percentage: aflPlayerData.Total_Games > 0 ? 
                        (aflPlayerData.Games_with_3_or_more_goals / aflPlayerData.Total_Games) * 100 : 0
                    }
                  },
                  disposals: {
                    fifteenPlus: {
                      count: aflPlayerData.Games_with_15_or_more_disposals,
                      odds: aflPlayerData.Odds_15_or_more_disposals,
                      percentage: aflPlayerData.Total_Games > 0 ? 
                        (aflPlayerData.Games_with_15_or_more_disposals / aflPlayerData.Total_Games) * 100 : 0
                    },
                    twentyPlus: {
                      count: aflPlayerData.Games_with_20_or_more_disposals,
                      odds: aflPlayerData.Odds_20_or_more_disposals,
                      percentage: aflPlayerData.Total_Games > 0 ? 
                        (aflPlayerData.Games_with_20_or_more_disposals / aflPlayerData.Total_Games) * 100 : 0
                    },
                    thirtyPlus: {
                      count: aflPlayerData.Games_with_30_or_more_disposals,
                      odds: aflPlayerData.Odds_30_or_more_disposals,
                      percentage: aflPlayerData.Total_Games > 0 ? 
                        (aflPlayerData.Games_with_30_or_more_disposals / aflPlayerData.Total_Games) * 100 : 0
                    }
                  },
                  recentForm: {
                    goalsLast5: aflPlayerData.Goals_Last_5_Games,
                    goalsLast10: aflPlayerData.Goals_Last_10_Games,
                    disposalsLast5: aflPlayerData.Disposals_Last_5_Games,
                    disposalsLast10: aflPlayerData.Disposals_Last_10_Games
                  }
                };
                
                if (homeAwayStats) {
                  playerStats.homeAway = homeAwayStats;
                }
                
                if (defeatStats) {
                  playerStats.defeat = defeatStats;
                }
                
                // Cache the player data
                cachePlayerData(playerName, selectedSport, playerStats);
                
                return { playerName, stats: playerStats };
              } else {
                // If DataProcessor failed, try using directly imported data
                try {
                  // Find player in imported data
                  const directPlayerData = (aflPlayerSummary as any[]).find(p => 
                    p.Player?.toLowerCase() === playerName.toLowerCase() ||
                    p.Player?.toLowerCase().includes(playerName.toLowerCase()) ||
                    playerName.toLowerCase().includes(p.Player?.toLowerCase())
                  );
                  
                  if (directPlayerData) {
                    const playerStats: PlayerStats = {
                      name: directPlayerData.Player,
                      gamesPlayed: directPlayerData.Total_Games || 0,
                      goals: {
                        onePlus: {
                          count: directPlayerData.Games_with_1_or_more_goals || 0,
                          odds: directPlayerData.Odds_1_or_more_goals || 0,
                          percentage: directPlayerData.Total_Games > 0 ? 
                            (directPlayerData.Games_with_1_or_more_goals / directPlayerData.Total_Games) * 100 : 0
                        },
                        twoPlus: {
                          count: directPlayerData.Games_with_2_or_more_goals || 0,
                          odds: directPlayerData.Odds_2_or_more_goals || 0,
                          percentage: directPlayerData.Total_Games > 0 ? 
                            (directPlayerData.Games_with_2_or_more_goals / directPlayerData.Total_Games) * 100 : 0
                        },
                        threePlus: {
                          count: directPlayerData.Games_with_3_or_more_goals || 0,
                          odds: directPlayerData.Odds_3_or_more_goals || 0,
                          percentage: directPlayerData.Total_Games > 0 ? 
                            (directPlayerData.Games_with_3_or_more_goals / directPlayerData.Total_Games) * 100 : 0
                        }
                      },
                      disposals: {
                        fifteenPlus: {
                          count: directPlayerData.Games_with_15_or_more_disposals || 0,
                          odds: directPlayerData.Odds_15_or_more_disposals || 0,
                          percentage: directPlayerData.Total_Games > 0 ? 
                            (directPlayerData.Games_with_15_or_more_disposals / directPlayerData.Total_Games) * 100 : 0
                        },
                        twentyPlus: {
                          count: directPlayerData.Games_with_20_or_more_disposals || 0,
                          odds: directPlayerData.Odds_20_or_more_disposals || 0,
                          percentage: directPlayerData.Total_Games > 0 ? 
                            (directPlayerData.Games_with_20_or_more_disposals / directPlayerData.Total_Games) * 100 : 0
                        },
                        thirtyPlus: {
                          count: directPlayerData.Games_with_30_or_more_disposals || 0,
                          odds: directPlayerData.Odds_30_or_more_disposals || 0,
                          percentage: directPlayerData.Total_Games > 0 ? 
                            (directPlayerData.Games_with_30_or_more_disposals / directPlayerData.Total_Games) * 100 : 0
                        }
                      },
                      recentForm: {
                        goalsLast5: directPlayerData.Goals_Last_5_Games || 0,
                        goalsLast10: directPlayerData.Goals_Last_10_Games || 0,
                        disposalsLast5: directPlayerData.Disposals_Last_5_Games || 0,
                        disposalsLast10: directPlayerData.Disposals_Last_10_Games || 0
                      }
                    };
                    
                    // Find player home/away stats
                    const homeAwayData = (aflHomeAway as any[]).find(p => 
                      p.full_name?.toLowerCase() === playerName.toLowerCase() ||
                      p.full_name?.toLowerCase().includes(playerName.toLowerCase())
                    );
                    
                    if (homeAwayData) {
                      playerStats.homeAway = {
                        home_games: homeAwayData.home_games || 0,
                        away_games: homeAwayData.away_games || 0,
                        home_games_with_goals: homeAwayData.home_games_with_goals || 0,
                        away_games_with_goals: homeAwayData.away_games_with_goals || 0,
                        home_goal_percentage: homeAwayData.home_goal_percentage || 0,
                        away_goal_percentage: homeAwayData.away_goal_percentage || 0
                      };
                    }
                    
                    // Find player defeat stats
                    const defeatData = (aflDefeats as any[]).find(p => 
                      p.full_name?.toLowerCase() === playerName.toLowerCase() ||
                      p.full_name?.toLowerCase().includes(playerName.toLowerCase())
                    );
                    
                    if (defeatData) {
                      playerStats.defeat = {
                        total_loss_games: defeatData.total_loss_games || 0,
                        loss_games_with_goals: defeatData.loss_games_with_goals || 0,
                        loss_goal_percentage: defeatData.loss_goal_percentage || 0
                      };
                    }
                    
                    // Cache the player data
                    cachePlayerData(playerName, selectedSport, playerStats);
                    
                    return { playerName, stats: playerStats };
                  }
                } catch (directDataError) {
                  logger.error(`Error getting AFL player data directly for ${playerName}:`, directDataError);
                }
              }
            } else {
              // Get NRL player data - parallel implementation
              console.log(`Fetching NRL stats for player: ${playerName}`);
              const playerData = await dataProcessor.getPlayerStats(playerName);
              if (playerData) {
                console.log(`Found NRL stats for player: ${playerName}`);
                
                // Cache the player data
                cachePlayerData(playerName, selectedSport, playerData);
                
                return { playerName, stats: playerData };
              } else {
                console.log(`No NRL stats found for player: ${playerName}`);
              }
            }
            return null;
          });

          // Execute all promises in parallel
          const playerResults = await Promise.all(playerDataPromises);
          
          // Process results
          playerResults.forEach(result => {
            if (result) {
              combinedContext.players[result.playerName] = result.stats;
            }
          });
        }

        // If we have player context, format it as text
        if (Object.keys(combinedContext.players).length > 0) {
          let sport = selectedSport.toLowerCase();
          
          // Create a text representation of the player context
          for (const [playerName, stats] of Object.entries(combinedContext.players)) {
            if (selectedSport === 'AFL') {
              // Format AFL player context with focus on goals or disposals depending on query
              playerContext += `Player name: ${stats.name}\nAFL player summary:\n`;
              playerContext += `ACTUAL_GAMES_PLAYED: ${stats.gamesPlayed}\n`;
              
              // Add goal stats if relevant
              if (isGoalScoringQuery || !isDisposalQuery) {
                playerContext += `\nGoal Scoring:\n`;
                playerContext += `Games_with_1_or_more_goals: ${stats.goals?.onePlus.count || 0}\n`;
                playerContext += `Odds_1_or_more_goals: ${stats.goals?.onePlus.odds || 0}\n`;
                playerContext += `Games_with_2_or_more_goals: ${stats.goals?.twoPlus.count || 0}\n`;
                playerContext += `Odds_2_or_more_goals: ${stats.goals?.twoPlus.odds || 0}\n`;
                playerContext += `Games_with_3_or_more_goals: ${stats.goals?.threePlus.count || 0}\n`;
                playerContext += `Odds_3_or_more_goals: ${stats.goals?.threePlus.odds || 0}\n`;
                playerContext += `Goals_Last_5_Games: ${stats.recentForm?.goalsLast5 || 0}\n`;
                playerContext += `Goals_Last_10_Games: ${stats.recentForm?.goalsLast10 || 0}\n`;
              }
              
              // Add disposal stats if relevant
              if (isDisposalQuery || !isGoalScoringQuery) {
                playerContext += `\nDisposals:\n`;
                playerContext += `Games_with_15_or_more_disposals: ${stats.disposals?.fifteenPlus.count || 0}\n`;
                playerContext += `Odds_15_or_more_disposals: ${stats.disposals?.fifteenPlus.odds || 0}\n`;
                playerContext += `Games_with_20_or_more_disposals: ${stats.disposals?.twentyPlus.count || 0}\n`;
                playerContext += `Odds_20_or_more_disposals: ${stats.disposals?.twentyPlus.odds || 0}\n`;
                playerContext += `Games_with_30_or_more_disposals: ${stats.disposals?.thirtyPlus.count || 0}\n`;
                playerContext += `Odds_30_or_more_disposals: ${stats.disposals?.thirtyPlus.odds || 0}\n`;
                playerContext += `Disposals_Last_5_Games: ${stats.recentForm?.disposalsLast5 || 0}\n`;
                playerContext += `Disposals_Last_10_Games: ${stats.recentForm?.disposalsLast10 || 0}\n`;
              }
              
              // Add home/away stats if available
              if (stats.homeAway) {
                playerContext += `\nHome/Away Stats:\n`;
                playerContext += `home_games: ${stats.homeAway.home_games}\n`;
                playerContext += `away_games: ${stats.homeAway.away_games}\n`;
                playerContext += `home_games_with_goals: ${stats.homeAway.home_games_with_goals}\n`;
                playerContext += `away_games_with_goals: ${stats.homeAway.away_games_with_goals}\n`;
                playerContext += `home_goal_percentage: ${stats.homeAway.home_goal_percentage}\n`;
                playerContext += `away_goal_percentage: ${stats.homeAway.away_goal_percentage}\n`;
              }
              
              // Add defeat stats if available
              if (stats.defeat) {
                playerContext += `\nDefeat Stats:\n`;
                playerContext += `total_loss_games: ${stats.defeat.total_loss_games}\n`;
                playerContext += `loss_games_with_goals: ${stats.defeat.loss_games_with_goals}\n`;
                playerContext += `loss_goal_percentage: ${stats.defeat.loss_goal_percentage}\n`;
              }
            } else {
              // NRL player context
              playerContext += `Player name: ${stats.name}\nNRL player summary:\n`;
              playerContext += `ACTUAL_GAMES_PLAYED: ${stats.gamesPlayed || 0}\n`;
              playerContext += `TotalAtsPlayer: ${stats.tries || 0}\n`;
              playerContext += `TotalFtsPlayer: ${stats.firstTries || 0}\n`;
              playerContext += `TotalLtsPlayer: ${stats.lastTries || 0}\n`;
              playerContext += `TotalFts2HPlayer: ${stats.secondHalfFirstTries || 0}\n`;
              playerContext += `TotalTwoPlusTryPlayer: ${stats.twoPlusTries || 0}\n`;
              playerContext += `Team: ${stats.team || ''}\n`;
              playerContext += `ATS_Last_5_Games: ${stats.atsLast5Games || 0}\n`;
              playerContext += `ATS_Last_10_Games: ${stats.atsLast10Games || 0}\n`;
              
              // Format position-specific data if available
              if (stats.positions && Object.keys(stats.positions).length > 0) {
                playerContext += '\nPositional Stats:\n';
                for (const [position, posStats] of Object.entries(stats.positions)) {
                  playerContext += `Position: ${position}\n`;
                  playerContext += `POSITION_ACTUAL_GAMES: ${posStats.gamesPlayed || 0}\n`;
                  playerContext += `Total ATS in Position: ${posStats.tries || 0}\n`;
                  playerContext += `Total FTS in Position: ${posStats.firstTries || 0}\n`;
                  playerContext += `Total LTS in Position: ${posStats.lastTries || 0}\n`;
                  playerContext += `Total FTS2H in Position: ${posStats.secondHalfFirstTries || 0}\n`;
                  playerContext += `Total 2+ Tries in Position: ${posStats.twoPlusTries || 0}\n`;
                }
              }
            }
            playerContext += '\n';
          }
        }
      } catch (playerError) {
        logger.error('Error getting player stats:', playerError);
      }

      // Combine contexts
      const fullContext = [context, playerContext].filter(Boolean).join('\n\n');

      // Get chat history as strings
      const chatHistoryMessages = await chatHistory.getMessages(sessionId);
      
      // Get bot response
      const response = await chatBot.chat(userMessage, selectedSport.toLowerCase(), chatHistoryMessages, fullContext);
      
      // Cache the result
      cacheResult(userMessage, selectedSport, context, playerContext, response);
      
      // Add bot response to chat
      await chatHistory.addMessage(sessionId, 'assistant', response);
      setMessages(prev => [...prev, { role: 'assistant', content: response, timestamp: new Date().toISOString() }]);

      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = (msg: ChatMessage, index: number) => (
    <View 
      key={index} 
      style={[
        styles.messageContainer,
        msg.role === 'user' ? styles.userMessageContainer : styles.assistantMessageContainer
      ]}
    >
      <Text style={[styles.messageText, msg.role === 'user' ? styles.userMessageText : styles.assistantMessageText]}>
        {msg.content}
      </Text>
    </View>
  );

  // Implement memory cleanup
  useEffect(() => {
    return () => {
      // Cleanup vector store cache
      vectorStoreCache.current.clear();
      // Cleanup other caches
      queryCache.current.clear();
      playerContextCache.current.clear();
    };
  }, []);

  // Add memory monitoring
  const checkMemoryUsage = () => {
    if (Platform.OS === 'android') {
      // Use a simpler approach - clear cache periodically
      const now = Date.now();
      const lastCleanup = vectorStoreCache.current.get('lastCleanup') || 0;
      
      if (now - lastCleanup > 5 * 60 * 1000) { // Every 5 minutes
        vectorStoreCache.current.clear();
        vectorStoreCache.current.set('lastCleanup', now);
      }
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#8bcea9" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          
          <View style={styles.dropdownContainer}>
            {/* Sport Selector */}
            <Pressable 
              style={styles.sportSelector}
              onPress={() => setShowSportPicker(true)}
            >
              <Image 
                source={sports.find(s => s.id === selectedSport)?.icon} 
                style={styles.sportIcon}
                contentFit="contain"
              />
              <Text style={styles.sportText}>{selectedSport}</Text>
              <MaterialCommunityIcons name="chevron-down" size={24} color="white" />
            </Pressable>

            {/* Market Selector */}
            <Pressable 
              style={styles.marketSelector}
              onPress={() => setShowMarketPicker(true)}
            >
              <Text style={styles.marketText}>
                {selectedMarket || 'Select Market'}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={24} color="white" />
            </Pressable>
          </View>
        </View>

        {/* Sport Picker Modal */}
        <Modal
          visible={showSportPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSportPicker(false)}
        >
          <Pressable 
            style={styles.modalOverlay}
            onPress={() => setShowSportPicker(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Sport</Text>
                <Pressable onPress={() => setShowSportPicker(false)}>
                  <MaterialCommunityIcons name="close" size={24} color="#8bcea9" />
                </Pressable>
              </View>
              {sports.map((sport) => (
                <Pressable
                  key={sport.id}
                  style={styles.sportOption}
                  onPress={() => {
                    setSelectedSport(sport.id);
                    setSelectedMarket('');
                    setShowSportPicker(false);
                  }}
                >
                  <View style={styles.sportOptionContent}>
                    <Image source={sport.icon} style={styles.sportOptionIcon} contentFit="contain" />
                    <Text style={[
                      styles.sportOptionText,
                      selectedSport === sport.id && styles.selectedSportText
                    ]}>
                      {sport.name}
                    </Text>
                  </View>
                  {selectedSport === sport.id && (
                    <MaterialCommunityIcons name="check" size={20} color="#8bcea9" />
                  )}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>

        {/* Market Picker Modal */}
        <Modal
          visible={showMarketPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowMarketPicker(false)}
        >
          <Pressable 
            style={styles.modalOverlay}
            onPress={() => setShowMarketPicker(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Market</Text>
                <Pressable onPress={() => setShowMarketPicker(false)}>
                  <MaterialCommunityIcons name="close" size={24} color="#8bcea9" />
                </Pressable>
              </View>
              {getCurrentMarkets().map((market, index) => (
                <Pressable
                  key={index}
                  style={styles.marketOption}
                  onPress={() => {
                    handleMarketSelect(market);
                    setShowMarketPicker(false);
                  }}
                >
                  <Text style={[
                    styles.marketOptionText,
                    selectedMarket === market && styles.selectedMarketText
                  ]}>
                    {market}
                  </Text>
                  {selectedMarket === market && (
                    <MaterialCommunityIcons name="check" size={20} color="#8bcea9" />
                  )}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>

        {/* Chat Area */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.chatArea}
          contentContainerStyle={[
            styles.chatContent,
            { paddingBottom: keyboardHeight > 0 ? keyboardHeight : 0 }
          ]}
        >
          {messages.map(renderMessage)}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#8bcea9" />
            </View>
          )}
        </ScrollView>

        {/* Bottom Area (Suggested Questions + Input) */}
        <View style={styles.bottomArea}>
          {/* Suggested Questions - Hide when keyboard is open */}
          {keyboardHeight === 0 && (
            <View style={styles.suggestedArea}>
              <Text style={styles.suggestedTitle}>Suggested Questions</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {suggestedQuestions.map((question, index) => (
                  <Pressable 
                    key={index}
                    style={styles.questionChip}
                    onPress={() => setMessage(question)}
                  >
                    <MaterialCommunityIcons name="message-text" size={16} color="#8bcea9" />
                    <Text style={styles.questionText}>{question}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Input Area */}
          <View style={styles.inputArea}>
            <TextInput
              style={[styles.input, { textAlignVertical: 'top' }]}
              value={message}
              onChangeText={setMessage}
              placeholder={`Ask about ${selectedSport}...`}
              placeholderTextColor="#718096"
              multiline
              maxLength={1000}
              keyboardType="default"
              keyboardAppearance="dark"
              enablesReturnKeyAutomatically={true}
              clearButtonMode="while-editing"
              textContentType="none"
              autoCorrect={true}
              autoCapitalize="sentences"
              accessibilityLabel="Message input field"
              accessibilityHint={`Enter your question about ${selectedSport} players and statistics`}
              onSubmitEditing={() => {
                if (message.trim()) {
                  sendMessage();
                }
              }}
            />
            <Pressable 
              style={[styles.sendButton, (!message.trim() || isLoading) && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!message.trim() || isLoading}
              accessibilityLabel="Send message"
              accessibilityHint="Send your question to get NRL statistics and analysis"
            >
              <MaterialCommunityIcons 
                name="send" 
                size={24} 
                color="white" 
              />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A', // slate-900
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)', // slate-700/20
    backgroundColor: '#0F172A', // slate-900
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginRight: 16,
  },
  backText: {
    color: '#8bcea9',
    marginLeft: 4,
    fontSize: 17,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter',
    fontWeight: '400',
  },
  dropdownContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  sportSelector: {
    flex: 0.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  marketSelector: {
    flex: 0.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  sportIcon: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  sportText: {
    color: 'white',
    fontSize: 17,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter',
    fontWeight: '500',
    marginRight: 4,
  },
  sportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  sportOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sportOptionIcon: {
    width: 32,
    height: 32,
    marginRight: 12,
  },
  sportOptionText: {
    color: 'white',
    fontSize: 17,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter',
  },
  selectedSportText: {
    color: '#8bcea9',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter',
    fontWeight: '600',
  },
  marketText: {
    color: 'white',
    fontSize: 17,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter',
    fontWeight: '500',
  },
  chatArea: {
    flex: 1,
    backgroundColor: '#0F172A', // slate-900
  },
  chatContent: {
    padding: 16,
  },
  messageContainer: {
    maxWidth: '85%',
    marginVertical: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)', // slate-700/20
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
    backgroundColor: '#8bcea9',
    borderColor: 'transparent',
  },
  userMessageText: {
    color: '#0F172A', // slate-900
    fontSize: 17,
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter',
  },
  assistantMessageContainer: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(30, 41, 59, 0.5)', // slate-800/50
  },
  assistantMessageText: {
    color: 'white',
    fontSize: 17,
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter',
  },
  messageText: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter',
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  bottomArea: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.2)', // slate-700/20
    backgroundColor: '#0F172A', // slate-900
  },
  suggestedArea: {
    padding: 16,
  },
  suggestedTitle: {
    color: '#8bcea9',
    fontSize: 17,
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter',
    fontWeight: '600',
  },
  questionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.5)', // slate-800/50
    padding: 12,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)', // slate-700/20
  },
  questionText: {
    color: 'white',
    marginLeft: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter',
    fontSize: 15,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.5)', // slate-800/50
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: 'white',
    marginRight: 12,
    maxHeight: 100,
    fontSize: 17,
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)', // slate-700/20
  },
  sendButton: {
    backgroundColor: '#8bcea9',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8bcea9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)', // slate-800/50
    shadowOpacity: 0,
    elevation: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A', // slate-900
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '50%',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)', // slate-700/20
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)', // slate-700/20
  },
  modalTitle: {
    color: 'white',
    fontSize: 17,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter',
    fontWeight: '600',
  },
  marketOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.5)', // slate-800/50
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)', // slate-700/20
  },
  marketOptionText: {
    color: 'white',
    fontSize: 17,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter',
  },
  selectedMarketText: {
    color: '#8bcea9',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter',
    fontWeight: '600',
  },
}); 