import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";

type SettingRowProps = {
  icon: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  colors: ReturnType<typeof useColors>;
};

function SettingRow({ icon, title, subtitle, right, onPress, colors }: SettingRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.card, opacity: onPress && pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: colors.muted }]}>
        <Feather name={icon as never} size={18} color={colors.foreground} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.rowSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{subtitle}</Text>
        )}
      </View>
      {right}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { themeMode, setThemeMode } = useTheme();

  const toggleDark = async (value: boolean) => {
    await setThemeMode(value ? "dark" : "light");
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: insets.bottom + 100, paddingHorizontal: 20 }}
    >
      <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>APP</Text>
      <Text style={[styles.heading, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
        Einstellungen
      </Text>
      <Text style={[styles.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        Passe die App an deine Bedürfnisse an
      </Text>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
        DARSTELLUNG
      </Text>
      <View style={[styles.group, { borderColor: colors.border }]}>
        <SettingRow
          icon="moon"
          title="Dark Mode"
          subtitle="Schalte zwischen heller und dunkler Ansicht"
          colors={colors}
          right={
            <Switch
              value={themeMode === "dark"}
              onValueChange={toggleDark}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          }
        />
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
        ÜBER
      </Text>
      <View style={[styles.group, { borderColor: colors.border }]}>
        <SettingRow
          icon="activity"
          title="Gym Tracker"
          subtitle="Version 1.0.0"
          colors={colors}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <SettingRow
          icon="database"
          title="Datenspeicherung"
          subtitle="Alle Daten werden lokal auf deinem Gerät gespeichert"
          colors={colors}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <SettingRow
          icon="shield"
          title="Datenschutz"
          subtitle="Keine Daten werden an externe Server gesendet"
          colors={colors}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, letterSpacing: 2, marginBottom: 4 },
  heading: { fontSize: 28, marginBottom: 4 },
  sub: { fontSize: 15, marginBottom: 24 },
  sectionLabel: { fontSize: 12, letterSpacing: 1, marginBottom: 8, marginTop: 8 },
  group: { borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 20 },
  row: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15 },
  rowSub: { fontSize: 13, marginTop: 1 },
  divider: { height: 1, marginLeft: 62 },
});
