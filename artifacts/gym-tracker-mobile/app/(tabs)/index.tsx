import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { DEFAULT_PLAN, WorkoutType, getSessionSummaries, SessionSummary } from "@/lib/trainingData";

const WORKOUT_ORDER: WorkoutType[] = ["push", "pull", "legs", "mixed"];

function formatRelativeDate(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Heute";
  if (days === 1) return "Gestern";
  if (days < 7) return `vor ${days} Tagen`;
  return new Date(timestamp).toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [lastSessions, setLastSessions] = useState<Record<string, SessionSummary>>({});
  const [refreshing, setRefreshing] = useState(false);

  const loadSessions = useCallback(async () => {
    const summaries = await getSessionSummaries();
    const byType: Record<string, SessionSummary> = {};
    for (const s of summaries) {
      const key = (s.dayName ?? "").toLowerCase();
      if (WORKOUT_ORDER.includes(key as WorkoutType) && !byType[key]) {
        byType[key] = s;
      }
    }
    setLastSessions(byType);
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  }, [loadSessions]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: insets.bottom + 100, paddingHorizontal: 20 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
        GYM TRACKER
      </Text>
      <Text style={[styles.heading, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
        Mein Training
      </Text>
      <Text style={[styles.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        Wähle dein heutiges Training
      </Text>

      <View style={{ gap: 14 }}>
        {WORKOUT_ORDER.map((type) => {
          const day = DEFAULT_PLAN[type];
          const last = lastSessions[type];
          return (
            <WorkoutCard key={type} type={type} day={day} last={last} />
          );
        })}
      </View>

      <Pressable
        onPress={() => router.push("/exercise" as never)}
        style={({ pressed }) => [styles.libraryBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={[styles.libraryIcon, { backgroundColor: colors.primary + "15" }]}>
          <Feather name="book-open" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.libraryTitle, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
            Übungsbibliothek
          </Text>
          <Text style={[styles.librarySub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Alle verfügbaren Übungen ansehen
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>
    </ScrollView>
  );
}

function WorkoutCard({ type, day, last }: { type: WorkoutType; day: (typeof DEFAULT_PLAN)[WorkoutType]; last?: SessionSummary }) {
  const [pressed, setPressed] = useState(false);
  const preview = day.exercises.slice(0, 2).map((e) => e.name).join(", ") + (day.exercises.length > 2 ? ` +${day.exercises.length - 2}` : "");

  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={() => router.push(`/workout/${type}` as never)}
      style={[
        styles.card,
        { backgroundColor: day.color, opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.badge}>
          <Text style={[styles.badgeText, { fontFamily: "Inter_600SemiBold" }]}>{type.toUpperCase()}</Text>
        </View>
        <View style={styles.startBtn}>
          <Feather name="play" size={13} color="#fff" />
          <Text style={[styles.startText, { fontFamily: "Inter_600SemiBold" }]}>Start</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { fontFamily: "Inter_700Bold" }]}>{day.name}</Text>
        <Text style={[styles.cardSub, { fontFamily: "Inter_400Regular" }]}>{preview}</Text>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.chip}>
          <Feather name={last ? "clock" : "plus-circle"} size={11} color="rgba(255,255,255,0.8)" />
          <Text style={[styles.chipText, { fontFamily: "Inter_400Regular" }]}>
            {" "}{last ? formatRelativeDate(last.timestamp) : "Noch nie"}
          </Text>
        </View>
        <Text style={[styles.count, { fontFamily: "Inter_500Medium" }]}>
          {day.exercises.length} Übungen
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, letterSpacing: 2, marginBottom: 6 },
  heading: { fontSize: 28, marginBottom: 4 },
  sub: { fontSize: 15, marginBottom: 24 },
  card: { borderRadius: 24, padding: 20, height: 178, justifyContent: "space-between" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: { backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { color: "rgba(255,255,255,0.9)", fontSize: 11, letterSpacing: 1 },
  startBtn: { backgroundColor: "rgba(255,255,255,0.22)", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  startText: { color: "#fff", fontSize: 13 },
  cardBody: { flex: 1, justifyContent: "flex-end", paddingBottom: 8 },
  cardTitle: { fontSize: 26, color: "#fff" },
  cardSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chip: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.18)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  chipText: { fontSize: 12, color: "rgba(255,255,255,0.8)" },
  count: { fontSize: 12, color: "rgba(255,255,255,0.7)" },
  libraryBtn: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 16 },
  libraryIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  libraryTitle: { fontSize: 15, marginBottom: 2 },
  librarySub: { fontSize: 12 },
});
