import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import nrlPlayerPositional from "../assets/NRL_Player_Positional_odd_2025.json";
import nrlPlayerTries from "../assets/NRL_Player_tries_2025.json";
import { PlayerStats, PositionalStats } from "../types/chat";
// Import AFL data files directly
import { logger } from '../utils/logger';
// Import our storage utilities
import { clearOldCache, getData, removeData, storeData } from '../app/services/storage';

/**
 * Interface for NRL player data
 */
interface PlayerTryData {
  player_id: string | number;
  first_name: string;
  last_name: string;
  team_name: string;
  TotalGames: number | string;
  ACTUAL_GAMES_PLAYED?: number | string;
  TotalLtsPlayer: number | string;
  TotalFts2HPlayer: number | string;
  TotalFtsPlayer: number | string;
  TotalAtsPlayer: number | string;
  TotalTwoPlusTryPlayer: number | string;
  TotalSecondTryPlayer: number | string;
  TotalThirdTryPlayer: number | string;
  ATSODDS: number | string;
  FTSODDS: number | string;
  LTSODDS: number | string;
  FTS2HODDS: number | string;
  SecondTryODDS: number | string;
  ThirdTryODDS: number | string;
  TwoPlusTryODDS: number | string;
  ATS_Last_5_Games: number | string;
  ATS_Last_10_Games: number | string;
}

/**
 * Interface for NRL upcoming matchup data
 */
interface UpcomingMatchup {
  "Team Name": string;
  Matchup: string;
  "Player Name": string;
  Position?: string;
}

/**
 * Interface for home/away try scorer data
 */
interface HomeAwayTryScorer {
  player_id: string;
  full_name: string;
  team_name?: string;
  home_games: number;
  away_games: number;
  home_games_with_try: number;
  away_games_with_try: number;
  home_try_percentage: number;
  away_try_percentage: number;
}

/**
 * Interface for try scorers in defeats data
 */
interface TryScorerInDefeats {
  player_id: string;
  total_loss_games: number;
  loss_games_with_tries: number;
  full_name: string;
  loss_try_percentage: number;
}

/**
 * Interface for co-scoring summary data
 */
interface CoScoringData {
  primary_player: string;
  co_scorer: string;
  co_scoring_rate: number;
  primary_total_scored: number;
  primary_scoring_rate: number;
}

/**
 * Data cache interface
 */
interface DataCache {
  [key: string]: any;
  tries?: PlayerTryData[];
  positions?: any[];
  matchups?: UpcomingMatchup[];
  homeAway?: HomeAwayTryScorer[];
  defeats?: TryScorerInDefeats[];
  coScoring?: CoScoringData[];
  // AFL specific data
  afl_players?: AFLPlayerData[];
  afl_positions?: AFLPositionalData[];
  afl_homeAway?: AFLHomeAwayData[];
  afl_defeats?: AFLDefeatData[];
  afl_matchups?: UpcomingMatchup[];
}

/**
 * Interface for AFL player data
 */
interface AFLPlayerData {
  Player: string;
  Total_Games: number | string;
  Games_with_1_or_more_goals: number | string;
  Odds_1_or_more_goals: number | string;
  Games_with_2_or_more_goals: number | string;
  Odds_2_or_more_goals: number | string;
  Games_with_3_or_more_goals: number | string;
  Odds_3_or_more_goals: number | string;
  Games_with_15_or_more_disposals: number | string;
  Odds_15_or_more_disposals: number | string;
  Games_with_20_or_more_disposals: number | string;
  Odds_20_or_more_disposals: number | string;
  Games_with_30_or_more_disposals: number | string;
  Odds_30_or_more_disposals: number | string;
  FGS_count: number | string;
  FGS_odds: number | string;
  Goals_Last_5_Games: number | string;
  Goals_Last_10_Games: number | string;
  Disposals_Last_5_Games: number | string;
  Disposals_Last_10_Games: number | string;
}

/**
 * Interface for AFL positional data
 */
interface AFLPositionalData {
  Player: string;
  full_name: string;
  position: string;
  Total_Games: number | string;
  Games_with_1_or_more_goals: number | string;
  Games_with_2_or_more_goals: number | string;
  Games_with_3_or_more_goals: number | string;
  Games_with_15_or_more_disposals: number | string;
  Games_with_20_or_more_disposals: number | string;
  Games_with_30_or_more_disposals: number | string;
  Odds_1_or_more_goals: number | string;
  Odds_2_or_more_goals: number | string;
  Odds_3_or_more_goals: number | string;
  Odds_15_or_more_disposals: number | string;
  Odds_20_or_more_disposals: number | string;
  Odds_30_or_more_disposals: number | string;
  Goals_Last_5_Games: number | string;
  Goals_Last_10_Games: number | string;
  Disposals_Last_5_Games: number | string;
  Disposals_Last_10_Games: number | string;
}

/**
 * Interface for AFL home/away data
 */
