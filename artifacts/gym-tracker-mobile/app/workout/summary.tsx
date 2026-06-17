import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { LoggedSet, getSessionSets } from "@/lib/trainingData";

type ExerciseGroup = {
  exercise: string;
  sets: LoggedSet[];
};

function groupByExercise(sets: LoggedSet[]): ExerciseGroup[] {
  const map: Record<string, LoggedSet[]> = {};
  for (const set of sets) {
    if (!map[set.exercise]) map[set.exercise] = [];
    map[set.exercise].push(set);
  }
  return Object.entries(map).map(([exercise, s]) => ({ exercise, sets: s }));
}

export default function WorkoutSummaryScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sessionId, workoutType, dayName } = useLocalSearchParams<{
    sessionId: string;
    workoutType: string;
    dayName: string;
  }>();

  const [groups, setGroups] = useState<ExerciseGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const typeColorMap: Record<string, string> = {
    push: colors.push,
    pull: colors.pull,
    legs: colors.legs,
    mixed: colors.mixed,
  };
  const accentColor = typeColorMap[workoutType ?? "push"] ?? colors.primary;

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    getSessionSets(Number(sessionId)).then((sets) => {
      setGroups(groupByExercise(sets));
      setLoading(false);
    });
  }, [sessionId]);

  const totalSets = groups.reduce((sum, g) => sum + g.sets.length, 0);
  const totalVolume = groups.reduce(
    (sum, g) => sum + g.sets.reduce((s2, set) => s2 + set.weight * set.reps, 0),
    0
  );

  const topPad = Platform.OS === "web" ? 0 : insets.top;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad + 20, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
    >
      <View style={[styles.headerBadge, { backgroundColor: accentColor + "20" }]}>
        <Feather name="check-circle" size={20} color={accentColor} />
        <Text style={[styles.headerBadgeText, { color: accentColor, fontFamily: "Inter_600SemiBold" }]}>
          Training abgeschlossen!
        </Text>
      </View>

      <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
        {dayName ?? "Workout"}
      </Text>

      <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: accentColor, fontFamily: "Inter_700Bold" }]}>{totalSets}</Text>
          <Text style={[styles.statLbl, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Sets</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: accentColor, fontFamily: "Inter_700Bold" }]}>{groups.length}</Text>
          <Text style={[styles.statLbl, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Übungen</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: accentColor, fontFamily: "Inter_700Bold" }]}>
            {Math.round(totalVolume).toLocaleString("de-DE")}
          </Text>
          <Text style={[styles.statLbl, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>kg Volumen</Text>
        </View>
      </View>

      {groups.map((group) => (
        <View key={group.exercise} style={[styles.exerciseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.exerciseName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {group.exercise}
          </Text>
          <View style={styles.setTable}>
            <View style={styles.setTableHeader}>
              <Text style={[styles.setHeaderCell, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Set</Text>
              <Text style={[styles.setHeaderCell, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Gewicht</Text>
              <Text style={[styles.setHeaderCell, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Wdh</Text>
              <Text style={[styles.setHeaderCell, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Volumen</Text>
            </View>
            {group.sets.map((set, idx) => (
              <View key={idx} style={[styles.setTableRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.setCell, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {idx + 1}
                </Text>
                <Text style={[styles.setCell, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  {set.weight} kg
                </Text>
                <Text style={[styles.setCell, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  {set.reps}
                </Text>
                <Text style={[styles.setCell, { color: accentColor, fontFamily: "Inter_500Medium" }]}>
                  {Math.round(set.weight * set.reps)} kg
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      <Pressable
        onPress={() => router.replace("/")}
        style={({ pressed }) => [styles.homeBtn, { backgroundColor: accentColor, opacity: pressed ? 0.85 : 1 }]}
      >
        <Text style={[styles.homeBtnText, { fontFamily: "Inter_600SemiBold" }]}>Zum Dashboard</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerBadge: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, alignSelf: "flex-start", marginBottom: 16 },
  headerBadgeText: { fontSize: 14 },
  title: { fontSize: 28, marginBottom: 20 },
  statsRow: { flexDirection: "row", borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20, justifyContent: "space-around", alignItems: "center" },
  statItem: { alignItems: "center" },
  statNum: { fontSize: 22 },
  statLbl: { fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, height: 32 },
  exerciseCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  exerciseName: { fontSize: 15, marginBottom: 12 },
  setTable: {},
  setTableHeader: { flexDirection: "row", paddingBottom: 8 },
  setHeaderCell: { flex: 1, fontSize: 11, letterSpacing: 0.5 },
  setTableRow: { flexDirection: "row", paddingVertical: 8, borderTopWidth: 1 },
  setCell: { flex: 1, fontSize: 14 },
  homeBtn: { borderRadius: 16, padding: 16, alignItems: "center", marginTop: 12 },
  homeBtnText: { color: "#fff", fontSize: 16 },
});
