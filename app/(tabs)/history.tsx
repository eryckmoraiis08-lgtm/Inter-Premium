import { useCallback, useState } from "react";
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { haptic } from "@/lib/haptics";
import { clearHistory, readHistory, saveDraft, type NotificationRecord } from "@/lib/notification-storage";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "agora";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    .format(date)
    .replace(" de ", " ");
}

export default function HistoryScreen() {
  const colors = useColors();
  const [history, setHistory] = useState<NotificationRecord[]>([]);

  const refresh = useCallback(async () => {
    setHistory(await readHistory());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const reuse = async (item: NotificationRecord) => {
    haptic.light();
    await saveDraft(item.senderName, item.subject, {
      senderName: item.senderName,
      subtitle: item.subtitle,
      imageUri: item.imageUri,
    });
    router.replace("/(tabs)");
  };

  const askClear = () => {
    if (!history.length) return;
    Alert.alert("Limpar histórico?", "As notificações emitidas serão removidas deste dispositivo.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Limpar",
        style: "destructive",
        onPress: async () => {
          await clearHistory();
          setHistory([]);
          haptic.light();
        },
      },
    ]);
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-background">
      <View style={styles.screen}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>MEMÓRIA LOCAL</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Histórico</Text>
          </View>
          <Pressable
            onPress={askClear}
            disabled={!history.length}
            style={({ pressed }) => [styles.clearButton, { borderColor: colors.border }, !history.length && styles.disabled, pressed && styles.pressed]}
          >
            <MaterialIcons name="delete-outline" size={19} color={history.length ? colors.error : colors.muted} />
          </Pressable>
        </View>

        <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.summaryIcon, { backgroundColor: `${colors.primary}18` }]}>
            <MaterialIcons name="history" size={22} color={colors.primary} />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={[styles.summaryTitle, { color: colors.foreground }]}>{history.length === 1 ? "1 notificação emitida" : `${history.length} notificações emitidas`}</Text>
            <Text style={[styles.summaryText, { color: colors.muted }]}>Tudo fica salvo apenas neste dispositivo.</Text>
          </View>
        </View>

        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={history.length ? styles.list : styles.emptyList}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}18` }]}>
                <MaterialIcons name="notifications-none" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nada por aqui ainda</Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>As notificações emitidas aparecerão aqui para você reutilizar quando quiser.</Text>
              <Pressable onPress={() => router.replace("/(tabs)")} style={({ pressed }) => [styles.emptyButton, { backgroundColor: colors.primary }, pressed && styles.buttonPressed]}>
                <Text style={styles.emptyButtonText}>Criar primeira notificação</Text>
                <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.itemIcon, { backgroundColor: colors.primary }]}> 
                {item.imageUri ? <Image source={{ uri: item.imageUri }} style={styles.itemImage} /> : <MaterialIcons name="notifications-none" size={20} color="#FFFFFF" />}
              </View>
              <View style={styles.itemCopy}>
                <View style={styles.itemMeta}>
                  {item.senderName ? <Text numberOfLines={1} style={[styles.itemSender, { color: colors.muted }]}>{item.senderName}</Text> : null}
                  <Text style={[styles.itemTime, { color: colors.muted }]}>{formatDate(item.createdAt)}</Text>
                </View>
                <Text numberOfLines={1} style={[styles.itemTitle, { color: colors.foreground }]}>
                  {item.senderName || "Nome exibido"}
                </Text>
                {item.subtitle ? (
                  <Text numberOfLines={1} style={[styles.itemSubtitle, { color: colors.foreground, opacity: 0.8 }]}>
                    {item.subtitle}
                  </Text>
                ) : null}
                <Text numberOfLines={2} style={[styles.itemSubject, { color: colors.muted }]}>
                  {item.subject}
                </Text>
              </View>
              <Pressable onPress={() => void reuse(item)} style={({ pressed }) => [styles.reuseButton, { backgroundColor: `${colors.primary}18` }, pressed && styles.pressed]}>
                <MaterialIcons name="replay" size={20} color={colors.primary} />
              </Pressable>
            </View>
          )}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, paddingTop: 18 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.6, marginBottom: 3 },
  title: { fontSize: 30, lineHeight: 35, fontWeight: "800", letterSpacing: -0.6 },
  clearButton: { width: 43, height: 43, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  summary: { borderWidth: 1, borderRadius: 20, padding: 14, flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 17 },
  summaryIcon: { width: 43, height: 43, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  summaryCopy: { flex: 1, gap: 3 },
  summaryTitle: { fontSize: 14, lineHeight: 18, fontWeight: "800" },
  summaryText: { fontSize: 12, lineHeight: 17 },
  list: { gap: 11, paddingBottom: 28 },
  emptyList: { flexGrow: 1, justifyContent: "center", paddingBottom: 90 },
  emptyState: { alignItems: "center", paddingHorizontal: 18 },
  emptyIcon: { width: 74, height: 74, borderRadius: 25, alignItems: "center", justifyContent: "center", marginBottom: 17 },
  emptyTitle: { fontSize: 18, lineHeight: 23, fontWeight: "800", marginBottom: 7 },
  emptyText: { fontSize: 13, lineHeight: 19, textAlign: "center", maxWidth: 280, marginBottom: 20 },
  emptyButton: { borderRadius: 14, minHeight: 46, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 9 },
  emptyButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  historyCard: { borderWidth: 1, borderRadius: 19, padding: 13, flexDirection: "row", alignItems: "center", gap: 11 },
  itemIcon: { width: 41, height: 41, borderRadius: 13, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  itemImage: { width: 41, height: 41 },
  itemCopy: { flex: 1, gap: 2 },
  itemMeta: { flexDirection: "row", justifyContent: "flex-end" },
  itemSender: { flex: 1, fontSize: 10, lineHeight: 14, fontWeight: "700" },
  itemTime: { fontSize: 10, lineHeight: 14 },
  itemTitle: { fontSize: 14, lineHeight: 18, fontWeight: "800" },
  itemSubtitle: { fontSize: 12, lineHeight: 16, fontWeight: "600" },
  itemSubject: { fontSize: 12, lineHeight: 17 },
  reuseButton: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
  buttonPressed: { transform: [{ scale: 0.97 }], opacity: 0.88 },
});
