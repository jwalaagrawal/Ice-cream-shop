import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getAllData, restoreAllData } from '../storage/store';

export default function BackupScreen() {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const data = await getAllData();
      const json = JSON.stringify(data, null, 2);
      const date = new Date().toISOString().slice(0, 10);
      const path = `${FileSystem.cacheDirectory}icecream_backup_${date}.json`;
      await FileSystem.writeAsStringAsync(path, json);
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Error', 'Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(path, {
        mimeType: 'application/json',
        dialogTitle: 'Save or share your backup',
      });
    } catch (e) {
      Alert.alert('Export Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const fileUri = result.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(fileUri);
      const data = JSON.parse(content);

      Alert.alert(
        'Restore Backup',
        'This will replace ALL current data (ice creams, vendors, transactions) with the backup. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              setLoading(true);
              try {
                await restoreAllData(data);
                Alert.alert('Success', 'Data restored successfully! Restart the app if data does not refresh.');
              } catch (e) {
                Alert.alert('Restore Failed', e.message);
              } finally {
                setLoading(false);
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Import Failed', 'Could not read the file. Make sure it is a valid backup.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>How backup works</Text>
        <Text style={styles.infoText}>
          • <Text style={styles.bold}>Export</Text> saves all ice creams, vendors, and transaction records into a single file.
        </Text>
        <Text style={styles.infoText}>
          • Share it to WhatsApp, email, Google Drive, or iCloud to keep it safe.
        </Text>
        <Text style={styles.infoText}>
          • <Text style={styles.bold}>Restore</Text> on any phone by picking the saved file — all data will be loaded back.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.btn, styles.exportBtn]}
        onPress={handleExport}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.btnIcon}>⬆️</Text>
            <View>
              <Text style={styles.btnTitle}>Export Backup</Text>
              <Text style={styles.btnSub}>Save & share all your data</Text>
            </View>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.importBtn]}
        onPress={handleImport}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.btnIcon}>⬇️</Text>
            <View>
              <Text style={styles.btnTitle}>Restore Backup</Text>
              <Text style={styles.btnSub}>Pick a backup file to restore data</Text>
            </View>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.warning}>
        ⚠️ Restoring will overwrite all current data on this device.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    padding: 20,
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 28,
    borderLeftWidth: 4,
    borderLeftColor: '#2E86AB',
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 13,
    color: '#444',
    lineHeight: 20,
    marginBottom: 4,
  },
  bold: { fontWeight: '700' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  exportBtn: {
    backgroundColor: '#2E86AB',
    shadowColor: '#2E86AB',
  },
  importBtn: {
    backgroundColor: '#16A34A',
    shadowColor: '#16A34A',
  },
  btnIcon: { fontSize: 30 },
  btnTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  btnSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  warning: {
    textAlign: 'center',
    color: '#92400E',
    fontSize: 12,
    marginTop: 8,
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
  },
});