interface AFLHomeAwayData {
  full_name: string;
  home_games: number | string;
  away_games: number | string;
  home_games_with_goals: number | string;
  away_games_with_goals: number | string;
  home_goal_percentage: number | string;
  away_goal_percentage: number | string;
}

/**
 * Interface for AFL defeat data
 */
interface AFLDefeatData {
  full_name: string;
  total_loss_games: number | string;
  loss_games_with_goals: number | string;
  loss_goal_percentage: number | string;
}

interface AFLDataCache {
  [key: string]: any;
  afl_players?: AFLPlayerData[];
  afl_positions?: AFLPositionalData[];
  afl_matchups?: UpcomingMatchup[];
  afl_homeAway?: AFLHomeAwayData[];
  afl_defeats?: AFLDefeatData[];
}

/**
 * Data processor class for handling NRL statistics
 */
export class DataProcessor {
  private baseDir: string;
  private assetsDir: string;
  private dataCache: DataCache;
  private readonly CACHE_KEY = "@nrl_data_cache";
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  /**
   * Constructor for DataProcessor
   * @param baseDir Base directory for file operations
   */
  constructor(baseDir?: string) {
    this.baseDir = baseDir || FileSystem.documentDirectory || "";
    this.assetsDir = `${this.baseDir}assets/`;
    this.dataCache = {};
    // Start initialization but don't await it in constructor
    this.initializationPromise = this.initializeData();
  }

  /**
   * Ensure data is initialized before accessing
   * @returns Promise that resolves when data is ready
   */
  public async ensureInitialized(): Promise<void> {
    console.log("Ensuring data is initialized, current status:", this.isInitialized);
    if (this.isInitialized) return;

    if (this.initializationPromise) {
      await this.initializationPromise;
    } else {
      this.initializationPromise = this.initializeData();
      await this.initializationPromise;
    }
  }

  /**
   * Initialize NRL data
   */
  private async initializeData(): Promise<void> {
    try {
      console.log("Starting data initialization...");
      
      // Try to load from AsyncStorage first
      let loadedFromCache = false;
      try {
        const cachedData = await this.loadFromAsyncStorage();
        if (cachedData) {
          console.log("Data loaded from AsyncStorage cache");
          // Validate that the cache contains actual data before using it
          if (
            cachedData &&
            cachedData.tries &&
            Array.isArray(cachedData.tries) &&
            cachedData.tries.length > 0 &&
            cachedData.positions &&
            Array.isArray(cachedData.positions) &&
            cachedData.positions.length > 0
          ) {
            this.dataCache = cachedData;
            
            // Ensure AFL data is properly initialized
            if (!this.dataCache.afl_players || !Array.isArray(this.dataCache.afl_players)) {
              console.log("AFL players data is missing or invalid in cache, will initialize");
              this.dataCache.afl_players = [];
            }
            
            if (!this.dataCache.afl_positions || !Array.isArray(this.dataCache.afl_positions)) {
              console.log("AFL positions data is missing or invalid in cache, will initialize");
              this.dataCache.afl_positions = [];
            }
            
            if (!this.dataCache.afl_homeAway || !Array.isArray(this.dataCache.afl_homeAway)) {
              console.log("AFL home/away data is missing or invalid in cache, will initialize");
              this.dataCache.afl_homeAway = [];
            }
            
            if (!this.dataCache.afl_defeats || !Array.isArray(this.dataCache.afl_defeats)) {
              console.log("AFL defeats data is missing or invalid in cache, will initialize");
              this.dataCache.afl_defeats = [];
            }
            
            if (!this.dataCache.afl_matchups || !Array.isArray(this.dataCache.afl_matchups)) {
              console.log("AFL matchups data is missing or invalid in cache, will initialize");
              this.dataCache.afl_matchups = [];
            }
            
            loadedFromCache = true;
            console.log(`Successfully loaded from cache: ${cachedData.tries.length} try records, ${cachedData.positions.length} position records`);
          } else {
            console.log("Cache data is invalid or empty, will load from imports");
          }
        } else {
          console.log("No data found in AsyncStorage cache, loading from imports");
        }
      } catch (cacheError) {
        console.error("Error loading from AsyncStorage:", cacheError);
      }

      // If not loaded from cache, load from direct imports
      if (!loadedFromCache) {
        try {
          console.log("Loading data from direct imports...");
          
          // Helper function to safely load JSON
          const safelyLoadJSON = (jsonData: any, label: string): any[] => {
            try {
              if (!jsonData) {
                console.error(`${label} import is undefined`);
                return [];
              }
              
              if (!Array.isArray(jsonData)) {
                console.error(`${label} import is not an array`);
                return [];
              }
              
              if (jsonData.length === 0) {
                console.error(`${label} import is empty`);
                return [];
              }
              
              console.log(`Successfully loaded ${label}: ${jsonData.length} entries`);
              return jsonData;
            } catch (error) {
              console.error(`Error processing ${label}:`, error);
              return [];
            }
          };
          
          // Load NRL data from direct imports
          const tryData = safelyLoadJSON(nrlPlayerTries, "NRL try data");
          const posData = safelyLoadJSON(nrlPlayerPositional, "NRL positional data");

          if (tryData.length === 0) {
            console.error("NRL try data import is empty or invalid");
            throw new Error("NRL try data import is empty or invalid");
          }
          
          if (posData.length === 0) {
            console.error("NRL positional data import is empty or invalid");
            throw new Error("NRL positional data import is empty or invalid");
          }

          // Store the NRL datasets in cache
          this.dataCache = {
            tries: tryData,
            positions: posData,
          };

          console.log("NRL data loaded successfully from imports. Cache populated with:", 
            `${this.dataCache.tries ? this.dataCache.tries.length : 0} try records,`,
            `${this.dataCache.positions ? this.dataCache.positions.length : 0} position records`);

          // Initialize AFL data
          await this.initializeAFLData();

          // Save to AsyncStorage
          await this.saveToCache();
        } catch (error) {
          console.error("Error loading from imports:", error);
          throw error;
        }
      }

      // Set initialization flag
      this.isInitialized = true;
      console.log("Data initialization completed successfully");
    } catch (error) {
      console.error("Fatal error during data initialization:", error);
      // Create empty cache so app doesn't crash but make sure we know it's empty
      this.dataCache = { 
        tries: [], 
        positions: [],
        afl_players: [],
        afl_positions: [],
        afl_homeAway: [],
        afl_defeats: [],
        afl_matchups: []
      };
      this.isInitialized = false; // Mark as not initialized so we can try again later
    }
  }

