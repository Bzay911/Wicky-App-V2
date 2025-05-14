import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import storeData, { getData, removeData } from '../app/services/storage';
import { ChatMessage, ChatSession } from '../types';
import { logger } from '../utils/logger';

/**
 * Manages chat sessions and message history
 * Provides methods to create, update, and retrieve chat sessions
 */
export class ChatHistoryManager {
  private storageDir: string;
  private sessions: Record<string, ChatSession>;
  private readonly STORAGE_KEY = '@chat_sessions';
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize chat history manager
   * Sets up storage directory and loads existing sessions
   */
  constructor(storageDir?: string) {
    this.storageDir = storageDir || `${FileSystem.documentDirectory}chat_history/`;
    this.sessions = {};
    this.initPromise = this.initializeStorage();
  }

  /**
   * Ensure storage is initialized before performing operations
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    
    if (this.initPromise) {
      await this.initPromise;
    } else {
      this.initPromise = this.initializeStorage();
      await this.initPromise;
    }
  }

  /**
   * Initialize storage directory and load existing sessions
   */
  private async initializeStorage(): Promise<void> {
    try {
      // Set initialization timeout to prevent UI hanging
      const initTimeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          logger.warn('Chat history initialization timeout reached');
          this.isInitialized = true;
          resolve();
        }, 5000); // 5 second timeout
      });
      
      // Create storage directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(this.storageDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.storageDir, { intermediates: true });
      }
      
      // Use Promise.race to implement timeout
      await Promise.race([
        // Actual initialization logic
        (async () => {
          try {
            // Load sessions using chunked storage
            const storedSessions = await getData(this.STORAGE_KEY);
            if (storedSessions) {
              this.sessions = storedSessions;
              logger.info(`Loaded ${Object.keys(this.sessions).length} chat sessions`);
            } else {
              // On Android, try simpler approach if initial load fails
              if (Platform.OS === 'android') {
                const legacyData = await AsyncStorage.getItem(this.STORAGE_KEY);
                if (legacyData) {
                  try {
                    this.sessions = JSON.parse(legacyData);
                    logger.info(`Loaded ${Object.keys(this.sessions).length} chat sessions from legacy storage`);
                  } catch (parseError) {
                    logger.error('Error parsing legacy sessions:', parseError);
                    this.sessions = {};
                  }
                } else {
                  this.sessions = {};
                }
              } else {
                this.sessions = {};
              }
            }
            
            // Perform cleanup if needed
            if (Platform.OS === 'android') {
              await this.cleanupOldSessions();
            }
            
            this.isInitialized = true;
            logger.info('Chat history storage initialized');
          } catch (error) {
            logger.error('Error during chat history initialization:', error);
            // Initialize with empty sessions to allow app to continue
            this.sessions = {};
            this.isInitialized = true;
          }
        })(),
        initTimeoutPromise
      ]);
    } catch (error) {
      logger.error('Fatal error in chat history initialization:', error);
      // Always ensure we mark initialization as complete
      this.isInitialized = true;
      this.sessions = {};
    }
  }

  /**
   * Clean up old sessions to prevent storage issues
   */
  private async cleanupOldSessions(): Promise<void> {
    try {
      const maxSessions = 20; // Keep only the 20 most recent sessions
      const sessionIds = Object.keys(this.sessions);
      
      if (sessionIds.length <= maxSessions) return;
      
      // Sort sessions by creation date
      const sortedSessions = sessionIds
        .map(id => ({ id, createdAt: this.sessions[id].createdAt }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Keep only the most recent sessions
      const sessionsToKeep = sortedSessions.slice(0, maxSessions);
      const sessionsToRemove = sortedSessions.slice(maxSessions);
      
      // Create new sessions object with only the kept sessions
      const newSessions: Record<string, ChatSession> = {};
      sessionsToKeep.forEach(session => {
        newSessions[session.id] = this.sessions[session.id];
      });
      
      this.sessions = newSessions;
      
      // Log the cleanup
      logger.info(`Cleaned up ${sessionsToRemove.length} old chat sessions`);
    } catch (error) {
      logger.error('Error cleaning up old sessions:', error);
    }
  }

  /**
   * Create a new chat session
   * @param sessionId Unique identifier for the session
   * @param metadata Optional metadata for the session
   * @returns Success status
   */
  async createSession(sessionId: string, metadata?: Record<string, any>): Promise<boolean> {
    try {
      await this.ensureInitialized();
      
      if (this.sessions[sessionId]) {
        logger.warn(`Session ${sessionId} already exists`);
        return false;
      }

      this.sessions[sessionId] = {
        createdAt: new Date().toISOString(),
        metadata: metadata || {},
        messages: []
      };

      await this.saveSession(sessionId);
      logger.info(`Created new session: ${sessionId}`);
      return true;
    } catch (error) {
      logger.error('Error creating session:', error);
      return false;
    }
  }

  /**
   * Get a chat session by ID
   * @param sessionId Session ID
   * @returns Chat session or null if not found
   */
  async getSession(sessionId: string): Promise<ChatSession | null> {
    try {
      await this.ensureInitialized();
      return this.sessions[sessionId] || null;
    } catch (error) {
      logger.error('Error getting session:', error);
      return null;
    }
  }

  /**
   * Get all messages for a session
   * @param sessionId Session ID
   * @returns Array of chat messages
   */
  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    try {
      await this.ensureInitialized();
      return this.sessions[sessionId]?.messages || [];
    } catch (error) {
      logger.error('Error getting messages:', error);
      return [];
    }
  }

  /**
   * Add a message to a chat session
   * @param sessionId Session ID
   * @param role Message role (user, assistant, system)
   * @param content Message content
   * @returns Success status
   */
  async addMessage(sessionId: string, role: 'user' | 'assistant' | 'system', content: string): Promise<boolean> {
    try {
      await this.ensureInitialized();
      
      if (!this.sessions[sessionId]) {
        logger.warn(`Session ${sessionId} not found`);
        return false;
      }

      const message: ChatMessage = {
        role,
        content,
        timestamp: new Date().toISOString()
      };

      this.sessions[sessionId].messages.push(message);
      await this.saveSession(sessionId);
      return true;
    } catch (error) {
      logger.error('Error adding message:', error);
      return false;
    }
  }

  /**
   * Save session to persistent storage
   * @param sessionId Session ID
   */
  private async saveSession(sessionId: string): Promise<void> {
    try {
      // Save sessions using chunked storage
      await storeData(this.STORAGE_KEY, this.sessions);
    } catch (error) {
      logger.error('Error saving session:', error);
      
      // Platform-specific fallback for Android
      if (Platform.OS === 'android') {
        try {
          // Try saving just this session to file system
          const sessionFile = `${this.storageDir}${sessionId}.json`;
          await FileSystem.writeAsStringAsync(
            sessionFile,
            JSON.stringify(this.sessions[sessionId])
          );
          logger.info(`Session saved to filesystem: ${sessionFile}`);
        } catch (fsError) {
          logger.error('Filesystem fallback failed:', fsError);
        }
      }
    }
  }

  /**
   * Clear all sessions
   * @returns Success status
   */
  async clearAllSessions(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      this.sessions = {};
      await removeData(this.STORAGE_KEY);
      
      // Also clean up any files in the storage directory
      try {
        const files = await FileSystem.readDirectoryAsync(this.storageDir);
        const deletePromises = files.map(file => 
          FileSystem.deleteAsync(`${this.storageDir}${file}`, { idempotent: true }));
        await Promise.all(deletePromises);
      } catch (fsError) {
        logger.error('Error cleaning up session files:', fsError);
      }
      
      return true;
    } catch (error) {
      logger.error('Error clearing sessions:', error);
      return false;
    }
  }
} 