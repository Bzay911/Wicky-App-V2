export interface ChatConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface ChatMessage {
  role: string;
  content: string;
  timestamp: string;
}

export interface ChatSession {
  createdAt: string;
  metadata: Record<string, any>;
  messages: ChatMessage[];
}

export interface PlayerStats {
  firstName: string;
  lastName: string;
  team: string;
  games: number;
  tries: number;
  firstTries: number;
  lastTries: number;
  secondHalfFirstTries: number;
  twoPlusTries: number;
  positions: Record<string, PositionalStats>;
  homeAway?: { home: number; away: number };
  defeats?: { games: number; percentage: number };
}

export interface PositionalStats {
  games: number;
  tries: number;
  firstTries: number;
  lastTries: number;
  secondHalfFirstTries: number;
  odds: {
    ats: number;
    fts: number;
    lts: number;
    fts2h: number;
  };
} 