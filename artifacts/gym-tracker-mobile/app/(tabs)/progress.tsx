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
import { ExerciseProgressItem, getExerciseProgress } from "@/lib/trainingData";

function KindBadge({ kind, colors }: { kind: ExerciseProgressItem["kind"]; colors: ReturnType<typeof useColors> }) {
  const config = {
    better: { icon: "trending-up", color: "#16A34A", label: "Besser" },
    worse: { icon: "trending-down", color: "#E52B2E", label: "Rückgang" },
    same: { icon: "minus", color: colors.mutedForeground, label: "Gleich" },
    new: { icon: "star", color: "#F59E0B", label: "Neu" },
  } as const;
  const { icon, color, label } = config[kind];
  return (
    <View style={[styles.badge, { backgroundColor: color + "20" }]}>
      <Feather name={icon as never} size={12} color={color} />
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function ProgressCard({ item, colors }: { item: ExerciseProgressItem; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.exerciseName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
          {item.exercise}
        </Text>
        <KindBadge kind={item.kind} colors={colors} />
      </View>

      <View style={styles.setRow}>
        <View style={styles.setCol}>
          <Text style={[styles.setLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Aktuell</Text>
          <Text style={[styles.setValue, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {item.latestSet.weight}kg × {item.latestSet.reps}
          </Text>
        </View>
        {item.previousSet && (
          <View style={styles.setCol}>
            <Text style={[styles.setLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Vorher</Text>
            <Text style={[styles.setValue, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              {item.previousSet.weight}kg × {item.previousSet.reps}
            </Text>
          </View>
        )}
        {item.bestSet && (
          <View style={styles.setCol}>
            <Text style={[styles.setLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Bestleistung</Text>
            <Text style={[styles.setValue, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
              {item.bestSet.weight}kg × {item.bestSet.reps}
            </Text>
          </View>
        )}
      </View>

      {item.kind === "better" && (item.deltaWeight !== 0 || item.deltaReps !== 0) && (
        <View style={[styles.deltaRow, { backgroundColor: "#16A34A15" }]}>
          {item.deltaWeight !== 0 && (
            <Text style={[styles.deltaText, { color: "#16A34A", fontFamily: "Inter_500Medium" }]}>
              {item.deltaWeight > 0 ? "+" : ""}{item.deltaWeight}kg
            </Text>
          )}
          {item.deltaReps !== 0 && (
            <Text style={[styles.deltaText, { color: "#16A34A", fontFamily: "Inter_500Medium" }]}>
              {item.deltaReps > 0 ? "+" : ""}{item.deltaReps} Wdh
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

export default function ProgressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ExerciseProgressItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getExerciseProgress());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const betterCount = items.filter((i) => i.kind === "better").length;
  const worseCount = items.filter((i) => i.kind === "worse").length;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: insets.bottom + 100, paddingHorizontal: 20 }}
    >
      <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>DEINE</Text>
      <Text style={[styles.heading, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Fortschritt</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        Vergleich aktuell vs. letzte Session
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="bar-chart-2" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Noch keine Daten</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Absolviere mindestens eine Trainingseinheit, um hier deinen Fortschritt zu sehen.
          </Text>
        </View>
      ) : (
        <>
          {(betterCount > 0 || worseCount > 0) && (
            <View style={[styles.summaryRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {betterCount > 0 && (
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryNum, { color: "#16A34A", fontFamily: "Inter_700Bold" }]}>{betterCount}</Text>
                  <Text style={[styles.summaryLbl, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Verbessert</Text>
                </View>
              )}
              {worseCount > 0 && (
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryNum, { color: "#E52B2E", fontFamily: "Inter_700Bold" }]}>{worseCount}</Text>
                  <Text style={[styles.summaryLbl, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Rückgang</Text>
                </View>
              )}
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNum, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{items.length}</Text>
                <Text style={[styles.summaryLbl, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Übungen</Text>
              </View>
            </View>
          )}
          {items
            .sort((a, b) => {
              const order = { better: 0, new: 1, same: 2, worse: 3 };
              return order[a.kind] - order[b.kind];
            })
            .map((item) => (
              <ProgressCard key={item.exerciseId} item={item} colors={colors} />
            ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, letterSpacing: 2, marginBottom: 4 },
  heading: { fontSize: 28, marginBottom: 4 },
  sub: { fontSize: 15, marginBottom: 24 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  exerciseName: { fontSize: 15, flex: 1, marginRight: 8 },
  badge: { flexDirection: "row", alignItems: "center", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, gap: 4 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  setRow: { flexDirection: "row", gap: 16 },
  setCol: { flex: 1 },
  setLabel: { fontSize: 11, marginBottom: 2 },
  setValue: { fontSize: 15 },
  deltaRow: { flexDirection: "row", gap: 12, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 10 },
  deltaText: { fontSize: 13 },
  summaryRow: { flexDirection: "row", borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16, justifyContent: "space-around" },
  summaryItem: { alignItems: "center" },
  summaryNum: { fontSize: 24 },
  summaryLbl: { fontSize: 12, marginTop: 2 },
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 32, alignItems: "center", gap: 12, marginTop: 20 },
  emptyTitle: { fontSize: 17 },
  emptySub: { fontSize: 14, textAlign: "center" },
});
