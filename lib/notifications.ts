import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import type { NotificationCustomization } from "@/lib/notification-storage";

export type NotificationPermission = "granted" | "denied" | "undetermined";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function configureNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("default", {
    name: "Notificações locais",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 180, 100, 180],
    lightColor: "#0F766E",
  });
}

export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (Platform.OS === "web") return "denied";
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (Platform.OS === "web") return "denied";
  await configureNotificationChannel();
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === "granted") return existingStatus;
  const { status } = await Notifications.requestPermissionsAsync();
  return status;
}

export async function emitLocalNotification(
  senderName: string,
  subject: string,
  customization: NotificationCustomization,
  secondsDelay?: number,
): Promise<string> {
  if (Platform.OS === "web") {
    throw new Error("Notificações locais precisam ser testadas em um iPhone ou Android.");
  }

  await configureNotificationChannel();
  const sender = senderName.trim() || customization.senderName.trim();
  const content: Notifications.NotificationContentInput = {
    // O Nome exibido ocupa o título nativo e o Assunto ocupa o corpo do alerta.
    title: sender,
    subtitle: customization.subtitle,
    body: subject,
    sound: "default",
    interruptionLevel: "active",
    data: {
      source: "notificacao-premium",
      senderName: sender,
      notificationSubject: subject,
      subtitle: customization.subtitle,
      imageUri: customization.imageUri,
    },
  };

  // O iOS apresenta anexos visuais junto ao conteúdo expandido da notificação.
  // No Android, o sistema mantém o ícone definido pelo aplicativo no config plugin.
  if (Platform.OS === "ios" && customization.imageUri) {
    content.attachments = [
      {
        identifier: "custom-notification-image",
        type: "image/*",
        url: customization.imageUri,
      },
    ];
  }

  return Notifications.scheduleNotificationAsync({
    content,
    trigger: secondsDelay
      ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: secondsDelay }
      : null,
  });
}
