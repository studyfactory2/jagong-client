import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import ChevronRightOutlinedIcon from "@mui/icons-material/ChevronRightOutlined";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { getMyChatRoom, sendMyChatMessage } from "../../services/chat.service";
import type { ChatRoom, ChatRoomMessage } from "../../../lib/types";
import "./inquiry.css";

const NOTICES = [
  ["공지", "오늘 3교시 시작 1분 전 안내", "2026.06.08 (월) 13:19"],
  ["중요", "캠 화면 점검 및 자리 정돈 안내", "2026.06.08 (월) 08:02"],
  ["공지", "이번 주 모의고사 신청 안내", "2026.06.07 (일) 20:10"],
  ["공지", "휴가 신청 규칙 안내", "2026.06.06 (토) 09:30"],
];

function timeText(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function dateLabel(value?: string) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(date);
}

export default function Inquiry() {
  /** STATE **/
  const navigate = useNavigate();
  const { session } = useAuth();
  const { socket } = useSocket();
  const [message, setMessage] = useState("");
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  /** DERIVED **/
  const myId = session?.user.userId ?? session?.user.id;
  const messages = useMemo(() => room?.messages ?? [], [room]);

  /** EFFECTS **/
  useEffect(() => {
    loadRoom();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = (payload: { message?: ChatRoomMessage }) => {
      const incoming = payload.message;
      if (!incoming) return;
      setRoom((current) =>
        current
          ? { ...current, messages: [...(current.messages ?? []), incoming] }
          : current,
      );
    };
    socket.on("chat:new-message", handleNewMessage);
    return () => {
      socket.off("chat:new-message", handleNewMessage);
    };
  }, [socket]);

  /** HANDLERS **/
  async function loadRoom() {
    setLoading(true);
    setError("");
    try {
      setRoom(await getMyChatRoom());
    } catch (err) {
      setError(err instanceof Error ? err.message : "문의 대화를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
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
          ? { ...current, messages: [...(current.messages ?? []), sent] }
          : current,
      );
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "문의 전송에 실패했습니다.");
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
        <section className="iq-panel">
          <div className="iq-panel-title">
            <CampaignOutlinedIcon />
            <div>
              <strong>관리자 공지</strong>
              <p>공지표시 · 제목 · 등록날짜/요일/시간을 최신순으로 확인해요</p>
            </div>
            <button type="button">전체보기 ›</button>
          </div>

          <div className="iq-notices">
            {NOTICES.map(([tag, title, date]) => (
              <button key={title} type="button">
                <span className={tag === "중요" ? "is-hot" : ""}>{tag}</span>
                <div>
                  <strong>{title}</strong>
                  <em>{date}</em>
                </div>
                <ChevronRightOutlinedIcon />
              </button>
            ))}
          </div>
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
            <span>{loading ? "대화를 불러오는 중입니다." : `전체 대화 ${messages.length}개`}</span>
            <button type="button">히스토리</button>
          </div>

          {error && <p className="iq-error">{error}</p>}

          <div className="iq-chat-date">{dateLabel(messages.at(-1)?.createdAt)}</div>

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
          </div>

          <div className="iq-input">
            <AddOutlinedIcon />
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="문의 내용을 입력해 주세요"
            />
            <button disabled={sending || !message.trim()} onClick={send} type="button">
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
