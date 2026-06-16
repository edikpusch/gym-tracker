import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import {
  BodyWeightEntry,
  deleteBodyWeightEntry,
  getBodyWeightEntries,
  saveBodyWeightEntry,
} from "@/lib/trainingData";

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" });
}

export default function WeightScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<BodyWeightEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const load = useCallback(async () => {
    setEntries(await getBodyWeightEntries());
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openAdd = () => {
    setWeightInput("");
    setNoteInput("");
    setModalVisible(true);
    setTimeout(() => inputRef.current?.focus(), 300);
  };

  const onSave = async () => {
    const w = parseFloat(weightInput.replace(",", "."));
    if (isNaN(w) || w <= 0 || w > 500) {
      Alert.alert("Ungültig", "Bitte ein gültiges Gewicht eingeben.");
      return;
    }
    setSaving(true);
    await saveBodyWeightEntry(w, noteInput);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await load();
    setSaving(false);
    setModalVisible(false);
  };

  const onDelete = (id: string) => {
    Alert.alert("Eintrag löschen?", "Dieser Eintrag wird dauerhaft entfernt.", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Löschen",
        style: "destructive",
        onPress: async () => {
          await deleteBodyWeightEntry(id);
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          load();
        },
      },
    ]);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const latest = entries[0]?.weight;
  const prev = entries[1]?.weight;
  const trend = latest && prev ? latest - prev : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.background }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>KÖRPER</Text>
            <Text style={[styles.heading, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Gewicht</Text>
          </View>
          <Pressable
            onPress={openAdd}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={20} color="#fff" />
          </Pressable>
        </View>

        {latest && (
          <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                {latest.toFixed(1)} kg
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Aktuell
              </Text>
            </View>
            {trend !== null && (
              <View style={styles.stat}>
                <Text style={[styles.statValue, {
                  color: trend < 0 ? "#16A34A" : trend > 0 ? "#E52B2E" : colors.mutedForeground,
                  fontFamily: "Inter_700Bold"
                }]}>
                  {trend > 0 ? "+" : ""}{trend.toFixed(1)} kg
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Änderung
                </Text>
              </View>
            )}
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                {entries.length}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Einträge
              </Text>
            </View>
          </View>
        )}
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomPad + 100 }}
        scrollEnabled={!!entries.length}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="trending-up" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              Noch keine Einträge
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Tippe auf + um dein erstes Gewicht einzutragen.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const prev2 = entries[index + 1]?.weight;
          const delta = prev2 !== undefined ? item.weight - prev2 : null;
          return (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardLeft}>
                <Text style={[styles.cardWeight, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {item.weight.toFixed(1)} <Text style={{ fontSize: 14 }}>kg</Text>
                </Text>
                {item.note && (
                  <Text style={[styles.cardNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {item.note}
                  </Text>
                )}
                <Text style={[styles.cardDate, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {formatDate(item.timestamp)}
                </Text>
              </View>
              <View style={styles.cardRight}>
                {delta !== null && (
                  <Text style={[styles.delta, {
                    color: delta < 0 ? "#16A34A" : delta > 0 ? "#E52B2E" : colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                  }]}>
                    {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                  </Text>
                )}
                <Pressable onPress={() => onDelete(item.id)} hitSlop={8}>
                  <Feather name="trash-2" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Gewicht eintragen
            </Text>

            <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <TextInput
                ref={inputRef}
                style={[styles.weightInput, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
                placeholder="0.0"
                placeholderTextColor={colors.mutedForeground}
                value={weightInput}
                onChangeText={setWeightInput}
                keyboardType="decimal-pad"
                returnKeyType="next"
              />
              <Text style={[styles.kgLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>kg</Text>
            </View>

            <TextInput
              style={[styles.noteInput, { borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              placeholder="Notiz (optional)"
              placeholderTextColor={colors.mutedForeground}
              value={noteInput}
              onChangeText={setNoteInput}
              returnKeyType="done"
            />

            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={[styles.cancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.cancelText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  Abbrechen
                </Text>
              </Pressable>
              <Pressable
                onPress={onSave}
                disabled={saving}
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.saveText, { fontFamily: "Inter_600SemiBold" }]}>
                  {saving ? "Speichern..." : "Speichern"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 },
  label: { fontSize: 11, letterSpacing: 2, marginBottom: 4 },
  heading: { fontSize: 28 },
  addBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  statsRow: { flexDirection: "row", borderRadius: 16, borderWidth: 1, padding: 16, gap: 24 },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 20 },
  statLabel: { fontSize: 12, marginTop: 2 },
  card: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  cardLeft: { gap: 2 },
  cardWeight: { fontSize: 20 },
  cardNote: { fontSize: 13 },
  cardDate: { fontSize: 12 },
  cardRight: { alignItems: "flex-end", gap: 8 },
  delta: { fontSize: 15 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18 },
  emptyText: { fontSize: 14, textAlign: "center", maxWidth: 260 },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14 },
  modalTitle: { fontSize: 20, marginBottom: 4 },
  inputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 14, paddingHorizontal: 16 },
  weightInput: { flex: 1, fontSize: 36, paddingVertical: 12 },
  kgLabel: { fontSize: 18 },
  noteInput: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 15 },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14, alignItems: "center" },
  cancelText: { fontSize: 15 },
  saveBtn: { flex: 1, borderRadius: 14, padding: 14, alignItems: "center" },
  saveText: { fontSize: 15, color: "#fff" },
});
