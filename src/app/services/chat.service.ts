import { http } from "./http";
import type { ChatMessage } from "../../lib/types";

/** MEMBER CHAT API **/

export async function getMyChat(): Promise<ChatMessage[]> {
  const { data } = await http.get<ChatMessage[]>("/chat/me");
  return data;
}

export async function sendChatMessage(message: string): Promise<ChatMessage> {
  const { data } = await http.post<ChatMessage>("/chat", { message });
  return data;
}

/** ADMIN CHAT API **/

export async function getAdminChat(input?: {
  status?: string;
  userId?: string;
}): Promise<ChatMessage[]> {
  const { data } = await http.get<ChatMessage[]>("/chat", { params: input });
  return data;
}

export async function replyChatMessage(
  id: string,
  reply: string,
): Promise<ChatMessage> {
  const { data } = await http.post<ChatMessage>("/chat/reply/" + id, { reply });
  return data;
}
