import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { BellOff, CheckCheck, X, AlertTriangle, Info, CheckCircle2, CalendarX } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NotificationRepository } from '../domains/notification/repository';
import { colors, spacing, typography } from '../tokens';
import { AppCard } from '../components/cards/AppCard';
import * as Haptics from 'expo-haptics';
import { modernLink } from '../domains/notification/service';

interface NotificationRow {
  id: number;
  title: string;
  message: string;
  type: string | null;
  isRead: boolean | null;
  actionUrl: string | null;
  createdAt: string | null;
}

const typeIcon = (t: string | null) => {
  switch (t) {
    case 'success': return CheckCircle2;
    case 'warning': return AlertTriangle;
    case 'alert': return CalendarX;
    default: return Info;
  }
};

const typeColor = (t: string | null): string => {
  switch (t) {
    case 'success': return colors.light.success ?? '#10B981';
    case 'warning': return colors.light.warning ?? '#F59E0B';
    case 'alert': return colors.light.danger ?? '#EF4444';
    default: return colors.light.primary ?? '#3B82F6';
  }
};

const formatTime = (iso: string | null): string => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
};

export default function NotificationsModal() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await NotificationRepository.list(200);
      setItems(rows as NotificationRow[]);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    // Clear the bell dot when the user actually opens the inbox.
    NotificationRepository.markAllRead().catch(() => {});
  }, [load]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const handlePress = useCallback(async (n: NotificationRow) => {
    try {
      Haptics.selectionAsync?.();
    } catch {}
    if (!n.isRead) {
      await NotificationRepository.markRead(n.id).catch(() => {});
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x));
    }
    if (n.actionUrl) {
      // Dismiss the modal first, then navigate. Stack ordering: notifications is a modal on top of the tabs.
      router.dismiss();
      // Small delay so the dismiss animation doesn't collide with the push.
      setTimeout(() => router.push(modernLink(n.actionUrl!) as any), 50);
    }
  }, [router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Inbox</Text>
          {items.length > 0 && (
            <Text style={styles.subtitle}>{items.length} notification{items.length === 1 ? '' : 's'}</Text>
          )}
        </View>
        <View style={styles.headerActions}>
          {items.some(n => !n.isRead) && (
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={async () => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                await NotificationRepository.markAllRead().catch(() => {});
                setItems(prev => prev.map(x => ({ ...x, isRead: true })));
              }}
              accessibilityLabel="Mark all as read"
            >
              <CheckCheck size={20} color={colors.light.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.back()}
            accessibilityLabel="Close"
          >
            <X size={20} color={colors.light.text} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.light.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <BellOff size={48} color={colors.light.textMuted} />
          <Text style={styles.emptyTitle}>All caught up</Text>
          <Text style={styles.emptySub}>You don't have any new notifications.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {items.map(n => {
            const Icon = typeIcon(n.type);
            const color = typeColor(n.type);
            return (
              <TouchableOpacity
                key={n.id}
                activeOpacity={0.8}
                onPress={() => handlePress(n)}
              >
                <AppCard
                  padding="md"
                  style={[
                    styles.card,
                    !n.isRead && styles.cardUnread,
                  ]}
                >
                  <View style={[styles.iconWrap, { backgroundColor: color + '18' }]}>
                    <Icon size={20} color={color} />
                  </View>
                  <View style={styles.cardContent}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={[styles.cardTitle, !n.isRead && styles.cardTitleUnread]} numberOfLines={1}>
                        {n.title}
                      </Text>
                      <Text style={styles.cardTime}>{formatTime(n.createdAt)}</Text>
                    </View>
                    <Text style={styles.cardMessage} numberOfLines={2}>{n.message}</Text>
                    {n.actionUrl && (
                      <Text style={styles.cardLink} numberOfLines={1}>{modernLink(n.actionUrl)}</Text>
                    )}
                  </View>
                  {!n.isRead && <View style={styles.unreadDot} />}
                </AppCard>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.light.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  title: {
    fontSize: typography.fontSize.xl ?? 24,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text,
  },
  subtitle: {
    fontSize: typography.fontSize.sm ?? 13,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg ?? 18,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text,
    marginTop: spacing.md,
  },
  emptySub: {
    fontSize: typography.fontSize.sm ?? 13,
    color: colors.light.textMuted,
    marginTop: spacing.xs,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardUnread: {
    backgroundColor: (colors.light.primary ?? '#3B82F6') + '10',
    borderColor: (colors.light.primary ?? '#3B82F6') + '30',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: { flex: 1 },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    flex: 1,
    fontSize: typography.fontSize.base ?? 15,
    fontWeight: typography.fontWeight.semibold,
    color: colors.light.text,
  },
  cardTitleUnread: { fontWeight: typography.fontWeight.bold },
  cardTime: {
    fontSize: typography.fontSize.xs ?? 11,
    color: colors.light.textMuted,
    marginLeft: spacing.sm,
  },
  cardMessage: {
    fontSize: typography.fontSize.sm ?? 13,
    color: colors.light.textMuted,
    marginTop: 2,
    lineHeight: 18,
  },
  cardLink: {
    fontSize: typography.fontSize.xs ?? 11,
    color: colors.light.primary,
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.light.primary ?? '#3B82F6',
  },
});
