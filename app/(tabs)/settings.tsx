import { useCallback, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { haptic } from "@/lib/haptics";
import { readPreferences, savePreferences, type NotificationPreferences } from "@/lib/notification-storage";
import { getNotificationPermission, type NotificationPermission } from "@/lib/notifications";

export default function SettingsScreen() {
  const colors = useColors();
  const [permission, setPermission] = useState<NotificationPermission>("undetermined");
  const [preferences, setPreferences] = useState<NotificationPreferences>({ hapticsEnabled: true });

  const refresh = useCallback(async () => {
    const [nextPermission, nextPreferences] = await Promise.all([getNotificationPermission(), readPreferences()]);
    setPermission(nextPermission);
    setPreferences(nextPreferences);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const toggleHaptics = async (value: boolean) => {
    const next = { ...preferences, hapticsEnabled: value };
    setPreferences(next);
    await savePreferences(next);
    if (value) haptic.light();
  };

  const openSettings = async () => {
    if (Platform.OS !== "web") await Linking.openSettings();
  };

  const permissionTone = permission === "granted" ? colors.success : permission === "denied" ? colors.warning : colors.primary;
  const permissionText = permission === "granted" ? "Ativa neste dispositivo" : permission === "denied" ? "Bloqueada pelo sistema" : "Ainda não solicitada";

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-background">
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>CONTROLE DO APP</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Ajustes</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Preferências simples para uma experiência mais sua.</Text>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.muted }]}>SISTEMA</Text>
        <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.settingRow}>
            <View style={[styles.settingIcon, { backgroundColor: `${permissionTone}18` }]}>
              <MaterialIcons name="notifications-active" size={21} color={permissionTone} />
            </View>
            <View style={styles.settingCopy}>
              <Text style={[styles.settingTitle, { color: colors.foreground }]}>Permissão de notificações</Text>
              <Text style={[styles.settingDescription, { color: permissionTone }]}>{permissionText}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: `${permissionTone}18` }]}>
              <View style={[styles.statusDot, { backgroundColor: permissionTone }]} />
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Pressable onPress={() => void openSettings()} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
            <View style={styles.actionCopy}>
              <Text style={[styles.actionTitle, { color: colors.foreground }]}>Abrir Ajustes do dispositivo</Text>
              <Text style={[styles.settingDescription, { color: colors.muted }]}>Altere a permissão quando quiser.</Text>
            </View>
            <MaterialIcons name="open-in-new" size={20} color={colors.muted} />
          </Pressable>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.muted }]}>PREFERÊNCIAS</Text>
        <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.settingRow}>
            <View style={[styles.settingIcon, { backgroundColor: `${colors.primary}18` }]}>
              <MaterialIcons name="vibration" size={21} color={colors.primary} />
            </View>
            <View style={styles.settingCopy}>
              <Text style={[styles.settingTitle, { color: colors.foreground }]}>Feedback tátil ao emitir</Text>
              <Text style={[styles.settingDescription, { color: colors.muted }]}>Uma resposta sutil ao concluir a ação.</Text>
            </View>
            <Switch
              value={preferences.hapticsEnabled}
              onValueChange={(value) => void toggleHaptics(value)}
              trackColor={{ false: colors.border, true: `${colors.primary}88` }}
              thumbColor={preferences.hapticsEnabled ? colors.primary : colors.surface}
              ios_backgroundColor={colors.border}
            />
          </View>
        </View>

        <View style={[styles.aboutCard, { backgroundColor: `${colors.primary}12` }]}>
          <View style={[styles.aboutIcon, { backgroundColor: colors.primary }]}>
            <MaterialIcons name="bolt" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.aboutCopy}>
            <Text style={[styles.aboutTitle, { color: colors.foreground }]}>Notificação Premium</Text>
            <Text style={[styles.aboutText, { color: colors.muted }]}>Emissões locais, rápidas e privadas. Seus dados permanecem no aparelho.</Text>
          </View>
        </View>

        <Text style={[styles.version, { color: colors.muted }]}>Versão 1.0.0</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, paddingTop: 18 },
  header: { marginBottom: 25 },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.6, marginBottom: 3 },
  title: { fontSize: 30, lineHeight: 35, fontWeight: "800", letterSpacing: -0.6 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 7, maxWidth: 315 },
  sectionLabel: { fontSize: 10, lineHeight: 14, letterSpacing: 1.5, fontWeight: "800", marginBottom: 9, marginLeft: 3 },
  settingsCard: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, marginBottom: 24 },
  settingRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 11 },
  settingIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  settingCopy: { flex: 1, gap: 3 },
  settingTitle: { fontSize: 14, lineHeight: 18, fontWeight: "800" },
  settingDescription: { fontSize: 12, lineHeight: 17 },
  statusPill: { width: 25, height: 25, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  divider: { height: 1 },
  actionRow: { minHeight: 63, flexDirection: "row", alignItems: "center", gap: 10 },
  actionCopy: { flex: 1, gap: 3 },
  actionTitle: { fontSize: 13, lineHeight: 18, fontWeight: "700" },
  aboutCard: { borderRadius: 20, padding: 15, flexDirection: "row", gap: 11, marginTop: 1 },
  aboutIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  aboutCopy: { flex: 1, gap: 3 },
  aboutTitle: { fontSize: 13, lineHeight: 18, fontWeight: "800" },
  aboutText: { fontSize: 12, lineHeight: 18 },
  version: { textAlign: "center", fontSize: 11, marginTop: "auto", marginBottom: 15 },
  pressed: { opacity: 0.68 },
});
