import { http } from "./http";
import type { NoticeRecord } from "../../lib/types";

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

export async function getMyNotifications(): Promise<NoticeRecord[]> {
  const { data } = await http.get<NoticeRecord[]>("/notices/notify/me");
  return data;
}
