import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { WorkoutStats, getWorkoutStats, getSessionSummaries, SessionSummary } from "@/lib/trainingData";

function StatCard({
  icon,
  title,
  value,
  subtitle,
  color,
  colors,
}: {
  icon: string;
  title: string;
  value: string;
  subtitle?: string;
  color?: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: (color ?? colors.primary) + "20" }]}>
        <Feather name={icon as never} size={18} color={color ?? colors.primary} />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{value}</Text>
      <Text style={[styles.statTitle, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{title}</Text>
      {subtitle && (
        <Text style={[styles.statSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{subtitle}</Text>
      )}
    </View>
  );
}

function SessionRow({ session, colors }: { session: SessionSummary; colors: ReturnType<typeof useColors> }) {
  const date = new Date(session.timestamp);
  const dateStr = date.toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
  const typeColor: Record<string, string> = {
    push: colors.push,
    pull: colors.pull,
    legs: colors.legs,
    mixed: colors.mixed,
  };
  const color = typeColor[session.workoutType] ?? colors.primary;
  return (
    <View style={[styles.sessionRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.sessionDot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.sessionName, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{session.dayName}</Text>
        <Text style={[styles.sessionMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {session.totalSets} Sets · {session.exercises.slice(0, 2).join(", ")}
          {session.exercises.length > 2 ? ` +${session.exercises.length - 2}` : ""}
        </Text>
      </View>
      <Text style={[styles.sessionDate, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{dateStr}</Text>
    </View>
  );
}

export default function StatisticsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, ss] = await Promise.all([getWorkoutStats(), getSessionSummaries()]);
      setStats(s);
      setSessions(ss.slice(0, 10));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const weekTrend =
    stats && stats.lastWeekSessions > 0
      ? stats.thisWeekSessions >= stats.lastWeekSessions
        ? "↑ Mehr als letzte Woche"
        : "↓ Weniger als letzte Woche"
      : undefined;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: insets.bottom + 100, paddingHorizontal: 20 }}
    >
      <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>DEINE</Text>
      <Text style={[styles.heading, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Statistiken</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        Überblick über dein Training
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : !stats || stats.totalSessions === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="pie-chart" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Noch keine Daten</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Absolviere dein erstes Training, um Statistiken zu sehen.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.grid}>
            <StatCard icon="calendar" title="Einheiten" value={String(stats.totalSessions)} colors={colors} />
            <StatCard icon="layers" title="Gesamt Sets" value={String(stats.totalSets)} colors={colors} />
            <StatCard
              icon="trending-up"
              title="Diese Woche"
              value={String(stats.thisWeekSessions)}
              subtitle={weekTrend}
              color="#2563EB"
              colors={colors}
            />
            <StatCard
              icon="zap"
              title="Sets/Einheit"
              value={String(stats.avgSetsPerSession)}
              color="#F59E0B"
              colors={colors}
            />
          </View>

          <View style={[styles.volumeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.volumeIcon, { backgroundColor: colors.primary + "20" }]}>
              <Feather name="award" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.volumeLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Gesamtvolumen
              </Text>
              <Text style={[styles.volumeValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                {stats.totalVolumeKg.toLocaleString("de-DE")} kg
              </Text>
            </View>
          </View>

          {stats.mostTrainedExercise && (
            <View style={[styles.topExCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="star" size={16} color="#F59E0B" />
              <Text style={[styles.topExText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                Meisttrainiert: <Text style={{ fontFamily: "Inter_600SemiBold" }}>{stats.mostTrainedExercise}</Text>
              </Text>
            </View>
          )}

          {sessions.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                LETZTE EINHEITEN
              </Text>
              <View style={[styles.sessionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {sessions.map((session) => (
                  <SessionRow key={session.sessionId} session={session} colors={colors} />
                ))}
              </View>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, letterSpacing: 2, marginBottom: 4 },
  heading: { fontSize: 28, marginBottom: 4 },
  sub: { fontSize: 15, marginBottom: 24 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  statCard: {
    width: "47%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: "flex-start",
    gap: 8,
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  statValue: { fontSize: 24 },
  statTitle: { fontSize: 13 },
  statSub: { fontSize: 11 },
  volumeCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
    marginBottom: 12,
  },
  volumeIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  volumeLabel: { fontSize: 12, marginBottom: 2 },
  volumeValue: { fontSize: 22 },
  topExCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  topExText: { fontSize: 14, flex: 1 },
  sectionLabel: { fontSize: 12, letterSpacing: 1, marginBottom: 8 },
  sessionCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 20 },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    gap: 10,
  },
  sessionDot: { width: 8, height: 8, borderRadius: 4 },
  sessionName: { fontSize: 14, marginBottom: 2 },
  sessionMeta: { fontSize: 12 },
  sessionDate: { fontSize: 12 },
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 32, alignItems: "center", gap: 12, marginTop: 20 },
  emptyTitle: { fontSize: 17 },
  emptySub: { fontSize: 14, textAlign: "center" },
});
