import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Recommendation {
  name: string;
  percentage: number;
  home_games?: number;
}

interface RecommendationSectionProps {
  title: string;
  recommendations: Recommendation[];
  type: 'co_scorers' | 'loss_scorers' | 'home_scorers';
  onSelect?: (name: string) => void;
  selectedPlayers?: Set<string>;
}

const RecommendationSection: React.FC<RecommendationSectionProps> = ({
  title,
  recommendations,
  type,
  onSelect,
  selectedPlayers = new Set()
}) => {
  if (!title || recommendations.length === 0) {
    return null;
  }


  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      
      {recommendations.map((rec, index) => (
        <TouchableOpacity 
          key={index} 
          style={styles.recommendation}
          onPress={() => onSelect?.(rec.name)}
          activeOpacity={0.7}
        >
          <View style={styles.nameContainer}>
            <View style={styles.checkboxContainer}>
              <View style={[
                styles.checkbox,
                selectedPlayers.has(rec.name) && styles.checkboxSelected
              ]}>
                {selectedPlayers.has(rec.name) && (
                  <Ionicons name="checkmark" size={16} color="#1C2732" />
                )}
              </View>
            </View>
            <Text style={styles.name}>{rec.name}</Text>
          </View>
          
          <View style={styles.percentageContainer}>
            <Text style={styles.percentage}>{rec.percentage.toFixed(1)}%</Text>
          </View>
        </TouchableOpacity>
      ))}

      {type === 'co_scorers' && (
        <Text style={styles.noteText}>
          Note: Some players may not be historical co-scorers but teammates from the upcoming matchup.
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    backgroundColor: '#2D3B47',
    borderRadius: 12,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7FFFD4',
    marginBottom: 16,
  },
  recommendation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1C2732',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#7FFFD4',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxSelected: {
    backgroundColor: '#7FFFD4',
  },
  name: {
    color: 'white',
    fontSize: 16,
  },
  percentageContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  percentage: {
    color: '#7FFFD4',
    fontSize: 16,
    fontWeight: 'bold',
  },
  rateType: {
    color: '#8F9BA8',
    fontSize: 14,
    marginLeft: 8,
  },
  noteText: {
    color: '#8F9BA8',
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 16,
    opacity: 0.8,
  }
});

export default RecommendationSection; 