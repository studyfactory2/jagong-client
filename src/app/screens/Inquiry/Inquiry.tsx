import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import ChevronRightOutlinedIcon from "@mui/icons-material/ChevronRightOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
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

const CHAT_IMAGE_MAX_COUNT = 5;
const CHAT_IMAGE_MAX_SIZE = 5 * 1024 * 1024;
const CHAT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type SelectedChatImage = {
  file: File;
  url: string;
};

function imageFileError(file: File) {
  if (!CHAT_IMAGE_TYPES.includes(file.type)) {
    return "png, jpg, webp 이미지만 첨부할 수 있습니다.";
  }
  if (file.size > CHAT_IMAGE_MAX_SIZE) {
    return "이미지는 5MB 이하만 첨부할 수 있습니다.";
  }
  return "";
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
  const [selectedImages, setSelectedImages] = useState<SelectedChatImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [noticeLoading, setNoticeLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [noticeError, setNoticeError] = useState("");
  const messagesListRef = useRef<HTMLDivElement | null>(null);
  const selectedImagesRef = useRef<SelectedChatImage[]>([]);

  /** DERIVED **/
  const myId = session?.user.userId ?? session?.user.id;
  const messages = useMemo(() => room?.messages ?? [], [room]);
  const routedNoticeId =
    (location.state as { noticeId?: string } | null)?.noticeId ?? "";
  const routedNotice =
    routedNoticeId && dismissedRoutedNoticeId !== routedNoticeId
      ? (notices.find((notice) => notice.id === routedNoticeId) ?? null)
      : null;
  const activeNotice = selectedNotice ?? routedNotice;

  /** EFFECTS **/
  useEffect(() => {
    loadRoom();
    loadNotices();
  }, []);

  useEffect(() => {
    const element = messagesListRef.current;
    if (!element) return;

    const frame = window.requestAnimationFrame(() => {
      element.scrollTop = element.scrollHeight;
    });

    return () => window.cancelAnimationFrame(frame);
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

  useEffect(
    () => () => {
      selectedImagesRef.current.forEach((image) =>
        URL.revokeObjectURL(image.url),
      );
    },
    [],
  );

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

  function addImages(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const incoming = Array.from(files);
    setSelectedImages((current) => {
      const next = [...current];
      for (const file of incoming) {
        const errorMessage = imageFileError(file);
        if (errorMessage) {
          setError(errorMessage);
          continue;
        }
        if (next.length >= CHAT_IMAGE_MAX_COUNT) {
          setError("이미지는 최대 5개까지 첨부할 수 있습니다.");
          break;
        }
        next.push({ file, url: URL.createObjectURL(file) });
      }
      selectedImagesRef.current = next;
      return next;
    });
  }

  function removeImage(index: number) {
    setSelectedImages((current) => {
      const removed = current[index];
      if (removed) URL.revokeObjectURL(removed.url);
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      selectedImagesRef.current = next;
      return next;
    });
  }

  function clearImages() {
    selectedImagesRef.current.forEach((image) => URL.revokeObjectURL(image.url));
    selectedImagesRef.current = [];
    setSelectedImages([]);
  }

  async function send() {
    if ((!message.trim() && !selectedImages.length) || sending) return;
    const content = message.trim();
    const files = selectedImages.map((image) => image.file);
    setSending(true);
    setError("");
    try {
      const sent = await sendMyChatMessage({ content, files });
      setRoom((current) =>
        current
          ? {
              ...current,
              messages: appendUniqueMessage(current.messages ?? [], sent),
            }
          : current,
      );
      setMessage("");
      clearImages();
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
        <span />
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
                  className={activeNotice.level === "IMPORTANT" ? "is-hot" : ""}
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
          </div>

          {error && <p className="iq-error">{error}</p>}

          <div className="iq-messages" ref={messagesListRef}>
            {messages.map((item, index) => {
              const isMe = item.senderId === myId;
              const currentDate = dateLabel(item.createdAt);
              const previousDate =
                index > 0 ? dateLabel(messages[index - 1]?.createdAt) : "";
              const showDate = currentDate && currentDate !== previousDate;

              return (
                <Fragment key={item.id}>
                  {showDate && (
                    <div className="iq-chat-date">{currentDate}</div>
                  )}
                  <div className={`iq-msg ${isMe ? "is-me" : ""}`}>
                    {!isMe && <span className="iq-avatar">관리자</span>}
                    {isMe && <time>{timeText(item.createdAt)}</time>}
                    <div className="iq-bubble">
                      {!isMe && <em>{item.sender?.name ?? "관리자"}</em>}
                      {item.content && <p>{item.content}</p>}
                      {!!item.attachments?.length && (
                        <div className="iq-attachments">
                          {item.attachments.map((attachment) =>
                            attachment.signedUrl ? (
                              <a
                                href={attachment.signedUrl}
                                key={attachment.id}
                                rel="noreferrer"
                                target="_blank"
                              >
                                <img
                                  alt={
                                    attachment.fileName ?? "문의 첨부 이미지"
                                  }
                                  src={attachment.signedUrl}
                                />
                              </a>
                            ) : null,
                          )}
                        </div>
                      )}
                    </div>
                    {!isMe && <time>{timeText(item.createdAt)}</time>}
                    {isMe && <span className="iq-avatar is-me">나</span>}
                  </div>
                </Fragment>
              );
            })}

            {!messages.length && !loading && (
              <div className="iq-empty-chat">
                아직 문의 내역이 없습니다. 궁금한 내용을 편하게 남겨주세요.
              </div>
            )}
          </div>

          {!!selectedImages.length && (
            <div className="iq-image-preview" aria-label="첨부 이미지 미리보기">
              {selectedImages.map((image, index) => (
                <div key={`${image.file.name}-${index}`}>
                  <img src={image.url} alt={image.file.name} />
                  <button onClick={() => removeImage(index)} type="button">
                    <CloseOutlinedIcon />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="iq-input">
            <label className="iq-attach">
              <ImageOutlinedIcon />
              <input
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={(event) => {
                  addImages(event.target.files);
                  event.target.value = "";
                }}
                type="file"
              />
            </label>
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
              disabled={sending || (!message.trim() && !selectedImages.length)}
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
