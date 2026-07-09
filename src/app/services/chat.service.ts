import { http } from "./http";
import type {
  ChatMessage,
  ChatRoom,
  ChatRoomMessage,
  PaginatedResult,
} from "../../lib/types";

/** MEMBER ROOM CHAT API **/

type ChatMessagePayload = {
  content?: string;
  files?: File[];
};

function chatMessageBody(payload: string | ChatMessagePayload) {
  const content =
    typeof payload === "string" ? payload : (payload.content ?? "");
  const files = typeof payload === "string" ? [] : (payload.files ?? []);

  if (!files.length) {
    return { body: { content }, headers: undefined };
  }

  const form = new FormData();
  if (content.trim()) form.append("content", content);
  files.forEach((file) => form.append("files", file));
  return {
    body: form,
    headers: { "Content-Type": "multipart/form-data" },
  };
}

export async function getMyChatRoom(): Promise<ChatRoom> {
  const { data } = await http.get<ChatRoom>("/chat/me");
  return data;
}

export async function sendMyChatMessage(
  payload: string | ChatMessagePayload,
): Promise<ChatRoomMessage> {
  const request = chatMessageBody(payload);
  const { data } = await http.post<ChatRoomMessage>(
    "/chat/me/messages",
    request.body,
    request.headers ? { headers: request.headers } : undefined,
  );
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
  payload: string | ChatMessagePayload,
): Promise<ChatRoomMessage> {
  const request = chatMessageBody(payload);
  const { data } = await http.post<ChatRoomMessage>(
    "/chat/rooms/" + userId + "/messages",
    request.body,
    request.headers ? { headers: request.headers } : undefined,
  );
  return data;
}

export async function markAdminChatRoomRead(
  userId: string,
): Promise<{ ok: true }> {
  const { data } = await http.post<{ ok: true }>(
    "/chat/rooms/" + userId + "/read",
  );
  return data;
}

/** LEGACY TICKET CHAT API — kept while older screens are phased out. **/

export async function getMyChat(): Promise<ChatRoom> {
  return await getMyChatRoom();
}

export async function sendChatMessage(
  message: string,
): Promise<ChatRoomMessage> {
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
