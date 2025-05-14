import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    ListRenderItemInfo,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// First, update the OddsData interface to be more flexible for different market types
interface OddsData {
  Number: string;
  Player: string;
  Team: string;
  Match: string;
  Games: number;
  'ATS Historical'?: number;
  'FTS Historical'?: number;
  'LTS Historical'?: number;
  'FTS2H Historical'?: number;
  'TPT Historical'?: number;
  'FST Historical'?: number;
  'CCM Historical'?: number;
  'FTSLTS Historical'?: number;
  'FTS2TS Historical'?: number;
  'ATS Model'?: number;
  'FTS Model'?: number;
  'LTS Model'?: number;
  'FTS2H Model'?: number;
  'TPT Model'?: number;
  'FST Model'?: number;
  'CCM Model'?: number;
  'FTSLTS Model'?: number;
  'FTS2TS Model'?: number;
  'Highest/Model'?: number;
  'Highest/Historical'?: number;
  Tab?: number;
  Neds?: number;
  Betright?: number;
  Bet365?: number;
  Topsport?: number;
  Sportsbet?: number;
  Pointsbet?: number;
  Dabble?: number;
  Unibet?: number;
  'Market Value'?: number;
  [key: string]: string | number | undefined; // Allow for dynamic keys
}

// Update the ApiResponse interface to include all market types
interface ApiResponse {
  matches: string[];
  ats_summary: OddsData[];
  fts_summary: OddsData[];
  lts_summary: OddsData[];
  fts2h_summary: OddsData[];
  tpt_summary: OddsData[];
  fst_summary: OddsData[];
  ccm_summary: OddsData[];
  ftslts_summary: OddsData[];
  fts2ts_summary: OddsData[];
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

export default function OddsComparisonScreen() {
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
  const [selectedSport, setSelectedSport] = useState('nrl');

  // Add settings modal state
  const [settingsVisible, setSettingsVisible] = useState(false);
  
  // Add NBA coming soon modal state
  const [nbaComingSoonVisible, setNbaComingSoonVisible] = useState(false);

  // Create temporary states for settings to apply only when "Apply Changes" is pressed
  const [tempSelectedMarket, setTempSelectedMarket] = useState('ats');
  const [tempSelectedMatch, setTempSelectedMatch] = useState('all');
  const [tempPlayerTypeFilter, setTempPlayerTypeFilter] = useState('all');
  const [tempIsDetailedView, setTempIsDetailedView] = useState(false);
  const [tempIsDarkMode, setTempIsDarkMode] = useState(true);

  // Add dropdown states
  const [marketOpen, setMarketOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState('ats');
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
    { id: 'ats', name: 'Anytime Try Scorer' },
    { id: 'fts', name: 'First Try Scorer' },
    { id: 'lts', name: 'Last Try Scorer' },
    { id: 'fts2h', name: 'First Try Scorer 2nd Half' },
    { id: 'tpt', name: 'Two Plus Tries' },
    { id: 'fst', name: 'First Scoring Type' },
    { id: 'ccm', name: 'Correct Conversion Miss' },
    { id: 'ftslts', name: 'First/Last Try Scorer' },
    { id: 'fts2ts', name: 'First/Second Try Scorer' }
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
  
  // Update the row press handler to toggle expansion instead of showing modal
  const handleRowPress = (item: OddsData) => {
    if (!isDetailedView) {
      const rowId = `${item.Number}-${item.Player}-${item.Match}`;
      setExpandedRowId(expandedRowId === rowId ? null : rowId);
    }
  };
  
  // Update the renderExpandedContent function with improved styling
  const renderExpandedContent = (item: OddsData) => {
    const highestOddsInfo = findHighestOdds(item);
    const bookmakerFields = [
      'Betright', 'Bet365', 'Neds', 'Sportsbet', 
      'Tab', 'Topsport', 'Dabble', 'Pointsbet', 'Unibet'
    ];
    
    // Filter out bookmakers with no odds
    const availableBookmakers = bookmakerFields.filter(
      bookie => typeof item[bookie as keyof OddsData] === 'number' && 
                (item[bookie as keyof OddsData] as number) > 0
    );
    
    const rowBackgroundColor = isDarkMode ? '#203040' : '#F8FAFC';
    const rowTextColor = isDarkMode ? '#FFFFFF' : textColor;
    
    return (
      <View style={[styles.expandedContent, { 
        backgroundColor: rowBackgroundColor,
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 8,
        marginHorizontal: 8,
        marginTop: -4,
        marginBottom: 4,
        shadowColor: isDarkMode ? '#000' : '#282828',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: isDarkMode ? 0.4 : 0.1,
        shadowRadius: 2,
        elevation: 1,
        padding: 12,
      }]}>
        {/* Odds Section */}
        <View style={styles.expandedSection}>
          <Text style={[styles.expandedSectionTitle, { color: isDarkMode ? '#FFFFFF' : '#4A5568' }]}>
            Bookmaker Odds
          </Text>
          <View style={styles.expandedGrid}>
            {['Betright', 'Bet365', 'Neds', 'Sportsbet', 'Tab', 'Topsport', 'Dabble', 'Pointsbet', 'Unibet'].map(bookie => {
              const odds = item[bookie as keyof OddsData] as number;
              if (typeof odds !== 'number' || odds <= 0) return null;
              
              const isHighest = findHighestOdds(item).highestBookmakers.includes(bookie);
              
              return (
                <View 
                  key={bookie} 
                  style={[
                    styles.expandedBookieContainer,
                    isHighest && {
                      backgroundColor: isDarkMode ? 'rgba(130, 208, 114, 0.2)' : 'rgba(130, 208, 114, 0.15)',
                      borderRadius: 8,
                    }
                  ]}
                >
                  <View style={[
                    styles.bookieContent,
                    { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)' }
                  ]}>
                    <Text style={[
                      styles.expandedBookieName,
                      isHighest && {
                        color: isDarkMode ? '#A0E9C8' : '#047857',
                        fontWeight: 'bold',
                      }
                    ]}>
                      {bookie}
                    </Text>
                    <Text style={[
                      styles.expandedOddsText,
                      isHighest && {
                        color: isDarkMode ? '#10D592' : '#047857',
                      }
                    ]}>
                      {formatNumber(odds)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };
  
  // Update the renderRow function to use lighter borders
  const renderRow = ({ item, index }: ListRenderItemInfo<OddsData>) => {
    const isAlternateRow = index % 2 === 0;
    const rowBackgroundColor = isDarkMode ? '#395676' : (isAlternateRow ? alternateRowColor : '#FFFFFF');
    const rowTextColor = isDarkMode ? '#FFFFFF' : textColor;
    const highestOddsInfo = findHighestOdds(item);
    
    // Set very subtle border colors based on dark mode
    const borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)';
    
    return (
      <View style={[
        styles.tableRow, 
        { 
          backgroundColor: rowBackgroundColor, 
          borderBottomColor: borderColor,
          borderBottomWidth: 0.5,
          height: 40,
          position: 'relative',
          zIndex: 0
        }
      ]}>
        {headers.filter(header => header.key !== 'Player').map(header => {
          // Check if this is a bookmaker column with the highest odds
          const isBookmaker = ['Betright', 'Bet365', 'Neds', 'Sportsbet', 
                              'Tab', 'Topsport', 'Dabble', 'Pointsbet', 'Unibet'].includes(header.key);
          const isHighestOdds = highestOddsInfo.highestBookmakers.includes(header.key);
          
          // Check if this is a value column that needs color coding
          const isValueColumn = ['Highest/Model', 'Highest/Historical', 'Market Value'].includes(header.key);
          const value = item[header.key as keyof OddsData];
          
          // Determine cell background color
          let cellBackgroundColor: string = 'transparent';
          if (isBookmaker && isHighestOdds) {
            cellBackgroundColor = highestOddsInfo.isSingleHighest ? highlightGreen : highlightYellow;
          } else if (isValueColumn && typeof value === 'number') {
            cellBackgroundColor = getValueColor(value);
          }
          
          // Determine text color based on background and row type
          let cellTextColor = rowTextColor; // Use row text color by default
          if ((isBookmaker && isHighestOdds) || (isValueColumn && typeof value === 'number')) {
            cellTextColor = '#000000'; // Black text on colored backgrounds
          }
          
          // Format the cell content
          let cellContent: string | number = 'N/A';
          
          if (header.key === 'Team' && item.Team) {
            cellContent = formatTeamName(item.Team as string);
          } else if (header.key === 'Match') {
            const opponent = getOpponentTeam(item.Match as string, item.Team as string);
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
          
          // Use left alignment for all cells now instead of center
          const textAlign = 'left';
          const justifyContent = 'flex-start';
          
          // Determine if we need a colored background
          const needsColoredBackground = cellBackgroundColor !== 'transparent';
          
          return (
            <View 
              key={header.key} 
              style={[
                styles.tableCell, 
                { 
                  width: header.width,
                  backgroundColor: 'transparent',
                  borderRightColor: borderColor,
                  borderRightWidth: 0.5,
                  justifyContent: justifyContent,
                  alignItems: 'flex-start',
                  paddingLeft: 8,
                  overflow: 'visible'
                }
              ]}
            >
              {needsColoredBackground ? (
                <View style={[
                  styles.coloredBackground,
                  { 
                    backgroundColor: cellBackgroundColor,
                    zIndex: 1,
                    alignItems: 'flex-start'
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

  // Update the renderFixedNameColumn function to use lighter borders
  const renderFixedNameColumn = ({ item, index }: ListRenderItemInfo<OddsData>) => {
    const isAlternateRow = index % 2 === 0;
    const rowBackgroundColor = isDarkMode ? '#395676' : (isAlternateRow ? alternateRowColor : '#FFFFFF');
    
    // Set very subtle border colors based on dark mode
    const borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)';
    
    return (
      <View style={[
        styles.tableCell,
        styles.fixedCell,
        { 
          backgroundColor: rowBackgroundColor,
          borderBottomColor: borderColor,
          borderBottomWidth: 0.5,
          borderRightColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
          height: 40,
          alignItems: 'flex-start',
          paddingLeft: 8,
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
            fontFamily,
            fontSize: 13
          }
        ]}>
          {item.Player}
        </Text>
      </View>
    );
  };

  // Update the renderSimpleRow function with improved styling
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
    
    const teamShort = formatTeamName(item.Team as string);
    const opponentShort = formatTeamName(getOpponentTeam(item.Match as string, item.Team as string));
    
    const rowId = `${item.Number}-${item.Player}-${item.Match}`;
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
                  {item.Player}
                </Text>
                <Text style={[styles.playerSubInfo, { 
                  color: isDarkMode ? '#A0AEC0' : '#718096', 
                  textAlign: 'left', 
                  fontFamily,
                  fontSize: 12,
                  marginTop: 2
                }]}>
                  <Text style={{ fontWeight: 'bold', color: isDarkMode ? '#A0AEC0' : '#4A5568' }}>{teamShort}</Text> vs {opponentShort} ({item.Number})
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
        {isExpanded && (
          <View style={[
            styles.expandedContent, 
            { 
              backgroundColor: isDarkMode ? '#203040' : '#F8FAFC',
              borderBottomLeftRadius: 8,
              borderBottomRightRadius: 8,
              marginHorizontal: 8,
              marginTop: -4,
              marginBottom: 4,
              shadowColor: isDarkMode ? '#000' : '#282828',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: isDarkMode ? 0.4 : 0.1,
              shadowRadius: 2,
              elevation: 1,
              padding: 12,
            }
          ]}>
            {/* Odds Section */}
            <View style={styles.expandedSection}>
              <Text style={[styles.expandedSectionTitle, { color: isDarkMode ? '#FFFFFF' : '#4A5568' }]}>
                Bookmaker Odds
              </Text>
              <View style={styles.expandedGrid}>
                {['Betright', 'Bet365', 'Neds', 'Sportsbet', 'Tab', 'Topsport', 'Dabble', 'Pointsbet', 'Unibet'].map(bookie => {
                  const odds = item[bookie as keyof OddsData] as number;
                  if (typeof odds !== 'number' || odds <= 0) return null;
                  
                  const isHighest = findHighestOdds(item).highestBookmakers.includes(bookie);
                  
                  return (
                    <View 
                      key={bookie} 
                      style={[
                        styles.expandedBookieContainer,
                        isHighest && {
                          backgroundColor: isDarkMode ? 'rgba(130, 208, 114, 0.2)' : 'rgba(130, 208, 114, 0.15)',
                          borderRadius: 8,
                        }
                      ]}
                    >
                      <View style={[
                        styles.bookieContent,
                        { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)' }
                      ]}>
                        <Text style={[
                          styles.expandedBookieName,
                          isHighest && {
                            color: isDarkMode ? '#A0E9C8' : '#047857',
                            fontWeight: 'bold',
                          }
                        ]}>
                          {bookie}
                        </Text>
                        <Text style={[
                          styles.expandedOddsText,
                          isHighest && {
                            color: isDarkMode ? '#10D592' : '#047857',
                          }
                        ]}>
                          {formatNumber(odds)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  // Render a simplified table header for the less detailed view
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
                fontWeight: sortConfig.key === 'Player' ? 'bold' : '600',
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
                fontWeight: sortConfig.key === 'Best Odds' ? 'bold' : '600',
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
                fontWeight: sortConfig.key === 'Highest/Model' ? 'bold' : '600',
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
                fontWeight: sortConfig.key === 'Market Value' ? 'bold' : '600',
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

  // Fetch data function
  const fetchData = async () => {
    try {
      setLoading(true);
      // (Optional) Delay for UI visibility in development
      if (process.env.NODE_ENV === 'development') {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      // NOTE: Adjust your API URL as needed
      const apiUrl = 'https://wicky-nrl-api-12a5d66a862f.herokuapp.com/premium_new_betting_data'; // For NRL
      // const apiUrl = 'https://wicky-nrl-api-12a5d66a862f.herokuapp.com/afl_betting_data'; // For AFL
      const options = {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      };
      console.log('Fetching data from:', apiUrl);
      const response = await fetch(apiUrl, options);
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      const json: ApiResponse = await response.json();
      console.log('Data fetched successfully:', Object.keys(json));
      setApiData(json);
      const initialData = json.ats_summary || [];
      setData(initialData);
      if (initialData.length > 0) {
        updateColumnsFromData(initialData[0]);
      }
      setMatches(json.matches || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(`Failed to fetch data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Update the updateColumnsFromData function to handle both table types
  const updateColumnsFromData = (item: OddsData, marketType: string = selectedMarket) => {
    if (!item) return;
    
    // Map market types to their corresponding historical and model fields
    const marketFieldMap: Record<string, { historical: string, model: string }> = {
      'ats': { historical: 'ATS Historical', model: 'ATS Model' },
      'fts': { historical: 'FTS Historical', model: 'FTS Model' },
      'lts': { historical: 'LTS Historical', model: 'LTS Model' },
      'fts2h': { historical: 'FTS2H Historical', model: 'FTS2H Model' },
      'tpt': { historical: 'TPT Historical', model: 'TPT Model' },
      'fst': { historical: 'FST Historical', model: 'FST Model' },
      'ccm': { historical: 'CCM Historical', model: 'CCM Model' },
      'ftslts': { historical: 'FTSLTS Historical', model: 'FTSLTS Model' },
      'fts2ts': { historical: 'FTS2TS Historical', model: 'FTS2TS Model' }
    };
    
    // Get the appropriate historical and model fields for the current market
    const marketFields = marketFieldMap[marketType] || marketFieldMap['ats'];
    
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
    // But keep 'Best Odds' which is calculated
    const newHeaders = headerConfig.filter(header => 
      header.key === 'Best Odds' || 
      (item && header.key in item) || 
      // Special case for 'Opp' which is derived from 'Match'
      (header.key === 'Match' && 'Match' in item)
    );
    
    setHeaders(newHeaders);
  };

  // Add this function to calculate the best odds for each player
  const calculateBestOdds = (item: OddsData): number => {
    // Get all the bookmaker odds fields
    const bookmakerFields = [
      'Tab', 'Neds', 'Betright', 'Bet365', 
      'Topsport', 'Sportsbet', 'Pointsbet', 'Dabble', 'Unibet'
    ];
    
    // Filter out non-numeric values and find the maximum
    const odds = bookmakerFields
      .map(field => item[field as keyof OddsData])
      .filter(value => typeof value === 'number' && value > 0) as number[];
    
    if (odds.length === 0) return 0;
    return Math.max(...odds);
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

  // Update the filtering logic to filter by both match and player type
  const applyFilters = (data: OddsData[]) => {
    let filtered = data;
    
    // Apply match filtering
    if (selectedMatch !== 'all') {
      filtered = filtered.filter(item => item.Match === selectedMatch);
    }
    
    // Apply player type filtering
    if (playerTypeFilter === 'starters') {
      filtered = filtered.filter(item => {
        const playerNumber = parseInt(item.Number, 10);
        return playerNumber >= 1 && playerNumber <= 13;
      });
    } else if (playerTypeFilter === 'bench') {
      filtered = filtered.filter(item => {
        const playerNumber = parseInt(item.Number, 10);
        return playerNumber >= 14 && playerNumber <= 17;
      });
    }
    
    return filtered;
  };

  // Replace the existing filteredData with the new function that includes sorting
  const filteredData = useMemo(() => {
    let filtered = applyFilters(data);
    
    // Apply sorting if sortConfig is set
    if (sortConfig.key && sortConfig.direction) {
      filtered = [...filtered].sort((a, b) => {
        // Special case for Best Odds
        if (sortConfig.key === 'Best Odds') {
          const aOdds = calculateBestOdds(a);
          const bOdds = calculateBestOdds(b);
          return sortConfig.direction === 'ascending' 
              ? aOdds - bOdds 
              : bOdds - aOdds;
        }
        
        // Special case for Match (Opp)
        if (sortConfig.key === 'Match') {
          const aOpp = getOpponentTeam(a.Match as string, a.Team as string);
          const bOpp = getOpponentTeam(b.Match as string, b.Team as string);
          return sortConfig.direction === 'ascending'
              ? aOpp.localeCompare(bOpp)
              : bOpp.localeCompare(aOpp);
        }
        
        const aValue = a[sortConfig.key as keyof OddsData];
        const bValue = b[sortConfig.key as keyof OddsData];
        
        // Handle different types of values
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          // String comparison (for Name, Team, etc.)
          return sortConfig.direction === 'ascending'
              ? aValue.localeCompare(bValue)
              : bValue.localeCompare(aValue);
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          // Numeric comparison
          return sortConfig.direction === 'ascending'
              ? aValue - bValue
              : bValue - aValue;
        }
        // Default case if types don't match or are undefined
        return 0;
      });
    }
    
    return filtered;
  }, [data, selectedMatch, playerTypeFilter, sortConfig]);

  // Add a function to handle header clicks for sorting
  const handleHeaderClick = (key: string) => {
    // Show sorting indicator immediately
    setIsSorting(true);
    
    // Use requestAnimationFrame to ensure the loading state is rendered before sorting begins
    requestAnimationFrame(() => {
      // Delay the actual sorting operation to allow the UI to update first
      setTimeout(() => {
        let direction: 'ascending' | 'descending' | null = 'ascending';
        
        // If already sorting by this key, toggle direction
        if (sortConfig.key === key) {
          if (sortConfig.direction === 'ascending') {
            direction = 'descending';
          } else if (sortConfig.direction === 'descending') {
            direction = null; // Reset sorting
          }
        } else {
          // For new sort key, use ascending for text, descending for numbers
          const firstItem = data[0];
          if (firstItem && key in firstItem) {
            const value = firstItem[key as keyof OddsData];
            if (typeof value === 'number') {
              direction = 'descending'; // Default to descending for numbers
            }
          }
        }
        
        setSortConfig({ key, direction });
        
        // Hide sorting indicator after the sort is complete
        setTimeout(() => {
          setIsSorting(false);
        }, 300);
      }, 50); // Small delay to ensure loading indicator is visible
    });
  };

  // Helper: Get opponent team from a match string
  function getOpponentTeam(match: string, team: string): string {
    const teams = match.split(' vs ');
    return teams[0] === team ? teams[1] : teams[0];
  }

  // Helper: Format team name to show only first 3 letters in uppercase
  function formatTeamName(teamName: string): string {
    if (!teamName) return '';
    return teamName.substring(0, 3).toUpperCase();
  }

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
  const formatNumber = (value: number): string => {
    // Check if the number is a whole number (no decimal part)
    if (value % 1 === 0) {
      return value.toFixed(0); // Return without decimal places
    } else {
      return value.toFixed(2); // Return with 2 decimal places
    }
  };

  // Update the toggleDetailedView function to refresh the columns when toggled
  const toggleDetailedView = () => {
    const newDetailedView = !isDetailedView;
    setIsDetailedView(newDetailedView);
    
    // Update the columns based on the new detailed view setting
    if (data.length > 0) {
      updateColumnsFromData(data[0], selectedMarket);
    }
  };

  // Add the missing handleReset function
  const handleReset = () => {
    // Reset market to "Anytime Try Scorer"
    setSelectedMarket('ats');
    
    // Reset match selection
    setSelectedMatch('all');
    
    // Reset player type to "All Players"
    setPlayerTypeFilter('all');
    
    // Load the ATS data
    if (apiData && apiData.ats_summary) {
      setMarketLoading(true);
      
      // Set the data back to ATS summary
      const atsData = apiData.ats_summary;
      setData(atsData);
      
      // Update columns if needed
      if (atsData.length > 0) {
        updateColumnsFromData(atsData[0]);
      }
      
      // Add a small delay to show loading state
      setTimeout(() => {
        setMarketLoading(false);
      }, 300);
    }
    
    // Reset sorting
    setSortConfig({ key: '', direction: null });
    
    // Reset expanded row
    setExpandedRowId(null);
    
    console.log('Table reset to default values');
  };

  // Add the missing handleMarketChange function
  const handleMarketChange = async (value: string) => {
    setSelectedMarket(value);
    console.log(`passed value = ${value}`);
    if (!apiData) return;
    setMarketLoading(true);
    const marketDataMap: { [key: string]: OddsData[] } = {
      ats: apiData.ats_summary,
      fts: apiData.fts_summary,
      lts: apiData.lts_summary,
      fts2h: apiData.fts2h_summary,
      tpt: apiData.tpt_summary,
      fst: apiData.fst_summary,
      ccm: apiData.ccm_summary,
      ftslts: apiData.ftslts_summary,
      fts2ts: apiData.fts2ts_summary,
    };
    const marketData = marketDataMap[value] || [];
    if (marketData.length > 0) {
      // Pass the selected market type to updateColumnsFromData
      updateColumnsFromData(marketData[0], value);
    }
    setData(marketData);
    setTimeout(() => {
      setMarketLoading(false);
    }, 300);
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
    
    if (value === 'afl') {
      // Use tabs navigation to maintain the bottom bar
      router.push('/(tabs)/aflTab');
    } else if (value === 'nba') {
      // Show NBA coming soon modal
      setNbaComingSoonVisible(true);
    }
    // If it's already NRL, do nothing
  };

  // Add states for button press tracking
  const [resetPressed, setResetPressed] = useState(false);
  const [settingsPressed, setSettingsPressed] = useState(false);

  // Enhanced handler for reset button
  const handleResetPress = () => {
    setResetPressed(true);
    handleReset();
    // Reset the pressed state after a short delay
    setTimeout(() => {
      setResetPressed(false);
    }, 300);
  };

  // Enhanced handler for settings button
  const handleSettingsPress = () => {
    setSettingsPressed(true);
    openSettings();
    // Reset the pressed state after a short delay
    setTimeout(() => {
      setSettingsPressed(false);
    }, 300);
  };

  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.container, { 
      flex: 1,
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      backgroundColor: backgroundColor 
    }]}>
      <Stack.Screen
        options={{
          title: 'Odds Comparison',
          headerStyle: { backgroundColor: headerBackgroundColor },
          headerTintColor: headerTextColor,
          headerShadowVisible: false,
          headerRight: () => (
            <View style={styles.headerIcons}>
              <TouchableOpacity
                onPress={handleResetPress}
                style={styles.iconButton}
              >
                <MaterialCommunityIcons
                  name="refresh"
                  size={22}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSettingsPress}
                style={styles.iconButton}
              >
                <MaterialCommunityIcons
                  name="cog"
                  size={22}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <StatusBar style="light" />
      
      <ScrollView 
        style={[styles.mainScrollView, { 
          flex: 1,
          paddingTop: 0,
          paddingBottom: 0,
        }]}
        contentContainerStyle={[styles.mainScrollContent, {
          paddingBottom: insets.bottom,
        }]}
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
                  keyExtractor={(item, index) => `fixed-${item.Number}-${item.Player}-${item.Match}-${index}`}
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
                    keyExtractor={(item, index) => `scroll-${item.Number}-${item.Player}-${item.Match}-${index}`}
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
                keyExtractor={(item, index) => `${item.Number}-${item.Player}-${item.Match}-${index}`}
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
            }]}>Loading NRL data...</Text>
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
                style={[styles.dropdown, { backgroundColor: isDarkMode ? '#2D3B47' : '#F5F7FA', borderColor: isDarkMode ? 'rgba(24, 234, 185, 0.3)' : 'rgba(0, 0, 0, 0.1)' }]}
                textStyle={[styles.dropdownText, { color: textColor }]}
                dropDownContainerStyle={[styles.dropdownContainer, { backgroundColor: isDarkMode ? '#2D3B47' : '#F5F7FA', borderColor: isDarkMode ? 'rgba(24, 234, 185, 0.3)' : 'rgba(0, 0, 0, 0.1)' }]}
                listItemContainerStyle={{ borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
                listItemLabelStyle={{ color: textColor }}
                labelStyle={{ color: textColor }}
                placeholderStyle={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                ArrowDownIconComponent={() => (
                  <MaterialCommunityIcons name="chevron-down" size={20} color={isDarkMode ? '#18EAB9' : '#666'} />
                )}
                ArrowUpIconComponent={() => (
                  <MaterialCommunityIcons name="chevron-up" size={20} color={isDarkMode ? '#18EAB9' : '#666'} />
                )}
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
                style={[styles.dropdown, { backgroundColor: isDarkMode ? '#2D3B47' : '#F5F7FA', borderColor: isDarkMode ? 'rgba(24, 234, 185, 0.3)' : 'rgba(0, 0, 0, 0.1)' }]}
                textStyle={[styles.dropdownText, { color: textColor }]}
                dropDownContainerStyle={[styles.dropdownContainer, { backgroundColor: isDarkMode ? '#2D3B47' : '#F5F7FA', borderColor: isDarkMode ? 'rgba(24, 234, 185, 0.3)' : 'rgba(0, 0, 0, 0.1)' }]}
                listItemContainerStyle={{ borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
                listItemLabelStyle={{ color: textColor }}
                labelStyle={{ color: textColor }}
                placeholderStyle={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                ArrowDownIconComponent={() => (
                  <MaterialCommunityIcons name="chevron-down" size={20} color={isDarkMode ? '#18EAB9' : '#666'} />
                )}
                ArrowUpIconComponent={() => (
                  <MaterialCommunityIcons name="chevron-up" size={20} color={isDarkMode ? '#18EAB9' : '#666'} />
                )}
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
                style={[styles.dropdown, { backgroundColor: isDarkMode ? '#2D3B47' : '#F5F7FA', borderColor: isDarkMode ? 'rgba(24, 234, 185, 0.3)' : 'rgba(0, 0, 0, 0.1)' }]}
                textStyle={[styles.dropdownText, { color: textColor }]}
                dropDownContainerStyle={[styles.dropdownContainer, { backgroundColor: isDarkMode ? '#2D3B47' : '#F5F7FA', borderColor: isDarkMode ? 'rgba(24, 234, 185, 0.3)' : 'rgba(0, 0, 0, 0.1)' }]}
                listItemContainerStyle={{ borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
                listItemLabelStyle={{ color: textColor }}
                labelStyle={{ color: textColor }}
                placeholderStyle={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                ArrowDownIconComponent={() => (
                  <MaterialCommunityIcons name="chevron-down" size={20} color={isDarkMode ? '#18EAB9' : '#666'} />
                )}
                ArrowUpIconComponent={() => (
                  <MaterialCommunityIcons name="chevron-up" size={20} color={isDarkMode ? '#18EAB9' : '#666'} />
                )}
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
                      borderColor: '#18EAB9',
                      backgroundColor: tempIsDarkMode ? '#18EAB9' : 'transparent' 
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
                      borderColor: '#18EAB9',
                      backgroundColor: tempIsDetailedView ? '#18EAB9' : 'transparent' 
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
                style={[styles.button, styles.buttonCancel, { borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)' }]}
                onPress={() => setSettingsVisible(false)}
              >
                <Text style={[styles.buttonText, { color: textColor }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.buttonApply, { backgroundColor: '#18EAB9' }]}
                onPress={applySettings}
              >
                <Text style={[styles.buttonText, { color: '#1C2732' }]}>Apply Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    flexGrow: 1,
  },
  tableContainer: {
    borderWidth: 0,
    borderRadius: 0,
    overflow: 'hidden',
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
    flex: 1,
  },
  horizontalScrollView: {
    flexGrow: 1,
  },
  tableBodyContainer: {
    flexGrow: 1,
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
    minWidth: 100,
  },
  buttonApply: {
    minWidth: 140,
    shadowColor: '#18EAB9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdown: {
    borderRadius: 8,
    minHeight: 48,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dropdownContainer: {
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
    marginTop: 4,
  },
  dropdownText: {
    fontSize: 16,
    fontWeight: '500',
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    minHeight: 48,
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
    fontWeight: '500',
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
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
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0,
    height: 40,
  },
  tableCell: {
    paddingHorizontal: 4,
    alignItems: 'flex-start',
    justifyContent: 'center',
    borderRightWidth: 0,
    position: 'relative',
    zIndex: 0,
    height: 40,
    paddingVertical: 0,
  },
  cellText: {
    fontSize: 13,
    textAlign: 'left',
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
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
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
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 4,
    minWidth: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 1,
    elevation: 1,
    position: 'relative',
  },
  expandedContent: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  expandedRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    paddingRight: 8,
  },
  expandedBookieName: {
    fontSize: 12,
    minWidth: 120,
    paddingRight: 0,
  },
  expandedOddsText: {
    fontSize: 12,
    minWidth: 30,
    textAlign: 'left',
    marginLeft: 2,
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
    justifyContent: 'space-between',
  },
  expandedBookieContainer: {
    width: '24%',
    marginBottom: 12,
    backgroundColor: 'transparent',
    borderRadius: 8,
    overflow: 'hidden',
  },
  bookieContent: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 8,
  },
  expandedBookieName: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Verdana, Geneva, Tahoma, sans-serif',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  expandedOddsText: {
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: 'Verdana, Geneva, Tahoma, sans-serif',
    textAlign: 'center',
    color: '#FFFFFF',
  },
  expandedDetailItem: {
    flex: 1,
    minWidth: '30%',
    margin: 4,
    padding: 8,
    backgroundColor: 'transparent',
    borderRadius: 8,
  },
  expandedDetailLabel: {
    fontSize: 12,
    marginBottom: 4,
    fontFamily: 'Verdana, Geneva, Tahoma, sans-serif',
  },
  expandedDetailValue: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Verdana, Geneva, Tahoma, sans-serif',
  },
  sportSwitcherContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  sportSwitcher: {
    borderRadius: 8,
    minHeight: 40,
    height: 40,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    borderWidth: 1,
  },
  quickAccessButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  quickButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 0,
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
  comingSoonMessage: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  comingSoonSubMessage: {
    fontSize: 14,
    textAlign: 'center',
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
  },
  expandedSection: {
    marginBottom: 0,
  },
  expandedSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    fontFamily: 'Verdana, Geneva, Tahoma, sans-serif',
    paddingHorizontal: 4,
  },
  expandedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  expandedBookieContainer: {
    width: '24%',
    marginBottom: 12,
    backgroundColor: 'transparent',
    borderRadius: 8,
    overflow: 'hidden',
  },
  bookieContent: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 8,
  },
  expandedBookieName: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Verdana, Geneva, Tahoma, sans-serif',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  expandedOddsText: {
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: 'Verdana, Geneva, Tahoma, sans-serif',
    textAlign: 'center',
    color: '#FFFFFF',
  },
  expandedDetailItem: {
    flex: 1,
    minWidth: '30%',
    margin: 4,
    padding: 8,
    backgroundColor: 'transparent',
    borderRadius: 8,
  },
  expandedDetailLabel: {
    fontSize: 12,
    marginBottom: 4,
    fontFamily: 'Verdana, Geneva, Tahoma, sans-serif',
  },
  expandedDetailValue: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Verdana, Geneva, Tahoma, sans-serif',
  },
});