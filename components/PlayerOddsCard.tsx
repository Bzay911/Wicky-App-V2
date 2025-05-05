import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from 'react-native-paper';

interface PlayerOddsCardProps {
  playerName: string;
  historical: number;
  alternativeName: string;
  alternativeHistorical: number;
}

export const PlayerOddsCard: React.FC<PlayerOddsCardProps> = ({
  playerName,
  historical,
  alternativeName,
  alternativeHistorical,
}) => {
  return (
    <Card style={styles.card}>
      <Card.Title title={playerName} subtitle="Player Odds" />
      <Card.Content>
        <View style={styles.oddsContainer}>
          <View style={styles.oddsItem}>
            <Text style={styles.label}>Historical Odds:</Text>
            <Text style={styles.value}>{historical.toFixed(2)}</Text>
          </View>
          
          <View style={styles.oddsItem}>
            <Text style={styles.label}>Alternative:</Text>
            <Text style={styles.value}>{alternativeName}</Text>
            <Text style={styles.value}>{alternativeHistorical.toFixed(2)}</Text>
          </View>
        </View>
        
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    marginHorizontal: 16,
    elevation: 4,
  },
  oddsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  oddsItem: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    // color: theme.colors.secondary,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    // borderTopColor: theme.colors.outline,
  },
  statsHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statsLabel: {
    fontSize: 14,
    // color: theme.colors.secondary,
  },
  statsValue: {
    fontSize: 14,
  },
}); 