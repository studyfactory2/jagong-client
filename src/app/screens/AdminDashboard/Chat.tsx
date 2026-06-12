import { useEffect, useMemo, useState } from "react";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import {
  getAdminChatRoom,
  markAdminChatRoomRead,
  sendAdminChatMessage,
} from "../../services/chat.service";
import type { ChatRoom, ChatRoomMessage, PageMeta } from "../../../lib/types";
import AdminPager from "./AdminPager";
import { dateText } from "./admin.utils";

type ChatProps = {
  rooms: ChatRoom[];
  onRefresh: () => Promise<void> | void;
  pageMeta: PageMeta;
  onPageChange: (page: number) => void;
};

function latestText(room: ChatRoom) {
  return room.latestMessage?.content ?? "아직 대화가 없습니다.";
}

function roomTime(room: ChatRoom) {
  const value = room.latestMessage?.createdAt ?? room.updatedAt;
  return dateText(value);
}

function isManagerMessage(message: ChatRoomMessage) {
  return message.sender?.role === "ADMIN" || message.sender?.role === "STAFF";
}

export default function Chat(props: ChatProps) {
  /** STATE **/
  const { rooms, onRefresh, pageMeta, onPageChange } = props;
  const [selectedUserId, setSelectedUserId] = useState("");
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [draft, setDraft] = useState("");
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  /** DERIVED **/
  const selectedSummary = useMemo(
    () => rooms.find((room) => room.userId === selectedUserId) ?? rooms[0],
    [rooms, selectedUserId],
  );
  const messages = activeRoom?.messages ?? [];

  /** EFFECTS **/
  useEffect(() => {
    if (!rooms.length) {
      setSelectedUserId("");
      setActiveRoom(null);
      return;
    }

    if (
      !selectedUserId ||
      !rooms.some((room) => room.userId === selectedUserId)
    ) {
      setSelectedUserId(rooms[0].userId);
    }
  }, [rooms, selectedUserId]);

  useEffect(() => {
    if (!selectedUserId) return;
    loadRoom(selectedUserId);
  }, [selectedUserId]);

  /** HANDLERS **/
  async function loadRoom(userId: string) {
    setError("");
    setLoadingRoom(true);
    try {
      const room = await getAdminChatRoom(userId);
      setActiveRoom(room);
      await markAdminChatRoomRead(userId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "대화를 불러오지 못했습니다.",
      );
    } finally {
      setLoadingRoom(false);
    }
  }

  async function sendReply() {
    if (!selectedUserId || !draft.trim() || sending) return;
    const content = draft.trim();
    setSending(true);
    setError("");
    try {
      const message = await sendAdminChatMessage(selectedUserId, content);
      setDraft("");
      setActiveRoom((current) =>
        current
          ? { ...current, messages: [...(current.messages ?? []), message] }
          : current,
      );
      await onRefresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "답변을 전송하지 못했습니다.",
      );
    } finally {
      setSending(false);
    }
  }

  /** RENDER **/
  return (
    <section className="admin-card admin-chat-card">
      <div className="admin-section-head">
        <h2>
          <ChatBubbleOutlineOutlinedIcon /> 1:1 문의
        </h2>
        <span>{pageMeta.total}개 대화방</span>
      </div>

      {error && <p className="admin-error">{error}</p>}

      {!rooms.length ? (
        <div className="admin-chat-empty">
          <strong>아직 열린 문의방이 없습니다.</strong>
          <span>회원이 게시판에서 메시지를 보내면 이곳에 표시됩니다.</span>
        </div>
      ) : (
        <div className="admin-chat-layout">
          <aside className="admin-chat-rooms" aria-label="회원 문의방 목록">
            {rooms.map((room) => (
              <button
                className={room.userId === selectedUserId ? "is-active" : ""}
                key={room.id}
                onClick={() => setSelectedUserId(room.userId)}
                type="button"
              >
                <strong>{room.user?.name ?? "회원"}</strong>
                <span>{latestText(room)}</span>
                <em>{roomTime(room)}</em>
                {!!room.unreadCount && <b>{room.unreadCount}</b>}
              </button>
            ))}
          </aside>

          <div className="admin-chat-thread">
            <div className="admin-chat-thread-head">
              <div>
                <strong>{selectedSummary?.user?.name ?? "회원"}</strong>
                <span>{selectedSummary?.user?.phone ?? "연락처 없음"}</span>
              </div>
              <em>
                {loadingRoom ? "불러오는 중" : `${messages.length}개 메시지`}
              </em>
            </div>

            <div className="admin-chat-messages">
              {messages.map((message) => (
                <div
                  className={isManagerMessage(message) ? "is-manager" : ""}
                  key={message.id}
                >
                  <span>{message.sender?.name ?? "회원"}</span>
                  <p>{message.content}</p>
                  <time>{dateText(message.createdAt)}</time>
                </div>
              ))}

              {!messages.length && (
                <div className="admin-chat-placeholder">
                  선택한 회원과의 대화가 아직 없습니다.
                </div>
              )}
            </div>

            <div className="admin-chat-compose">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") sendReply();
                }}
                placeholder="회원에게 보낼 메시지"
              />
              <button
                disabled={sending || !draft.trim()}
                onClick={sendReply}
                type="button"
              >
                <SendOutlinedIcon />
                전송
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminPager meta={pageMeta} onPageChange={onPageChange} />
    </section>
  );
}
