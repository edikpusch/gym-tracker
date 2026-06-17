import React, { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { getExerciseLibrary } from "@/lib/trainingData";

const ALL_EXERCISES = getExerciseLibrary();
const CATEGORIES = ["Alle", ...new Set(ALL_EXERCISES.map((e) => e.category))];

export default function ExerciseLibraryScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Alle");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return ALL_EXERCISES.filter((ex) => {
      const matchQuery = !q || ex.name.toLowerCase().includes(q) || ex.id.toLowerCase().includes(q);
      const matchCat = category === "Alle" || ex.category === category;
      return matchQuery && matchCat;
    });
  }, [query, category]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: insets.bottom + 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ paddingHorizontal: 20 }}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>

        <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>ÜBUNGSBIBLIOTHEK</Text>
        <Text style={[styles.heading, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Übungen</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {ALL_EXERCISES.length} Übungen verfügbar
        </Text>

        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Übung suchen..."
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 4 }}
        style={{ marginBottom: 16 }}
      >
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => setCategory(cat)}
            style={[
              styles.catChip,
              {
                backgroundColor: category === cat ? colors.primary : colors.card,
                borderColor: category === cat ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.catChipText,
                {
                  color: category === cat ? "#fff" : colors.foreground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              {cat}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: 20 }}>
        {filtered.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="search" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Keine Übungen gefunden
            </Text>
          </View>
        ) : (
          <View style={[styles.listCard, { borderColor: colors.border }]}>
            {filtered.map((ex, idx) => (
              <View
                key={ex.id}
                style={[
                  styles.exerciseRow,
                  { backgroundColor: colors.card, borderBottomColor: colors.border },
                  idx === filtered.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={[styles.catDot, { backgroundColor: ex.categoryColor }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.exerciseName, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                    {ex.name}
                  </Text>
                  <Text style={[styles.exerciseCat, { color: ex.categoryColor, fontFamily: "Inter_400Regular" }]}>
                    {ex.category}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backBtn: { marginBottom: 16, alignSelf: "flex-start", padding: 4 },
  label: { fontSize: 11, letterSpacing: 2, marginBottom: 4 },
  heading: { fontSize: 28, marginBottom: 4 },
  sub: { fontSize: 15, marginBottom: 20 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 16 },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  catChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  catChipText: { fontSize: 13 },
  listCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  exerciseRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12, borderBottomWidth: 1 },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  exerciseName: { fontSize: 15 },
  exerciseCat: { fontSize: 12, marginTop: 1 },
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 32, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 15 },
});
