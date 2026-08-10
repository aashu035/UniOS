import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TextInput, ScrollView, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { AppScaffold } from '../../components/layout/AppScaffold';
import { PageContainer } from '../../components/layout/PageContainer';
import { Skeleton } from '../../components/ui/Skeleton';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { SecondaryButton } from '../../components/buttons/SecondaryButton';
import { colors, spacing, typography, radius } from '../../tokens';
import { useRouter } from 'expo-router';
import { MessageSquare, MonitorOff, Send, Bot, User } from 'lucide-react-native';
import { AIRepository } from '../../domains/ai/repository';
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

export default function TutorInterface() {
  const router = useRouter();
  const [connection, setConnection] = useState<any>(null);
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  
  useEffect(() => {
    loadChat();
  }, []);

  const loadChat = async () => {
    try {
      const activeConn = await AIRepository.getActiveConnection();
      setConnection(activeConn);
      
      if (activeConn) {
        const conv = await AIRepository.getOrCreateConversation(activeConn.id);
        setConversation(conv);
        const msgs = await AIRepository.getMessages(conv.id);
        setMessages(msgs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!messageText.trim() || !connection || !conversation) return;

    const body = messageText.trim();
    setMessageText('');
    setIsSending(true);

    try {
      // 1. Save and display user message
      const userMsg = await AIRepository.saveMessage(conversation.id, 'user', body);
      setMessages(prev => [...prev, userMsg]);
      
      // 2. Send to backend
      const baseUrl = connection.baseUrl;
      const fp = connection.deviceFingerprint;
      
      const token = await SecureStore.getItemAsync(`auth_token_${connection.id}`);
      if (!token) {
        const err = await AIRepository.saveMessage(
          conversation.id,
          'assistant',
          'Your local tutor needs pairing again. Open Settings to reconnect it securely.',
        );
        setMessages(prev => [...prev, err]);
        return;
      }
      
      let response;
      if (token === 'direct_mode') {
        // Direct mode to LM Studio / Ollama
        // 1. Fetch available models to avoid hardcoding 'qwen' which might be named 'qwen2.5:3b' in Ollama
        let targetModel = 'qwen';
        try {
          const modelsRes = await fetchWithTimeout(`${baseUrl}/v1/models`, { method: 'GET' }, 5000);
          if (modelsRes.ok) {
            const modelsData = await modelsRes.json();
            if (modelsData.data && modelsData.data.length > 0) {
              targetModel = modelsData.data[0].id; // Use the first available model
            }
          }
        } catch (e) {
          console.log('Could not fetch models, falling back to default.');
        }

        // 2. Get previous messages to build context
        const priorMessages = messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.body
        }));
        priorMessages.push({ role: 'user', content: body });

        response = await fetchWithTimeout(`${baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: targetModel,
            messages: priorMessages
          }),
        }, 60000);

        if (response.ok) {
          const data = await response.json();
          const reply = data.choices?.[0]?.message?.content || 'Sorry, no response';
          const asstMsg = await AIRepository.saveMessage(conversation.id, 'assistant', reply, null);
          setMessages(prev => [...prev, asstMsg]);
        } else {
          const err = await AIRepository.saveMessage(conversation.id, 'assistant', 'Error: LLM server encountered an issue.');
          setMessages(prev => [...prev, err]);
        }
      } else {
        // Paired FastAPI server
        response = await fetchWithTimeout(`${baseUrl}/v1/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Device-Fingerprint': fp
          },
          body: JSON.stringify({ message: body }),
        }, 30000);

        if (response.ok) {
          const data = await response.json();
          const sources = data.sources ? JSON.stringify(data.sources) : null;
          const asstMsg = await AIRepository.saveMessage(conversation.id, 'assistant', data.response || 'Sorry, no response', sources);
          setMessages(prev => [...prev, asstMsg]);
        } else {
          const err = await AIRepository.saveMessage(conversation.id, 'assistant', 'Error: The AI server encountered an issue.');
          setMessages(prev => [...prev, err]);
        }
      }
    } catch (error) {
      const err = await AIRepository.saveMessage(conversation.id, 'assistant', 'Error: Could not reach the AI server.');
      setMessages(prev => [...prev, err]);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <AppScaffold>
        <View style={styles.loadingContainer}>
          <Skeleton height={60} borderRadius={radius.lg} style={{ marginBottom: spacing.md }} />
          <Skeleton height={100} borderRadius={radius.lg} style={{ alignSelf: 'flex-start', width: '70%', marginBottom: spacing.md }} />
          <Skeleton height={100} borderRadius={radius.lg} style={{ alignSelf: 'flex-end', width: '70%', marginBottom: spacing.md }} />
          <Skeleton height={100} borderRadius={radius.lg} style={{ alignSelf: 'flex-start', width: '70%', marginBottom: spacing.md }} />
        </View>
      </AppScaffold>
    );
  }

  if (!connection) {
    return (
      <AppScaffold>
        <PageContainer>
          <View style={styles.emptyState}>
            <MonitorOff size={48} color={colors.light.textMuted} />
            <Text style={styles.emptyTitle}>Tutor is offline</Text>
            <Text style={styles.emptyBody}>
              Connect UniOS to your laptop to unlock the private, personalized AI tutor. 
              The AI runs entirely on your local network.
            </Text>
            <PrimaryButton 
              label="Setup Local Companion" 
              onPress={() => router.push('/settings/pairing')} 
              style={styles.setupButton}
            />
          </View>
        </PageContainer>
      </AppScaffold>
    );
  }

  return (
    <AppScaffold>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <MessageSquare size={24} color={colors.light.primary} />
          <Text style={styles.headerText}>AI Tutor</Text>
        </View>
        <SecondaryButton 
          label="Settings" 
          onPress={() => router.push('/settings/pairing')} 
        />
      </View>
      
      <ScrollView 
        ref={scrollViewRef}
        style={styles.chatArea} 
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        <View style={[styles.messageBubble, styles.assistantBubble]}>
          <View style={styles.bubbleHeader}>
            <Bot size={16} color={colors.light.primary} />
            <Text style={styles.bubbleName}>Tutor</Text>
          </View>
          <Text style={styles.bubbleText}>
            Hi! I'm your local AI tutor. I can help you study using the materials you explicitly share with me.
          </Text>
        </View>

        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <View key={index} style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
              <View style={styles.bubbleHeader}>
                {isUser ? <User size={16} color={colors.light.textMuted} /> : <Bot size={16} color={colors.light.primary} />}
                <Text style={styles.bubbleName}>{isUser ? 'You' : 'Tutor'}</Text>
              </View>
              <Text style={[styles.bubbleText, isUser && styles.userBubbleText]}>{msg.body}</Text>
              
              {msg.sourceManifest && (
                <View style={styles.sourcesContainer}>
                  <Text style={styles.sourcesLabel}>Sources:</Text>
                  <Text style={styles.sourcesText}>{msg.sourceManifest}</Text>
                </View>
              )}
            </View>
          );
        })}
        {isSending && (
          <View style={styles.typingIndicator}>
            <Skeleton height={32} width={60} borderRadius={radius.full} />
          </View>
        )}
      </ScrollView>

      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          placeholder="Ask a question..."
          value={messageText}
          onChangeText={setMessageText}
          multiline
          placeholderTextColor={colors.light.textMuted}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={!messageText.trim() || isSending}>
          <Send size={20} color={!messageText.trim() || isSending ? colors.light.textMuted : colors.light.primary} />
        </TouchableOpacity>
      </View>
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    marginTop: spacing.xxl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyBody: {
    textAlign: 'center',
    color: colors.light.textMuted,
    marginBottom: spacing.xxl,
  },
  setupButton: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
    backgroundColor: colors.light.surface,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  chatArea: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  chatContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  messageBubble: {
    padding: spacing.md,
    borderRadius: radius.lg,
    maxWidth: '85%',
  },
  assistantBubble: {
    backgroundColor: colors.light.surface,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.light.border,
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: colors.light.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  bubbleName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.light.textMuted,
  },
  bubbleText: {
    color: colors.light.text,
    fontSize: typography.fontSize.base,
    lineHeight: 22,
  },
  userBubbleText: {
    color: '#FFFFFF',
  },
  sourcesContainer: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: radius.md,
  },
  sourcesLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.light.textMuted,
    marginBottom: 2,
  },
  sourcesText: {
    fontSize: typography.fontSize.xs,
    color: colors.light.textMuted,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    backgroundColor: colors.light.surface,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.light.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.light.background,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.light.border,
  }
});
