import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

export interface NrlPlayerData {
  player_id: string;
  first_name: string;
  last_name: string;
  Player_Name: string;
  team_name: string;
  TotalGames: number;
  TotalAtsPlayer: number;
  TotalFtsPlayer: number;
  TotalLtsPlayer: number;
  ATSODDS: number;
  FTSODDS: number;
  LTSODDS: number;
  FTS2HODDS: number;
  SecondTryODDS: number;
  ThirdTryODDS: number;
}

export function parseCSV(csvString: string): NrlPlayerData[] {
  const lines = csvString.split('\n');
  const headers = lines[0].split(',').map(header => header.replace(/"/g, '').trim());
  const results: NrlPlayerData[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const values: string[] = [];
    let currentValue = '';
    let insideQuotes = false;
    
    for (let char of lines[i]) {
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        values.push(currentValue);
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue);

    const row: Record<string, any> = {};
    for (let j = 0; j < headers.length && j < values.length; j++) {
      const value = values[j].replace(/"/g, '').trim();
      row[headers[j]] = isNaN(Number(value)) || value === '' ? value : Number(value);
    }
    
    results.push(row as unknown as NrlPlayerData);
  }
  
  return results;
}

export async function loadNrlPlayerData(): Promise<NrlPlayerData[]> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);

    if (!fileInfo.exists) {
      // Ensure the asset is bundled and available
      const asset = Asset.fromModule(require('../assets/csv/NRL_Player_tries.csv'));
      await asset.downloadAsync();

      if (!asset.localUri) {
        throw new Error('Asset download failed');
      }

      // Copy CSV to the app's local storage
      await FileSystem.copyAsync({
        from: asset.localUri,
        to: fileUri,
      });
    }

    // Read the CSV file
    const csvContent = await FileSystem.readAsStringAsync(fileUri);
    return parseCSV(csvContent);
  } catch (error) {
    console.error('Error loading CSV:', error);
    throw new Error('Failed to load player data.');
  }
}