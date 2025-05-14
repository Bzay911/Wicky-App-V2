/**
 * Chat message structure
 */
export interface ChatMessage {
  /**
   * Role of the message author (user or assistant)
   */
  role: 'user' | 'assistant' | 'system';
  
  /**
   * Content of the message
   */
  content: string;
  
  /**
   * Timestamp when the message was created
   */
  timestamp: string;
}

/**
 * Chat session structure
 */
export interface ChatSession {
  /**
   * When the session was created
   */
  createdAt: string;
  
  /**
   * Metadata for the session (sport, market, etc.)
   */
  metadata: Record<string, any>;
  
  /**
   * Messages in the session
   */
  messages: ChatMessage[];
}

/**
 * Configuration for the chat bot
 */
export interface ChatConfig {
  /**
   * OpenAI model to use
   */
  model: string;
  
  /**
   * Temperature setting (0-1)
   */
  temperature: number;
  
  /**
   * Maximum tokens to generate
   */
  maxTokens: number;
}

/**
 * Player statistics structure
 */
export interface PlayerStats {
  /**
   * Player name
   */
  name: string;
  
  /**
   * Total games played
   */
  gamesPlayed: number;
  
  /**
   * NRL specific stats
   */
  tries?: number;
  firstTries?: number;
  lastTries?: number;
  secondHalfFirstTries?: number;
  twoPlusTries?: number;
  team?: string;
  secondTries?: number;
  thirdTries?: number;
  atsLast5Games?: number;
  atsLast10Games?: number;
  positions?: Record<string, PositionalStats>;
  
  /**
   * AFL specific stats
   */
  goals?: {
    onePlus: {
      count: number;
      odds: number;
      percentage: number;
    };
    twoPlus: {
      count: number;
      odds: number;
      percentage: number;
    };
    threePlus: {
      count: number;
      odds: number;
      percentage: number;
    };
  };
  disposals?: {
    fifteenPlus: {
      count: number;
      odds: number;
      percentage: number;
    };
    twentyPlus: {
      count: number;
      odds: number;
      percentage: number;
    };
    thirtyPlus: {
      count: number;
      odds: number;
      percentage: number;
    };
  };
  recentForm?: {
    goalsLast5: number;
    goalsLast10: number;
    disposalsLast5: number;
    disposalsLast10: number;
  };
  homeAway?: {
    home_games: number;
    away_games: number;
    home_games_with_goals: number;
    away_games_with_goals: number;
    home_goal_percentage: number;
    away_goal_percentage: number;
  } | null;
  defeat?: {
    total_loss_games: number;
    loss_games_with_goals: number;
    loss_goal_percentage: number;
  } | null;
}

/**
 * Position-specific statistics
 */
export interface PositionalStats {
  // NRL specific stats
  gamesPlayed?: number;
  tries?: number;
  firstTries?: number;
  lastTries?: number;
  secondHalfFirstTries?: number;
  twoPlusTries?: number;
  secondTries?: number;
  thirdTries?: number;
  odds?: {
    ats: number;
    fts: number;
    lts: number;
    fts2h: number;
    twoPlusTries: number;
  };
  // AFL specific stats
  position?: string;
  TotalGames?: number;
  Goals?: number;
  Disposals?: number;
  odds_goals?: number;
  odds_disposals?: number;
} 