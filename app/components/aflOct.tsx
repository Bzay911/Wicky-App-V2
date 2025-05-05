import { useState, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ListRenderItemInfo,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DropDownPicker from 'react-native-dropdown-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

// First, update the OddsData interface to be more flexible for different market types
interface OddsData {
  Name: string;
  Team: string;
  Match: string;
  Bet365: number | null;
  Tab: number | null;
  Neds: number | null;
  Sportsbet: number | null;
  Betright: number | null;
  Betr: number | null;
  Dabble: number | null;
  Topsport: number | null;
  Highest: number;
  "Second Highest": number;
  "Market Value": number;
  Market: string;
  "Highest/Model": number;
  [key: string]: string | number | null;
}

// Update the interface to match the API response format
interface MatchOption {
  value: string;
  label: string;
}

// Update the ApiResponse interface to match the actual API response
interface ApiResponse {
  matches: MatchOption[];  // Updated to match the API response format
  ags_summary: OddsData[];  // Anytime Goal Scorer
  fgs_summary: OddsData[];  // First Goal Scorer
  o2gs_summary: OddsData[]; // Over 2 Goals
  o3gs_summary: OddsData[]; // Over 3 Goals
  o4gs_summary: OddsData[]; // Over 4 Goals
  o5gs_summary: OddsData[]; // Over 5 Goals
  o20d_summary: OddsData[]; // Over 20 Disposals
  o25d_summary: OddsData[]; // Over 25 Disposals
  o30d_summary: OddsData[]; // Over 30 Disposals
  o35d_summary: OddsData[]; // Over 35 Disposals
  market: string;
  oppositeMarket: string;
  o2gsMarket: string;
  o3gsMarket: string;
  o4gsMarket: string;
  o5gsMarket: string;
  o20dMarket: string;
  o25dMarket: string;
  o30dMarket: string;
  o35dMarket: string;
}

// Add these interfaces at the top
interface Match {
  id: string;
  name: string;
}

interface MarketType {
  id: string;
  name: string;
}

export default function AFLOddsComparisonScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<OddsData[]>([]);
  const [matches, setMatches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<string>('all');
  const [isDetailedView, setIsDetailedView] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Add sport switcher state
  const [selectedSport, setSelectedSport] = useState('afl');

  // Add settings modal state
  const [settingsVisible, setSettingsVisible] = useState(false);
  
  // Add NBA coming soon modal state
  const [nbaComingSoonVisible, setNbaComingSoonVisible] = useState(false);
  
  // Add button press states
  const [resetPressed, setResetPressed] = useState(false);
  const [settingsPressed, setSettingsPressed] = useState(false);
  
  // Create temporary states for settings to apply only when "Apply Changes" is pressed
  const [tempSelectedMarket, setTempSelectedMarket] = useState('ags');
  const [tempSelectedMatch, setTempSelectedMatch] = useState('all');
  const [tempPlayerTypeFilter, setTempPlayerTypeFilter] = useState('all');
  const [tempIsDetailedView, setTempIsDetailedView] = useState(false);
  const [tempIsDarkMode, setTempIsDarkMode] = useState(true);

  // Add dropdown states
  const [marketOpen, setMarketOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState('ags');
  const [matchesOpen, setMatchesOpen] = useState(false);

  // Add this state variable for player type filtering
  const [playerTypeFilter, setPlayerTypeFilter] = useState('all'); // 'all', 'starters', 'bench'

  // Updated colors based on reference UI and design guidelines
  const backgroundColor = isDarkMode ? '#1C2732' : '#F5F7FA';
  const cardBackground = isDarkMode ? '#2D3B47' : '#FFFFFF';
  const accentColor = '#10D592';
  const textColor = isDarkMode ? '#FFFFFF' : '#373F4D';
  const headerTextColor = '#FFFFFF';
  const headerBackgroundColor = isDarkMode ? '#233240' : '#2C3E50';
  const borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)';
  const alternateRowColor = isDarkMode ? '#304255' : '#F0F4F8';
  
  // Add color constants for the table
  const highlightGreen = '#82d072';
  const highlightYellow = '#fffb8f';
  const highlightRed = '#ff6961';
  const tableBorderColor = isDarkMode ? '#3D5A73' : '#E0E0E0';
  const tableCellBorderColor = isDarkMode ? '#2D4050' : '#F5F5F5';
  const tableHeaderBackground = isDarkMode ? '#1D2B3A' : '#395676';

  // First, define column widths
  const COLUMN_WIDTHS = {
    'No.': 60,
    'Name': 180,
    'Team': 200,
    'Opponent': 200,
    'Games': 80,
    'TPT Historical': 120,
    'Tab': 100,
    'Neds': 100,
    'Betright': 100,
    'Bet365': 100,
    'Topsport': 100,
    'Sportsbet': 100,
    'Pointsbet': 100,
    'Dabble': 100,
    'Market Value': 120
  } as const;

  // Update type definitions
  type ColumnKey = keyof OddsData;
  type ColumnMap = Record<keyof typeof COLUMN_WIDTHS, ColumnKey>;

  const columnToKey: ColumnMap = {
    'No.': 'Number',
    'Name': 'Player',
    'Team': 'Team',
    'Opponent': 'Match',
    'Games': 'Games',
    'TPT Historical': 'ATS Historical',
    'Tab': 'Tab',
    'Neds': 'Neds',
    'Betright': 'Betright',
    'Bet365': 'Bet365',
    'Topsport': 'Topsport',
    'Sportsbet': 'Sportsbet',
    'Pointsbet': 'Pointsbet',
    'Dabble': 'Dabble',
    'Market Value': 'Market Value'
  } as const;

  const marketTypes: MarketType[] = [
    { id: 'ags', name: 'Anytime Goal Scorer' },
    { id: 'fgs', name: 'First Goal Scorer' },
    { id: 'o2gs', name: 'Over 2 Goals' },
    { id: 'o3gs', name: 'Over 3 Goals' },
    { id: 'o4gs', name: 'Over 4 Goals' },
    { id: 'o5gs', name: 'Over 5 Goals' },
    { id: 'o20d', name: 'Over 20 Disposals' },
    { id: 'o25d', name: 'Over 25 Disposals' },
    { id: 'o30d', name: 'Over 30 Disposals' },
    { id: 'o35d', name: 'Over 35 Disposals' }
  ];

  // Add this after your existing state variables
  const [apiData, setApiData] = useState<ApiResponse | null>(null);

  // Add a new state variable for tracking market changes
  const [marketLoading, setMarketLoading] = useState(false);

  // Update the headers type to include the display property
  const [headers, setHeaders] = useState<Array<{key: string, width: number, display?: string, isSticky?: boolean}>>([]);

  // Add this state for the new dropdown
  const [playerTypeOpen, setPlayerTypeOpen] = useState(false);

  // Add a ref for the horizontal scroll views
  const headerScrollRef = useRef<ScrollView>(null);
  const dataScrollRef = useRef<ScrollView>(null);

  // Add sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'ascending' | 'descending' | null;
  }>({
    key: '',
    direction: null,
  });

  // Add a state for sorting loading indicator
  const [isSorting, setIsSorting] = useState(false);

  // Add state for expanded row
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  
  // Define a common font family to use throughout the screen
  const fontFamily = 'Verdana, Geneva, Tahoma, sans-serif';

  // Fetch data function
  const fetchData = async () => {
    try {
      setLoading(true);
      const apiUrl = 'https://wicky-nrl-api-12a5d66a862f.herokuapp.com/afl_betting_data';
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      
      const json: ApiResponse = await response.json();
      console.log('API Response:', {
        market: json.market,
        oppositeMarket: json.oppositeMarket,
        dataExample: json.fgs_summary?.[0]
      });
      
      setApiData(json);
      
      // Extract unique matches from all summary data types
      const allMatchesArrays = [
        ...(json.ags_summary || []),
        ...(json.fgs_summary || []),
        ...(json.o2gs_summary || []),
        ...(json.o3gs_summary || []),
        ...(json.o4gs_summary || []),
        ...(json.o5gs_summary || []),
        ...(json.o20d_summary || []),
        ...(json.o25d_summary || []),
        ...(json.o30d_summary || []),
        ...(json.o35d_summary || [])
      ];
      
      // Use Set to get unique match names
      const uniqueMatchesSet = new Set<string>();
      
      allMatchesArrays.forEach(item => {
        if (item && item.Match && typeof item.Match === 'string' && item.Match.trim() !== '') {
          uniqueMatchesSet.add(item.Match);
        }
      });
      
      // Convert Set to Array and sort alphabetically
      const uniqueMatches = Array.from(uniqueMatchesSet).sort();
      
      console.log('Unique matches found:', uniqueMatches);
      setMatches(['all', ...uniqueMatches]);
      
      // Set initial data based on selected market
      const initialMarket = selectedMarket || 'fgs';
      const marketDataMap: { [key: string]: keyof ApiResponse } = {
        'ags': 'ags_summary',
        'fgs': 'fgs_summary',
        'o2gs': 'o2gs_summary',
        'o3gs': 'o3gs_summary',
        'o4gs': 'o4gs_summary',
        'o5gs': 'o5gs_summary',
        'o20d': 'o20d_summary',
        'o25d': 'o25d_summary',
        'o30d': 'o30d_summary',
        'o35d': 'o35d_summary'
      };
      
      const summaryField = marketDataMap[initialMarket];
      if (summaryField && json[summaryField]) {
        const initialData = json[summaryField] as OddsData[];
        setData(initialData);
        
        if (initialData.length > 0) {
          updateColumnsFromData(initialData[0], initialMarket);
        }
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching AFL data:', err);
      setError(`Failed to fetch data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, []);

  // Refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // Helper: Get opponent team from a match string
  const getOpponentTeam = (match: string | number | null, team: string | number | null): string => {
    if (!match || !team) return '';
    const matchStr = String(match);
    const teamStr = String(team);
    const teams = matchStr.split(' vs ');
    return teams[0] === teamStr ? teams[1] : teams[0];
  };

  // Helper: Format team name to show only first 3 letters in uppercase
  const formatTeamName = (team: string | number | null): string => {
    if (!team) return '';
    const teamStr = String(team);
    return teamStr.substring(0, 3).toUpperCase();
  };

  // Add a function to find the highest odds for a player across all bookmakers
  const findHighestOdds = (item: OddsData) => {
    const bookmakerFields = [
      'Betright', 'Bet365', 'Neds', 'Sportsbet', 
      'Tab', 'Topsport', 'Dabble', 'Pointsbet', 'Unibet'
    ];
    
    // Get all valid odds
    const oddsMap: Record<string, number> = {};
    let maxOdds = 0;
    
    bookmakerFields.forEach(field => {
      const value = item[field as keyof OddsData];
      if (typeof value === 'number' && value > 0) {
        oddsMap[field] = value;
        maxOdds = Math.max(maxOdds, value);
      }
    });
    
    // Find all bookmakers with the highest odds
    const highestBookmakers = Object.keys(oddsMap).filter(key => oddsMap[key] === maxOdds);
    
    return {
      maxOdds,
      highestBookmakers,
      isSingleHighest: highestBookmakers.length === 1,
      hasMultipleHighest: highestBookmakers.length > 1
    };
  };

  // Add a function to determine the color for value columns
  const getValueColor = (value: number): string => {
    if (value >= 125) return highlightGreen; // Green for 125+
    if (value >= 101) return highlightYellow; // Yellow for 101-124
    return highlightRed; // Red for below 101
  };

  // Add a helper function to format numbers
  const formatNumber = (value: number | null): string => {
    if (value === null) return 'N/A';
    // Check if the number is a whole number (no decimal part)
    if (value % 1 === 0) {
      return value.toFixed(0); // Return without decimal places
    } else {
      return value.toFixed(2); // Return with 2 decimal places
    }
  };

  // Add a function to calculate the best odds for each player
  const calculateBestOdds = (item: OddsData): number => {
    const odds = [
      item.Bet365,
      item.Tab,
      item.Neds,
      item.Sportsbet,
      item.Betright,
      item.Betr,
      item.Dabble,
      item.Topsport
    ].filter((odd): odd is number => odd !== null && odd !== undefined && !isNaN(odd));
    
    return odds.length > 0 ? Math.max(...odds) : 0;
  };

  // Update the updateColumnsFromData function to handle both table types
  const updateColumnsFromData = (item: OddsData, marketType: string = selectedMarket) => {
    if (!item) return;
    
    // Map market types to their corresponding historical and model fields
    const marketFieldMap: Record<string, { historical: string, model: string }> = {
      'ags': { historical: 'AGS Historical', model: 'AGS Model' },
      'fgs': { historical: 'FGS Historical', model: 'FGS Model' },
      'o2gs': { historical: 'O2GS Historical', model: 'O2GS Model' },
      'o3gs': { historical: 'O3GS Historical', model: 'O3GS Model' },
      'o4gs': { historical: 'O4GS Historical', model: 'O4GS Model' },
      'o5gs': { historical: 'O5GS Historical', model: 'O5GS Model' },
      'o20d': { historical: 'O20D Historical', model: 'O20D Model' },
      'o25d': { historical: 'O25D Historical', model: 'O25D Model' },
      'o30d': { historical: 'O30D Historical', model: 'O30D Model' },
      'o35d': { historical: 'O35D Historical', model: 'O35D Model' }
    };
    
    // Get the appropriate historical and model fields for the current market
    const marketFields = marketFieldMap[marketType] || marketFieldMap['ags'];
    
    // Define the headers we want to display and their order
    const headerConfig = [
      { key: 'Number', display: 'No.', width: 60 },
      { key: 'Player', display: 'Name', width: 160 },
      { key: 'Team', display: 'Team', width: 120 },
      { key: 'Match', display: 'Opp', width: 120 },
      { key: 'Best Odds', display: 'Best Odds', width: 120 },
      { key: 'Highest/Model', display: 'Model Value', width: 120 },
      { key: 'Highest/Historical', display: 'Historical Value', width: 140 },
      { key: 'Market Value', display: 'Market Value', width: 120 },
      { key: marketFields.historical, display: marketFields.historical, width: 120 },
      { key: marketFields.model, display: marketFields.model, width: 120 },
      { key: 'Betright', display: 'Betright', width: 100 },
      { key: 'Bet365', display: 'Bet365', width: 100 },
      { key: 'Neds', display: 'Neds', width: 100 },
      { key: 'Sportsbet', display: 'Sportsbet', width: 100 },
      { key: 'Tab', display: 'Tab', width: 100 },
      { key: 'Topsport', display: 'Topsport', width: 100 },
      { key: 'Dabble', display: 'Dabble', width: 100 },
      { key: 'Pointsbet', display: 'Pointsbet', width: 100 },
      { key: 'Unibet', display: 'Unibet', width: 100 }
    ];
    
    // Filter out headers that don't exist in the data
    const newHeaders = headerConfig.filter(header => 
      header.key === 'Best Odds' || 
      (item && header.key in item) || 
      (header.key === 'Match' && 'Match' in item)
    );
    
    setHeaders(newHeaders);
  };

  // Add the missing handleReset function
  const handleReset = () => {
    setSelectedMarket('ags');
    setSelectedMatch('all');
    setPlayerTypeFilter('all');
    
    if (apiData && apiData.ags_summary) {
      setMarketLoading(true);
      const agsData = apiData.ags_summary;
      setData(agsData);
      
      if (agsData.length > 0) {
        updateColumnsFromData(agsData[0]);
      }
      
      setTimeout(() => {
        setMarketLoading(false);
      }, 300);
    }
    
    setSortConfig({ key: '', direction: null });
    setExpandedRowId(null);
  };

  // Add enhanced handlers with pressed state
  const handleResetPress = () => {
    setResetPressed(true);
    handleReset();
    setTimeout(() => {
      setResetPressed(false);
    }, 300);
  };

  // Add the missing handleMarketChange function
  const handleMarketChange = async (value: string) => {
    setSelectedMarket(value);
    if (!apiData) return;
    setMarketLoading(true);
    const marketDataMap: { [key: string]: OddsData[] } = {
      ags: apiData.ags_summary,
      fgs: apiData.fgs_summary,
      o2gs: apiData.o2gs_summary,
      o3gs: apiData.o3gs_summary,
      o4gs: apiData.o4gs_summary,
      o5gs: apiData.o5gs_summary,
      o20d: apiData.o20d_summary,
      o25d: apiData.o25d_summary,
      o30d: apiData.o30d_summary,
      o35d: apiData.o35d_summary,
    };
    const marketData = marketDataMap[value] || [];
    if (marketData.length > 0) {
      updateColumnsFromData(marketData[0], value);
    }
    setData(marketData);
    setTimeout(() => {
      setMarketLoading(false);
    }, 300);
  };

  // Update the toggleDetailedView function
  const toggleDetailedView = () => {
    const newDetailedView = !isDetailedView;
    setIsDetailedView(newDetailedView);
    
    if (data.length > 0) {
      updateColumnsFromData(data[0], selectedMarket);
    }
  };

  // Add the handleHeaderClick function for sorting
  const handleHeaderClick = (key: string) => {
    setIsSorting(true);
    
    requestAnimationFrame(() => {
      setTimeout(() => {
        let direction: 'ascending' | 'descending' | null = 'ascending';
        
        if (sortConfig.key === key) {
          if (sortConfig.direction === 'ascending') {
            direction = 'descending';
          } else if (sortConfig.direction === 'descending') {
            direction = null;
          }
        } else {
          const firstItem = data[0];
          if (firstItem && key in firstItem) {
            const value = firstItem[key as keyof OddsData];
            if (typeof value === 'number') {
              direction = 'descending';
            }
          }
        }
        
        setSortConfig({ key, direction });
        
        setTimeout(() => {
          setIsSorting(false);
        }, 300);
      }, 50);
    });
  };

  // Add the handleRowPress function
  const handleRowPress = (item: OddsData) => {
    if (!isDetailedView) {
      const rowId = `${item.Name}-${item.Match}`;
      setExpandedRowId(expandedRowId === rowId ? null : rowId);
    }
  };

  // Add the renderExpandedContent function
  const renderExpandedContent = (item: OddsData) => {
    const highestOddsInfo = findHighestOdds(item);
    const availableBookmakers = [
      { name: 'Bet365', key: 'Bet365' },
      { name: 'Neds', key: 'Neds' },
      { name: 'Sportsbet', key: 'Sportsbet' },
      { name: 'Tab', key: 'Tab' },
      { name: 'Dabble', key: 'Dabble' },
      { name: 'Pointsbet', key: 'Pointsbet' }
    ];
    
    return (
      <View style={[
        styles.expandedContent,
        {
          backgroundColor: isDarkMode ? '#1C2732' : '#F7FAFC',
          paddingVertical: 16,
          paddingHorizontal: 12,
          marginTop: 0,
          borderBottomLeftRadius: 8,
          borderBottomRightRadius: 8,
        }
      ]}>
        <Text style={{
          color: isDarkMode ? '#A0AEC0' : '#4A5568',
          fontSize: 14,
          fontWeight: '600',
          marginBottom: 12,
          paddingLeft: 4
        }}>
          Bookmaker Odds
        </Text>
        <View style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'flex-start',
          gap: 8,
        }}>
          {availableBookmakers.map(bookie => {
            const odds = item[bookie.key as keyof OddsData] as number | null;
            if (odds === null || odds === undefined || isNaN(odds)) return null;
            
            const isHighest = highestOddsInfo.highestBookmakers.includes(bookie.key);
            
            return (
              <View 
                key={bookie.key} 
                style={{
                  width: '23%',
                  backgroundColor: isDarkMode ? '#233240' : '#FFFFFF',
                  borderRadius: 8,
                  padding: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...(isHighest && {
                    backgroundColor: isDarkMode ? 'rgba(16, 213, 146, 0.2)' : 'rgba(16, 213, 146, 0.15)',
                  }),
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: isDarkMode ? 0.4 : 0.1,
                  shadowRadius: 2,
                  elevation: 2,
                }}
              >
                <Text style={{
                  color: isDarkMode ? '#A0AEC0' : '#4A5568',
                  fontSize: 12,
                  marginBottom: 4,
                  fontWeight: '500'
                }}>
                  {bookie.name}
                </Text>
                <Text style={{
                  color: isDarkMode ? '#FFFFFF' : '#1A202C',
                  fontSize: 16,
                  fontWeight: '700',
                  ...(isHighest && {
                    color: isDarkMode ? '#10D592' : '#047857'
                  })
                }}>
                  {formatNumber(odds)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  // Add the renderRow function
  const renderRow = ({ item, index }: ListRenderItemInfo<OddsData>) => {
    // console.log('Rendering row:', { index, player: item.Player });
    const isAlternateRow = index % 2 === 0;
    const rowBackgroundColor = isDarkMode ? '#395676' : (isAlternateRow ? alternateRowColor : '#FFFFFF');
    const rowTextColor = isDarkMode ? '#FFFFFF' : textColor;
    const highestOddsInfo = findHighestOdds(item);
    
    return (
      <View style={[
        styles.tableRow, 
        { 
          backgroundColor: rowBackgroundColor, 
          borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : tableCellBorderColor,
          height: 55,
          position: 'relative',
          zIndex: 0
        }
      ]}>
        {headers.filter(header => header.key !== 'Player').map(header => {
          const isBookmaker = ['Betright', 'Bet365', 'Neds', 'Sportsbet', 
                              'Tab', 'Topsport', 'Dabble', 'Pointsbet', 'Unibet'].includes(header.key);
          const isHighestOdds = highestOddsInfo.highestBookmakers.includes(header.key);
          const isValueColumn = ['Highest/Model', 'Highest/Historical', 'Market Value'].includes(header.key);
          const value = item[header.key as keyof OddsData];
          
          let cellBackgroundColor: string = 'transparent';
          if (isBookmaker && isHighestOdds) {
            cellBackgroundColor = highestOddsInfo.isSingleHighest ? highlightGreen : highlightYellow;
          } else if (isValueColumn && typeof value === 'number') {
            cellBackgroundColor = getValueColor(value);
          }
          
          let cellTextColor = rowTextColor;
          if ((isBookmaker && isHighestOdds) || (isValueColumn && typeof value === 'number')) {
            cellTextColor = '#000000';
          }
          
          let cellContent: string | number = 'N/A';
          
          if (header.key === 'Team' && item.Team) {
            cellContent = formatTeamName(item.Team);
          } else if (header.key === 'Match') {
            const opponent = getOpponentTeam(item.Match, item.Team);
            cellContent = formatTeamName(opponent);
          } else if (header.key === 'Best Odds') {
            cellContent = formatNumber(calculateBestOdds(item));
          } else if (item[header.key as keyof OddsData] !== undefined) {
            const rawValue = item[header.key as keyof OddsData];
            if (typeof rawValue === 'number') {
              cellContent = formatNumber(rawValue);
            } else {
              cellContent = rawValue as string;
            }
          }
          
          const textAlign = header.key === 'Player' ? 'left' : 'center';
          const justifyContent = header.key === 'Player' ? 'flex-start' : 'center';
          const needsColoredBackground = cellBackgroundColor !== 'transparent';
          
          return (
            <View 
              key={header.key} 
              style={[
                styles.tableCell, 
                { 
                  width: header.width,
                  backgroundColor: 'transparent',
                  borderRightColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : tableCellBorderColor,
                  justifyContent: justifyContent,
                  alignItems: header.key === 'Player' ? 'flex-start' : 'center',
                  paddingLeft: header.key === 'Player' ? 16 : 8,
                  overflow: 'visible'
                }
              ]}
            >
              {needsColoredBackground ? (
                <View style={[
                  styles.coloredBackground,
                  { 
                    backgroundColor: cellBackgroundColor,
                    zIndex: 1
                  }
                ]}>
                  <Text style={[
                    styles.cellText, 
                    { 
                      color: cellTextColor,
                      fontWeight: (header.key === 'Best Odds' || header.key === 'Market Value' || 
                                (isBookmaker && isHighestOdds) || isValueColumn) ? 'bold' : 'normal',
                      textAlign: textAlign,
                      fontFamily
                    }
                  ]}>
                    {cellContent}
                  </Text>
                </View>
              ) : (
                <Text style={[
                  styles.cellText, 
                  { 
                    color: cellTextColor,
                    fontWeight: (header.key === 'Best Odds' || header.key === 'Market Value' || 
                              (isBookmaker && isHighestOdds) || isValueColumn) ? 'bold' : 'normal',
                    textAlign: textAlign,
                    fontFamily
                  }
                ]}>
                  {cellContent}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  // Add the renderFixedNameColumn function
  const renderFixedNameColumn = ({ item, index }: ListRenderItemInfo<OddsData>) => {
    const isAlternateRow = index % 2 === 0;
    const rowBackgroundColor = isDarkMode ? '#395676' : (isAlternateRow ? alternateRowColor : '#FFFFFF');
    
    return (
      <View style={[
        styles.tableCell,
        styles.fixedCell,
        { 
          backgroundColor: rowBackgroundColor,
          borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : tableCellBorderColor,
          borderBottomWidth: 1,
          height: 55,
          alignItems: 'flex-start',
          paddingLeft: 16,
          justifyContent: 'center'
        }
      ]}>
        <Text style={[
          styles.cellText,
          { 
            color: isDarkMode ? '#FFFFFF' : textColor,
            fontWeight: 'bold',
            textAlign: 'left',
            width: '100%',
            fontFamily
          }
        ]}>
          {item.Name}
        </Text>
      </View>
    );
  };

  // Add the renderSimpleRow function
  const renderSimpleRow = ({ item, index }: ListRenderItemInfo<OddsData>) => {
    const isAlternateRow = index % 2 === 0;
    const marketValue = item['Market Value'] as number;
    const modelValue = item['Highest/Model'] as number;
    const bestOdds = calculateBestOdds(item);
    
    const rowBackgroundColor = isDarkMode 
      ? (isAlternateRow ? '#2A3B4D' : '#233240') 
      : (isAlternateRow ? '#F8FAFC' : '#FFFFFF');
    
    const rowTextColor = isDarkMode ? '#FFFFFF' : textColor;
    
    let marketValueBgColor = 'transparent';
    if (typeof marketValue === 'number') {
      marketValueBgColor = getValueColor(marketValue);
    }
    
    let modelValueBgColor = 'transparent';
    if (typeof modelValue === 'number') {
      modelValueBgColor = getValueColor(modelValue);
    }
    
    const teamShort = formatTeamName(item.Team);
    const opponentShort = formatTeamName(getOpponentTeam(item.Match, item.Team));
    
    const rowId = `${item.Name}-${item.Match}`;
    const isExpanded = expandedRowId === rowId;
    
    return (
      <View style={{ 
        width: '100%', 
        paddingHorizontal: 8, 
        paddingVertical: 4,
      }}>
        <TouchableOpacity
          onPress={() => handleRowPress(item)}
          activeOpacity={0.7}
        >
          <View style={[
            styles.tableRow, 
            { 
              backgroundColor: rowBackgroundColor,
              borderRadius: 8,
              overflow: 'hidden',
              height: 50,
              width: '100%',
              shadowColor: isDarkMode ? '#000' : '#282828',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: isDarkMode ? 0.4 : 0.1,
              shadowRadius: 3,
              elevation: 2,
            }
          ]}>
            {/* Player Column */}
            <View 
              style={[
                styles.tableCell, 
                { 
                  flex: 0.4,
                  width: undefined,
                  backgroundColor: 'transparent',
                  borderRightWidth: 0,
                  alignItems: 'flex-start',
                  paddingLeft: 12
                }
              ]}
            >
              <View style={styles.playerInfoContainer}>
                <Text style={[styles.cellText, { 
                  color: rowTextColor, 
                  fontWeight: 'bold', 
                  textAlign: 'left', 
                  fontFamily,
                  fontSize: 14
                }]}>
                  {item.Name}
                </Text>
                <Text style={[styles.playerSubInfo, { 
                  color: isDarkMode ? '#A0AEC0' : '#718096', 
                  textAlign: 'left', 
                  fontFamily,
                  fontSize: 12,
                  marginTop: 2
                }]}>
                  <Text style={{ fontWeight: 'bold', color: isDarkMode ? '#A0AEC0' : '#4A5568' }}>{teamShort}</Text> vs {opponentShort}
                </Text>
              </View>
            </View>
            
            {/* Best Odds Column */}
            <View 
              style={[
                styles.tableCell, 
                { 
                  flex: 0.2,
                  width: undefined,
                  backgroundColor: 'transparent',
                  borderRightWidth: 0,
                  alignItems: 'center',
                  justifyContent: 'center'
                }
              ]}
            >
              <View style={{
                backgroundColor: bestOdds > 8 ? 'rgba(16, 213, 146, 0.2)' : 'transparent',
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 12,
              }}>
                <Text style={[styles.cellText, { 
                  color: bestOdds > 8 ? (isDarkMode ? '#10D592' : '#047857') : rowTextColor, 
                  fontWeight: 'bold', 
                  fontFamily, 
                  fontSize: 15
                }]}>
                  {formatNumber(bestOdds)}
                </Text>
              </View>
            </View>
            
            {/* Model Value Column */}
            <View 
              style={[
                styles.tableCell, 
                { 
                  flex: 0.2,
                  width: undefined,
                  backgroundColor: 'transparent',
                  borderRightWidth: 0,
                  alignItems: 'center',
                  justifyContent: 'center'
                }
              ]}
            >
              {modelValueBgColor !== 'transparent' ? (
                <View style={[
                  styles.coloredBackground,
                  { 
                    backgroundColor: modelValueBgColor,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 12,
                  }
                ]}>
                  <Text style={[
                    styles.cellText, 
                    { 
                      color: '#000000',
                      fontWeight: 'bold',
                      fontFamily,
                      fontSize: 14
                    }
                  ]}>
                    {typeof modelValue === 'number' ? formatNumber(modelValue) : 'N/A'}
                  </Text>
                </View>
              ) : (
                <Text style={[
                  styles.cellText, 
                  { 
                    color: rowTextColor,
                    fontWeight: 'bold',
                    fontFamily,
                    fontSize: 14
                  }
                ]}>
                  {typeof modelValue === 'number' ? formatNumber(modelValue) : 'N/A'}
                </Text>
              )}
            </View>
            
            {/* Market Value Column */}
            <View 
              style={[
                styles.tableCell, 
                { 
                  flex: 0.2,
                  width: undefined,
                  backgroundColor: 'transparent',
                  borderRightWidth: 0,
                  alignItems: 'center',
                  justifyContent: 'center'
                }
              ]}
            >
              {marketValueBgColor !== 'transparent' ? (
                <View style={[
                  styles.coloredBackground,
                  { 
                    backgroundColor: marketValueBgColor,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 12,
                  }
                ]}>
                  <Text style={[
                    styles.cellText, 
                    { 
                      color: '#000000',
                      fontWeight: 'bold',
                      fontFamily,
                      fontSize: 14
                    }
                  ]}>
                    {typeof marketValue === 'number' ? formatNumber(marketValue) : 'N/A'}
                  </Text>
                </View>
              ) : (
                <Text style={[
                  styles.cellText, 
                  { 
                    color: rowTextColor,
                    fontWeight: 'bold',
                    fontFamily,
                    fontSize: 14
                  }
                ]}>
                  {typeof marketValue === 'number' ? formatNumber(marketValue) : 'N/A'}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
        
        {/* Expanded content */}
        {isExpanded && renderExpandedContent(item)}
      </View>
    );
  };

  // Update the renderSimpleHeader function
  const renderSimpleHeader = () => (
    <View style={[
      styles.headerRow, 
      { 
        backgroundColor: 'transparent',
        borderBottomWidth: 0,
        marginHorizontal: 8,
        marginBottom: 4,
        width: 'auto'
      }
    ]}>
      {/* Player Header */}
      <View 
        style={[
          styles.headerCell, 
          { 
            flex: 0.4,
            width: undefined,
            backgroundColor: 'transparent',
            borderRightWidth: 0,
            paddingLeft: 12
          }
        ]}
      >
        <TouchableOpacity 
          onPress={() => handleHeaderClick('Player')}
          style={{ width: '100%' }}
        >
          <View style={styles.headerContent}>
            <Text style={[
              styles.headerText, 
              { 
                color: isDarkMode ? '#A0AEC0' : '#4A5568',
                fontWeight: sortConfig.key === 'Player' ? 'bold' : 'normal',
                fontFamily,
                textAlign: 'left',
                fontSize: 14
              }
            ]}>
              Player
            </Text>
            {sortConfig.key === 'Player' && sortConfig.direction && (
              <MaterialCommunityIcons 
                name={sortConfig.direction === 'ascending' ? 'arrow-up' : 'arrow-down'} 
                size={16} 
                color={isDarkMode ? '#A0AEC0' : '#4A5568'} 
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </TouchableOpacity>
      </View>
      
      {/* Best Odds Header */}
      <View 
        style={[
          styles.headerCell, 
          { 
            flex: 0.2,
            width: undefined,
            backgroundColor: 'transparent',
            borderRightWidth: 0,
            alignItems: 'center'
          }
        ]}
      >
        <TouchableOpacity 
          onPress={() => handleHeaderClick('Best Odds')}
          style={{ width: '100%', alignItems: 'center' }}
        >
          <View style={styles.headerContent}>
            <Text style={[
              styles.headerText, 
              { 
                color: isDarkMode ? '#A0AEC0' : '#4A5568',
                fontWeight: sortConfig.key === 'Best Odds' ? 'bold' : 'normal',
                fontFamily,
                fontSize: 14
              }
            ]}>
              Best Odds
            </Text>
            {sortConfig.key === 'Best Odds' && sortConfig.direction && (
              <MaterialCommunityIcons 
                name={sortConfig.direction === 'ascending' ? 'arrow-up' : 'arrow-down'} 
                size={16} 
                color={isDarkMode ? '#A0AEC0' : '#4A5568'} 
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </TouchableOpacity>
      </View>
      
      {/* Model Value Header */}
      <View 
        style={[
          styles.headerCell, 
          { 
            flex: 0.2,
            width: undefined,
            backgroundColor: 'transparent',
            borderRightWidth: 0,
            alignItems: 'center'
          }
        ]}
      >
        <TouchableOpacity 
          onPress={() => handleHeaderClick('Highest/Model')}
          style={{ width: '100%', alignItems: 'center' }}
        >
          <View style={styles.headerContent}>
            <Text style={[
              styles.headerText, 
              { 
                color: isDarkMode ? '#A0AEC0' : '#4A5568',
                fontWeight: sortConfig.key === 'Highest/Model' ? 'bold' : 'normal',
                fontFamily,
                fontSize: 14
              }
            ]}>
              Model
            </Text>
            {sortConfig.key === 'Highest/Model' && sortConfig.direction && (
              <MaterialCommunityIcons 
                name={sortConfig.direction === 'ascending' ? 'arrow-up' : 'arrow-down'} 
                size={16} 
                color={isDarkMode ? '#A0AEC0' : '#4A5568'} 
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </TouchableOpacity>
      </View>
      
      {/* Market Value Header */}
      <View 
        style={[
          styles.headerCell, 
          { 
            flex: 0.2,
            width: undefined,
            backgroundColor: 'transparent',
            borderRightWidth: 0,
            alignItems: 'center'
          }
        ]}
      >
        <TouchableOpacity 
          onPress={() => handleHeaderClick('Market Value')}
          style={{ width: '100%', alignItems: 'center' }}
        >
          <View style={styles.headerContent}>
            <Text style={[
              styles.headerText, 
              { 
                color: isDarkMode ? '#A0AEC0' : '#4A5568',
                fontWeight: sortConfig.key === 'Market Value' ? 'bold' : 'normal',
                fontFamily,
                fontSize: 14
              }
            ]}>
              Market
            </Text>
            {sortConfig.key === 'Market Value' && sortConfig.direction && (
              <MaterialCommunityIcons 
                name={sortConfig.direction === 'ascending' ? 'arrow-up' : 'arrow-down'} 
                size={16} 
                color={isDarkMode ? '#A0AEC0' : '#4A5568'} 
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Update the filteredData memo with better logging
  const filteredData = useMemo(() => {
    console.log('Filtering data:', {
      totalData: data.length,
      selectedMatch,
      playerTypeFilter,
      sortConfig
    });
    
    let filtered = [...data];
    
    // Filter by match
    if (selectedMatch && selectedMatch !== 'all') {
      console.log(`Starting match filtering for: "${selectedMatch}"`);
      console.log('Data sample before match filtering:', filtered.slice(0, 3).map(item => ({
        name: item.Name,
        match: item.Match,
        team: item.Team
      })));
      
      filtered = filtered.filter(item => item.Match === selectedMatch);
      
      console.log(`After match filtering: ${filtered.length} results`);
      console.log('Data sample after match filtering:', filtered.slice(0, 3).map(item => ({
        name: item.Name,
        match: item.Match,
        team: item.Team
      })));
    }
    
    // Filter by player type
    if (playerTypeFilter === 'starters') {
      filtered = filtered.filter(item => {
        const playerNumber = item.Number ? parseInt(String(item.Number), 10) : 0;
        return playerNumber >= 1 && playerNumber <= 13;
      });
    } else if (playerTypeFilter === 'bench') {
      filtered = filtered.filter(item => {
        const playerNumber = item.Number ? parseInt(String(item.Number), 10) : 0;
        return playerNumber >= 14 && playerNumber <= 17;
      });
    }
    
    // Apply sorting
    if (sortConfig.key && sortConfig.direction) {
      filtered = [...filtered].sort((a, b) => {
        if (sortConfig.key === 'Best Odds') {
          const aOdds = calculateBestOdds(a);
          const bOdds = calculateBestOdds(b);
          return sortConfig.direction === 'ascending' 
              ? aOdds - bOdds 
              : bOdds - aOdds;
        }
        
        if (sortConfig.key === 'Match') {
          const aOpp = getOpponentTeam(a.Match, a.Team);
          const bOpp = getOpponentTeam(b.Match, b.Team);
          return sortConfig.direction === 'ascending'
              ? aOpp.localeCompare(bOpp)
              : bOpp.localeCompare(aOpp);
        }
        
        const aValue = a[sortConfig.key as keyof OddsData];
        const bValue = b[sortConfig.key as keyof OddsData];
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'ascending'
              ? aValue.localeCompare(bValue)
              : bValue.localeCompare(aValue);
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'ascending'
              ? aValue - bValue
              : bValue - aValue;
        }
        return 0;
      });
    }
    
    console.log('Final filtered data result:', filtered.length, 'entries');
    return filtered;
  }, [data, selectedMatch, playerTypeFilter, sortConfig]);

  // Enhance the match filtering function
  const handleMatchChange = (value: string) => {
    console.log('Match changed to:', value);
    
    try {
      if (typeof value !== 'string') {
        console.error('Invalid match value:', value);
        return;
      }
      
      setSelectedMatch(value);
      
      // Log matches for debugging
      console.log('Available matches:', matches);
      console.log('Current selection:', value);
      console.log('Data before filtering:', data.length);
      
      const matchFiltered = value === 'all' 
        ? data 
        : data.filter(item => item.Match === value);
      
      console.log('Data after match filtering:', matchFiltered.length);
      
      // Notice: We don't set the data here as it's handled by the useMemo
    } catch (err) {
      console.error('Error in handleMatchChange:', err);
    }
  };

  // Function to open settings modal
  const openSettings = () => {
    // Initialize temp settings with current values
    setTempSelectedMarket(selectedMarket);
    setTempSelectedMatch(selectedMatch);
    setTempPlayerTypeFilter(playerTypeFilter);
    setTempIsDetailedView(isDetailedView);
    setTempIsDarkMode(isDarkMode);
    setSettingsVisible(true);
  };
  
  // Function to apply settings changes
  const applySettings = () => {
    // Check if market type changed
    const marketChanged = tempSelectedMarket !== selectedMarket;
    
    // Apply all settings
    setSelectedMarket(tempSelectedMarket);
    setSelectedMatch(tempSelectedMatch);
    setPlayerTypeFilter(tempPlayerTypeFilter);
    setIsDetailedView(tempIsDetailedView);
    setIsDarkMode(tempIsDarkMode);
    
    // If market type changed, update the data
    if (marketChanged) {
      handleMarketChange(tempSelectedMarket);
    }
    
    // Close the modal
    setSettingsVisible(false);
  };

  // Function to handle sport change
  const handleSportChange = (value: string) => {
    setSelectedSport(value);
    
    if (value === 'nrl') {
      // Use tabs navigation to maintain the bottom bar
      router.push('/(tabs)/OCTDataScreen');
    } else if (value === 'nba') {
      // Show NBA coming soon modal
      setNbaComingSoonVisible(true);
    }
    // If it's already AFL, do nothing
  };

  // Add enhanced handler with pressed state
  const handleSettingsPress = () => {
    setSettingsPressed(true);
    openSettings();
    setTimeout(() => {
      setSettingsPressed(false);
    }, 300);
  };

  // Update the return statement
  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top', 'left', 'right']}>
      <Stack.Screen
        options={{
          title: 'AFL Odds Comparison',
          headerStyle: { backgroundColor: headerBackgroundColor },
          headerTintColor: headerTextColor,
          headerShadowVisible: false,
          headerRight: () => (
            <View style={styles.headerIcons}>
              <TouchableOpacity
                style={[
                  styles.iconActionButton, 
                  { 
                    backgroundColor: resetPressed ? accentColor : (isDarkMode ? '#2D4050' : '#FFFFFF'),
                    borderColor: resetPressed ? accentColor : borderColor,
                    borderWidth: 2,
                    marginRight: 8,
                  }
                ]}
                onPress={handleResetPress}
              >
                <MaterialCommunityIcons
                  name="refresh"
                  size={22}
                  color={resetPressed ? '#FFFFFF' : textColor}
                />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.iconActionButton, 
                  { 
                    backgroundColor: settingsPressed ? accentColor : (isDarkMode ? '#2D4050' : '#FFFFFF'),
                    borderColor: settingsPressed ? accentColor : borderColor,
                    borderWidth: 2,
                  }
                ]}
                onPress={handleSettingsPress}
              >
                <MaterialCommunityIcons
                  name="cog"
                  size={22}
                  color={settingsPressed ? '#FFFFFF' : textColor}
                />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <StatusBar style="dark" />

      <ScrollView 
        style={styles.mainScrollView}
        contentContainerStyle={styles.mainScrollContent}
        showsVerticalScrollIndicator={true}
      >
        {/* Combined Sport Icons and Action Buttons Row */}
        <View style={[styles.controlsRow, { 
          marginHorizontal: 16,
          marginVertical: 6,
          flexDirection: 'row',
          alignItems: 'center'
        }]}>
          {/* Sport Selector Icons - left side */}
          <View style={{ 
            flex: 0.35, 
            flexDirection: 'row', 
            alignItems: 'center'
          }}>
            {/* NRL Ball */}
            <TouchableOpacity
              style={[
                styles.sportIconButton, 
                { 
                  backgroundColor: selectedSport === 'nrl' ? accentColor : (isDarkMode ? '#2D4050' : '#FFFFFF'),
                  borderColor: selectedSport === 'nrl' ? accentColor : borderColor,
                  borderWidth: 2,
                  marginRight: 8,
                }
              ]}
              onPress={() => handleSportChange('nrl')}
            >
              <MaterialCommunityIcons
                name="football"
                size={22}
                color={selectedSport === 'nrl' ? '#FFFFFF' : textColor}
              />
            </TouchableOpacity>
            
            {/* NBA Ball */}
            <TouchableOpacity
              style={[
                styles.sportIconButton, 
                { 
                  backgroundColor: selectedSport === 'nba' ? accentColor : (isDarkMode ? '#2D4050' : '#FFFFFF'),
                  borderColor: selectedSport === 'nba' ? accentColor : borderColor,
                  borderWidth: 2,
                  marginRight: 8,
                }
              ]}
              onPress={() => handleSportChange('nba')}
            >
              <MaterialCommunityIcons
                name="basketball"
                size={22}
                color={selectedSport === 'nba' ? '#FFFFFF' : textColor}
              />
            </TouchableOpacity>
            
            {/* AFL Ball */}
            <TouchableOpacity
              style={[
                styles.sportIconButton, 
                { 
                  backgroundColor: selectedSport === 'afl' ? accentColor : (isDarkMode ? '#2D4050' : '#FFFFFF'),
                  borderColor: selectedSport === 'afl' ? accentColor : borderColor,
                  borderWidth: 2,
                }
              ]}
              onPress={() => handleSportChange('afl')}
            >
              <MaterialCommunityIcons
                name="football-australian"
                size={22}
                color={selectedSport === 'afl' ? '#FFFFFF' : textColor}
              />
            </TouchableOpacity>
          </View>
          
          {/* Centered Sport Label */}
          <View style={{ 
            flex: 0.3, 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <Text style={{
              color: '#FFFFFF',
              fontWeight: 'bold',
              fontSize: 16,
              textAlign: 'center',
              fontFamily
            }}>
              {selectedSport === 'nrl' ? 'NRL' : selectedSport === 'afl' ? 'AFL' : 'NBA'}
            </Text>
          </View>
          
          {/* Action Buttons - right side */}
          <View style={{ 
            flex: 0.35, 
            flexDirection: 'row', 
            justifyContent: 'flex-end',
            marginLeft: 8
          }}>
            <TouchableOpacity
              style={[
                styles.iconActionButton, 
                { 
                  backgroundColor: resetPressed ? accentColor : (isDarkMode ? '#2D4050' : '#FFFFFF'),
                  borderColor: resetPressed ? accentColor : borderColor,
                  borderWidth: 2,
                  marginRight: 8,
                }
              ]}
              onPress={handleResetPress}
            >
              <MaterialCommunityIcons
                name="refresh"
                size={22}
                color={resetPressed ? '#FFFFFF' : textColor}
              />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.iconActionButton, 
                { 
                  backgroundColor: settingsPressed ? accentColor : (isDarkMode ? '#2D4050' : '#FFFFFF'),
                  borderColor: settingsPressed ? accentColor : borderColor,
                  borderWidth: 2,
                }
              ]}
              onPress={handleSettingsPress}
            >
              <MaterialCommunityIcons
                name="cog"
                size={22}
                color={settingsPressed ? '#FFFFFF' : textColor}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Table Container moved to top */}
        <View style={{
          borderWidth: 0,
          borderRadius: 0,
          overflow: 'hidden',
          marginHorizontal: 0,
          marginTop: 0,
          marginBottom: 0,
          flex: 1,
          backgroundColor: isDarkMode ? '#2D3B47' : '#FFFFFF',
          shadowColor: isDarkMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.15)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.8,
          shadowRadius: 8,
          elevation: 4,
        }}>
          {isDetailedView ? (
            <View style={{ position: 'relative' }}>
              {/* Fixed Name Column */}
              <View style={[
                styles.fixedColumnContainer, 
                { 
                  backgroundColor: isDarkMode ? '#395676' : '#FFFFFF',
                  borderRightColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
                }
              ]}>
                <View style={[
                  styles.headerCell,
                  { 
                    width: 160,
                    backgroundColor: tableHeaderBackground,
                    borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.03)',
                    borderRightColor: isDarkMode ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.03)',
                    borderBottomWidth: 1,
                    borderRightWidth: 1,
                    height: 40,
                    paddingVertical: 0,
                    alignItems: 'flex-start',
                    paddingLeft: 8,
                    justifyContent: 'center'
                  }
                ]}>
                  <TouchableOpacity 
                    onPress={() => handleHeaderClick('Player')}
                    style={{ width: '100%' }}
                  >
                    <View style={styles.headerContent}>
                      <Text style={[
                        styles.headerText,
                        { 
                          color: headerTextColor,
                          fontWeight: sortConfig.key === 'Player' ? 'bold' : 'normal',
                          fontFamily,
                          textAlign: 'left'
                        }
                      ]}>
                        Player
                      </Text>
                      {sortConfig.key === 'Player' && sortConfig.direction && (
                        <MaterialCommunityIcons 
                          name={sortConfig.direction === 'ascending' ? 'arrow-up' : 'arrow-down'} 
                          size={16} 
                          color={headerTextColor} 
                          style={{ marginLeft: 4 }}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={filteredData}
                  renderItem={renderFixedNameColumn}
                  keyExtractor={(item, index) => `fixed-${item.Name}-${item.Match}-${index}`}
                  style={styles.tableBodyContainer}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={false}
                />
              </View>

              {/* Scrollable Content */}
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={true}
                style={[styles.horizontalScrollView, { marginLeft: 160 }]}
              >
                <View>
                  <View style={[styles.headerRow, { 
                    backgroundColor: tableHeaderBackground,
                    borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.03)'
                  }]}>
                    {headers.filter(header => header.key !== 'Player').map(header => {
                      const isValueColumn = ['Highest/Model', 'Highest/Historical', 'Market Value'].includes(header.key);
                      const isSorted = sortConfig.key === header.key;
                      
                      return (
                        <TouchableOpacity 
                          key={header.key} 
                          style={[
                            styles.headerCell,
                            { 
                              width: header.width,
                              backgroundColor: tableHeaderBackground,
                              borderRightColor: isDarkMode ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.03)'
                            }
                          ]}
                          onPress={() => handleHeaderClick(header.key)}
                        >
                          <View style={styles.headerContent}>
                            <Text style={[
                              styles.headerText,
                              { 
                                color: headerTextColor,
                                fontWeight: header.key === 'Best Odds' || isValueColumn || isSorted ? 'bold' : 'normal',
                                fontFamily
                              }
                            ]}>
                              {header.display || header.key}
                            </Text>
                            {isSorted && sortConfig.direction && (
                              <MaterialCommunityIcons 
                                name={sortConfig.direction === 'ascending' ? 'arrow-up' : 'arrow-down'} 
                                size={16} 
                                color={headerTextColor} 
                                style={{ marginLeft: 4 }}
                              />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <FlatList
                    data={filteredData}
                    renderItem={renderRow}
                    keyExtractor={(item, index) => `scroll-${item.Name}-${item.Match}-${index}`}
                    style={styles.tableBodyContainer}
                    showsVerticalScrollIndicator={true}
                    scrollEnabled={false}
                  />
                </View>
              </ScrollView>
            </View>
          ) : (
            // Simple view with full-width layout
            <View style={{ flex: 1, width: '100%' }}>
              {renderSimpleHeader()}
              <FlatList
                data={filteredData}
                renderItem={renderSimpleRow}
                keyExtractor={(item, index) => `${item.Name}-${item.Match}-${index}`}
                style={{ flex: 1, width: '100%' }}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                initialNumToRender={20}
                maxToRenderPerBatch={10}
                windowSize={10}
              />
            </View>
          )}
        </View>

        {/* Loading and Error States */}
        {loading && (
          <View style={[styles.loadingOverlay, { 
            backgroundColor: isDarkMode ? 'rgba(28, 39, 50, 0.9)' : 'rgba(245, 247, 250, 0.9)',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }]}>
            <ActivityIndicator size="large" color={accentColor} />
            <Text style={[styles.loadingText, { 
              color: textColor,
              marginTop: 16,
              fontSize: 16,
              fontWeight: '600'
            }]}>Loading AFL data...</Text>
          </View>
        )}
        {error && (
          <View style={[styles.errorOverlay, { 
            backgroundColor: isDarkMode ? 'rgba(28, 39, 50, 0.9)' : 'rgba(245, 247, 250, 0.9)',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }]}>
            <MaterialCommunityIcons name="alert-circle" size={48} color="#F44336" />
            <Text style={[styles.errorText, { 
              color: '#F44336',
              marginTop: 16,
              fontSize: 16,
              fontWeight: '600',
              textAlign: 'center',
              paddingHorizontal: 24
            }]}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* Settings Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={settingsVisible}
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={[styles.modalView, { backgroundColor: cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: '#18EAB9' }]}>Settings</Text>
              <TouchableOpacity
                onPress={() => setSettingsVisible(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={24} color={textColor} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.settingsScrollView}>
              <Text style={[styles.settingsSectionTitle, { color: '#18EAB9' }]}>Market Type</Text>
              <DropDownPicker
                open={marketOpen}
                value={tempSelectedMarket}
                items={marketTypes.map(market => ({
                  label: market.name,
                  value: market.id,
                }))}
                setOpen={setMarketOpen}
                setValue={setTempSelectedMarket}
                style={[styles.dropdown, { backgroundColor: cardBackground, borderColor }]}
                textStyle={[styles.dropdownText, { color: textColor }]}
                dropDownContainerStyle={[styles.dropdownContainer, { backgroundColor: cardBackground, borderColor }]}
                listItemContainerStyle={{ borderColor }}
                listItemLabelStyle={{ color: textColor }}
                labelStyle={{ color: textColor }}
                placeholderStyle={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                zIndex={4000}
              />

              <Text style={[styles.settingsSectionTitle, { color: '#18EAB9', marginTop: 16 }]}>Game</Text>
              <DropDownPicker
                open={matchesOpen}
                value={tempSelectedMatch}
                items={[
                  { label: 'All Games', value: 'all' },
                  ...matches.filter(match => match !== 'All Games').map(match => ({
                    label: match,
                    value: match,
                  }))
                ]}
                setOpen={setMatchesOpen}
                setValue={setTempSelectedMatch}
                style={[styles.dropdown, { backgroundColor: cardBackground, borderColor }]}
                textStyle={[styles.dropdownText, { color: textColor }]}
                dropDownContainerStyle={[styles.dropdownContainer, { backgroundColor: cardBackground, borderColor }]}
                listItemContainerStyle={{ borderColor }}
                listItemLabelStyle={{ color: textColor }}
                labelStyle={{ color: textColor }}
                placeholderStyle={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                zIndex={3000}
                zIndexInverse={4000}
                maxHeight={200}
              />

              <Text style={[styles.settingsSectionTitle, { color: '#18EAB9', marginTop: 16 }]}>Player Type</Text>
              <DropDownPicker
                open={playerTypeOpen}
                value={tempPlayerTypeFilter}
                items={[
                  { label: 'All Players', value: 'all' },
                  { label: 'Starters Only', value: 'starters' },
                  { label: 'Bench Only', value: 'bench' }
                ]}
                setOpen={setPlayerTypeOpen}
                setValue={setTempPlayerTypeFilter}
                style={[styles.dropdown, { backgroundColor: cardBackground, borderColor }]}
                textStyle={[styles.dropdownText, { color: textColor }]}
                dropDownContainerStyle={[styles.dropdownContainer, { backgroundColor: cardBackground, borderColor }]}
                listItemContainerStyle={{ borderColor }}
                listItemLabelStyle={{ color: textColor }}
                labelStyle={{ color: textColor }}
                placeholderStyle={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                zIndex={2000}
                zIndexInverse={3000}
              />

              <Text style={[styles.settingsSectionTitle, { color: '#18EAB9', marginTop: 16 }]}>Display Options</Text>
              <View style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => setTempIsDarkMode(!tempIsDarkMode)}
                >
                  <View style={[
                    styles.checkboxBox, 
                    { 
                      borderColor: accentColor,
                      backgroundColor: tempIsDarkMode ? accentColor : 'transparent' 
                    }
                  ]}>
                    {tempIsDarkMode && (
                      <MaterialCommunityIcons
                        name="check"
                        size={16}
                        color="#FFFFFF"
                      />
                    )}
                  </View>
                  <Text style={[styles.toggleText, { color: textColor, marginLeft: 8 }]}>
                    Dark Mode
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => setTempIsDetailedView(!tempIsDetailedView)}
                >
                  <View style={[
                    styles.checkboxBox, 
                    { 
                      borderColor: accentColor,
                      backgroundColor: tempIsDetailedView ? accentColor : 'transparent' 
                    }
                  ]}>
                    {tempIsDetailedView && (
                      <MaterialCommunityIcons
                        name="check"
                        size={16}
                        color="#FFFFFF"
                      />
                    )}
                  </View>
                  <Text style={[styles.toggleText, { color: textColor, marginLeft: 8 }]}>
                    Full View
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.button, styles.buttonCancel, { borderColor }]}
                onPress={() => setSettingsVisible(false)}
              >
                <Text style={[styles.buttonText, { color: textColor }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.buttonApply, { backgroundColor: accentColor }]}
                onPress={applySettings}
              >
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Apply Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {marketLoading && (
        <View style={[styles.loadingOverlay, { backgroundColor: 'rgba(255, 255, 255, 0.9)' }]}>
          <ActivityIndicator size="large" color={accentColor} />
          <Text style={[styles.loadingText, { color: textColor }]}>Loading market data...</Text>
        </View>
      )}
      
      {isSorting && (
        <View style={[styles.loadingOverlay, { 
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          zIndex: 1000
        }]}>
          <ActivityIndicator size="large" color={accentColor} />
          <Text style={[styles.loadingText, { color: textColor }]}>Sorting data...</Text>
        </View>
      )}

      {/* NBA Coming Soon Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={nbaComingSoonVisible}
        onRequestClose={() => setNbaComingSoonVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={[styles.modalView, { 
            backgroundColor: cardBackground,
            padding: 24,
            alignItems: 'center',
            maxHeight: 'auto'
          }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>NBA Stats Coming Soon</Text>
              <TouchableOpacity
                onPress={() => setNbaComingSoonVisible(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={24} color={textColor} />
              </TouchableOpacity>
            </View>

            <View style={{ alignItems: 'center', marginVertical: 20 }}>
              <MaterialCommunityIcons
                name="basketball"
                size={64}
                color={accentColor}
                style={{ marginBottom: 16 }}
              />
              <Text style={[styles.comingSoonMessage, { color: textColor, textAlign: 'center', marginBottom: 8 }]}>
                NBA statistics are under development
              </Text>
              <Text style={[styles.comingSoonSubMessage, { 
                color: isDarkMode ? '#A0AEC0' : '#4A5568',
                textAlign: 'center'
              }]}>
                We're working hard to bring you comprehensive NBA statistics and betting data. Check back soon!
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.button, { 
                backgroundColor: accentColor,
                minWidth: 140,
                marginTop: 20
              }]}
              onPress={() => setNbaComingSoonVisible(false)}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainScrollView: {
    flex: 1,
  },
  mainScrollContent: {
    paddingBottom: 20,
  },
  controls: {
    padding: 16,
    gap: 12,
    marginTop: 16,
  },
  dropdown: {
    borderRadius: 8,
    minHeight: 45,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    borderWidth: 1,
  },
  dropdownContainer: {
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
  },
  dropdownText: {
    fontSize: 16,
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingHorizontal: 16,
  },
  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  toggleText: {
    fontSize: 16,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableContainer: {
    borderWidth: 0,
    borderRadius: 0,
    overflow: 'hidden',
    marginHorizontal: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    marginBottom: 0,
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    height: 40,
  },
  headerCell: {
    paddingHorizontal: 8,
    alignItems: 'flex-start',
    justifyContent: 'center',
    borderRightWidth: 0.5,
    height: 40,
    paddingVertical: 0,
  },
  headerText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'left',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    height: 40,
  },
  tableCell: {
    paddingHorizontal: 4,
    alignItems: 'flex-start',
    justifyContent: 'center',
    borderRightWidth: 0.5,
    position: 'relative',
    zIndex: 0,
    height: 40,
    paddingVertical: 0,
  },
  cellText: {
    fontSize: 13,
    textAlign: 'left',
  },
  playerName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  playerInfoContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: '100%'
  },
  playerSubInfo: {
    fontSize: 11,
    textAlign: 'left',
    marginTop: 2,
    color: '#666666',
  },
  coloredBackground: {
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    elevation: 1,
    position: 'relative',
  },
  expandedContent: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  expandedRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    paddingRight: 16,
  },
  expandedBookieName: {
    fontSize: 12,
    marginBottom: 4,
  },
  expandedOddsText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  fixedColumnContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 160,
    zIndex: 2,
    elevation: 2,
    borderRightWidth: 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  fixedCell: {
    width: 160,
    borderRightWidth: 0.5,
    height: 40,
  },
  expandedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    padding: 8,
  },
  expandedBookieContainer: {
    padding: 10,
    minWidth: '30%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizontalScrollView: {
    flexGrow: 1,
  },
  tableBodyContainer: {
    flexGrow: 1,
  },
  message: {
    textAlign: 'center',
    padding: 16,
    fontSize: 16,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
    marginHorizontal: 4,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  settingsSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  settingsScrollView: {
    marginBottom: 16,
  },
  checkboxContainer: {
    marginVertical: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  buttonCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    marginRight: 12,
  },
  buttonApply: {
    minWidth: 120,
  },
  controlsRow: {
    marginHorizontal: 16,
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sportIconButton: {
    padding: 0,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  iconActionButton: {
    padding: 0,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  comingSoonMessage: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  comingSoonSubMessage: {
    fontSize: 14,
    fontWeight: 'normal',
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  errorText: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  bookieContent: {
    padding: 8,
    alignItems: 'center',
  },
});