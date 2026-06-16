import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { getSessionSummaries, SessionSummary } from "@/lib/trainingData";

const TYPE_COLORS: Record<string, string> = {
  push: "#E52B2E",
  pull: "#2563EB",
  legs: "#16A34A",
  mixed: "#16A34A",
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await getSessionSummaries();
    setSessions(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.background }]}>
        <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          TRAINING
        </Text>
        <Text style={[styles.heading, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Verlauf
        </Text>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => String(item.sessionId)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomPad + 100 }}
        scrollEnabled={!!sessions.length}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Feather name="clock" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                Noch keine Trainings
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Sobald du ein Training abschliesst, erscheint es hier.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const typeKey = (item.dayName ?? "").toLowerCase();
          const accentColor = TYPE_COLORS[typeKey] ?? "#E52B2E";
          return (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.accent, { backgroundColor: accentColor }]} />
              <View style={styles.cardContent}>
                <View style={styles.cardTop}>
                  <View style={[styles.typeBadge, { backgroundColor: accentColor + "18" }]}>
                    <Text style={[styles.typeBadgeText, { color: accentColor, fontFamily: "Inter_600SemiBold" }]}>
                      {item.dayName?.toUpperCase() ?? "WORKOUT"}
                    </Text>
                  </View>
                  <Text style={[styles.time, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {formatTime(item.timestamp)}
                  </Text>
                </View>

                <Text style={[styles.date, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {formatDate(item.timestamp)}
                </Text>

                <View style={styles.meta}>
                  <View style={styles.metaItem}>
                    <Feather name="check-square" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.metaText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {" "}{item.totalSets} Sets
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Feather name="list" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.metaText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {" "}{item.exercises.length} Übungen
                    </Text>
                  </View>
                </View>

                {item.exercises.length > 0 && (
                  <Text style={[styles.exercises, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
                    {item.exercises.join(" · ")}
                  </Text>
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  label: { fontSize: 11, letterSpacing: 2, marginBottom: 4 },
  heading: { fontSize: 28 },
  card: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 12,
  },
  accent: { width: 4 },
  cardContent: { flex: 1, padding: 14 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  typeBadgeText: { fontSize: 11, letterSpacing: 0.5 },
  time: { fontSize: 12 },
  date: { fontSize: 15, marginBottom: 8 },
  meta: { flexDirection: "row", gap: 16, marginBottom: 6 },
  metaItem: { flexDirection: "row", alignItems: "center" },
  metaText: { fontSize: 13 },
  exercises: { fontSize: 12 },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18 },
  emptyText: { fontSize: 14, textAlign: "center", maxWidth: 260 },
});
