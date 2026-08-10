import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, Alert, Text } from 'react-native';
import { AppScaffold } from '../../components/layout/AppScaffold';
import { PageContainer } from '../../components/layout/PageContainer';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { SecondaryButton } from '../../components/buttons/SecondaryButton';
import { colors, spacing, typography, radius } from '../../tokens';
import { useRouter } from 'expo-router';
import { Monitor, CheckCircle, XCircle } from 'lucide-react-native';
import { expoDb } from '../../core/db/client';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

async function fetchWithTimeout(url: string, options: Parameters<typeof fetch>[1], timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export default function PairingSettings() {
  const router = useRouter();
  const [ipAddress, setIpAddress] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [connectionState, setConnectionState] = useState<'pending' | 'paired' | 'revoked' | 'unreachable'>('pending');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string | null>(null);

  useEffect(() => {
    loadExistingConnection();
  }, []);

  const loadExistingConnection = async () => {
    try {
      const connections = await expoDb.getAllAsync('SELECT * FROM ai_connections ORDER BY created_at DESC LIMIT 1');
      if (connections.length > 0) {
        const conn = connections[0] as any;
        setIpAddress(conn.base_url.replace('http://', ''));
        setConnectionState(conn.pairing_state);
        setConnectionId(conn.id);
        setDeviceFingerprint(conn.device_fingerprint);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const testConnection = async () => {
    if (!ipAddress) {
      Alert.alert('Missing Info', 'Please provide the IP address of your laptop.');
      return;
    }
    
    // Validate IP and Port format
    const ipPortRegex = /^(\d{1,3}\.){3}\d{1,3}:\d{2,5}$/;
    if (!ipPortRegex.test(ipAddress)) {
      Alert.alert('Invalid Format', 'Please enter a valid IP address and port (e.g., 192.168.1.100:8000).');
      return;
    }

    const [ip, portStr] = ipAddress.split(':');
    const port = parseInt(portStr, 10);

    // Basic IP validation
    if (ip.startsWith('127.') || ip === '0.0.0.0' || ip === '255.255.255.255') {
      Alert.alert('Invalid IP', 'Loopback and broadcast addresses are not allowed. Use the laptop\'s local network IP.');
      return;
    }

    // Validate unprivileged port (typically used for local dev servers)
    if (port <= 1024 || port > 65535) {
      Alert.alert('Invalid Port', 'Please use a valid unprivileged port (e.g. >1024).');
      return;
    }
    
    setIsTesting(true);
    const baseUrl = `http://${ipAddress}`;
    
    let fp = deviceFingerprint;
    if (!fp) {
      fp = 'df_' + Crypto.randomUUID();
      setDeviceFingerprint(fp);
    }

    try {
      // Direct LLM Connection (LM Studio / Ollama via OpenAI API format)
      if (!pairingCode) {
        const modelsRes = await fetchWithTimeout(`${baseUrl}/v1/models`, { method: 'GET' }, 5000);
        if (modelsRes.ok) {
          const connId = await saveConnection(baseUrl, 'paired', fp);
          if (connId) {
            await SecureStore.setItemAsync(`auth_token_${connId}`, 'direct_mode');
            setConnectionState('paired');
            Alert.alert('Success', 'Directly connected to local LLM server!');
          }
          return;
        } else {
          Alert.alert('Error', 'Could not verify OpenAI-compatible server at /v1/models. Are you sure the server is running?');
          return;
        }
      }

      // 1. Discovery / Health Check for Custom FastAPI backend
      const healthRes = await fetchWithTimeout(`${baseUrl}/v1/health`, {
        method: 'GET',
      }, 5000);
      
      if (!healthRes.ok) {
        setConnectionState('unreachable');
        Alert.alert('Error', 'Laptop responded, but health check failed.');
        setIsTesting(false);
        return;
      }

      // 2. Pair Confirm for Custom FastAPI backend
      const pairRes = await fetchWithTimeout(`${baseUrl}/v1/pair/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_id: fp,
          device_label: 'My Phone',
          pairing_code: pairingCode
        })
      }, 5000);

      if (pairRes.ok) {
        const data = await pairRes.json();
        const token = typeof data.token === 'string' ? data.token.trim() : '';
        if (!token) {
          setConnectionState('unreachable');
          Alert.alert('Pairing Failed', 'The laptop did not return a valid pairing token.');
          return;
        }

        const connId = await saveConnection(baseUrl, 'pending', fp);
        if (!connId) {
          setConnectionState('unreachable');
          Alert.alert('Pairing Failed', 'UniOS could not save this connection.');
          return;
        }

        try {
          await SecureStore.setItemAsync(`auth_token_${connId}`, token);
          await expoDb.runAsync('UPDATE ai_connections SET pairing_state = ?, last_verified_at = CURRENT_TIMESTAMP WHERE id = ?', ['paired', connId]);
        } catch (storageError) {
          console.error('Failed to store pairing token:', storageError);
          setConnectionState('pending');
          Alert.alert('Pairing Incomplete', 'UniOS could not securely store the pairing token. Please try again.');
          return;
        }

        setConnectionState('paired');
        Alert.alert('Success', 'Successfully paired with local AI companion.');
      } else {
        const errorData = await pairRes.json().catch(() => ({}));
        setConnectionState('unreachable');
        Alert.alert('Pairing Failed', errorData.detail || 'The laptop rejected the pairing.');
      }
    } catch (error) {
      console.error(error);
      setConnectionState('unreachable');
      Alert.alert('Unreachable', 'Could not reach the laptop. Ensure it is on the same WiFi network and the AI server is running.');
    } finally {
      setIsTesting(false);
    }
  };

  const saveConnection = async (baseUrl: string, state: string, fp: string) => {
    try {
      if (connectionId) {
        await expoDb.runAsync('UPDATE ai_connections SET base_url = ?, pairing_state = ?, device_fingerprint = ?, last_verified_at = CURRENT_TIMESTAMP WHERE id = ?', [baseUrl, state, fp, connectionId]);
        return connectionId;
      } else {
        const id = Crypto.randomUUID();
        await expoDb.runAsync('INSERT INTO ai_connections (id, label, base_url, pairing_state, device_fingerprint) VALUES (?, ?, ?, ?, ?)', [id, 'My Phone', baseUrl, state, fp]);
        setConnectionId(id);
        return id;
      }
    } catch (e) {
      console.error('Failed to save connection:', e);
      return null;
    }
  };

  const revokeConnection = async () => {
    if (!connectionId) return;

    let revokedOnLaptop = false;
    try {
      const token = await SecureStore.getItemAsync(`auth_token_${connectionId}`);
      if (token && deviceFingerprint && ipAddress) {
        const response = await fetchWithTimeout(`http://${ipAddress}/v1/pair/revoke`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Device-Fingerprint': deviceFingerprint,
          },
        }, 5000);
        revokedOnLaptop = response.ok;
      }
    } catch (error) {
      console.warn('Could not revoke the token on the laptop:', error);
    }

    try {
      await SecureStore.deleteItemAsync(`auth_token_${connectionId}`);
      await expoDb.runAsync('UPDATE ai_connections SET pairing_state = ?, revoked_at = CURRENT_TIMESTAMP WHERE id = ?', ['revoked', connectionId]);
      setConnectionState('revoked');
      Alert.alert(
        revokedOnLaptop ? 'Revoked' : 'Revoked on this phone',
        revokedOnLaptop
          ? 'The laptop and this phone have both invalidated the pairing token.'
          : 'The pairing secret was removed from this phone. Connect to the laptop and revoke there too if it is available.',
      );
    } catch (e) {
      console.error('Failed to remove the local pairing secret:', e);
      Alert.alert('Revocation Failed', 'UniOS could not remove the protected pairing secret from this phone.');
    }
  };

  return (
    <AppScaffold>
      <PageContainer>
        <View style={styles.header}>
          <Monitor size={48} color={colors.light.primary} />
          <Text style={styles.title}>Local AI Companion</Text>
          <Text style={styles.subtitle}>
            Connect your phone to your laptop's AI server to use private, offline AI features.
          </Text>
        </View>

        <View style={{ backgroundColor: `${colors.light.warning}20`, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.xl }}>
          <Text style={{ color: colors.light.warning, fontWeight: typography.fontWeight.semibold, textAlign: 'center' }}>
            ⚠️ Security Note: Only pair with a device or network you completely trust.
          </Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Laptop IP Address (with Port)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 192.168.1.100:8000"
            value={ipAddress}
            onChangeText={setIpAddress}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
          />
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Pairing Code (Optional for Direct LLM)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter pairing code from laptop"
            value={pairingCode}
            onChangeText={setPairingCode}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
        </View>

        <View style={styles.statusContainer}>
          {connectionState === 'paired' && (
            <View style={styles.statusBadge}>
              <CheckCircle size={20} color={colors.light.success} />
              <Text style={[styles.statusText, { color: colors.light.success }]}>Connected</Text>
            </View>
          )}
          {connectionState === 'unreachable' && (
            <View style={styles.statusBadge}>
              <XCircle size={20} color={colors.light.danger} />
              <Text style={[styles.statusText, { color: colors.light.danger }]}>Unreachable / Unpaired</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <PrimaryButton 
            label={isTesting ? "Testing..." : "Pair & Test Connection"} 
            onPress={testConnection} 
            disabled={!ipAddress || isTesting}
          />
          {connectionState === 'paired' && (
            <SecondaryButton 
              label="Revoke Connection" 
              onPress={revokeConnection} 
            />
          )}
          <SecondaryButton 
            label="Back to Profile" 
            onPress={() => router.back()} 
          />
        </View>
      </PageContainer>
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
    marginTop: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  subtitle: {
    textAlign: 'center',
    color: colors.light.textMuted,
    paddingHorizontal: spacing.xl,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.light.text,
  },
  formGroup: {
    marginBottom: spacing.xl,
  },
  input: {
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.surface,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.base,
    marginTop: spacing.sm,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    minHeight: 24,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusText: {
    fontWeight: typography.fontWeight.semibold,
  },
  actions: {
    gap: spacing.md,
  }
});
