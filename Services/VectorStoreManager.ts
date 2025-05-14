import { OpenAIEmbeddings } from "@langchain/openai";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { logger } from '../utils/logger';
// Import NRL data files directly
import nrlPlayerPositional from "../assets/NRL_Player_Positional_odd_2025.json";
import nrlPlayerTries from "../assets/NRL_Player_tries_2025.json";
// Import AFL data files directly
import aflPlayerSummary from "../assets/afl/AFL_Co_Scoring_Summaries.json";
import aflDefeats from "../assets/afl/AFL_Goalscorers_in_Defeats.json";
import aflHomeAway from "../assets/afl/AFL_Home_Away_Goalscorers.json";
import aflMatchup from "../assets/afl/AFL_Upcoming_Matchup.json";
// Import storage utilities
import { clearOldCache, getData, removeData, storeData } from '../app/services/storage';

/**
 * Interface for documents stored in the vector store
 */
interface VectorDocument {
  text: string;
  metadata: Record<string, any>;
}

/**
 * Interface for product quantization codebook
 */
interface PQCodebook {
  centroids: number[][][]; // [subspace][centroid][dimension]
  assignments: number[][]; // [vector][subspace]
}

/**
 * Interface for the vector store data structure
 */
interface VectorStore {
  vectors: number[][];
  documents: VectorDocument[];
  pqCodebook?: PQCodebook;
}

/**
 * Manages vector stores for different sports
 * Handles initialization, caching, and searching of vector embeddings
 */
export class VectorStoreManager {
  private embeddings: OpenAIEmbeddings;
  private baseDir: string;
  private assetsDir: string;
  private stores: Record<string, VectorStore>;
  private readonly CACHE_PREFIX = 'vector_store_';
  private readonly PQ_SUBSPACES = 8; // Number of subspaces for PQ
  private readonly PQ_CENTROIDS = 256; // Number of centroids per subspace
  private embeddingHash: Record<string, string> = {};
  private indexHash: Record<string, string> = {};

