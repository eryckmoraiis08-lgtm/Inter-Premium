import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { haptic } from "@/lib/haptics";
import {
  addToHistory,
  readDraft,
  readNotificationIcon,
  readPreferences,
  saveDraft,
  type NotificationPreferences,
} from "@/lib/notification-storage";
import {
  SENDER_NAME_LIMIT,
  SUBJECT_LIMIT,
  SUBTITLE_LIMIT,
  validateNotificationContent,
} from "@/lib/notification-validation";
import {
  emitLocalNotification,
  getNotificationPermission,
  requestNotificationPermission,
  type NotificationPermission,
} from "@/lib/notifications";

const DELAYS = [
  { label: "1 minuto", shortLabel: "1 min", value: 60 },
  { label: "5 minutos", shortLabel: "5 min", value: 300 },
  { label: "10 minutos", shortLabel: "10 min", value: 600 },
  { label: "30 minutos", shortLabel: "30 min", value: 1800 },
];

export default function ScheduleScreen() {
  const colors = useColors();
  const [senderName, setSenderName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [subject, setSubject] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [selectedDelay, setSelectedDelay] = useState(300);
  const [permission, setPermission] = useState<NotificationPermission>("undetermined");
  const [preferences, setPreferences] = useState<NotificationPreferences>({ hapticsEnabled: true });
  const [isScheduling, setIsScheduling] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const refresh = useCallback(async () => {
    const [draft, savedIcon, nextPermission, nextPreferences] = await Promise.all([
      readDraft(),
      readNotificationIcon(),
      getNotificationPermission(),
      readPreferences(),
    ]);
    if (draft) {
      setSenderName(draft.senderName);
      setSubtitle(draft.subtitle ?? "");
      setSubject(draft.subject);
      setImageUri(draft.imageUri ?? savedIcon);
    } else {
      setImageUri(savedIcon);
    }
    setPermission(nextPermission);
    setPreferences(nextPreferences);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(null), 4500);
    return () => clearTimeout(timeout);
  }, [feedback]);

  const showError = (message: string) => {
    setFeedback({ kind: "error", message });
    if (preferences.hapticsEnabled) haptic.error();
  };

  const handleSchedule = async () => {
    const validation = validateNotificationContent(senderName, subject, subtitle);
    if (!validation.valid) {
      showError(validation.message);
      return;
    }

    setIsScheduling(true);
    setFeedback(null);
    try {
      let nextPermission = permission;
      if (nextPermission !== "granted") {
        nextPermission = await requestNotificationPermission();
        setPermission(nextPermission);
      }
      if (nextPermission !== "granted") {
        showError("Precisamos da permissão do sistema para agendar a notificação.");
        return;
      }

      const notificationId = await emitLocalNotification(
        validation.senderName,
        validation.subject,
        { senderName: validation.senderName, subtitle: validation.subtitle, imageUri },
        selectedDelay,
      );
      await addToHistory({
        id: `${Date.now()}`,
        subject: validation.subject,
        senderName: validation.senderName,
        subtitle: validation.subtitle,
        imageUri,
        createdAt: new Date().toISOString(),
        notificationId,
      });
      await saveDraft(senderName, subject, { senderName, subtitle, imageUri });
      const selected = DELAYS.find((delay) => delay.value === selectedDelay);
      if (preferences.hapticsEnabled) haptic.success();
      setFeedback({ kind: "success", message: `Agendada para daqui a ${selected?.label ?? "alguns minutos"}.` });
    } catch (error) {
      showError(error instanceof Error ? error.message : "Não foi possível agendar a notificação.");
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-background">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <View style={[styles.headerIcon, { backgroundColor: colors.primary }]}>
              <MaterialIcons name="schedule" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, { color: colors.primary }]}>AUTOMAÇÃO</Text>
              <Text style={[styles.screenTitle, { color: colors.foreground }]}>Agendar notificação</Text>
            </View>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroTopline}>
              <MaterialIcons name="notifications-active" size={22} color="#BCEBE5" />
              <Text style={styles.heroKicker}>ENVIO PROGRAMADO</Text>
            </View>
            <Text style={styles.heroTitle}>Escolha quando a mensagem deve chegar.</Text>
            <Text style={styles.heroDescription}>
              A notificação será criada localmente no seu iPhone, mesmo sem servidor.
            </Text>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Mensagem</Text>
            <Text style={[styles.sectionHint, { color: colors.muted }]}>A PARTIR DO RASCUNHO</Text>
          </View>

          <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Nome exibido</Text>
                <Text style={[styles.counter, { color: colors.muted }]}>{senderName.length}/{SENDER_NAME_LIMIT}</Text>
              </View>
              <TextInput
                value={senderName}
                onChangeText={setSenderName}
                onEndEditing={() => void saveDraft(senderName, subject, { senderName, subtitle, imageUri })}
                placeholder="Ex.: Banco Manus"
                placeholderTextColor={colors.muted}
                maxLength={SENDER_NAME_LIMIT}
                returnKeyType="next"
                style={[
                  styles.textInput,
                  styles.senderNameInput,
                  { color: colors.foreground, borderColor: colors.border },
                ]}
              />
            </View>
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Subtítulo (Opcional)</Text>
                <Text style={[styles.counter, { color: colors.muted }]}>
                  {subtitle.length}/{SUBTITLE_LIMIT}
                </Text>
              </View>
              <TextInput
                value={subtitle}
                onChangeText={setSubtitle}
                onEndEditing={() => void saveDraft(senderName, subject, { senderName, subtitle, imageUri })}
                placeholder="Ex.: Transação confirmada"
                placeholderTextColor={colors.muted}
                maxLength={SUBTITLE_LIMIT}
                returnKeyType="next"
                style={[styles.textInput, { color: colors.foreground, borderColor: colors.border }]}
              />
            </View>
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Mensagem</Text>
                <Text style={[styles.counter, { color: colors.muted }]}>
                  {subject.length}/{SUBJECT_LIMIT}
                </Text>
              </View>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                onEndEditing={() => void saveDraft(senderName, subject, { senderName, subtitle, imageUri })}
                placeholder="Ex.: Você recebeu um Pix de R$ 100,00."
                placeholderTextColor={colors.muted}
                maxLength={SUBJECT_LIMIT}
                multiline
                textAlignVertical="top"
                returnKeyType="done"
                style={[
                  styles.textInput,
                  styles.multilineInput,
                  { color: colors.foreground, borderColor: colors.border },
                ]}
              />
            </View>
          </View>

          {imageUri ? (
            <View style={[styles.imageRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Image source={{ uri: imageUri }} style={styles.image} />
              <View style={styles.imageCopy}>
                <Text style={[styles.imageTitle, { color: colors.foreground }]}>Imagem personalizada ativa</Text>
                <Text style={[styles.imageText, { color: colors.muted }]}>A imagem será anexada à notificação expandida.</Text>
              </View>
              <MaterialIcons name="check-circle" size={20} color={colors.success} />
            </View>
          ) : null}

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quando enviar?</Text>
            <Text style={[styles.sectionHint, { color: colors.muted }]}>SELECIONE UM PRAZO</Text>
          </View>

          <View style={[styles.delayGrid, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {DELAYS.map((delay) => {
              const active = selectedDelay === delay.value;
              return (
                <Pressable
                  key={delay.value}
                  onPress={() => {
                    setSelectedDelay(delay.value);
                    if (preferences.hapticsEnabled) haptic.light();
                  }}
                  style={({ pressed }) => [
                    styles.delayOption,
                    { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? `${colors.primary}16` : "transparent" },
                    pressed && styles.pressed,
                  ]}
                >
                  <MaterialIcons name={active ? "radio-button-checked" : "radio-button-unchecked"} size={20} color={active ? colors.primary : colors.muted} />
                  <Text style={[styles.delayLabel, { color: active ? colors.primary : colors.foreground }]}>{delay.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {feedback ? (
            <View style={[styles.feedback, { backgroundColor: feedback.kind === "success" ? `${colors.success}18` : `${colors.error}18`, borderColor: feedback.kind === "success" ? `${colors.success}42` : `${colors.error}42` }]}>
              <MaterialIcons name={feedback.kind === "success" ? "check-circle" : "error-outline"} size={19} color={feedback.kind === "success" ? colors.success : colors.error} />
              <Text style={[styles.feedbackText, { color: feedback.kind === "success" ? colors.success : colors.error }]}>{feedback.message}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => void handleSchedule()}
            disabled={isScheduling}
            style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, pressed && styles.buttonPressed]}
          >
            {isScheduling ? <ActivityIndicator color="#FFFFFF" /> : <MaterialIcons name="alarm-add" size={22} color="#FFFFFF" />}
            <Text style={styles.primaryButtonText}>{isScheduling ? "Agendando…" : "Agendar notificação"}</Text>
            {!isScheduling ? <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" /> : null}
          </Pressable>

          <View style={[styles.permissionNote, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}25` }]}>
            <MaterialIcons name={permission === "granted" ? "verified" : "info-outline"} size={18} color={colors.primary} />
            <Text style={[styles.permissionText, { color: colors.muted }]}>
              {permission === "granted" ? "Permissão ativa. O iOS poderá mostrar a notificação no horário escolhido." : "Na primeira vez, o iOS pedirá permissão para notificações."}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 34, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", minHeight: 48 },
  headerIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, marginLeft: 12 },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.6, marginBottom: 2 },
  screenTitle: { fontSize: 25, lineHeight: 30, fontWeight: "800", letterSpacing: -0.4 },
  heroCard: { backgroundColor: "#102A43", borderRadius: 26, padding: 22, gap: 10, overflow: "hidden" },
  heroTopline: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroKicker: { color: "#BCEBE5", fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  heroTitle: { color: "#FFFFFF", fontSize: 24, lineHeight: 29, fontWeight: "800", letterSpacing: -0.35, maxWidth: 310 },
  heroDescription: { color: "#B8CAD6", fontSize: 14, lineHeight: 20, maxWidth: 320 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 3 },
  sectionTitle: { fontSize: 17, lineHeight: 22, fontWeight: "800" },
  sectionHint: { fontSize: 9, lineHeight: 13, fontWeight: "800", letterSpacing: 1.4 },
  formCard: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 4 },
  inputGroup: { paddingVertical: 12 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  inputLabel: { fontSize: 12, lineHeight: 17, fontWeight: "800" },
  counter: { fontSize: 10, lineHeight: 14, fontWeight: "600" },
  textInput: { minHeight: 47, borderRadius: 13, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 12, fontSize: 14, lineHeight: 20 },
  senderNameInput: { fontSize: 18, lineHeight: 23, fontWeight: "800", letterSpacing: -0.2 },
  multilineInput: { minHeight: 77 },
  separator: { height: 1, opacity: 0.7 },
  imageRow: { borderRadius: 18, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  image: { width: 42, height: 42, borderRadius: 13 },
  imageCopy: { flex: 1, gap: 2 },
  imageTitle: { fontSize: 12, lineHeight: 16, fontWeight: "800" },
  imageText: { fontSize: 11, lineHeight: 15 },
  delayGrid: { borderRadius: 20, borderWidth: 1, padding: 10, gap: 9 },
  delayOption: { minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  delayLabel: { fontSize: 14, lineHeight: 19, fontWeight: "800" },
  feedback: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 8 },
  feedbackText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "700" },
  primaryButton: { minHeight: 56, borderRadius: 18, paddingHorizontal: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, lineHeight: 20, fontWeight: "800", flex: 1 },
  permissionNote: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 8 },
  permissionText: { flex: 1, fontSize: 11, lineHeight: 16 },
  pressed: { opacity: 0.76 },
  buttonPressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
});

