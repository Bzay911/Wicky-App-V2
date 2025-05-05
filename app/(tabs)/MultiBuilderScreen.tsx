import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
  TextInput,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMultiBuilder } from '../../context/MultiBuilderContext';
import RecommendationSection from '../components/RecommendationSection';
import { Dropdown } from 'react-native-element-dropdown';
import BetSlipModal from '../components/BetSlipModal';

interface Recommendation {
  name: string;
  percentage: number;
  home_games?: number;
}

interface AnalysisResult {
  co_scorers: {
    title: string;
    recommendations: Recommendation[];
  };
  loss_scorers: {
    title: string;
    recommendations: Recommendation[];
  };
  home_scorers: {
    title: string;
    recommendations: Recommendation[];
  };
  initialLegsCount?: number;
}

export default function MultiBuilderScreen() {
  const { 
    isLoading,
    isInitialized,
    sports, 
    selectedSport, 
    setSelectedSport,
    matchups,
    fetchMatchups,
    players,
    fetchPlayers,
    analyzeMultiBuilder
  } = useMultiBuilder();

  const [selectedMatchup, setSelectedMatchup] = useState<string>('');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [selectedWinner, setSelectedWinner] = useState<string>('');
  const [teams, setTeams] = useState<string[]>([]);
  const [playersList, setPlayersList] = useState<string[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [showBetSlip, setShowBetSlip] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Add animation values for buttons
  const resetButtonScale = useRef(new Animated.Value(1)).current;
  const analyzeButtonScale = useRef(new Animated.Value(1)).current;
  const viewSlipButtonScale = useRef(new Animated.Value(1)).current;

  // Add sports options with icons
  const sportsOptions: Array<{
    label: string;
    value: string;
    icon: keyof typeof Ionicons.glyphMap;
  }> = [
    { label: 'NRL', value: 'nrl', icon: 'american-football' },
    { label: 'AFL', value: 'afl', icon: 'football' },
  ];

  // Convert matchups to dropdown format
  const matchupOptions = matchups.map(matchup => ({
    label: matchup,
    value: matchup
  }));
  
  // Convert teams to dropdown format
  const teamOptions = teams.map(team => ({
    label: team,
    value: team
  }));
  
  // Convert players to dropdown format
  const playerOptions = playersList.map(player => ({
    label: player,
    value: player
  }));

  // Fetch matchups when sport changes
  useEffect(() => {
    fetchMatchups(selectedSport);
    setSelectedMatchup('');
    setSelectedPlayer('');
    setSelectedWinner('');
    setTeams([]);
    setPlayersList([]);
    setAnalysisResult(null);
  }, [selectedSport]);

  // Fetch players when matchup changes
  useEffect(() => {
    if (selectedMatchup) {
      console.log(`Fetching players for sport: ${selectedSport}, matchup: ${selectedMatchup}`);
      fetchPlayers(selectedSport, selectedMatchup);
      
      // Extract teams from the matchup (format: "Team A vs Team B")
      const matchupTeams = selectedMatchup.split(' vs ');
      console.log(`Teams extracted from matchup: ${matchupTeams.join(', ')}`);
      setTeams(matchupTeams);
      // Don't pre-select winner
      setSelectedWinner('');
    }
  }, [selectedMatchup]);

  // Update players list when players or winner changes
  useEffect(() => {
    if (players && selectedWinner && players[selectedWinner]) {
      console.log(`Loading players for winner team: ${selectedWinner}`);
      console.log(`Available players:`, players[selectedWinner]);
      setPlayersList(players[selectedWinner]);
      // Don't pre-select player
      setSelectedPlayer('');
    } else if (selectedWinner) {
      console.log(`No players found for team: ${selectedWinner}`);
      console.log(`Available players object:`, players);
    }
  }, [players, selectedWinner]);

  const scrollToResults = () => {
    // Add a small delay to ensure the results are rendered
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: 1000, // This will scroll past the form to the results
        animated: true
      });
    }, 500);
  };

  const handleAnalyze = async () => {
    if (!selectedSport || !selectedMatchup || !selectedPlayer || !selectedWinner) {
      Alert.alert('Missing Information', 'Please select all required fields.');
      return;
    }

    animateButtonPress(analyzeButtonScale);
    // Reset fade animation
    fadeAnim.setValue(0);

    const result = await analyzeMultiBuilder(
      selectedSport,
      selectedMatchup,
      selectedPlayer,
      selectedWinner
    );

    if (result) {
      setAnalysisResult(result);
      setShowBetSlip(false);
      
      // Trigger both scroll and fade animations
      scrollToResults();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true
      }).start();
    }
  };

  const handlePlayerSelect = (name: string) => {
    const newSelected = new Set(selectedPlayers);
    if (selectedPlayers.has(name)) {
      newSelected.delete(name);
    } else {
      newSelected.add(name);
    }
    setSelectedPlayers(newSelected);
  };

  const handleRemoveSelection = (selection: string) => {
    const newSelected = new Set(selectedPlayers);
    newSelected.delete(selection);
    setSelectedPlayers(newSelected);
  };

  const handleRemoveWinner = () => {
    setSelectedWinner('');
  };

  const handleRemoveLock = () => {
    setSelectedPlayer('');
  };

  const handleReset = () => {
    animateButtonPress(resetButtonScale);
    // Clear all selections
    setSelectedMatchup('');
    setSelectedWinner('');
    setSelectedPlayer('');
    setSelectedPlayers(new Set());
    
    // Clear dropdown data
    setTeams([]);
    setPlayersList([]);
    
    // Clear analysis results and bet slip
    setAnalysisResult(null);
    setShowBetSlip(false);

    // Reset matchups if needed
    fetchMatchups(selectedSport);
  };

  // Add animation functions
  const animateButtonPress = (scale: Animated.Value) => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <Text 
            style={styles.headerTitle}
            allowFontScaling={true}
            adjustsFontSizeToFit={true}
            numberOfLines={2}
          >
            Build Your Dream Multi
          </Text>
        </View>

        <View style={styles.formWrapper}>
          <View style={styles.searchContainer}>
            <Text 
              style={styles.searchTitle}
              allowFontScaling={true}
              adjustsFontSizeToFit={true}
              numberOfLines={2}
            >
              Enter what you think will happen in the game
            </Text>
            <Text 
              style={styles.searchSubtitle}
              allowFontScaling={true}
              adjustsFontSizeToFit={true}
              numberOfLines={2}
            >
              We'll give you more options to build your dream multi!
            </Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.label}>Select Sport</Text>
            <View style={styles.toggleContainer}>
              {sportsOptions.map((sport) => (
                <TouchableOpacity
                  key={sport.value}
                  style={[
                    styles.toggleButton,
                    selectedSport === sport.value && styles.toggleButtonActive
                  ]}
                  onPress={() => {
                    setSelectedSport(sport.value);
                    // Reset other selections when sport changes
                    setSelectedMatchup('');
                    setSelectedPlayer('');
                    setSelectedWinner('');
                    setTeams([]);
                    setPlayersList([]);
                    setAnalysisResult(null);
                    setShowBetSlip(false);
                  }}
                >
                  <View style={styles.toggleIconContainer}>
                    <Ionicons 
                      name={sport.icon} 
                      size={20} 
                      color={selectedSport === sport.value ? "#1C2732" : "#7FFFD4"} 
                    />
                  </View>
                  <Text 
                    style={[
                      styles.toggleText,
                      selectedSport === sport.value && styles.toggleTextActive
                    ]}
                  >
                    {sport.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Select Matchup</Text>
            <View style={styles.dropdownContainer}>
              <Dropdown
                style={styles.dropdown}
                containerStyle={styles.dropdownListContainer}
                placeholderStyle={styles.placeholderText}
                selectedTextStyle={styles.selectedText}
                inputSearchStyle={styles.inputSearchStyle}
                iconStyle={styles.iconStyle}
                data={matchupOptions.length > 0 ? matchupOptions : [{ label: 'Loading...', value: '' }]}
                search={false}
                maxHeight={300}
                labelField="label"
                valueField="value"
                placeholder={matchups.length > 0 ? "Select a matchup" : `Loading ${selectedSport.toUpperCase()} matchups...`}
                value={selectedMatchup}
                onChange={item => {
                  console.log("Dropdown selection:", item);
                  // Clear all dependent selections and data
                  setSelectedWinner('');
                  setSelectedPlayer('');
                  setSelectedPlayers(new Set());
                  setTeams([]);
                  setPlayersList([]);
                  setAnalysisResult(null);
                  setShowBetSlip(false);
                  // Set new matchup
                  setSelectedMatchup(item.value);
                }}
                renderLeftIcon={() => (
                  <View style={styles.dropdownIcon}>
                    <Ionicons 
                      name={selectedSport === 'nrl' ? 'american-football-outline' : 'football-outline'} 
                      size={20} 
                      color="#7FFFD4" 
                    />
                  </View>
                )}
                renderItem={(item) => (
                  <View style={styles.dropdownItem}>
                    <Text style={styles.dropdownItemText} numberOfLines={2}>
                      {item.label}
                    </Text>
                  </View>
                )}
                activeColor="rgba(127, 255, 212, 0.1)"
              />
            </View>
            
            <Text style={styles.label}>Predict Winner</Text>
            <View style={styles.dropdownContainer}>
              <Dropdown
                style={styles.dropdown}
                containerStyle={styles.dropdownListContainer}
                placeholderStyle={styles.placeholderText}
                selectedTextStyle={styles.selectedText}
                inputSearchStyle={styles.inputSearchStyle}
                iconStyle={styles.iconStyle}
                data={teamOptions}
                search={false}
                maxHeight={300}
                labelField="label"
                valueField="value"
                placeholder="Select winner"
                value={selectedWinner}
                onChange={item => {
                  setSelectedWinner(item.value);
                }}
                renderLeftIcon={() => (
                  <View style={styles.dropdownIcon}>
                    <Ionicons name="trophy-outline" size={20} color="#7FFFD4" />
                  </View>
                )}
                renderItem={(item) => (
                  <View style={styles.dropdownItem}>
                    <Text style={styles.dropdownItemText} numberOfLines={2}>
                      {item.label}
                    </Text>
                  </View>
                )}
                activeColor="rgba(127, 255, 212, 0.1)"
                disable={teams.length < 2}
              />
            </View>
            
            <Text style={styles.label}>
              {selectedSport === 'nrl' ? 'Who is your Tryscorer Lock?' : 'Who is your Goalscorer Lock?'}
            </Text>
            <View style={styles.dropdownContainer}>
              <Dropdown
                style={styles.dropdown}
                containerStyle={styles.dropdownListContainer}
                placeholderStyle={styles.placeholderText}
                selectedTextStyle={styles.selectedText}
                inputSearchStyle={styles.inputSearchStyle}
                iconStyle={styles.iconStyle}
                data={playerOptions}
                search={false}
                maxHeight={300}
                labelField="label"
                valueField="value"
                placeholder="Select player"
                value={selectedPlayer}
                onChange={item => {
                  setSelectedPlayer(item.value);
                }}
                renderLeftIcon={() => (
                  <View style={styles.dropdownIcon}>
                    <Ionicons name="person-outline" size={20} color="#7FFFD4" />
                  </View>
                )}
                renderItem={(item) => (
                  <View style={styles.dropdownItem}>
                    <Text style={styles.dropdownItemText} numberOfLines={2}>
                      {item.label}
                    </Text>
                  </View>
                )}
                activeColor="rgba(127, 255, 212, 0.1)"
                disable={playersList.length === 0}
              />
            </View>
  
            <View style={styles.buttonContainer}>
              <Animated.View style={{ transform: [{ scale: resetButtonScale }] }}>
                <TouchableOpacity 
                  style={styles.resetButton}
                  onPress={handleReset}
                  activeOpacity={1}
                >
                  <Ionicons name="refresh" size={20} color="#7FFFD4" />
                  <Text style={styles.resetButtonText}>Reset</Text>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={{ flex: 1, transform: [{ scale: analyzeButtonScale }] }}>
                <TouchableOpacity 
                  style={[
                    styles.analyzeButton,
                    (!selectedMatchup || !selectedPlayer || !selectedWinner) && 
                      styles.analyzeButtonDisabled
                  ]}
                  onPress={handleAnalyze}
                  disabled={isLoading || !selectedMatchup || !selectedPlayer || !selectedWinner}
                  activeOpacity={1}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#1C2732" />
                  ) : (
                    <Text style={styles.analyzeButtonText}>Build Multi</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        </View>
        
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7FFFD4" />
            <Text style={styles.loadingText}>Analyzing potential combinations...</Text>
          </View>
        )}
        
        {analysisResult && (
          <Animated.View 
            style={[
              styles.resultsContainer,
              {
                opacity: fadeAnim,
                transform: [{
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0]
                  })
                }]
              }
            ]}
          >
            <Text style={styles.resultsTitle}>More options - Data from 2019</Text>
            
            <RecommendationSection 
              title={analysisResult.co_scorers.title}
              recommendations={analysisResult.co_scorers.recommendations}
              type="co_scorers"
              onSelect={handlePlayerSelect}
              selectedPlayers={selectedPlayers}
            />
            
            <RecommendationSection 
              title={analysisResult.loss_scorers.title}
              recommendations={analysisResult.loss_scorers.recommendations}
              type="loss_scorers"
              onSelect={handlePlayerSelect}
              selectedPlayers={selectedPlayers}
            />
            
            <RecommendationSection 
              title={analysisResult.home_scorers.title}
              recommendations={analysisResult.home_scorers.recommendations}
              type="home_scorers"
              onSelect={handlePlayerSelect}
              selectedPlayers={selectedPlayers}
            />

            <Animated.View style={{ transform: [{ scale: viewSlipButtonScale }] }}>
              <TouchableOpacity 
                style={styles.viewSlipButton}
                onPress={() => {
                  animateButtonPress(viewSlipButtonScale);
                  setShowBetSlip(true);
                }}
                activeOpacity={1}
              >
                <Text style={styles.viewSlipButtonText}>
                  View Bet Slip ({selectedPlayers.size > 0 ? 
                    (analysisResult.initialLegsCount || 2) + selectedPlayers.size : 
                    (analysisResult.initialLegsCount || 2)} Legs)
                </Text>
              </TouchableOpacity>
            </Animated.View>

            <BetSlipModal
              visible={showBetSlip}
              onClose={() => setShowBetSlip(false)}
              matchup={selectedMatchup}
              winner={selectedWinner}
              lock={selectedPlayer}
              selections={Array.from(selectedPlayers)}
              onRemoveSelection={handleRemoveSelection}
              onRemoveWinner={handleRemoveWinner}
              onRemoveLock={handleRemoveLock}
            />
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C2732',
  },
  scrollContent: {
    flex: 1,
  },
  headerContainer: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 24 : 16,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: Platform.OS === 'ios' ? 34 : 28,
    fontWeight: '700',
    color: '#7FFFD4',
    textAlign: 'center',
    textShadowColor: 'rgba(127, 255, 212, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    letterSpacing: -0.5,
    lineHeight: Platform.OS === 'ios' ? 41 : 36,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#8F9BA8',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: '80%',
  },
  formWrapper: {
    paddingHorizontal: 24,
  },
  searchContainer: {
    backgroundColor: 'rgba(45, 59, 71, 0.5)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(127, 255, 212, 0.2)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  searchSubtitle: {
    fontSize: 15,
    color: '#8F9BA8',
    textAlign: 'center',
    lineHeight: 20,
  },
  formContainer: {
    backgroundColor: 'rgba(45, 59, 71, 0.5)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 17,
    color: '#7FFFD4',
    marginBottom: 8,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  dropdownContainer: {
    marginBottom: 20,
  },
  dropdownListContainer: {
    backgroundColor: '#2D3B47',
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(127, 255, 212, 0.2)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
    padding: 8,
  },
  dropdown: {
    minHeight: 56,
    backgroundColor: '#2D3B47',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(127, 255, 212, 0.2)',
  },
  dropdownIcon: {
    backgroundColor: 'rgba(127, 255, 212, 0.1)',
    padding: 8,
    borderRadius: 8,
    marginRight: 12,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D3B47',
    borderRadius: 8,
  },
  dropdownItemText: {
    fontSize: 17,
    color: '#FFFFFF',
    flex: 1,
    lineHeight: 22,
  },
  placeholderText: {
    fontSize: 17,
    color: '#8F9BA8',
    paddingRight: 24,
    flex: 1,
  },
  selectedText: {
    fontSize: 17,
    color: '#FFFFFF',
    paddingRight: 24,
    flex: 1,
    lineHeight: 22,
  },
  inputSearchStyle: {
    height: 40,
    flex: 1,
    fontSize: 17,
    color: '#FFFFFF',
    paddingVertical: 8,
  },
  iconStyle: {
    width: 20,
    height: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  resetButton: {
    backgroundColor: 'rgba(127, 255, 212, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(127, 255, 212, 0.3)',
  },
  resetButtonText: {
    color: '#7FFFD4',
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 8,
  },
  analyzeButton: {
    flex: 1,
    backgroundColor: '#7FFFD4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#7FFFD4',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  analyzeButtonDisabled: {
    backgroundColor: '#7FFFD480',
  },
  analyzeButtonText: {
    color: '#1C2732',
    fontSize: 17,
    fontWeight: '600',
  },
  loadingContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  loadingText: {
    color: '#7FFFD4',
    marginTop: 12,
    fontSize: 17,
  },
  resultsContainer: {
    marginTop: 24,
    backgroundColor: '#1E2A35',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#7FFFD4',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  viewSlipButton: {
    backgroundColor: '#7FFFD4',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    alignItems: 'center',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#7FFFD4',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  viewSlipButtonText: {
    color: '#1C2732',
    fontSize: 17,
    fontWeight: '600',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C2732',
    borderRadius: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(127, 255, 212, 0.2)',
  },
  searchIcon: {
    marginRight: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#2D3B47',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(127, 255, 212, 0.2)',
    overflow: 'hidden',
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  toggleButtonActive: {
    backgroundColor: '#7FFFD4',
  },
  toggleIconContainer: {
    marginRight: 8,
  },
  toggleText: {
    fontSize: 16,
    color: '#7FFFD4',
    fontWeight: '500',
  },
  toggleTextActive: {
    color: '#1C2732',
    fontWeight: '600',
  },
  disabledToggleContainer: {
    backgroundColor: 'rgba(45, 59, 71, 0.5)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(127, 255, 212, 0.1)',
    alignItems: 'center',
  },
  disabledToggleText: {
    fontSize: 16,
    color: '#8F9BA8',
  },
}); 