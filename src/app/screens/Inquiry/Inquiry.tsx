import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import ChevronRightOutlinedIcon from "@mui/icons-material/ChevronRightOutlined";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { getMyChatRoom, sendMyChatMessage } from "../../services/chat.service";
import { getNotices } from "../../services/notice.service";
import type {
  ChatRoom,
  ChatRoomMessage,
  NoticeRecord,
} from "../../../lib/types";
import "./inquiry.css";

function timeText(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function dateLabel(value?: string) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(date);
}

function noticeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function appendUniqueMessage(
  messages: ChatRoomMessage[],
  incoming: ChatRoomMessage,
): ChatRoomMessage[] {
  if (incoming.id && messages.some((message) => message.id === incoming.id)) {
    return messages;
  }
  return [...messages, incoming];
}

export default function Inquiry() {
  /** STATE **/
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const { socket } = useSocket();
  const [message, setMessage] = useState("");
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [notices, setNotices] = useState<NoticeRecord[]>([]);
  const [selectedNotice, setSelectedNotice] = useState<NoticeRecord | null>(
    null,
  );
  const [dismissedRoutedNoticeId, setDismissedRoutedNoticeId] = useState("");
  const [newNoticeIds, setNewNoticeIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [noticeLoading, setNoticeLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [noticeError, setNoticeError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  /** DERIVED **/
  const myId = session?.user.userId ?? session?.user.id;
  const messages = useMemo(() => room?.messages ?? [], [room]);
  const routedNoticeId =
    (location.state as { noticeId?: string } | null)?.noticeId ?? "";
  const routedNotice =
    routedNoticeId && dismissedRoutedNoticeId !== routedNoticeId
      ? notices.find((notice) => notice.id === routedNoticeId) ?? null
      : null;
  const activeNotice = selectedNotice ?? routedNotice;

  /** EFFECTS **/
  useEffect(() => {
    loadRoom();
    loadNotices();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (payload: { message?: ChatRoomMessage }) => {
      const incoming = payload.message;
      if (!incoming) return;
      setRoom((current) =>
        current
          ? {
              ...current,
              messages: appendUniqueMessage(current.messages ?? [], incoming),
            }
          : current,
      );
    };

    const handleNotice = (notice: NoticeRecord) => {
      setNotices((current) => [
        notice,
        ...current.filter((item) => item.id !== notice.id),
      ]);
      setNewNoticeIds((current) => [
        notice.id,
        ...current.filter((id) => id !== notice.id),
      ]);
    };

    socket.on("chat:new-message", handleNewMessage);
    socket.on("notice", handleNotice);
    return () => {
      socket.off("chat:new-message", handleNewMessage);
      socket.off("notice", handleNotice);
    };
  }, [socket]);

  /** HANDLERS **/
  async function loadRoom() {
    setLoading(true);
    setError("");
    try {
      setRoom(await getMyChatRoom());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "문의 대화를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadNotices() {
    setNoticeLoading(true);
    setNoticeError("");
    try {
      setNotices(await getNotices());
    } catch (err) {
      setNoticeError(
        err instanceof Error ? err.message : "공지 목록을 불러오지 못했습니다.",
      );
    } finally {
      setNoticeLoading(false);
    }
  }

  function openNotice(notice: NoticeRecord) {
    setSelectedNotice(notice);
    setNewNoticeIds((current) => current.filter((id) => id !== notice.id));
  }

  function closeNotice() {
    if (activeNotice?.id === routedNoticeId) {
      setDismissedRoutedNoticeId(routedNoticeId);
      navigate(location.pathname + location.search, {
        replace: true,
        state: null,
      });
    }
    setSelectedNotice(null);
  }

  async function send() {
    if (!message.trim() || sending) return;
    const content = message.trim();
    setSending(true);
    setError("");
    try {
      const sent = await sendMyChatMessage(content);
      setRoom((current) =>
        current
          ? {
              ...current,
              messages: appendUniqueMessage(current.messages ?? [], sent),
            }
          : current,
      );
      setMessage("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "문의 전송에 실패했습니다.",
      );
    } finally {
      setSending(false);
    }
  }

  /** RENDER **/
  return (
    <div className="iq">
      <header className="iq-head">
        <button onClick={() => navigate("/waiting-room")} type="button">
          <ArrowBackIcon /> 대기장
        </button>
        <h1>게시판</h1>
        <button onClick={() => navigate("/video-consult")} type="button">
          상담실 →
        </button>
      </header>

      <main className="iq-body">
        <section className="iq-panel iq-notice-panel">
          <div className="iq-panel-title">
            <CampaignOutlinedIcon />
            <div>
              <strong>관리자 공지</strong>
              <p>공지표시 · 제목 · 등록날짜/요일/시간을 최신순으로 확인해요</p>
            </div>
            <button onClick={loadNotices} type="button">
              새로고침
            </button>
          </div>

          {noticeError && <p className="iq-error">{noticeError}</p>}

          <div className="iq-notices">
            {notices.map((notice) => {
              const important = notice.level === "IMPORTANT";
              return (
                <button
                  className={newNoticeIds.includes(notice.id) ? "is-new" : ""}
                  key={notice.id}
                  onClick={() => openNotice(notice)}
                  type="button"
                >
                  <span className={important ? "is-hot" : ""}>
                    {important ? "중요" : "공지"}
                  </span>
                  <div>
                    <strong>{notice.title}</strong>
                    <em>{noticeDate(notice.createdAt)}</em>
                    <small>{notice.body}</small>
                  </div>
                  <ChevronRightOutlinedIcon />
                </button>
              );
            })}

            {!notices.length && !noticeLoading && (
              <div className="iq-empty-chat">등록된 공지가 없습니다.</div>
            )}

            {noticeLoading && (
              <div className="iq-empty-chat">
                공지 목록을 불러오는 중입니다.
              </div>
            )}
          </div>

          {activeNotice && (
            <div className="iq-notice-detail" role="dialog" aria-modal="true">
              <div>
                <span
                  className={
                    activeNotice.level === "IMPORTANT" ? "is-hot" : ""
                  }
                >
                  {activeNotice.level === "IMPORTANT" ? "중요" : "공지"}
                </span>
                <button onClick={closeNotice} type="button">
                  닫기
                </button>
              </div>
              <strong>{activeNotice.title}</strong>
              <time>{noticeDate(activeNotice.createdAt)}</time>
              <p>{activeNotice.body}</p>
            </div>
          )}
        </section>

        <section className="iq-panel iq-chat">
          <div className="iq-chat-head">
            <span>1:1</span>
            <div>
              <strong>1:1 문의 게시판</strong>
              <p>관리자와 나만 보는 대화방입니다.</p>
            </div>
            <button onClick={loadRoom} type="button">
              새로고침
            </button>
          </div>

          <div className="iq-chat-meta">
            <span>
              {loading
                ? "대화를 불러오는 중입니다."
                : `전체 대화 ${messages.length}개`}
            </span>
            <button type="button">히스토리</button>
          </div>

          {error && <p className="iq-error">{error}</p>}

          <div className="iq-chat-date">
            {dateLabel(messages.at(-1)?.createdAt)}
          </div>

          <div className="iq-messages">
            {messages.map((item) => {
              const isMe = item.senderId === myId;
              return (
                <div className={`iq-msg ${isMe ? "is-me" : ""}`} key={item.id}>
                  {!isMe && <span className="iq-avatar">관리자</span>}
                  <div>
                    {!isMe && <em>{item.sender?.name ?? "관리자"}</em>}
                    <p>{item.content}</p>
                  </div>
                  <time>{timeText(item.createdAt)}</time>
                </div>
              );
            })}

            {!messages.length && !loading && (
              <div className="iq-empty-chat">
                아직 문의 내역이 없습니다. 궁금한 내용을 편하게 남겨주세요.
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="iq-input">
            <AddOutlinedIcon />
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing)
                  send();
              }}
              placeholder="문의 내용을 입력해 주세요"
            />
            <button
              disabled={sending || !message.trim()}
              onClick={send}
              type="button"
            >
              <SendOutlinedIcon />
              전송
            </button>
          </div>
        </section>
      </main>

      <p className="app-foot">자격증공장 재택근무반</p>
    </div>
  );
}
