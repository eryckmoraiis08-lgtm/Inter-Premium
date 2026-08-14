import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { haptic } from "@/lib/haptics";
import {
  addTemplate,
  addToHistory,
  consumeDraft,
  readNotificationIcon,
  readPreferences,
  readTemplates,
  saveDraft,
  saveNotificationIcon,
  type NotificationPreferences,
  type NotificationTemplate,
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

function permissionCopy(status: NotificationPermission) {
  if (status === "granted") {
    return {
      title: "Notificações prontas",
      description: "Você pode emitir uma notificação a qualquer momento.",
      icon: "check-circle" as const,
      tone: "success" as const,
    };
  }
  if (status === "denied") {
    return {
      title: "Permissão bloqueada",
      description: "Abra os Ajustes para permitir notificações neste dispositivo.",
      icon: "lock-outline" as const,
      tone: "warning" as const,
    };
  }
  return {
    title: "Ative as notificações para começar",
    description: "Na primeira emissão, o sistema pedirá sua autorização.",
    icon: "notifications-none" as const,
    tone: "primary" as const,
  };
}

export default function HomeScreen() {
  const colors = useColors();
  const [subject, setSubject] = useState("");
  const [senderName, setSenderName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("undetermined");
  const [preferences, setPreferences] = useState<NotificationPreferences>({ hapticsEnabled: true });
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextPermission, nextPreferences, draft, nextTemplates, savedIconUri] = await Promise.all([
        getNotificationPermission(),
        readPreferences(),
        consumeDraft(),
        readTemplates(),
        readNotificationIcon(),
      ]);
      setPermission(nextPermission);
      setPreferences(nextPreferences);
      setTemplates(nextTemplates);
      if (draft) {
        setSubject(draft.subject);
        setSenderName(draft.senderName);
        setSubtitle(draft.subtitle || "");
        setImageUri(draft.imageUri ?? savedIconUri);
      } else {
        setImageUri(savedIconUri);
      }
    } catch (err) {
      console.error("Erro ao carregar dados iniciais:", err);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void getNotificationPermission().then(setPermission);
      void readTemplates().then(setTemplates);
    }, []),
  );

  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(null), 4200);
    return () => clearTimeout(timeout);
  }, [feedback]);

  const copy = useMemo(() => permissionCopy(permission), [permission]);
  const isReady = senderName.trim().length > 0 && subject.trim().length > 0 && !isSending;

  const showError = (message: string) => {
    setFeedback({ kind: "error", message });
    if (preferences.hapticsEnabled) haptic.error();
  };

  const handlePermissionAction = async () => {
    if (permission === "denied") {
      if (Platform.OS === "web") {
        showError("Abra o aplicativo em um iPhone ou Android para alterar permissões.");
        return;
      }
      await Linking.openSettings();
      return;
    }

    const nextPermission = await requestNotificationPermission();
    setPermission(nextPermission);
    if (nextPermission !== "granted") {
      showError("A permissão ainda não foi concedida. Você pode tentar novamente.");
    }
  };

  const pickNotificationImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      await saveNotificationIcon(uri);
      await saveDraft(senderName, subject, { senderName, subtitle, imageUri: uri });
    }
  };

  const handleSaveTemplate = async () => {
    const validation = validateNotificationContent(senderName, subject, subtitle);
    if (!validation.valid) {
      showError(validation.message);
      return;
    }

    try {
      const template: NotificationTemplate = {
        id: `template-${Date.now()}`,
        name: templateName.trim() || validation.senderName,
        senderName: validation.senderName,
        subtitle: validation.subtitle,
        subject: validation.subject,
        imageUri,
        createdAt: new Date().toISOString(),
      };
      await addTemplate(template);
      const nextTemplates = await readTemplates();
      setTemplates(nextTemplates);
      setTemplateName("");
      if (preferences.hapticsEnabled) haptic.success();
      setFeedback({ kind: "success", message: "Modelo salvo para uso rápido." });
    } catch (err) {
      showError("Não foi possível salvar o modelo.");
    }
  };

  const applyTemplate = (template: NotificationTemplate) => {
    setSenderName(template.senderName);
    setSubtitle(template.subtitle || "");
    setSubject(template.subject);
    setImageUri(template.imageUri);
    void saveNotificationIcon(template.imageUri);
    setTemplateName(template.name);
    void saveDraft(template.senderName, template.subject, {
      senderName: template.senderName,
      subtitle: template.subtitle,
      imageUri: template.imageUri,
    });
    if (preferences.hapticsEnabled) haptic.light();
    setFeedback({ kind: "success", message: `Modelo “${template.name}” aplicado.` });
  };

  const handleEmit = async () => {
    const validation = validateNotificationContent(senderName, subject, subtitle);
    if (!validation.valid) {
      showError(validation.message);
      return;
    }

    setIsSending(true);
    setFeedback(null);
    try {
      let nextPermission = permission;
      if (nextPermission !== "granted") {
        nextPermission = await requestNotificationPermission();
        setPermission(nextPermission);
      }
      if (nextPermission !== "granted") {
        showError("Precisamos da permissão do sistema para emitir a notificação.");
        return;
      }

      const notificationId = await emitLocalNotification(
        validation.senderName,
        validation.subject,
        { senderName: validation.senderName, subtitle: validation.subtitle, imageUri },
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
      if (preferences.hapticsEnabled) haptic.success();
      setFeedback({
        kind: "success",
        message: "Notificação emitida com sucesso.",
      });
    } catch (error) {
      showError(error instanceof Error ? error.message : "Não foi possível emitir agora.");
    } finally {
      setIsSending(false);
    }
  };

  const previewSubject = subject.trim() || "O assunto aparecerá aqui antes do envio.";
  const previewSenderName = senderName.trim() || "Nome exibido";
  const previewSubtitle = subtitle.trim();
  const toneColor =
    copy.tone === "success" ? colors.success : copy.tone === "warning" ? colors.warning : colors.primary;

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-background">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <View style={styles.brandMark}>
              <Image source={require("@/assets/images/icon.png")} style={styles.brandIcon} />
            </View>
            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, { color: colors.primary }]}>COMPOSITOR</Text>
              <Text style={[styles.screenTitle, { color: colors.foreground }]}>Criar notificação</Text>
            </View>
            <View style={styles.liveDot} />
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroTopline}>
              <View style={styles.heroIconCircle}>
                <MaterialIcons name="notifications-active" size={25} color="#FFFFFF" />
              </View>
              <Text style={styles.heroKicker}>PRONTA PARA CHEGAR</Text>
            </View>
            <Text style={styles.heroTitle}>Uma mensagem, no momento certo.</Text>
            <Text style={styles.heroDescription}>
              Escreva uma notificação clara e veja como ela ficará antes de emitir.
            </Text>
          </View>

          <Pressable
            onPress={handlePermissionAction}
            style={({ pressed }) => [
              styles.permissionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.permissionIcon, { backgroundColor: `${toneColor}18` }]}>
              <MaterialIcons name={copy.icon} size={22} color={toneColor} />
            </View>
            <View style={styles.permissionCopy}>
              <Text style={[styles.permissionTitle, { color: colors.foreground }]}>{copy.title}</Text>
              <Text style={[styles.permissionDescription, { color: colors.muted }]}>{copy.description}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={colors.muted} />
          </Pressable>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Conteúdo</Text>
            <Text style={[styles.sectionHint, { color: colors.muted }]}>PERSONALIZE</Text>
          </View>

          <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Nome exibido</Text>
                <Text style={[styles.counter, { color: colors.muted }]}>
                  {senderName.length}/{SENDER_NAME_LIMIT}
                </Text>
              </View>
              <TextInput
                value={senderName}
                onChangeText={setSenderName}
                onEndEditing={() => void saveDraft(senderName, subject, { senderName, subtitle, imageUri })}
                placeholder="Ex.: Inter"
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

          <View style={[styles.imageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable
              onPress={() => void pickNotificationImage()}
              style={({ pressed }) => [styles.imagePicker, pressed && styles.pressed]}
            >
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.selectedImage} />
              ) : (
                <View style={[styles.imagePlaceholder, { backgroundColor: `${colors.primary}18` }]}>
                  <MaterialIcons name="add-photo-alternate" size={22} color={colors.primary} />
                </View>
              )}
              <View style={styles.imagePickerCopy}>
                <Text style={[styles.imagePickerTitle, { color: colors.foreground }]}>
                  {imageUri ? "Imagem personalizada" : "Imagem da notificação"}
                </Text>
                <Text style={[styles.imagePickerText, { color: colors.muted }]}>
                  {imageUri ? "Toque para trocar a imagem." : "Escolha uma imagem para o preview."}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={21} color={colors.muted} />
            </Pressable>
            {imageUri ? (
              <Pressable
                onPress={() => {
                  setImageUri(null);
                  void saveNotificationIcon(null);
                  void saveDraft(senderName, subject, { senderName, subtitle, imageUri: null });
                }}
                style={({ pressed }) => [styles.removeImageButton, pressed && styles.pressed]}
              >
                <MaterialIcons name="close" size={15} color={colors.error} />
                <Text style={[styles.removeImageText, { color: colors.error }]}>Remover imagem</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Modelos predefinidos</Text>
              <Text style={[styles.sectionHint, { color: colors.muted }]}>SALVE PARA USAR DE NOVO</Text>
            </View>
            <MaterialIcons name="bookmark-border" size={20} color={colors.primary} />
          </View>

          <View style={[styles.templatesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.templateNameRow}>
              <TextInput
                value={templateName}
                onChangeText={setTemplateName}
                placeholder="Nome do modelo (opcional)"
                placeholderTextColor={colors.muted}
                maxLength={36}
                returnKeyType="done"
                style={[styles.templateNameInput, { color: colors.foreground, borderColor: colors.border }]}
              />
              <Pressable
                onPress={() => void handleSaveTemplate()}
                disabled={!isReady}
                style={({ pressed }) => [
                  styles.saveTemplateButton,
                  { backgroundColor: isReady ? colors.primary : `${colors.primary}55` },
                  pressed && isReady && styles.buttonPressed,
                ]}
              >
                <MaterialIcons name="bookmark-add" size={19} color="#FFFFFF" />
                <Text style={styles.saveTemplateText}>Salvar</Text>
              </Pressable>
            </View>
            <FlatList
              data={templates}
              horizontal
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.templateList}
              ListEmptyComponent={
                <Text style={[styles.emptyTemplateText, { color: colors.muted }]}>
                  Seus modelos salvos aparecerão aqui.
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => applyTemplate(item)}
                  style={({ pressed }) => [
                    styles.templateChip,
                    { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` },
                    pressed && styles.pressed,
                  ]}
                >
                  {item.imageUri ? (
                    <Image source={{ uri: item.imageUri }} style={styles.templateChipImage} />
                  ) : (
                    <MaterialIcons name="notifications-none" size={17} color={colors.primary} />
                  )}
                  <View style={styles.templateChipCopy}>
                    <Text numberOfLines={1} style={[styles.templateChipName, { color: colors.foreground }]}>
                      {item.name}
                    </Text>
                    <Text numberOfLines={1} style={[styles.templateChipSubject, { color: colors.muted }]}>
                      {item.subject}
                    </Text>
                  </View>
                  <MaterialIcons name="north-east" size={16} color={colors.primary} />
                </Pressable>
              )}
            />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Pré-visualização</Text>
            <View style={styles.previewLabel}>
              <View style={styles.previewDot} />
              <Text style={[styles.sectionHint, { color: colors.muted }]}>AGORA</Text>
            </View>
          </View>

          <View style={styles.notificationPreviewStage}>
            <View style={styles.notificationGlassCard}>
              <View
                style={[styles.notificationAppIcon, { backgroundColor: imageUri ? "transparent" : colors.primary }]}
              >
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.notificationImage} />
                ) : (
                  <MaterialIcons name="notifications-none" size={21} color="#FFFFFF" />
                )}
              </View>
              <View style={styles.notificationCopy}>
                <View style={styles.notificationMetaRow}>
                  <Text numberOfLines={1} style={styles.notificationTitle}>
                    {previewSenderName}
                  </Text>
                  <Text style={styles.notificationTime}>agora</Text>
                </View>
                {previewSubtitle ? <Text numberOfLines={1} style={styles.notificationSubtitle}>{previewSubtitle}</Text> : null}
                <Text numberOfLines={2} style={styles.notificationSubject}>
                  {previewSubject}
                </Text>
              </View>
            </View>
            <Text style={styles.notificationPreviewNote}>A fonte e o cartão finais serão renderizados pelo iOS.</Text>
          </View>

          {feedback ? (
            <View
              style={[
                styles.feedback,
                {
                  backgroundColor: feedback.kind === "success" ? `${colors.success}18` : `${colors.error}18`,
                  borderColor: feedback.kind === "success" ? `${colors.success}42` : `${colors.error}42`,
                },
              ]}
            >
              <MaterialIcons
                name={feedback.kind === "success" ? "check-circle" : "error-outline"}
                size={19}
                color={feedback.kind === "success" ? colors.success : colors.error}
              />
              <Text
                style={[styles.feedbackText, { color: feedback.kind === "success" ? colors.success : colors.error }]}
              >
                {feedback.message}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleEmit}
            disabled={!isReady}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: isReady ? colors.primary : `${colors.primary}55` },
              pressed && isReady && styles.buttonPressed,
            ]}
          >
            {isSending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <MaterialIcons name="notifications-active" size={21} color="#FFFFFF" />
            )}
            <Text style={styles.primaryButtonText}>{isSending ? "Emitindo…" : "Emitir notificação"}</Text>
            {!isSending ? <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" /> : null}
          </Pressable>

          <Text style={[styles.footerNote, { color: colors.muted }]}>
            A emissão acontece localmente, sem precisar de servidor.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 34, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", minHeight: 48 },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 15,
    overflow: "hidden",
    shadowColor: "#102A43",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  brandIcon: { width: 44, height: 44 },
  headerCopy: { flex: 1, marginLeft: 12 },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.6, marginBottom: 2 },
  screenTitle: { fontSize: 25, lineHeight: 30, fontWeight: "800", letterSpacing: -0.4 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#2E9B68", marginRight: 3 },
  heroCard: {
    backgroundColor: "#102A43",
    borderRadius: 26,
    padding: 22,
    gap: 10,
    overflow: "hidden",
    shadowColor: "#102A43",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  heroTopline: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F766E",
  },
  heroKicker: { color: "#BCEBE5", fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  heroTitle: { color: "#FFFFFF", fontSize: 24, lineHeight: 29, fontWeight: "800", letterSpacing: -0.35, maxWidth: 300 },
  heroDescription: { color: "#B8CAD6", fontSize: 14, lineHeight: 20, maxWidth: 320 },
  permissionCard: {
    minHeight: 72,
    borderRadius: 19,
    borderWidth: 1,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  permissionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  permissionCopy: { flex: 1, gap: 3 },
  permissionTitle: { fontSize: 14, lineHeight: 18, fontWeight: "800" },
  permissionDescription: { fontSize: 12, lineHeight: 17 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 3 },
  sectionTitle: { fontSize: 17, lineHeight: 22, fontWeight: "800" },
  sectionHint: { fontSize: 9, lineHeight: 13, fontWeight: "800", letterSpacing: 1.4 },
  previewLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  previewDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#2E9B68" },
  formCard: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 4 },
  imageCard: { borderRadius: 20, borderWidth: 1, padding: 13 },
  imagePicker: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 11 },
  selectedImage: { width: 43, height: 43, borderRadius: 14 },
  imagePlaceholder: { width: 43, height: 43, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  imagePickerCopy: { flex: 1, gap: 3 },
  imagePickerTitle: { fontSize: 13, lineHeight: 17, fontWeight: "800" },
  imagePickerText: { fontSize: 12, lineHeight: 17 },
  templatesCard: { borderRadius: 20, borderWidth: 1, padding: 13, gap: 12 },
  templateNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  templateNameInput: {
    flex: 1,
    minHeight: 43,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 13,
    lineHeight: 18,
  },
  saveTemplateButton: {
    minHeight: 43,
    borderRadius: 12,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  saveTemplateText: { color: "#FFFFFF", fontSize: 12, lineHeight: 16, fontWeight: "800" },
  templateList: { gap: 8 },
  emptyTemplateText: { fontSize: 12, lineHeight: 17, paddingVertical: 4 },
  templateChip: {
    minWidth: 205,
    maxWidth: 245,
    borderRadius: 15,
    borderWidth: 1,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  templateChipImage: { width: 31, height: 31, borderRadius: 10 },
  templateChipCopy: { flex: 1, gap: 2 },
  templateChipName: { fontSize: 12, lineHeight: 16, fontWeight: "800" },
  templateChipSubject: { fontSize: 11, lineHeight: 15 },
  removeImageButton: {
    borderTopWidth: 1,
    borderTopColor: "#D7E1E8",
    marginTop: 9,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  removeImageText: { fontSize: 12, lineHeight: 16, fontWeight: "700" },
  inputGroup: { paddingVertical: 12 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  inputLabel: { fontSize: 12, lineHeight: 17, fontWeight: "800" },
  counter: { fontSize: 10, lineHeight: 14, fontWeight: "600" },
  textInput: {
    minHeight: 47,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  senderNameInput: { fontSize: 18, lineHeight: 23, fontWeight: "800", letterSpacing: -0.2 },
  multilineInput: { minHeight: 77 },
  separator: { height: 1, opacity: 0.7 },
  notificationPreviewStage: { borderRadius: 24, padding: 12, backgroundColor: "#20394D", overflow: "hidden" },
  notificationGlassCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    padding: 14,
    flexDirection: "row",
    gap: 12,
    backgroundColor: "rgba(27, 39, 52, 0.78)",
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  notificationAppIcon: { width: 43, height: 43, borderRadius: 14, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  notificationImage: { width: 43, height: 43 },
  notificationCopy: { flex: 1, gap: 2 },
  notificationMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  notificationSender: { flex: 1, color: "#FFFFFF", fontSize: 13, lineHeight: 17, fontWeight: "800", letterSpacing: -0.1 },
  notificationTime: { color: "rgba(255,255,255,0.78)", fontSize: 11, lineHeight: 15 },
  notificationTitle: { flex: 1, color: "#FFFFFF", fontSize: 15, lineHeight: 19, fontWeight: "800", letterSpacing: -0.1 },
  notificationSubtitle: { color: "#FFFFFF", fontSize: 14, lineHeight: 18, fontWeight: "600", opacity: 0.95 },
  notificationSubject: { color: "rgba(255,255,255,0.88)", fontSize: 14, lineHeight: 19 },
  notificationPreviewNote: {
    color: "rgba(255,255,255,0.66)",
    fontSize: 10,
    lineHeight: 14,
    marginTop: 9,
    textAlign: "center",
  },
  feedback: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  feedbackText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "700" },
  primaryButton: {
    minHeight: 56,
    borderRadius: 18,
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#0F766E",
    shadowOpacity: 0.22,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, lineHeight: 20, fontWeight: "800", flex: 1 },
  footerNote: { fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: -4 },
  pressed: { opacity: 0.76 },
  buttonPressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
});
