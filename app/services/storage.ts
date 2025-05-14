import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

// Maximum chunk size (100KB is safer for Android)
const CHUNK_SIZE = 100 * 1024; // 100KB

/**
 * Stores data with chunking to avoid SQLite limits on Android
 */
export async function storeData(key: string, value: any): Promise<void> {
  try {
    const stringValue = JSON.stringify(value);
    
    // For small data, use direct storage
    if (stringValue.length < CHUNK_SIZE) {
      await AsyncStorage.setItem(key, stringValue);
      return;
    }
    
    // For larger data, use chunking
    const chunks = chunkString(stringValue, CHUNK_SIZE);
    const chunkKeys = chunks.map((_, index) => `${key}_chunk_${index}`);
    
    // Store metadata
    await AsyncStorage.setItem(`${key}_metadata`, JSON.stringify({
      chunks: chunkKeys.length,
      totalSize: stringValue.length,
      timestamp: Date.now()
    }));
    
    // Store chunks
    const promises = chunks.map((chunk, index) => 
      AsyncStorage.setItem(chunkKeys[index], chunk)
        .catch(async (error) => {
          // If AsyncStorage fails, fallback to filesystem for this chunk
          if (Platform.OS === 'android') {
            const path = `${FileSystem.documentDirectory}${chunkKeys[index].replace(/[^a-z0-9]/gi, '_')}.json`;
            await FileSystem.writeAsStringAsync(path, chunk);
            // Mark this chunk as stored in filesystem
            await AsyncStorage.setItem(`${chunkKeys[index]}_location`, 'filesystem');
            return { path };
          }
          throw error;
        })
    );
    
    await Promise.all(promises);
  } catch (error) {
    console.error('Error storing data:', error);
    throw error;
  }
}

/**
 * Retrieves chunked data
 */
export async function getData(key: string): Promise<any | null> {
  try {
    // Try direct fetch first for small data
    const value = await AsyncStorage.getItem(key);
    if (value !== null) {
      return JSON.parse(value);
    }
    
    // Check if we have chunked data
    const metadataStr = await AsyncStorage.getItem(`${key}_metadata`);
    if (!metadataStr) {
      return null;
    }
    
    const metadata = JSON.parse(metadataStr);
    const { chunks } = metadata;
    
    // Collect all chunks
    let allChunks: string[] = [];
    let missingChunks = 0;
    
    for (let i = 0; i < chunks; i++) {
      const chunkKey = `${key}_chunk_${i}`;
      
      try {
        // Check location
        const location = await AsyncStorage.getItem(`${chunkKey}_location`);
        
        let chunkData;
        if (location === 'filesystem') {
          // Read from filesystem
          const path = `${FileSystem.documentDirectory}${chunkKey.replace(/[^a-z0-9]/gi, '_')}.json`;
          chunkData = await FileSystem.readAsStringAsync(path);
        } else {
          // Read from AsyncStorage
          chunkData = await AsyncStorage.getItem(chunkKey);
        }
        
        if (chunkData === null) {
          console.warn(`Missing chunk ${i} for key ${key}, will try to recover`);
          missingChunks++;
          // Add empty placeholder to maintain order
          allChunks.push(''); 
        } else {
          allChunks.push(chunkData);
        }
      } catch (chunkError) {
        console.warn(`Error reading chunk ${i} for key ${key}:`, chunkError);
        missingChunks++;
        // Add empty placeholder to maintain order
        allChunks.push('');
      }
    }
    
    // Check if we have too many missing chunks
    const missingPercentage = (missingChunks / chunks) * 100;
    if (missingPercentage > 25) {
      console.error(`Too many missing chunks (${missingPercentage.toFixed(1)}%) for key ${key}`);
      
      // Attempt to clean up corrupted data
      try {
        await removeData(key);
        console.log(`Removed corrupted data for key ${key}`);
      } catch (cleanupError) {
        console.error(`Failed to clean up corrupted data for key ${key}:`, cleanupError);
      }
      
      return null;
    }
    
    // If we have some missing chunks but below threshold, try to recover
    if (missingChunks > 0) {
      console.log(`Recovered data with ${missingChunks} missing chunks for key ${key}`);
    }
    
    // Combine and parse
    const combinedData = allChunks.join('');
    try {
      return JSON.parse(combinedData);
    } catch (parseError) {
      console.error(`Failed to parse recovered data for key ${key}:`, parseError);
      
      // Clean up corrupted data
      await removeData(key);
      console.log(`Removed unparseable data for key ${key}`);
      
      return null;
    }
  } catch (error) {
    console.error('Error retrieving data:', error);
    return null; // Return null instead of throwing to prevent app crashes
  }
}

/**
 * Removes stored data and its chunks
 */
export async function removeData(key: string): Promise<void> {
  try {
    // Remove direct data if exists
    await AsyncStorage.removeItem(key);
    
    // Check for chunked data
    const metadataStr = await AsyncStorage.getItem(`${key}_metadata`);
    if (!metadataStr) {
      return;
    }
    
    const metadata = JSON.parse(metadataStr);
    const { chunks } = metadata;
    
    // Remove all chunks
    const promises = [];
    for (let i = 0; i < chunks; i++) {
      const chunkKey = `${key}_chunk_${i}`;
      
      // Check location
      const location = await AsyncStorage.getItem(`${chunkKey}_location`);
      promises.push(AsyncStorage.removeItem(chunkKey));
      
      if (location === 'filesystem') {
        // Remove from filesystem
        const path = `${FileSystem.documentDirectory}${chunkKey.replace(/[^a-z0-9]/gi, '_')}.json`;
        promises.push(FileSystem.deleteAsync(path, { idempotent: true }));
        promises.push(AsyncStorage.removeItem(`${chunkKey}_location`));
      }
    }
    
    // Remove metadata
    promises.push(AsyncStorage.removeItem(`${key}_metadata`));
    
    await Promise.all(promises);
  } catch (error) {
    console.error('Error removing data:', error);
    throw error;
  }
}

/**
 * Utility to clear storage cache based on age or quota
 */
export async function clearOldCache(maxAgeMs = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  try {
    const now = Date.now();
    const keys = await AsyncStorage.getAllKeys();
    const metadataKeys = keys.filter(k => k.endsWith('_metadata'));
    
    for (const metaKey of metadataKeys) {
      const metadataStr = await AsyncStorage.getItem(metaKey);
      if (metadataStr) {
        const metadata = JSON.parse(metadataStr);
        if (now - metadata.timestamp > maxAgeMs) {
          // Extract the base key from metadata key
          const baseKey = metaKey.replace('_metadata', '');
          await removeData(baseKey);
        }
      }
    }
    
    // Check storage usage on Android
    if (Platform.OS === 'android') {
      try {
        const info = await FileSystem.getInfoAsync(FileSystem.documentDirectory);
        if (info.exists && info.isDirectory) {
          // If storage is over 80% full, clear older caches more aggressively
          if (info.totalSpace && info.freeSpace && (info.freeSpace / info.totalSpace < 0.2)) {
            await clearOldCache(24 * 60 * 60 * 1000); // 1 day old
          }
        }
      } catch (error) {
        console.warn('Failed to check storage usage:', error);
      }
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

/**
 * Helper function to split string into chunks
 */
function chunkString(str: string, size: number): string[] {
  const chunks = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.substring(i, i + size));
  }
  return chunks;
} 