import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BetSlipModalProps {
  visible: boolean;
  onClose: () => void;
  matchup: string;
  winner: string;
  lock: string;
  selections: string[];
  onRemoveSelection?: (selection: string) => void;
  onRemoveWinner?: () => void;
  onRemoveLock?: () => void;
}

const BetSlipModal: React.FC<BetSlipModalProps> = ({
  visible,
  onClose,
  matchup,
  winner,
  lock,
  selections,
  onRemoveSelection,
  onRemoveWinner,
  onRemoveLock
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.titleContainer}>
              <Text style={styles.modalTitle}>Multi Bet Slip</Text>
              <Text style={styles.modalSubtitle}>Review your selections</Text>
            </View>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color="#7FFFD4" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.betDetails} showsVerticalScrollIndicator={false}>
            <View style={styles.betSection}>
              <Text style={styles.betLabel}>Matchup</Text>
              <View style={styles.matchupContainer}>
                <Text style={styles.betValue}>{matchup}</Text>
              </View>
            </View>

            <View style={styles.betSection}>
              <Text style={styles.betLabel}>Match Winner</Text>
              <View style={styles.winnerContainer}>
                <View style={styles.selectionInfo}>
                  <Text style={styles.betValue}>{winner}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.removeButton}
                  onPress={onRemoveWinner}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <View style={styles.removeButtonInner}>
                    <Ionicons name="close" size={14} color="#1C2732" />
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.betSection}>
              <Text style={styles.betLabel}>Your ATS lock</Text>
              <View style={styles.lockContainer}>
                <View style={styles.selectionInfo}>
                  <Text style={styles.betValue}>{lock}</Text>
                  <Text style={styles.subLabel}>Anytime Try Scorer</Text>
                </View>
                <TouchableOpacity 
                  style={styles.removeButton}
                  onPress={onRemoveLock}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <View style={styles.removeButtonInner}>
                    <Ionicons name="close" size={14} color="#1C2732" />
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {selections.length > 0 && (
              <View style={styles.betSection}>
                <Text style={styles.betLabel}>Additional Selections</Text>
                {selections.map((selection, index) => (
                  <View key={index} style={styles.selectionContainer}>
                    <View style={styles.selectionInfo}>
                      <Text style={styles.betValue}>{selection}</Text>
                      <Text style={styles.subLabel}>Anytime Try Scorer</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.removeButton}
                      onPress={() => onRemoveSelection?.(selection)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <View style={styles.removeButtonInner}>
                        <Ionicons name="close" size={14} color="#1C2732" />
                      </View>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <TouchableOpacity 
            style={styles.placeButton}
            activeOpacity={0.8}
            onPress={onClose}
          >
            <Text style={styles.placeButtonText}>Place Multi Bet</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1C2732',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7FFFD4',
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#8F9BA8',
  },
  closeButton: {
    padding: 4,
  },
  betDetails: {
    marginBottom: 16,
  },
  betSection: {
    marginBottom: 12,
  },
  betLabel: {
    fontSize: 13,
    color: '#8F9BA8',
    marginBottom: 6,
    fontWeight: '500',
  },
  matchupContainer: {
    backgroundColor: '#2D3B47',
    padding: 12,
    borderRadius: 10,
  },
  winnerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D3B47',
    padding: 12,
    borderRadius: 10,
    justifyContent: 'space-between',
  },
  lockContainer: {
    backgroundColor: '#2D3B47',
    padding: 12,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectionContainer: {
    backgroundColor: '#2D3B47',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectionInfo: {
    flex: 1,
  },
  betValue: {
    fontSize: 15,
    color: 'white',
    fontWeight: '600',
  },
  subLabel: {
    fontSize: 12,
    color: '#8F9BA8',
    marginTop: 4,
  },
  removeButton: {
    marginLeft: 12,
  },
  removeButtonInner: {
    backgroundColor: '#7FFFD4',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeButton: {
    backgroundColor: '#7FFFD4',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 32,
    shadowColor: '#7FFFD4',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
    
  },
  placeButtonText: {
    color: '#1C2732',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default BetSlipModal; 