import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import {
  DEFAULT_PLAN,
  Exercise,
  LoggedSet,
  WorkoutType,
  saveWorkoutSets,
} from "@/lib/trainingData";

type WorkoutPhase = "exercise" | "rest" | "done";

export default function WorkoutScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const workoutType = (type as WorkoutType) in DEFAULT_PLAN ? (type as WorkoutType) : "push";
  const day = DEFAULT_PLAN[workoutType];
  const exercises = day.exercises;
  const accentColor = day.color;

  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(0);
  const [weight, setWeight] = useState("0");
  const [reps, setReps] = useState("");
  const [phase, setPhase] = useState<WorkoutPhase>("exercise");
  const [restSeconds, setRestSeconds] = useState(0);
  const [sessionId] = useState(() => Date.now());
  const [loggedSets, setLoggedSets] = useState<LoggedSet[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const currentExercise: Exercise | undefined = exercises[exerciseIndex];
  const totalExercises = exercises.length;
  const totalSetsForEx = currentExercise?.sets ?? 3;

  useEffect(() => {
    if (currentExercise) {
      setReps(String(currentExercise.minReps));
    }
  }, [exerciseIndex]);

  useEffect(() => {
    if (phase === "rest" && restSeconds > 0) {
      timerRef.current = setInterval(() => {
        setRestSeconds((s) => {
          if (s <= 1) {
            clearInterval(timerRef.current!);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setPhase("exercise");
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, restSeconds]);

  const fadeIn = useCallback(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const confirmExit = () => {
    Alert.alert(
      "Training beenden?",
      "Dein Fortschritt wird gespeichert.",
      [
        { text: "Weiter", style: "cancel" },
        {
          text: "Beenden",
          style: "destructive",
          onPress: async () => {
            if (loggedSets.length > 0) await saveWorkoutSets(loggedSets);
            router.back();
          },
        },
      ]
    );
  };

  const logSet = async () => {
    if (!currentExercise) return;
    const w = parseFloat(weight.replace(",", ".")) || 0;
    const r = parseInt(reps, 10) || currentExercise.minReps;

    const entry: LoggedSet = {
      eventType: "set",
      exercise: currentExercise.name,
      exerciseId: currentExercise.id,
      weight: w,
      reps: r,
      set: setIndex + 1,
      sessionId,
      timestamp: Date.now(),
      type: workoutType,
      dayName: day.name,
    };

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updated = [...loggedSets, entry];
    setLoggedSets(updated);

    const isLastSetOfExercise = setIndex >= totalSetsForEx - 1;
    const isLastExercise = exerciseIndex >= totalExercises - 1;

    if (isLastSetOfExercise && isLastExercise) {
      await saveWorkoutSets(updated);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhase("done");
      return;
    }

    if (isLastSetOfExercise) {
      setSetIndex(0);
      setExerciseIndex((i) => i + 1);
      setPhase("rest");
      setRestSeconds(currentExercise.restSeconds);
      fadeIn();
    } else {
      setSetIndex((s) => s + 1);
      setPhase("rest");
      setRestSeconds(currentExercise.restSeconds);
    }
  };

  const skipRest = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("exercise");
    setRestSeconds(0);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const progress = exercises.length > 1 ? exerciseIndex / (exercises.length - 1) : 0;

  if (phase === "done") {
    return (
      <View style={[styles.doneScreen, { backgroundColor: colors.background, paddingTop: topPad, paddingBottom: bottomPad }]}>
        <View style={[styles.doneIcon, { backgroundColor: accentColor + "22" }]}>
          <Feather name="check-circle" size={56} color={accentColor} />
        </View>
        <Text style={[styles.doneTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Training abgeschlossen!
        </Text>
        <Text style={[styles.doneSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {loggedSets.length} Sets · {totalExercises} Übungen
        </Text>
        <Pressable
          onPress={() =>
            router.replace({
              pathname: "/workout/summary",
              params: { sessionId: String(sessionId), workoutType, dayName: day.name },
            })
          }
          style={[styles.donBtn, { backgroundColor: accentColor }]}
        >
          <Text style={[styles.donBtnText, { fontFamily: "Inter_600SemiBold" }]}>Zusammenfassung ansehen</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={confirmExit} hitSlop={10} style={styles.headerBtn}>
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {day.name}
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Übung {exerciseIndex + 1} / {totalExercises}
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <Animated.View style={[styles.progressFill, { backgroundColor: accentColor, width: `${progress * 100}%` as never }]} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}>
        {phase === "rest" ? (
          <Animated.View style={[styles.restCard, { backgroundColor: accentColor + "12", opacity: fadeAnim }]}>
            <Text style={[styles.restLabel, { color: accentColor, fontFamily: "Inter_600SemiBold" }]}>PAUSE</Text>
            <Text style={[styles.restTimer, { color: accentColor, fontFamily: "Inter_700Bold" }]}>
              {formatTime(restSeconds)}
            </Text>
            <Text style={[styles.restNext, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Nächste Übung: {setIndex < totalSetsForEx - 1 ? currentExercise?.name : exercises[exerciseIndex + 1]?.name}
            </Text>
            <Pressable onPress={skipRest} style={[styles.skipBtn, { borderColor: accentColor }]}>
              <Text style={[styles.skipText, { color: accentColor, fontFamily: "Inter_600SemiBold" }]}>
                Pause überspringen
              </Text>
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* Exercise card */}
            <View style={[styles.exerciseCard, { backgroundColor: accentColor + "10", borderColor: accentColor + "25" }]}>
              <View style={[styles.setsBadge, { backgroundColor: accentColor }]}>
                <Text style={[styles.setsBadgeText, { fontFamily: "Inter_600SemiBold" }]}>
                  Satz {setIndex + 1} / {totalSetsForEx}
                </Text>
              </View>
              <Text style={[styles.exerciseName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                {currentExercise?.name}
              </Text>
              <Text style={[styles.exerciseRep, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Ziel: {currentExercise?.minReps}–{currentExercise?.maxReps} Wdh
              </Text>
            </View>

            {/* Inputs */}
            <View style={styles.inputsRow}>
              <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Gewicht</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                />
                <Text style={[styles.inputUnit, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>kg</Text>
              </View>
              <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Wiederholungen</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
                  value={reps}
                  onChangeText={setReps}
                  keyboardType="number-pad"
                  selectTextOnFocus
                />
                <Text style={[styles.inputUnit, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Wdh</Text>
              </View>
            </View>

            {/* Log button */}
            <Pressable
              onPress={logSet}
              style={({ pressed }) => [styles.logBtn, { backgroundColor: accentColor, opacity: pressed ? 0.8 : 1 }]}
            >
              <Feather name="check" size={20} color="#fff" />
              <Text style={[styles.logBtnText, { fontFamily: "Inter_600SemiBold" }]}>
                Satz loggen
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Upcoming exercises */}
        {exerciseIndex < totalExercises - 1 && (
          <View style={[styles.upcomingSection]}>
            <Text style={[styles.upcomingLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
              NÄCHSTE ÜBUNGEN
            </Text>
            {exercises.slice(exerciseIndex + 1).map((ex, i) => (
              <View key={ex.id} style={[styles.upcomingRow, { borderColor: colors.border }]}>
                <View style={[styles.upcomingNum, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.upcomingNumText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    {exerciseIndex + 2 + i}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.upcomingName, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                    {ex.name}
                  </Text>
                  <Text style={[styles.upcomingSets, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {ex.sets} × {ex.minReps}–{ex.maxReps} Wdh
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 17 },
  headerSub: { fontSize: 13, marginTop: 2 },
  progressTrack: { height: 3 },
  progressFill: { height: 3 },
  content: { padding: 20, gap: 16 },
  exerciseCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 8,
    marginBottom: 4,
  },
  setsBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 4,
  },
  setsBadgeText: { color: "#fff", fontSize: 12 },
  exerciseName: { fontSize: 26 },
  exerciseRep: { fontSize: 14 },
  inputsRow: { flexDirection: "row", gap: 12 },
  inputBox: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
  },
  inputLabel: { fontSize: 12, marginBottom: 6 },
  input: { fontSize: 32, textAlign: "center" },
  inputUnit: { fontSize: 13, marginTop: 4 },
  logBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 18,
    padding: 18,
    marginTop: 4,
  },
  logBtnText: { color: "#fff", fontSize: 17 },
  restCard: {
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  restLabel: { fontSize: 12, letterSpacing: 2 },
  restTimer: { fontSize: 56 },
  restNext: { fontSize: 14, textAlign: "center" },
  skipBtn: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 10, marginTop: 8 },
  skipText: { fontSize: 14 },
  upcomingSection: { gap: 10 },
  upcomingLabel: { fontSize: 11, letterSpacing: 1 },
  upcomingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    paddingBottom: 12,
  },
  upcomingNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  upcomingNumText: { fontSize: 13 },
  upcomingName: { fontSize: 15 },
  upcomingSets: { fontSize: 13, marginTop: 1 },
  doneScreen: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, paddingHorizontal: 40 },
  doneIcon: { width: 100, height: 100, borderRadius: 50, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  doneTitle: { fontSize: 26, textAlign: "center" },
  doneSub: { fontSize: 16, textAlign: "center" },
  donBtn: { borderRadius: 18, paddingHorizontal: 28, paddingVertical: 16, marginTop: 16 },
  donBtnText: { color: "#fff", fontSize: 17 },
});
