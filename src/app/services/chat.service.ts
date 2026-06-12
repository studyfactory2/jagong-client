import { http } from "./http";
import type { ChatMessage, ChatRoom, ChatRoomMessage, PaginatedResult } from "../../lib/types";

/** MEMBER ROOM CHAT API **/

export async function getMyChatRoom(): Promise<ChatRoom> {
  const { data } = await http.get<ChatRoom>("/chat/me");
  return data;
}

export async function sendMyChatMessage(content: string): Promise<ChatRoomMessage> {
  const { data } = await http.post<ChatRoomMessage>("/chat/me/messages", {
    content,
  });
  return data;
}

/** ADMIN / STAFF ROOM CHAT API **/

export async function getAdminChatRooms(input?: {
  text?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<ChatRoom>> {
  const { data } = await http.get<PaginatedResult<ChatRoom>>("/chat/rooms", {
    params: input,
  });
  return data;
}

export async function getAdminChatRoom(userId: string): Promise<ChatRoom> {
  const { data } = await http.get<ChatRoom>("/chat/rooms/" + userId);
  return data;
}

export async function sendAdminChatMessage(
  userId: string,
  content: string,
): Promise<ChatRoomMessage> {
  const { data } = await http.post<ChatRoomMessage>(
    "/chat/rooms/" + userId + "/messages",
    { content },
  );
  return data;
}

export async function markAdminChatRoomRead(userId: string): Promise<{ ok: true }> {
  const { data } = await http.post<{ ok: true }>("/chat/rooms/" + userId + "/read");
  return data;
}

/** LEGACY TICKET CHAT API — kept while older screens are phased out. **/

export async function getMyChat(): Promise<ChatRoom> {
  return await getMyChatRoom();
}

export async function sendChatMessage(message: string): Promise<ChatRoomMessage> {
  return await sendMyChatMessage(message);
}

export async function getAdminChat(): Promise<PaginatedResult<ChatRoom>> {
  return await getAdminChatRooms();
}

export async function replyChatMessage(
  id: string,
  reply: string,
): Promise<ChatMessage> {
  const { data } = await http.post<ChatMessage>("/chat/reply/" + id, {
    reply,
  });
  return data;
}
