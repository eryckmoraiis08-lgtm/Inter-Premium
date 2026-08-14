import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { readNotificationIcon, saveNotificationIcon } from "@/lib/notification-storage";

export default function IconScreen() {
  const colors = useColors();
  const [iconUri, setIconUri] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadIcon = useCallback(async () => {
    setIconUri(await readNotificationIcon());
  }, []);

  useEffect(() => {
    void loadIcon();
  }, [loadIcon]);

  const chooseIcon = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setFeedback("Permita o acesso às fotos nos Ajustes do iPhone para escolher uma imagem.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    const uri = result.canceled ? null : result.assets[0]?.uri;
    if (!uri) return;

    setIconUri(uri);
    await saveNotificationIcon(uri);
    setFeedback("Ícone salvo. Ele já aparece na pré-visualização da aba Compor.");
  };

  const clearIcon = async () => {
    setIconUri(null);
    await saveNotificationIcon(null);
    setFeedback("Ícone personalizado removido. O sino padrão será usado no preview.");
  };

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>PERSONALIZAÇÃO</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Ícone da notificação</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>Escolha a imagem que será usada no cartão e na pré-visualização.</Text>
          </View>
          <View style={[styles.headerIcon, { backgroundColor: `${colors.primary}18` }]}>
            <MaterialIcons name="notifications-none" size={26} color={colors.primary} />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.previewRow}>
            <View style={[styles.iconFrame, { backgroundColor: iconUri ? "transparent" : colors.primary, borderColor: `${colors.primary}45` }]}>
              {iconUri ? (
                <Image source={{ uri: iconUri }} style={styles.iconImage} />
              ) : (
                <MaterialIcons name="notifications-none" size={48} color="#FFFFFF" />
              )}
            </View>
            <View style={styles.previewCopy}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Imagem atual</Text>
              <Text style={[styles.cardHint, { color: colors.muted }]}>Use uma foto quadrada para obter um resultado melhor no cartão da notificação.</Text>
            </View>
          </View>

          <Pressable
            onPress={() => void chooseIcon()}
            style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}
          >
            <MaterialIcons name="photo-library" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>{iconUri ? "Trocar imagem" : "Escolher imagem"}</Text>
          </Pressable>

          {iconUri ? (
            <Pressable onPress={() => void clearIcon()} style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
              <MaterialIcons name="delete-outline" size={19} color={colors.error} />
              <Text style={[styles.removeButtonText, { color: colors.error }]}>Usar sino padrão</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.infoCard, { backgroundColor: `${colors.primary}0D`, borderColor: `${colors.primary}2A` }]}>
          <MaterialIcons name="info-outline" size={21} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.foreground }]}>No iOS, o pequeno ícone exibido ao lado da notificação é o ícone nativo do aplicativo e não pode ser trocado por uma foto arbitrária enquanto o app está rodando. Esta escolha personaliza o preview e a imagem/anexo usado pela notificação. Para alterar o ícone nativo, é necessário gerar um novo IPA com os assets definidos no projeto.</Text>
        </View>

        {feedback ? (
          <View style={[styles.feedback, { backgroundColor: `${colors.success}14`, borderColor: `${colors.success}35` }]}>
            <MaterialIcons name="check-circle-outline" size={19} color={colors.success} />
            <Text style={[styles.feedbackText, { color: colors.success }]}>{feedback}</Text>
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 36,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    maxWidth: 290,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 18,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  iconFrame: {
    width: 92,
    height: 92,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  iconImage: {
    width: "100%",
    height: "100%",
  },
  previewCopy: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  cardHint: {
    fontSize: 13,
    lineHeight: 19,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  removeButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  removeButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 15,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  feedback: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  feedbackText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.78,
  },
});