  /**
   * Initialize the vector store manager
   * @param baseDir Optional base directory for files
   */
  constructor(baseDir?: string) {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
    });
    this.baseDir = baseDir || FileSystem.documentDirectory || '';
    this.assetsDir = `${FileSystem.documentDirectory}assets/`;
    this.stores = {};
    this.initializeStores();
  }

  /**
   * Initialize vector stores for all supported sports
   */
  private async initializeStores(): Promise<void> {
    try {
      // Initialize both NRL and AFL stores
      await this.initializeStore('nrl');
      await this.initializeStore('afl');
    } catch (error) {
      logger.error(`Error initializing stores: ${error}`);
    }
  }

  /**
   * Generate a hash from a string
   * @param str String to hash
   * @returns Hashed string
   */
  private async _generateHash(str: string): Promise<string> {
    const hash = await crypto.digestStringAsync(
      crypto.CryptoDigestAlgorithm.MD5,
      str
    );
    return hash;
  }

  /**
   * Calculate the hash of a file's contents
   * @param filePath Path to the file
   * @returns File hash
   */
  private async _getFileHash(filePath: string): Promise<string> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        throw new Error(`File not found: ${filePath}`);
      }
      const content = await FileSystem.readAsStringAsync(filePath);
      return this._generateHash(content);
    } catch (error) {
      logger.error(`Error getting file hash: ${error}`);
      throw error;
    }
  }

  /**
   * Load vector store from cache
   * @param sport Sport identifier
   * @param indexHash Hash of the source data
   * @returns Vector store or null if not in cache
   */
  private async _loadFromCache(sport: string, indexHash: string): Promise<VectorStore | null> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${sport}_${indexHash}`;
      // Use our chunked storage system instead of direct AsyncStorage
      const store = await getData(cacheKey);
      
      if (store) {
        this.stores[sport] = store;
        logger.info(`Loaded ${sport} vector store from cache`);
        return store;
      }
      return null;
    } catch (error) {
      logger.error(`Error loading from cache: ${error}`);
      return null;
    }
  }

  /**
   * Save vector store to cache
   * @param sport Sport identifier
   * @param indexHash Hash of the source data
   * @param store Vector store to cache
   */
  private async _saveToCache(sport: string, indexHash: string, store: VectorStore): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${sport}_${indexHash}`;
      // Use our chunked storage system instead of direct AsyncStorage
      await storeData(cacheKey, store);
      this.stores[sport] = store;
      logger.info(`Saved ${sport} vector store to cache`);
    } catch (error) {
      logger.error(`Error saving to cache: ${error}`);
    }
  }

  /**
   * Train product quantization codebook
   * @param vectors Training vectors
   * @returns PQ codebook
   */
  private _trainPQCodebook(vectors: number[][]): PQCodebook {
    const dimension = vectors[0].length;
    const subspaceSize = Math.floor(dimension / this.PQ_SUBSPACES);
    const centroids: number[][][] = [];
    const assignments: number[][] = [];

    // Initialize centroids for each subspace
    for (let s = 0; s < this.PQ_SUBSPACES; s++) {
      const subspaceVectors = vectors.map(v => 
        v.slice(s * subspaceSize, (s + 1) * subspaceSize)
      );
      
      // K-means clustering for this subspace
      const subspaceCentroids = this._kmeans(subspaceVectors, this.PQ_CENTROIDS);
      centroids.push(subspaceCentroids);
    }

    // Assign vectors to centroids
    for (const vector of vectors) {
      const vectorAssignments: number[] = [];
      for (let s = 0; s < this.PQ_SUBSPACES; s++) {
        const subspaceVector = vector.slice(s * subspaceSize, (s + 1) * subspaceSize);
        const centroidIdx = this._findNearestCentroid(subspaceVector, centroids[s]);
        vectorAssignments.push(centroidIdx);
      }
      assignments.push(vectorAssignments);
    }

    return { centroids, assignments };
  }

  /**
   * K-means clustering
   * @param vectors Input vectors
   * @param k Number of clusters
   * @returns Cluster centroids
   */
  private _kmeans(vectors: number[][], k: number): number[][] {
    // Initialize centroids randomly
    let centroids = vectors.slice(0, k);
    let prevCentroids: number[][] = [];
    let iterations = 0;
    const maxIterations = 100;

    while (iterations < maxIterations) {
      // Assign vectors to nearest centroids
      const clusters: number[][][] = Array(k).fill(null).map(() => []);
      for (const vector of vectors) {
        const nearestCentroid = this._findNearestCentroid(vector, centroids);
        clusters[nearestCentroid].push(vector);
      }

      // Update centroids
      prevCentroids = [...centroids];
      centroids = clusters.map(cluster => {
        if (cluster.length === 0) return prevCentroids[clusters.indexOf(cluster)];
        return this._computeCentroid(cluster);
      });

      // Check convergence
      if (this._centroidsEqual(centroids, prevCentroids)) {
        break;
      }

      iterations++;
    }

    return centroids;
  }

  /**
   * Find nearest centroid to a vector
   * @param vector Input vector
   * @param centroids Centroids to search
   * @returns Index of nearest centroid
   */
  private _findNearestCentroid(vector: number[], centroids: number[][]): number {
    let minDist = Infinity;
    let nearestIdx = 0;

    for (let i = 0; i < centroids.length; i++) {
      const dist = this._euclideanDistance(vector, centroids[i]);
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = i;
      }
    }

    return nearestIdx;
  }

  /**
   * Compute centroid of vectors
   * @param vectors Input vectors
   * @returns Centroid vector
   */
  private _computeCentroid(vectors: number[][]): number[] {
    const dimension = vectors[0].length;
    const centroid = Array(dimension).fill(0);

    for (const vector of vectors) {
      for (let i = 0; i < dimension; i++) {
        centroid[i] += vector[i];
      }
    }

    return centroid.map(val => val / vectors.length);
  }

  /**
   * Check if centroids have converged
   * @param a First set of centroids
   * @param b Second set of centroids
   * @returns True if centroids are equal
   */
  private _centroidsEqual(a: number[][], b: number[][]): boolean {
    const epsilon = 1e-6;
    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < a[i].length; j++) {
        if (Math.abs(a[i][j] - b[i][j]) > epsilon) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Calculate Euclidean distance between vectors
   * @param a First vector
   * @param b Second vector
   * @returns Euclidean distance
   */
  private _euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param vec1 First vector
   * @param vec2 Second vector
   * @returns Similarity score (0-1)
   */
  private _cosineSimilarity(vec1: number[], vec2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Search using product quantization
   * @param queryVector Query vector
   * @param store Vector store to search
   * @param limit Maximum number of results
   * @returns Array of documents with similarity scores
   */
  private _searchWithPQ(queryVector: number[], store: VectorStore, limit: number): { document: VectorDocument; similarity: number }[] {
    // Validate store and its contents
    if (!store || !store.vectors || !store.documents || 
        store.vectors.length === 0 || store.documents.length === 0) {
      logger.warn('Invalid or empty store provided to _searchWithPQ');
      return [];
    }

    if (!store.pqCodebook) {
      // Fall back to exact search if PQ not available
      return this._searchExact(queryVector, store, limit);
    }

    const { centroids, assignments } = store.pqCodebook;
    
    // Validate PQ codebook
    if (!centroids || !assignments || centroids.length === 0 || assignments.length === 0) {
      logger.warn('Invalid PQ codebook, falling back to exact search');
      return this._searchExact(queryVector, store, limit);
    }
    
    const dimension = queryVector.length;
    const subspaceSize = Math.floor(dimension / this.PQ_SUBSPACES);
    const results: { document: VectorDocument; similarity: number }[] = [];

    try {
      // Precompute distances to centroids for each subspace
      const centroidDistances: number[][] = [];
      for (let s = 0; s < this.PQ_SUBSPACES; s++) {
        const subspaceVector = queryVector.slice(s * subspaceSize, (s + 1) * subspaceSize);
        const subspaceDistances: number[] = centroids[s].map(centroid => 
          this._euclideanDistance(subspaceVector, centroid)
        );
        centroidDistances.push(subspaceDistances);
      }

      // Compute approximate distances using PQ
      for (let i = 0; i < store.vectors.length; i++) {
        let distance = 0;
        for (let s = 0; s < this.PQ_SUBSPACES; s++) {
          if (!assignments[i]) {
            logger.warn(`Assignment missing for vector ${i}`);
            continue;
          }
          
          const centroidIdx = assignments[i][s];
          if (centroidDistances[s] && centroidDistances[s][centroidIdx] !== undefined) {
            const subspaceDistance: number = centroidDistances[s][centroidIdx];
            distance += subspaceDistance;
          }
        }

        // Only add valid documents
        if (store.documents[i]) {
          // Convert distance to similarity (higher distance = lower similarity)
          const similarity = 1 / (1 + distance);
          results.push({
            document: store.documents[i],
            similarity
          });
        }
      }

      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error) {
      logger.error(`Error in _searchWithPQ: ${error}`);
      return this._searchExact(queryVector, store, limit);
    }
  }

  /**
   * Exact search without PQ
   * @param queryVector Query vector
   * @param store Vector store to search
   * @param limit Maximum number of results
   * @returns Array of documents with similarity scores
   */
  private _searchExact(queryVector: number[], store: VectorStore, limit: number): { document: VectorDocument; similarity: number }[] {
    // Validate store
    if (!store || !store.vectors || !store.documents || 
        store.vectors.length === 0 || store.documents.length === 0) {
      logger.warn('Invalid or empty store provided to _searchExact');
      return [];
    }
    
    try {
      const results: { document: VectorDocument; similarity: number }[] = [];
      
      for (let i = 0; i < store.vectors.length; i++) {
        // Skip if vector or document is missing
        if (!store.vectors[i] || !store.documents[i]) {
          continue;
        }
        
        const similarity = this._cosineSimilarity(queryVector, store.vectors[i]);
        results.push({
          document: store.documents[i],
          similarity
        });
      }

      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error) {
      logger.error(`Error in _searchExact: ${error}`);
      return [];
    }
  }

  /**
   * Initialize vector store for a sport
   * Creates or loads the vector store for the sport
   * @param sport Sport identifier ('afl' or 'nrl')
   */
  async initializeStore(sport: string): Promise<void> {
    try {
      logger.info(`Initializing vector store for ${sport}`);
      // Get the data hash
      const [embedHash, indexHash] = await this._getDataHashes(sport);
      
      // Try to load from cache first
      let vectorStore = null;
      try {
        logger.info(`Trying to load ${sport} vector store from cache...`);
        vectorStore = await this._loadFromCache(sport, indexHash);
      } catch (cacheError) {
        logger.warn(`Failed to load ${sport} vector store from cache: ${cacheError}`);
        // Clean up any corrupted cache data
        try {
          const cacheKey = `${this.CACHE_PREFIX}${sport}_${indexHash}`;
          await removeData(cacheKey);
          logger.info(`Cleaned up corrupted cache for ${sport}`);
        } catch (cleanupError) {
          logger.error(`Failed to clean up corrupted cache: ${cleanupError}`);
        }
      }
      
      if (vectorStore) {
        logger.info(`Loaded ${sport} vector store from cache`);
        this.embeddingHash[sport] = embedHash;
        this.indexHash[sport] = indexHash;
        return;
      }
      
      // Wrap creation in platform-specific optimizations
      if (Platform.OS === 'android') {
        // On Android, add delay to reduce memory pressure and split creation
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // If not in cache, create a new one
      logger.info(`Creating new ${sport} vector store...`);
      
      // Create the vector store
      const documents = await this._getSportDocs(sport);
      
      // Add safety check for document count
      if (!documents || documents.length === 0) {
        logger.error(`No documents found for ${sport}, skipping vector store creation`);
        // Initialize empty store to prevent repeated failures
        this.stores[sport] = { _vectorstoretype: 'memory' };
        this.embeddingHash[sport] = embedHash;
        this.indexHash[sport] = indexHash;
        return;
      }
      
      // Create with smaller batches on Android
      const batchSize = Platform.OS === 'android' ? 5 : 10;
      let createdDocuments = 0;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (createdDocuments < documents.length && retryCount < maxRetries) {
        try {
          const batch = documents.slice(createdDocuments, createdDocuments + batchSize);
          
          if (createdDocuments === 0) {
            // For first batch, create a new store
            const vectorstore = this._createVectorStore(sport);
            await vectorstore.addDocuments(batch);
            this.stores[sport] = vectorstore;
          } else {
            // For subsequent batches, add to existing store if it exists
            if (!this.stores[sport]) {
              // If store doesn't exist, create it
              this.stores[sport] = this._createVectorStore(sport);
            }
            
            // Add documents safely
            try {
              await this.stores[sport].addDocuments(batch);
            } catch (batchError) {
              logger.error(`Error adding batch to ${sport} vector store: ${batchError}`);
              // Continue with next batch despite errors
            }
          }
          
          createdDocuments += batch.length;
          logger.info(`Added ${createdDocuments}/${documents.length} documents to ${sport} vector store`);
          
          // Small pause between batches on Android
          if (Platform.OS === 'android' && createdDocuments < documents.length) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        } catch (error) {
          retryCount++;
          logger.error(`Error creating ${sport} vector store (attempt ${retryCount}): ${error}`);
          
          if (retryCount >= maxRetries) {
            logger.error(`Failed to create ${sport} vector store after ${maxRetries} attempts`);
            
            // Initialize with a minimal store to allow app to continue
            if (!this.stores[sport]) {
              logger.info(`Initializing minimal ${sport} vector store to allow app to continue`);
              this.stores[sport] = { 
                _vectorstoretype: 'memory',
                vectors: [],
                documents: [],
                addDocuments: async () => this.stores[sport]  // Simple passthrough function
              };
            }
            break;
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Cache the vector store if we created at least some documents
      if (createdDocuments > 0) {
        try {
          await this._saveToCache(sport, indexHash, this.stores[sport]);
        } catch (cacheError) {
          logger.error(`Failed to cache ${sport} vector store: ${cacheError}`);
        }
      }
      
      this.embeddingHash[sport] = embedHash;
      this.indexHash[sport] = indexHash;
      logger.info(`Initialized ${sport} vector store`);
    } catch (error) {
      logger.error(`Error initializing ${sport} vector store: ${error}`);
      // Initialize minimal store to allow app to continue
      this.stores[sport] = { _vectorstoretype: 'memory' };
    }
  }

  /**
   * Search for documents in the vector store
   * @param query Search query
   * @param sport Optional sport to search in specific store
   * @param limit Maximum number of results to return
   * @returns Array of documents with their similarity scores
   */
  async search(query: string, sport?: string, limit: number = 5): Promise<VectorDocument[]> {
    try {
      // Safety check for empty query
      if (!query) {
        logger.warn('Empty query provided to search');
        return [];
      }
      
      // Generate query embedding
      let queryEmbedding: number[];
      try {
        queryEmbedding = await this.embeddings.embedQuery(query);
      } catch (embedError) {
        logger.error(`Error embedding search query: ${embedError}`);
        return [];
      }
      
      const results: { document: VectorDocument; similarity: number }[] = [];
      
      if (sport) {
        // Search only in the specified sport store
        const storeSport = sport.toLowerCase();
        const store = this.stores[storeSport];
        
        if (store) {
          try {
            // Check if store has necessary data
            if (!store.vectors || !store.documents || 
                store.vectors.length === 0 || store.documents.length === 0) {
              logger.warn(`Vector store for ${storeSport} is empty or incomplete`);
              return [];
            }
            
            // Search the store
            const searchResults = this._searchWithPQ(queryEmbedding, store, limit);
            results.push(...searchResults);
          } catch (searchError) {
            logger.error(`Error searching in ${storeSport} store: ${searchError}`);
          }
        } else {
          logger.warn(`No vector store found for sport: ${sport}`);
        }
      } else {
        // Search in all stores
        for (const storeSport in this.stores) {
          const store = this.stores[storeSport];
          
          // Skip empty or invalid stores
          if (!store || !store.vectors || !store.documents || 
              store.vectors.length === 0 || store.documents.length === 0) {
            continue;
          }
          
          try {
            const searchResults = this._searchWithPQ(queryEmbedding, store, limit);
            results.push(...searchResults);
          } catch (searchError) {
            logger.error(`Error searching in ${storeSport} store: ${searchError}`);
            // Continue with other stores
          }
        }
      }
      
      // Filter out any results with undefined or null documents
      const validResults = results.filter(r => r && r.document);
      
      // Sort by similarity and return top results
      return validResults
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map(result => result.document);
    } catch (error) {
      logger.error(`Error searching vector store: ${error}`);
      return []; // Return empty array instead of throwing
    }
  }

  /**
   * Clear the vector store cache
   */
  async clear(): Promise<void> {
    try {
      this.stores = {};
      const keys = await AsyncStorage.getAllKeys();
      const vectorStoreKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      
      // Clear each key using removeData to handle chunked storage
      for (const key of vectorStoreKeys) {
        await removeData(key);
      }
      
      // Run cache cleanup
      await clearOldCache();
      
      logger.info('Cleared vector store cache');
    } catch (error) {
      logger.error(`Error clearing vector store cache: ${error}`);
      throw error;
    }
  }

  /**
   * Get a specific vector store
   * @param sport Sport identifier
   * @returns Vector store or undefined if not found
   */
  getStore(sport: string): VectorStore | undefined {
    return this.stores[sport.toLowerCase()];
  }

  /**
   * Reinitialize vector stores for all sports
   * @returns Promise that resolves when initialization is complete
   */
  async reinitialize(): Promise<void> {
    try {
      logger.info('Reinitializing vector stores');
      await this.initializeStore('nrl');
      await this.initializeStore('afl');
      logger.info('Vector stores reinitialized successfully');
    } catch (error) {
      logger.error('Error reinitializing vector stores:', error);
      throw error;
    }
  }

  /**
   * Add documents to the vector store
   * @param documents Array of text documents to add
   * @param metadata Optional metadata to associate with documents
   * @param sport Sport to add documents for (defaults to 'nrl')
   */
  async addDocuments(documents: string[], metadata?: any, sport: string = 'nrl'): Promise<void> {
    try {
      logger.info(`Adding ${documents.length} documents to ${sport} vector store`);
      
      // Safety check for empty documents array
      if (!documents || documents.length === 0) {
        logger.warn('No documents provided to addDocuments');
        return;
      }
      
      // Get the store - make sure it's initialized
      if (!this.stores[sport]) {
        try {
          await this.initializeStore(sport);
        } catch (initError) {
          logger.error(`Failed to initialize ${sport} vector store: ${initError}`);
          // Create a minimal store to allow operation to continue
          this.stores[sport] = { 
            _vectorstoretype: 'memory',
            vectors: [],
            documents: [],
            addDocuments: async (docs: VectorDocument[]) => {
              try {
                const vectors = await this.embeddings.embedQuery(docs[0]?.text || '');
                if (!this.stores[sport].vectors) this.stores[sport].vectors = [];
                if (!this.stores[sport].documents) this.stores[sport].documents = [];
                this.stores[sport].vectors.push(vectors);
                this.stores[sport].documents.push(...docs);
                return this.stores[sport];
              } catch (embedError) {
                logger.error(`Error embedding document: ${embedError}`);
                return this.stores[sport];
              }
            }
          };
        }
      }
      
      const store = this.stores[sport];
      if (!store) {
        logger.error(`Vector store not initialized for ${sport} despite attempts`);
        return;
      }
      
      // Create document objects with type safety
      const docs: VectorDocument[] = documents.map(text => ({
        text: text || '',  // Ensure text is not undefined
        metadata: { 
          sport,
          ...(metadata || {})
        }
      }));
      
      // Process in smaller batches on Android
      const batchSize = Platform.OS === 'android' ? 3 : 10;
      
      // Process in batches to avoid memory issues
      for (let i = 0; i < docs.length; i += batchSize) {
        try {
          const batch = docs.slice(i, i + batchSize);
          
          if (store.addDocuments) {
            await store.addDocuments(batch);
          } else {
            // Fallback if addDocuments method is missing
            logger.warn(`Store for ${sport} has no addDocuments method, using embedded directly`);
            
            // Embed the documents directly
            const batchTexts = batch.map(doc => doc.text);
            try {
              const vectors = await this.embeddings.embedDocuments(batchTexts);
              
              // Ensure vectors and documents arrays exist
              if (!store.vectors) store.vectors = [];
              if (!store.documents) store.documents = [];
              
              // Add to the existing store
              store.vectors = [...store.vectors, ...vectors];
              store.documents = [...store.documents, ...batch];
            } catch (embedError) {
              logger.error(`Error embedding documents batch: ${embedError}`);
            }
          }
          
          // Add small delay between batches on Android
          if (Platform.OS === 'android' && i + batchSize < docs.length) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        } catch (batchError) {
          logger.error(`Error processing batch ${i}-${i+batchSize}: ${batchError}`);
          // Continue with next batch despite errors
        }
      }
      
      logger.info(`Successfully added ${documents.length} documents to ${sport} vector store`);
    } catch (error) {
      logger.error(`Error adding documents to ${sport} vector store: ${error}`);
      // Don't throw - let the app continue
    }
  }

  /**
   * Get data hashes for a sport
   * @param sport Sport identifier
   * @returns Tuple of [embeddingHash, indexHash]
   */
  private async _getDataHashes(sport: string): Promise<[string, string]> {
    try {
      if (sport.toLowerCase() === 'nrl') {
        // Use directly imported NRL data
        const triesData = nrlPlayerTries;
        const positionsData = nrlPlayerPositional;
        
        // Calculate hash based on both files
        const triesHash = await this._generateHash(JSON.stringify(triesData));
        const positionsHash = await this._generateHash(JSON.stringify(positionsData));
        const indexHash = await this._generateHash(triesHash + positionsHash);
        const embedHash = await this._generateHash('nrl_embed_' + indexHash);
        
        return [embedHash, indexHash];
      } else if (sport.toLowerCase() === 'afl') {
        // Use imported AFL data
        const playerSummaryData = aflPlayerSummary;
        const homeAwayData = aflHomeAway;
        const defeatsData = aflDefeats;
        const matchupData = aflMatchup;
        
        // Calculate hash based on all files
        const summaryHash = await this._generateHash(JSON.stringify(playerSummaryData));
        const homeAwayHash = await this._generateHash(JSON.stringify(homeAwayData));
        const defeatsHash = await this._generateHash(JSON.stringify(defeatsData));
        const matchupHash = await this._generateHash(JSON.stringify(matchupData));
        const indexHash = await this._generateHash(summaryHash + homeAwayHash + defeatsHash + matchupHash);
        const embedHash = await this._generateHash('afl_embed_' + indexHash);
        
        return [embedHash, indexHash];
      }
      
      // Default fallback
      const timestamp = Date.now().toString();
      return [
        await this._generateHash('embed_' + sport + '_' + timestamp),
        await this._generateHash('index_' + sport + '_' + timestamp)
      ];
    } catch (error) {
      logger.error(`Error generating data hashes for ${sport}: ${error}`);
      const timestamp = Date.now().toString();
      return [
        await this._generateHash('embed_' + sport + '_' + timestamp),
        await this._generateHash('index_' + sport + '_' + timestamp)
      ];
    }
  }

  /**
   * Get documents for a sport
   * @param sport Sport identifier
   * @returns Vector documents
   */
  private async _getSportDocs(sport: string): Promise<VectorDocument[]> {
    if (sport.toLowerCase() === 'nrl') {
      return this._getNRLDocs();
    } else if (sport.toLowerCase() === 'afl') {
      return this._getAFLDocs();
    }
    return [];
  }

  /**
   * Create a vector store instance
   * @param sport Sport identifier
   * @returns Empty vector store
   */
  private _createVectorStore(sport: string) {
    // Create an initial store structure
    const store = { 
      _vectorstoretype: 'memory',
      vectors: [],
      documents: [],
      addDocuments: async (docs: VectorDocument[]) => {
        try {
          const vectors = await Promise.all(
            docs.map(doc => this.embeddings.embedQuery(doc.text))
          );
          
          // Add to the store - ensure the store exists
          if (!this.stores[sport]) {
            this.stores[sport] = store;
          }
          
          // Ensure vectors and documents arrays exist
          if (!this.stores[sport].vectors) this.stores[sport].vectors = [];
          if (!this.stores[sport].documents) this.stores[sport].documents = [];
          
          // Now safely add to the arrays
          this.stores[sport].vectors = this.stores[sport].vectors.concat(vectors);
          this.stores[sport].documents = this.stores[sport].documents.concat(docs);
          
          return this.stores[sport];
        } catch (error) {
          logger.error(`Error embedding documents in _createVectorStore: ${error}`);
          // Return the store even on error
          return this.stores[sport] || store;
        }
      }
    };
    
    return store;
  }

  /**
   * Get NRL documents
   * @returns Vector documents for NRL
   */
  private async _getNRLDocs(): Promise<VectorDocument[]> {
    try {
      const documents: VectorDocument[] = [];
      const triesData = nrlPlayerTries;
      
      // Add general NRL context
      documents.push({
        text: "NRL 2025 Season Try Scoring Statistics and Analysis",
        metadata: { type: "general", sport: "nrl" }
      });
      
      // Add market-specific context
      documents.push({
        text: "Available try scoring markets: First Try Scorer (FTS), Anytime Try Scorer (ATS), Last Try Scorer (LTS), First Try Scorer Second Half (FTS2H), Two or More Tries (2+)",
        metadata: { type: "markets", sport: "nrl" }
      });
      
      // Add position-specific context
      documents.push({
        text: "Try scoring statistics are available for different positions including Wingers, Centres, Fullbacks, and Forwards",
        metadata: { type: "positions", sport: "nrl" }
      });
      
      // Process only a subset on Android to prevent memory issues
      const maxPlayers = Platform.OS === 'android' ? 50 : triesData.length;
      
      // Add player statistics
      for (let i = 0; i < Math.min(maxPlayers, triesData.length); i++) {
        const player = triesData[i];
        const playerName = `${player.first_name} ${player.last_name}`;
        const gamesPlayed = ('ACTUAL_GAMES_PLAYED' in player) 
          ? (player as any).ACTUAL_GAMES_PLAYED 
          : player.TotalGames;
        
        // Create simplified document on Android to save memory
        if (Platform.OS === 'android') {
          const playerStats: VectorDocument = {
            text: `${playerName}'s try scoring stats: Games played: ${gamesPlayed}, ` +
                 `FTS: ${player.TotalFtsPlayer || 0}, ATS: ${player.TotalAtsPlayer || 0}`,
            metadata: {
              player: playerName,
              type: "player_stats",
              sport: "nrl"
            }
          };
          documents.push(playerStats);
        } else {
          // Create detailed player document for iOS
          const playerStats: VectorDocument = {
            text: `${playerName}'s try scoring statistics: Games played: ${gamesPlayed}, ` +
                 `First try: ${player.TotalFtsPlayer || 0} times (${((player.TotalFtsPlayer || 0) / gamesPlayed * 100).toFixed(1)}%), ` +
                 `Anytime try: ${player.TotalAtsPlayer || 0} times (${((player.TotalAtsPlayer || 0) / gamesPlayed * 100).toFixed(1)}%), ` +
                 `Last try: ${player.TotalLtsPlayer || 0} times (${((player.TotalLtsPlayer || 0) / gamesPlayed * 100).toFixed(1)}%), ` +
                 `First try second half: ${player.TotalFts2HPlayer || 0} times (${((player.TotalFts2HPlayer || 0) / gamesPlayed * 100).toFixed(1)}%), ` +
                 `Two plus tries: ${player.TotalTwoPlusTryPlayer || 0} times (${((player.TotalTwoPlusTryPlayer || 0) / gamesPlayed * 100).toFixed(1)}%)`,
            metadata: {
              player: playerName,
              type: "player_stats",
              sport: "nrl",
              gamesPlayed: gamesPlayed,
              firstTries: player.TotalFtsPlayer || 0,
              anyTimeTries: player.TotalAtsPlayer || 0,
              lastTries: player.TotalLtsPlayer || 0,
              firstTriesSecondHalf: player.TotalFts2HPlayer || 0,
              twoPlusTries: player.TotalTwoPlusTryPlayer || 0,
              team: player.team_name || ''
            }
          };
          documents.push(playerStats);
        }
      }
      
      return documents;
    } catch (error) {
      logger.error(`Error creating NRL documents: ${error}`);
      return [];
    }
  }

  /**
   * Get AFL documents
   * @returns Vector documents for AFL
   */
  private async _getAFLDocs(): Promise<VectorDocument[]> {
    try {
      const documents: VectorDocument[] = [];
      const playerSummaryData = aflPlayerSummary;
      
      // Add general AFL context
      documents.push({
        text: "AFL 2025 Season Goal Scoring and Disposal Statistics and Analysis",
        metadata: { type: "general", sport: "afl" }
      });
      
      // Add market-specific context
      documents.push({
        text: "Available goal scoring markets: 1+ Goals, 2+ Goals, 3+ Goals, First Goal Scorer (FGS)",
        metadata: { type: "markets", sport: "afl", category: "goals" }
      });

      documents.push({
        text: "Available disposal markets: 15+ Disposals, 20+ Disposals, 30+ Disposals",
        metadata: { type: "markets", sport: "afl", category: "disposals" }
      });
      
      // Process only a subset on Android to prevent memory issues
      const maxPlayers = Platform.OS === 'android' ? 50 : playerSummaryData.length;
      
      // Add AFL player statistics from summary data
      for (let i = 0; i < Math.min(maxPlayers, playerSummaryData.length); i++) {
        const playerData = playerSummaryData[i] as any;
        
        // Skip if player doesn't have basic data
        if (!playerData.Player || !playerData.Total_Games) continue;
        
        const playerName = playerData.Player;
        const gamesPlayed = playerData.Total_Games;
        
        // Create simplified documents on Android to save memory
        if (Platform.OS === 'android') {
          const playerStats: VectorDocument = {
            text: `${playerName}'s AFL stats: Games: ${gamesPlayed}, ` +
                 `1+ goals: ${playerData.Games_with_1_or_more_goals || 0}, ` +
                 `15+ disposals: ${playerData.Games_with_15_or_more_disposals || 0}`,
            metadata: {
              player: playerName,
              type: "player_stats",
              sport: "afl"
            }
          };
          documents.push(playerStats);
        } else {
          // Create detailed player document for goals on iOS
          const playerGoalStats: VectorDocument = {
            text: `${playerName}'s goal scoring statistics: Games played: ${gamesPlayed}, ` +
                `1+ goals: ${playerData.Games_with_1_or_more_goals || 0} times (${((playerData.Games_with_1_or_more_goals || 0) / gamesPlayed * 100).toFixed(1)}%), ` +
                `2+ goals: ${playerData.Games_with_2_or_more_goals || 0} times (${((playerData.Games_with_2_or_more_goals || 0) / gamesPlayed * 100).toFixed(1)}%), ` +
                `3+ goals: ${playerData.Games_with_3_or_more_goals || 0} times (${((playerData.Games_with_3_or_more_goals || 0) / gamesPlayed * 100).toFixed(1)}%)`,
            metadata: {
              player: playerName,
              type: "player_goals",
              sport: "afl",
              gamesPlayed: gamesPlayed,
              onePlusGoals: playerData.Games_with_1_or_more_goals || 0,
              twoPlusGoals: playerData.Games_with_2_or_more_goals || 0,
              threePlusGoals: playerData.Games_with_3_or_more_goals || 0
            }
          };
          
          // Create detailed player document for disposals
          const playerDisposalStats: VectorDocument = {
            text: `${playerName}'s disposal statistics: Games played: ${gamesPlayed}, ` +
                `15+ disposals: ${playerData.Games_with_15_or_more_disposals || 0} times (${((playerData.Games_with_15_or_more_disposals || 0) / gamesPlayed * 100).toFixed(1)}%), ` +
                `20+ disposals: ${playerData.Games_with_20_or_more_disposals || 0} times (${((playerData.Games_with_20_or_more_disposals || 0) / gamesPlayed * 100).toFixed(1)}%)`,
            metadata: {
              player: playerName,
              type: "player_disposals",
              sport: "afl",
              gamesPlayed: gamesPlayed,
              fifteenPlusDisposals: playerData.Games_with_15_or_more_disposals || 0,
              twentyPlusDisposals: playerData.Games_with_20_or_more_disposals || 0
            }
          };
          
          documents.push(playerGoalStats);
          documents.push(playerDisposalStats);
        }
      }
      
      return documents;
    } catch (error) {
      logger.error(`Error creating AFL documents: ${error}`);
      return [];
    }
  }

  /**
   * Diagnose and repair corrupted vector store data
   * @param sport Sport identifier
   * @returns Repair status
   */
  async repairVectorStore(sport: string): Promise<boolean> {
    try {
      logger.info(`Attempting to repair ${sport} vector store...`);
      
      // Check if keys with this prefix exist
      const keys = await AsyncStorage.getAllKeys();
      const vectorStoreKeys = keys.filter(key => 
        key.startsWith(`${this.CACHE_PREFIX}${sport}_`) || 
        key.includes(`${this.CACHE_PREFIX}${sport}_`)
      );
      
      if (vectorStoreKeys.length === 0) {
        logger.info(`No vector store data found for ${sport}, nothing to repair`);
        return false;
      }
      
      logger.info(`Found ${vectorStoreKeys.length} keys related to ${sport} vector store`);
      
      // Remove all related keys
      for (const key of vectorStoreKeys) {
        await removeData(key);
      }
      
      // Also check for chunk keys directly
      const chunkKeys = keys.filter(key => 
        key.includes(`${this.CACHE_PREFIX}${sport}`) && 
        (key.includes('_chunk_') || key.includes('_metadata'))
      );
      
      for (const key of chunkKeys) {
        try {
          await AsyncStorage.removeItem(key);
        } catch (error) {
          logger.error(`Failed to remove chunk key ${key}: ${error}`);
        }
      }
      
      logger.info(`Cleaned up ${vectorStoreKeys.length + chunkKeys.length} keys for ${sport}`);
      
      // Reinitialize the vector store
      await this.initializeStore(sport);
      
      logger.info(`${sport} vector store repaired successfully`);
      return true;
    } catch (error) {
      logger.error(`Failed to repair ${sport} vector store: ${error}`);
      return false;
    }
  }
} 