  /**
   * Get player statistics by name
   * @param playerName Player's full name
   * @returns Player statistics or null if not found
   */
  async getPlayerStats(playerName: string): Promise<PlayerStats | null> {
    // Ensure data is loaded before proceeding
    await this.ensureInitialized();
    console.log("Getting stats for player:", playerName);

    try {
      if (!this.dataCache.tries || this.dataCache.tries.length === 0) {
        return null;
      }
      console.log("Player name:", playerName);
      const [firstName, lastName] = playerName.split(" ");
      let playerData: PlayerTryData | undefined;
      console.log(`firstName: ${firstName}, lastName: ${lastName}`);

      // Try exact match first
      playerData = this.dataCache.tries.find(
        (p: PlayerTryData) =>
          p.first_name.toLowerCase() === firstName.toLowerCase() &&
          p.last_name.toLowerCase() === lastName.toLowerCase()
      );

      // If no exact match, try case-insensitive match with contains
      if (!playerData) {
        playerData = this.dataCache.tries.find(
          (p: PlayerTryData) =>
            p.first_name.toLowerCase().includes(firstName.toLowerCase()) &&
            p.last_name.toLowerCase().includes(lastName.toLowerCase())
        );
      }

      // If still no match, try matching on either first or last name
      if (!playerData && playerName.indexOf(" ") === -1) {
        playerData = this.dataCache.tries.find(
          (p: PlayerTryData) =>
            p.first_name.toLowerCase() === playerName.toLowerCase() ||
            p.last_name.toLowerCase() === playerName.toLowerCase()
        );
      }

      if (!playerData) {
        return null;
      }
      console.log("I am here...)###################");

      // Helper function to parse values as numbers
      const parseNumeric = (value: string | number | undefined): number => {
        if (value === undefined || value === null) return 0;
        if (typeof value === 'number') return value;
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
      };

      // Create player stats object conforming to the PlayerStats interface
      const stats: PlayerStats = {
        name: `${playerData.first_name} ${playerData.last_name}`,
        gamesPlayed: parseNumeric(playerData.TotalGames),
        tries: parseNumeric(playerData.TotalAtsPlayer),
        firstTries: parseNumeric(playerData.TotalFtsPlayer),
        lastTries: parseNumeric(playerData.TotalLtsPlayer),
        secondHalfFirstTries: parseNumeric(playerData.TotalFts2HPlayer),
        twoPlusTries: parseNumeric(playerData.TotalTwoPlusTryPlayer),
        atsLast5Games: parseNumeric(playerData.ATS_Last_5_Games),
        atsLast10Games: parseNumeric(playerData.ATS_Last_10_Games),
        team: playerData.team_name || "Unknown Team",
        secondTries: parseNumeric(playerData.TotalSecondTryPlayer),
        thirdTries: parseNumeric(playerData.TotalThirdTryPlayer),
      };
      console.log("stats", stats);

      // Add positions
      const positions = await this.getPositionalStats(playerName);
      if (Object.keys(positions).length > 0) {
        stats.positions = positions;
      }

      return stats;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get position-specific statistics for a player
   * @param playerName Player's full name
   * @returns Record of position-specific statistics
   */
  private async getPositionalStats(
    playerName: string
  ): Promise<Record<string, PositionalStats>> {
    // Ensure data is loaded
    await this.ensureInitialized();

    try {
      if (!this.dataCache.positions || this.dataCache.positions.length === 0) {
        return {};
      }

      const result: Record<string, PositionalStats> = {};
      const positionsData = this.dataCache.positions;

      // Get all position data for this player
      const playerPositions = positionsData.filter((pos: any) => {
        if (
          pos.full_name &&
          pos.full_name.toLowerCase() === playerName.toLowerCase()
        ) {
          return true;
        }
        if (pos.first_name && pos.last_name) {
          const fullName = `${pos.first_name} ${pos.last_name}`.toLowerCase();
          return fullName === playerName.toLowerCase();
        }
        return false;
      });

      if (playerPositions.length === 0) {
        return {};
      }

      // Helper function to parse values as numbers
      const parseValue = (val: any): number => {
        if (val === null || val === undefined || val === "") return 0;
        if (typeof val === 'number') return val;
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
      };

      // Group by position
      for (const pos of playerPositions) {
        if (!pos.position || pos.position === "N/A") continue;

        result[pos.position] = {
          gamesPlayed: parseValue(pos.POSITION_ACTUAL_GAMES),
          tries: parseValue(pos.ATS),
          firstTries: parseValue(pos.FTS),
          lastTries: parseValue(pos.LTS),
          secondHalfFirstTries: parseValue(pos.FTS2H),
          twoPlusTries: parseValue(pos.TWO_OR_MORE || 0),
          secondTries: parseValue(pos.SECOND_TRY || 0),
          thirdTries: parseValue(pos.THIRD_TRY || 0),
          odds: {
            ats: parseValue(pos.odds_ATS),
            fts: parseValue(pos.odds_FTS),
            lts: parseValue(pos.odds_LTS),
            fts2h: parseValue(pos.odds_FTS2H),
            twoPlusTries: parseValue(pos.odds_TWO_OR_MORE || pos.odds_2PLUS),
          },
        };
      }

      return result;
    } catch (error) {
      return {};
    }
  }

  /**
   * Get player's team from matchup data
   * @param playerName Player's full name
   * @returns Team name or "Unknown Team"
   */
  private getPlayerTeam(playerName: string): string {
    const matchup = this.dataCache.matchups?.find(
      (m: UpcomingMatchup) => m["Player Name"] === playerName
    );
    return matchup?.["Team Name"] || "Unknown Team";
  }

  /**
   * Get home/away statistics for a player
   * @param playerName Player's full name
   * @returns Home/away statistics or null if not found
   */
  private getHomeAwayStats(
    playerName: string
  ): {
    home: number;
    away: number;
    homeGames: number;
    awayGames: number;
  } | null {
    if (!this.dataCache.homeAway) {
      return null;
    }

    const stats = this.dataCache.homeAway.find(
      (p: HomeAwayTryScorer) =>
        p.full_name && p.full_name.toLowerCase() === playerName.toLowerCase()
    );

    if (!stats) {
      return null;
    }

    return {
      home: stats.home_try_percentage,
      away: stats.away_try_percentage,
      homeGames: stats.home_games,
      awayGames: stats.away_games,
    };
  }

  /**
   * Get try scoring in defeats statistics for a player
   * @param playerName Player's full name
   * @returns Defeat statistics or null if not found
   */
  private getDefeatStats(
    playerName: string
  ): { games: number; percentage: number } | null {
    if (!this.dataCache.defeats) {
      return null;
    }

    const stats = this.dataCache.defeats.find(
      (p: TryScorerInDefeats) =>
        p.full_name && p.full_name.toLowerCase() === playerName.toLowerCase()
    );

    if (!stats) {
      return null;
    }

    return {
      games:
        typeof stats.total_loss_games === "string"
          ? parseInt(stats.total_loss_games)
          : stats.total_loss_games,
      percentage:
        typeof stats.loss_try_percentage === "string"
          ? parseFloat(stats.loss_try_percentage)
          : stats.loss_try_percentage,
    };
  }

  /**
   * Get matchups for a sport
   * @param sport Sport name (only 'nrl' is supported currently)
   * @returns Array of matchup strings
   */
  getMatchups(sport: string): string[] {
    if (sport.toLowerCase() !== "nrl" || !this.dataCache.matchups) {
      return [];
    }

    const matchups = new Set<string>();
    this.dataCache.matchups.forEach((match: UpcomingMatchup) => {
      if (match.Matchup) {
        matchups.add(match.Matchup);
      }
    });

    return Array.from(matchups);
  }

  /**
   * Get players for a specific matchup
   * @param sport Sport name (only 'nrl' is supported currently)
   * @param matchup Matchup string (e.g. "Team A vs Team B")
   * @returns Record of team name to array of player names
   */
  getPlayersForMatchup(
    sport: string,
    matchup: string
  ): Record<string, string[]> {
    if (sport.toLowerCase() !== "nrl" || !this.dataCache.matchups) {
      return {};
    }

    const matchupData = this.dataCache.matchups.filter(
      (m: UpcomingMatchup) => m.Matchup === matchup
    );

    if (matchupData.length === 0) {
      return {};
    }

    const result: Record<string, string[]> = {};
    matchupData.forEach((match: UpcomingMatchup) => {
      const team = match["Team Name"];
      const player = match["Player Name"];

      if (!result[team]) {
        result[team] = [];
      }

      if (player && !result[team].includes(player)) {
        result[team].push(player);
      }
    });

    return result;
  }

  /**
   * Save data to AsyncStorage in chunks to avoid Android's CursorWindow size limitation
   */
  private async saveToCache(): Promise<void> {
    try {
      console.log("Saving data to AsyncStorage cache");
      // Use our chunked storage system
      await storeData(this.CACHE_KEY, this.dataCache);
      console.log("Successfully saved to storage cache using chunked storage");
    } catch (error) {
      console.error("Error saving data cache to AsyncStorage:", error);
    }
  }

  /**
   * Load chunked data from AsyncStorage
   */
  private async loadFromAsyncStorage(): Promise<DataCache | null> {
    try {
      // Load using our chunked storage system
      const cachedData = await getData(this.CACHE_KEY);
      if (cachedData) {
        console.log("Found data in storage cache using chunked storage");
        return cachedData;
      }
      
      console.log("No data found in storage cache");
      return null;
    } catch (error) {
      console.error("Error loading from AsyncStorage:", error);
      return null;
    }
  }

  /**
   * Clear cache including all chunks
   */
  async clearCache(): Promise<void> {
    try {
      // Use our removeData utility to handle chunked data deletion
      await removeData(this.CACHE_KEY);
      
      this.dataCache = {};
      console.log("Cache cleared successfully");
      
      // Also clear old caches that might be taking up space
      await clearOldCache();
    } catch (error) {
      console.error("Error clearing cache:", error);
    }
  }

  /**
   * Force reload data, bypassing the cache
   * @returns Promise that resolves when reload is complete
   */
  public async forceReload(): Promise<void> {
    try {
      console.log("Force reloading data...");
      // Clear cache
      this.dataCache = {};
      await AsyncStorage.removeItem(this.CACHE_KEY);
      
      // Load NRL data from imports directly
      const tryData = nrlPlayerTries;
      const posData = nrlPlayerPositional;
      
      // Store the NRL datasets in cache
      this.dataCache = {
        tries: tryData,
        positions: posData,
      };
      
      // Initialize AFL data
      await this.initializeAFLData();
      
      // Save to AsyncStorage
      await this.saveToCache();
      
      this.isInitialized = true;
      console.log("Force reload completed successfully");
    } catch (error) {
      console.error("Error during force reload:", error);
      throw error;
    }
  }

  /**
   * Completely resets the data by clearing cache and reloading from imports
   * Use this if you suspect there's an issue with the cached data
   */
  public async resetDataCompletely(): Promise<string> {
    try {
      console.log("Starting complete data reset...");
      
      // Clear AsyncStorage cache
      await AsyncStorage.removeItem(this.CACHE_KEY);
      console.log("AsyncStorage cache cleared");
      
      // Reset initialization flags
      this.isInitialized = false;
      this.dataCache = {};
      
      // Load NRL data directly from imports
      const tryData = nrlPlayerTries;
      const posData = nrlPlayerPositional;
      
      if (!tryData || tryData.length === 0) {
        return "Reset failed: NRL try data import is empty or invalid";
      }
      
      if (!posData || posData.length === 0) {
        return "Reset failed: NRL positional data import is empty or invalid";
      }
      
      // Store NRL data in cache
      this.dataCache = {
        tries: tryData,
        positions: posData,
      };
      
      // Initialize AFL data
      await this.initializeAFLData();
      
      // Save to AsyncStorage
      await this.saveToCache();
      
      // Set as initialized
      this.isInitialized = true;
      
      console.log("Data reset and reload completed successfully");
      
      // Check if reset was successful
      if (
        this.isInitialized && 
        this.dataCache.tries && 
        this.dataCache.tries.length > 0 &&
        this.dataCache.positions &&
        this.dataCache.positions.length > 0 &&
        this.dataCache.afl_players &&
        this.dataCache.afl_players.length > 0
      ) {
        return "Data reset and reload successful! Data is now available.";
      } else {
        return "Data reset completed, but reload still failed. Check logs for details.";
      }
    } catch (error) {
      console.error("Error during complete data reset:", error);
      return `Error during data reset: ${error}`;
    }
  }
  
  /**
   * Debug method to check data status
   * @returns Promise<string> Debug information
   */
  public async debugDataStatus(): Promise<string> {
    try {
      let debugInfo = "";
      
      // Check imports
      debugInfo += "Direct imports status:\n";
      debugInfo += `Try data import: ${nrlPlayerTries ? nrlPlayerTries.length : 0} entries\n`;
      debugInfo += `Positional data import: ${nrlPlayerPositional ? nrlPlayerPositional.length : 0} entries\n\n`;
      
      // Check cache status
      debugInfo += `Cache status:\n`;
      debugInfo += `initialized: ${this.isInitialized}\n`;
      debugInfo += `tries: ${this.dataCache.tries ? this.dataCache.tries.length : 0} items\n`;
      debugInfo += `positions: ${this.dataCache.positions ? this.dataCache.positions.length : 0} items\n`;
      
      // Check AsyncStorage
      try {
        const cachedData = await AsyncStorage.getItem(this.CACHE_KEY);
        debugInfo += `\nAsyncStorage cache:\n`;
        debugInfo += `Exists: ${cachedData !== null}\n`;
        debugInfo += `Size: ${cachedData ? cachedData.length : 0} characters\n`;
      } catch (error) {
        debugInfo += `Error checking AsyncStorage: ${error}\n`;
      }
      
      return debugInfo;
    } catch (error) {
      return `Error in debugDataStatus: ${error}`;
    }
  }

  private async loadJSONFile<T>(filePath: string): Promise<T | null> {
    try {
      // First try to load from assets directory
      const assetsPath = `${this.assetsDir}${filePath}`;
      logger.info(`Attempting to load JSON file from assets: ${assetsPath}`);
      
      const fileInfo = await FileSystem.getInfoAsync(assetsPath);
      if (fileInfo.exists) {
        const fileContent = await FileSystem.readAsStringAsync(assetsPath);
        logger.info(`Successfully loaded file from assets: ${filePath}`);
        return JSON.parse(fileContent) as T;
      }
      
      // If not found in assets, try base directory
      const basePath = `${this.baseDir}${filePath}`;
      logger.info(`Attempting to load JSON file from base directory: ${basePath}`);
      
      const baseFileInfo = await FileSystem.getInfoAsync(basePath);
      if (baseFileInfo.exists) {
        const fileContent = await FileSystem.readAsStringAsync(basePath);
        logger.info(`Successfully loaded file from base directory: ${filePath}`);
        return JSON.parse(fileContent) as T;
      }
      
      logger.error(`File not found in either assets or base directory: ${filePath}`);
      return null;
    } catch (error) {
      logger.error(`Error loading JSON file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Initialize AFL data
   */
  private async initializeAFLData(): Promise<void> {
    try {
      // Helper function to parse values as numbers
      const parseNumeric = (value: any): number => {
        if (value === undefined || value === null || value === "") return 0;
        if (typeof value === 'number') return value;
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
      };
      
      // Helper function to safely load JSON
      const safelyLoadJSON = (path: string, defaultValue: any = []) => {
        try {
          // Use static imports based on the path
          if (path === '../assets/afl/AFL_player_summary_with_odds.json') {
            return require('../assets/afl/AFL_player_summary_with_odds.json');
          } else if (path === '../assets/afl/AFL_Goalscorers_in_Defeats.json') {
            return require('../assets/afl/AFL_Goalscorers_in_Defeats.json');
          } else if (path === '../assets/afl/AFL_Home_Away_Goalscorers.json') {
            return require('../assets/afl/AFL_Home_Away_Goalscorers.json');
          } else if (path === '../assets/afl/AFL_Upcoming_Matchup.json') {
            return require('../assets/afl/AFL_Upcoming_Matchup.json');
          } else {
            logger.error(`Unsupported file path: ${path}`);
            return defaultValue;
          }
        } catch (error) {
          logger.error(`Error loading file from ${path}:`, error);
          return defaultValue;
        }
      };
      
      // Load AFL player summary with odds
      let aflPlayerSummaryWithOdds;
      try {
        aflPlayerSummaryWithOdds = safelyLoadJSON('../assets/afl/AFL_player_summary_with_odds.json');
        logger.info(`Loaded AFL player summary with odds: ${aflPlayerSummaryWithOdds ? aflPlayerSummaryWithOdds.length : 0} entries`);
      } catch (error) {
        logger.error('Error loading AFL player summary:', error);
        aflPlayerSummaryWithOdds = [];
      }
      
      // Transform the data to match our interface
      this.dataCache.afl_players = aflPlayerSummaryWithOdds.map((player: any) => ({
        Player: player.Player,
        Total_Games: parseNumeric(player.Total_Games),
        Games_with_1_or_more_goals: parseNumeric(player.Games_with_1_or_more_goals),
        Odds_1_or_more_goals: parseNumeric(player.Odds_1_or_more_goals),
        Games_with_2_or_more_goals: parseNumeric(player.Games_with_2_or_more_goals),
        Odds_2_or_more_goals: parseNumeric(player.Odds_2_or_more_goals),
        Games_with_3_or_more_goals: parseNumeric(player.Games_with_3_or_more_goals),
        Odds_3_or_more_goals: parseNumeric(player.Odds_3_or_more_goals),
        Games_with_15_or_more_disposals: parseNumeric(player.Games_with_15_or_more_disposals),
        Odds_15_or_more_disposals: parseNumeric(player.Odds_15_or_more_disposals),
        Games_with_20_or_more_disposals: parseNumeric(player.Games_with_20_or_more_disposals),
        Odds_20_or_more_disposals: parseNumeric(player.Odds_20_or_more_disposals),
        Games_with_30_or_more_disposals: parseNumeric(player.Games_with_30_or_more_disposals),
        Odds_30_or_more_disposals: parseNumeric(player.Odds_30_or_more_disposals),
        FGS_count: parseNumeric(player.FGS_count),
        FGS_odds: parseNumeric(player.FGS_odds),
        Goals_Last_5_Games: parseNumeric(player.Goals_Last_5_Games),
        Goals_Last_10_Games: parseNumeric(player.Goals_Last_10_Games),
        Disposals_Last_5_Games: parseNumeric(player.Disposals_Last_5_Games),
        Disposals_Last_10_Games: parseNumeric(player.Disposals_Last_10_Games)
      }));

      // Load other AFL data with safe loading
      try {
        this.dataCache.afl_defeats = safelyLoadJSON('../assets/afl/AFL_Goalscorers_in_Defeats.json');
        this.dataCache.afl_homeAway = safelyLoadJSON('../assets/afl/AFL_Home_Away_Goalscorers.json');
        this.dataCache.afl_matchups = safelyLoadJSON('../assets/afl/AFL_Upcoming_Matchup.json');
        
        logger.info('AFL data initialized successfully');
        logger.info(`AFL data counts - Players: ${this.dataCache.afl_players?.length || 0}, Defeats: ${this.dataCache.afl_defeats?.length || 0}, Home/Away: ${this.dataCache.afl_homeAway?.length || 0}, Matchups: ${this.dataCache.afl_matchups?.length || 0}`);
      } catch (error) {
        logger.error('Error loading additional AFL data:', error);
        // Ensure we have default values
        this.dataCache.afl_defeats = this.dataCache.afl_defeats || [];
        this.dataCache.afl_homeAway = this.dataCache.afl_homeAway || [];
        this.dataCache.afl_matchups = this.dataCache.afl_matchups || [];
      }
    } catch (error) {
      logger.error('Error initializing AFL data:', error);
      // Set default empty arrays if data loading fails
      this.dataCache.afl_players = [];
      this.dataCache.afl_defeats = [];
      this.dataCache.afl_homeAway = [];
      this.dataCache.afl_matchups = [];
    }
  }

  async getAFLPlayerStats(playerName: string): Promise<AFLPlayerData | null> {
    await this.ensureInitialized();
    const players = this.dataCache.afl_players as AFLPlayerData[];
    if (!players || !Array.isArray(players)) {
      logger.error('AFL players data is undefined or not an array');
      return null;
    }
    
    // Try exact match first (case-insensitive)
    let player = players.find((p: AFLPlayerData) => 
      p.Player.toLowerCase() === playerName.toLowerCase()
    );
    
    // If no exact match, try partial match
    if (!player) {
      player = players.find((p: AFLPlayerData) => 
        p.Player.toLowerCase().includes(playerName.toLowerCase()) ||
        playerName.toLowerCase().includes(p.Player.toLowerCase())
      );
    }
    
    // If still no match, try matching on first or last name
    if (!player) {
      const nameParts = playerName.split(' ');
      if (nameParts.length > 0) {
        player = players.find((p: AFLPlayerData) => {
          const playerNameParts = p.Player.split(' ');
          return playerNameParts.some(part => 
            nameParts.some(namePart => 
              part.toLowerCase() === namePart.toLowerCase()
            )
          );
        });
      }
    }
    
    return player || null;
  }

  async getAFLPositionalStats(playerName: string): Promise<Record<string, AFLPositionalData>> {
    await this.ensureInitialized();
    const positions = this.dataCache.afl_positions as AFLPositionalData[];
    if (!positions || !Array.isArray(positions)) {
      logger.error('AFL positions data is undefined or not an array');
      return {};
    }
    
    // Find all position data for this player using flexible matching
    const playerPositions = positions.filter((pos: AFLPositionalData) => {
      // Try exact match first (case-insensitive)
      if (pos.full_name && pos.full_name.toLowerCase() === playerName.toLowerCase()) {
        return true;
      }
      
      // Try partial match
      if (pos.full_name && (
        pos.full_name.toLowerCase().includes(playerName.toLowerCase()) ||
        playerName.toLowerCase().includes(pos.full_name.toLowerCase())
      )) {
        return true;
      }
      
      // Try matching on first or last name
      if (pos.full_name) {
        const nameParts = playerName.split(' ');
        const playerNameParts = pos.full_name.split(' ');
        if (nameParts.length > 0 && playerNameParts.some(part => 
          nameParts.some(namePart => part.toLowerCase() === namePart.toLowerCase())
        )) {
          return true;
        }
      }
      
      return false;
    });
    
    // Group by position
    return playerPositions.reduce((acc: Record<string, AFLPositionalData>, pos: AFLPositionalData) => {
      if (pos.position) {
        acc[pos.position] = pos;
      }
      return acc;
    }, {});
  }

  async getAFLHomeAwayStats(playerName: string): Promise<AFLHomeAwayData | null> {
    await this.ensureInitialized();
    const homeAway = this.dataCache.afl_homeAway as AFLHomeAwayData[];
    if (!homeAway || !Array.isArray(homeAway)) {
      logger.error('AFL home/away data is undefined or not an array');
      return null;
    }
    
    // Try exact match first (case-insensitive)
    let stats = homeAway.find((p: AFLHomeAwayData) => 
      p.full_name && p.full_name.toLowerCase() === playerName.toLowerCase()
    );
    
    // If no exact match, try partial match
    if (!stats) {
      stats = homeAway.find((p: AFLHomeAwayData) => 
        p.full_name && (
          p.full_name.toLowerCase().includes(playerName.toLowerCase()) ||
          playerName.toLowerCase().includes(p.full_name.toLowerCase())
        )
      );
    }
    
    // If still no match, try matching on first or last name
    if (!stats) {
      const nameParts = playerName.split(' ');
      if (nameParts.length > 0) {
        stats = homeAway.find((p: AFLHomeAwayData) => {
          if (!p.full_name) return false;
          const playerNameParts = p.full_name.split(' ');
          return playerNameParts.some(part => 
            nameParts.some(namePart => part.toLowerCase() === namePart.toLowerCase())
          );
        });
      }
    }
    
    return stats || null;
  }

  async getAFLDefeatStats(playerName: string): Promise<AFLDefeatData | null> {
    await this.ensureInitialized();
    const defeats = this.dataCache.afl_defeats as AFLDefeatData[];
    if (!defeats || !Array.isArray(defeats)) {
      logger.error('AFL defeats data is undefined or not an array');
      return null;
    }
    
    // Try exact match first (case-insensitive)
    let stats = defeats.find((p: AFLDefeatData) => 
      p.full_name && p.full_name.toLowerCase() === playerName.toLowerCase()
    );
    
    // If no exact match, try partial match
    if (!stats) {
      stats = defeats.find((p: AFLDefeatData) => 
        p.full_name && (
          p.full_name.toLowerCase().includes(playerName.toLowerCase()) ||
          playerName.toLowerCase().includes(p.full_name.toLowerCase())
        )
      );
    }
    
    // If still no match, try matching on first or last name
    if (!stats) {
      const nameParts = playerName.split(' ');
      if (nameParts.length > 0) {
        stats = defeats.find((p: AFLDefeatData) => {
          if (!p.full_name) return false;
          const playerNameParts = p.full_name.split(' ');
          return playerNameParts.some(part => 
            nameParts.some(namePart => part.toLowerCase() === namePart.toLowerCase())
          );
        });
      }
    }
    
    return stats || null;
  }

  /**
   * Get AFL player summary data
   * @param playerName The name of the player to get summary data for
   * @returns A dictionary of player statistics
   */
  getAFLPlayerSummary(playerName: string): Record<string, any> {
    if (!this.dataCache.afl_players || !Array.isArray(this.dataCache.afl_players)) {
      console.warn('AFL players data is not available');
      return {};
    }

    // Find the player in the summary data
    const player = this.dataCache.afl_players.find(p => 
      p.Player.toLowerCase() === playerName.toLowerCase() ||
      p.Player.toLowerCase().includes(playerName.toLowerCase())
    );

    if (!player) {
      console.warn(`Player ${playerName} not found in AFL player summary data`);
      return {};
    }

    // Construct the statistics dictionary
    const stats: Record<string, any> = {
      total_games: player.Total_Games,
      goals: {
        games_with_1_or_more: player.Games_with_1_or_more_goals,
        games_with_2_or_more: player.Games_with_2_or_more_goals,
        games_with_3_or_more: player.Games_with_3_or_more_goals,
        odds: {
          one_or_more: player.Odds_1_or_more_goals,
          two_or_more: player.Odds_2_or_more_goals,
          three_or_more: player.Odds_3_or_more_goals
        }
      },
      disposals: {
        games_with_15_or_more: player.Games_with_15_or_more_disposals,
        games_with_20_or_more: player.Games_with_20_or_more_disposals,
        games_with_30_or_more: player.Games_with_30_or_more_disposals,
        odds: {
          fifteen_or_more: player.Odds_15_or_more_disposals,
          twenty_or_more: player.Odds_20_or_more_disposals,
          thirty_or_more: player.Odds_30_or_more_disposals
        }
      },
      // First Goal Scorer (FGS) data
      fgs: {
        count: player.FGS_count,
        odds: player.FGS_odds
      }
    };

    return stats;
  }
}
