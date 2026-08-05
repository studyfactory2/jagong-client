import { http } from "./http";
import type { NoticeRecord, NotificationRecord } from "../../lib/types";

/** NOTICE API **/

export async function getNotices(): Promise<NoticeRecord[]> {
  const { data } = await http.get<NoticeRecord[]>("/notices");
  return data;
}

export async function createNotice(input: {
  title: string;
  body: string;
  level?: "NOTICE" | "IMPORTANT";
}): Promise<NoticeRecord> {
  const { data } = await http.post<NoticeRecord>("/notices", input);
  return data;
}

export async function getMyNotifications(): Promise<NotificationRecord[]> {
  const { data } = await http.get<NotificationRecord[]>("/notices/notify/me");
  return data;
}

export async function sendPersonalNotification(
  userId: string,
  input: { title: string; body: string; type?: string },
): Promise<NotificationRecord> {
  const { data } = await http.post<NotificationRecord>(
    "/notices/notify/" + encodeURIComponent(userId),
    input,
  );
  return data;
}

export async function markMyNotificationRead(
  notificationId: string,
): Promise<NotificationRecord> {
  const { data } = await http.post<NotificationRecord>(
    "/notices/notify/read/" + notificationId,
  );
  return data;
}
