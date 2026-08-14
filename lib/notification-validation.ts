export const SUBJECT_LIMIT = 140;
export const SENDER_NAME_LIMIT = 40;
export const SUBTITLE_LIMIT = 60;

export type NotificationValidation =
  | { valid: true; senderName: string; subject: string; subtitle?: string }
  | { valid: false; message: string };

export function validateNotificationContent(
  senderName: string,
  subject: string,
  subtitle?: string,
): NotificationValidation {
  const normalizedSenderName = senderName.trim();
  const normalizedSubject = subject.trim();
  const normalizedSubtitle = subtitle?.trim();

  if (!normalizedSenderName) return { valid: false, message: "Preencha o nome exibido na notificação." };
  if (!normalizedSubject) return { valid: false, message: "Preencha o assunto da notificação." };
  if (normalizedSenderName.length > SENDER_NAME_LIMIT)
    return { valid: false, message: "O nome exibido ultrapassou o limite permitido." };
  if (normalizedSubject.length > SUBJECT_LIMIT)
    return { valid: false, message: "O assunto ultrapassou o limite permitido." };
  if (normalizedSubtitle && normalizedSubtitle.length > SUBTITLE_LIMIT)
    return { valid: false, message: "O subtítulo ultrapassou o limite permitido." };

  return {
    valid: true,
    senderName: normalizedSenderName,
    subject: normalizedSubject,
    subtitle: normalizedSubtitle,
  };
}
