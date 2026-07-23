import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import { useSocket } from "../../context/SocketContext";
import {
  getAdminChatRoom,
  markAdminChatRoomRead,
  sendAdminChatMessage,
} from "../../services/chat.service";
import type {
  AdminUser,
  ChatRoom,
  ChatRoomMessage,
  PageMeta,
} from "../../../lib/types";
import AdminPager from "./AdminPager";
import {
  avatarTone,
  dateText,
  initial,
  membershipEndText,
  userDetail,
} from "./admin.utils";

type ChatProps = {
  rooms: ChatRoom[];
  users: AdminUser[];
  searchText: string;
  onSearchChange: (value: string) => void;
  onRoomRead: (userId: string) => void;
  onRefresh: () => Promise<void> | void;
  pageMeta: PageMeta;
  onPageChange: (page: number) => void;
};

function latestText(room: ChatRoom) {
  if (room.latestMessage?.content) return room.latestMessage.content;
  if (room.latestMessage?.attachments?.length) return "이미지를 보냈습니다.";
  return "아직 대화가 없습니다.";
}

function roomTime(room: ChatRoom) {
  const value = room.latestMessage?.createdAt ?? room.updatedAt;
  return dateText(value);
}

function isManagerMessage(message: ChatRoomMessage) {
  return message.sender?.role === "ADMIN" || message.sender?.role === "STAFF";
}

function appendUniqueMessage(
  messages: ChatRoomMessage[],
  incoming: ChatRoomMessage,
): ChatRoomMessage[] {
  if (messages.some((message) => message.id === incoming.id)) return messages;
  return [...messages, incoming];
}

const CHAT_IMAGE_MAX_COUNT = 5;
const CHAT_IMAGE_MAX_SIZE = 5 * 1024 * 1024;
const CHAT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type SelectedChatImage = {
  file: File;
  url: string;
};

type ChatRealtimePayload = {
  room?: ChatRoom;
  roomId?: string;
  userId?: string;
  message?: ChatRoomMessage;
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

export default function Chat(props: ChatProps) {
  /** STATE **/
  const {
    rooms,
    users,
    searchText,
    onSearchChange,
    onRoomRead,
    onRefresh,
    pageMeta,
    onPageChange,
  } = props;
  const { socket } = useSocket();
  const [preferredUserId, setPreferredUserId] = useState("");
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [draft, setDraft] = useState("");
  const [selectedImages, setSelectedImages] = useState<SelectedChatImage[]>([]);
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const [memberInfoOpen, setMemberInfoOpen] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const activeRoomRef = useRef<ChatRoom | null>(null);
  const onRoomReadRef = useRef(onRoomRead);
  const onRefreshRef = useRef(onRefresh);
  const selectedUserIdRef = useRef("");
  const selectedImagesRef = useRef<SelectedChatImage[]>([]);

  useEffect(() => {
    onRoomReadRef.current = onRoomRead;
  }, [onRoomRead]);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  function clearImages() {
    selectedImagesRef.current.forEach((image) =>
      URL.revokeObjectURL(image.url),
    );
    selectedImagesRef.current = [];
    setSelectedImages([]);
  }

  /** DERIVED **/
  const selectedUserId = useMemo(() => {
    if (rooms.some((room) => room.userId === preferredUserId)) {
      return preferredUserId;
    }
    return rooms[0]?.userId ?? "";
  }, [rooms, preferredUserId]);

  const selectedSummary = useMemo(
    () => rooms.find((room) => room.userId === selectedUserId) ?? rooms[0],
    [rooms, selectedUserId],
  );
  const messages = activeRoom?.messages ?? [];
  const unreadTotal = useMemo(
    () => rooms.reduce((total, room) => total + (room.unreadCount ?? 0), 0),
    [rooms],
  );
  const selectedMember = useMemo(() => {
    const roomUser = selectedSummary?.user;
    return (
      users.find(
        (user) =>
          user.id === selectedUserId ||
          user.userId === selectedUserId ||
          user.id === roomUser?.id ||
          user.userId === roomUser?.id,
      ) ??
      roomUser ??
      null
    );
  }, [selectedSummary?.user, selectedUserId, users]);

  useEffect(() => {
    selectedUserIdRef.current = selectedUserId;
  }, [selectedUserId]);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    if (!memberInfoOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMemberInfoOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [memberInfoOpen]);

  /** HANDLERS **/
  const loadRoom = useCallback(async (userId: string) => {
    setError("");
    setLoadingRoom(true);
    try {
      const room = await getAdminChatRoom(userId);
      setActiveRoom(room);
      await markAdminChatRoomRead(userId);
      onRoomReadRef.current(userId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "대화를 불러오지 못했습니다.",
      );
    } finally {
      setLoadingRoom(false);
    }
  }, []);

  /** EFFECTS **/
  useEffect(() => {
    if (!selectedUserId) return;
    const timer = window.setTimeout(() => {
      void loadRoom(selectedUserId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedUserId, loadRoom]);

  useEffect(() => {
    const messagesElement = messagesRef.current;
    if (!messagesElement) return;

    const frame = window.requestAnimationFrame(() => {
      messagesElement.scrollTop = messagesElement.scrollHeight;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeRoom?.id, messages.length]);

  useEffect(() => {
    if (!socket) return;

    const handleChatEvent = (payload: ChatRealtimePayload = {}) => {
      const currentRoom = activeRoomRef.current;
      const currentUserId = selectedUserIdRef.current;
      const incoming = payload.message;
      const eventRoomId =
        incoming?.roomId ?? payload.roomId ?? payload.room?.id;
      const eventUserId = payload.userId ?? payload.room?.userId;

      if (incoming && currentRoom?.id === incoming.roomId) {
        setActiveRoom((current) =>
          current
            ? {
                ...current,
                messages: appendUniqueMessage(current.messages ?? [], incoming),
              }
            : current,
        );
      }

      void onRefreshRef.current();

      const shouldReloadActive =
        !!currentUserId &&
        (!eventRoomId ||
          eventRoomId === currentRoom?.id ||
          eventUserId === currentUserId);

      if (shouldReloadActive) {
        void loadRoom(currentUserId);
      }
    };

    socket.on("chat:new-message", handleChatEvent);
    socket.on("chat:room-updated", handleChatEvent);

    return () => {
      socket.off("chat:new-message", handleChatEvent);
      socket.off("chat:room-updated", handleChatEvent);
    };
  }, [loadRoom, socket]);

  useEffect(
    () => () => {
      selectedImagesRef.current.forEach((image) =>
        URL.revokeObjectURL(image.url),
      );
    },
    [],
  );

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

  function selectRoom(userId: string) {
    if (userId !== selectedUserId) setActiveRoom(null);
    setPreferredUserId(userId);
    setDraft("");
    setMobileView("thread");
    setMemberInfoOpen(false);
    clearImages();
  }

  async function sendReply() {
    if (!selectedUserId || (!draft.trim() && !selectedImages.length) || sending)
      return;
    const content = draft.trim();
    const files = selectedImages.map((image) => image.file);
    setSending(true);
    setError("");
    try {
      const message = await sendAdminChatMessage(selectedUserId, {
        content,
        files,
      });
      setDraft("");
      clearImages();
      setActiveRoom((current) =>
        current
          ? {
              ...current,
              messages: appendUniqueMessage(current.messages ?? [], message),
            }
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
    <section
      className={`admin-card admin-inquiry-page${mobileView === "thread" ? " is-mobile-thread" : ""}`}
    >
      <header className="admin-inquiry-head">
        <h2>
          <ChatBubbleOutlineOutlinedIcon />
          1:1 문의
        </h2>
        <div className="admin-inquiry-head-actions">
          {!!unreadTotal && (
            <span className="admin-inquiry-unread-total">
              미확인 {unreadTotal}
            </span>
          )}
          <span className="admin-inquiry-room-total">
            {pageMeta.total}개 대화
          </span>
        </div>
      </header>

      {error && <p className="admin-inquiry-error">{error}</p>}

      <div className={`admin-inquiry-layout${rooms.length ? "" : " is-empty"}`}>
        <aside
          aria-label="회원 문의방 목록"
          className="admin-inquiry-directory"
        >
          <label className="admin-inquiry-search">
            <span>문의 검색</span>
            <div>
              <SearchOutlinedIcon />
              <input
                value={searchText}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="회원명 또는 연락처 검색"
              />
            </div>
          </label>

          <nav className="admin-inquiry-room-list">
            {rooms.map((room) => {
              const selected = room.userId === selectedUserId;
              return (
                <button
                  aria-pressed={selected}
                  className={selected ? "is-active" : ""}
                  key={room.id}
                  onClick={() => selectRoom(room.userId)}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className={`admin-inquiry-avatar is-${avatarTone(room.user?.name)}`}
                  >
                    {initial(room.user?.name)}
                  </span>
                  <span className="admin-inquiry-room-copy">
                    <strong>{room.user?.name ?? "회원"}</strong>
                    <span>{latestText(room)}</span>
                  </span>
                  <time>{roomTime(room)}</time>
                  {!!room.unreadCount && <b>{room.unreadCount}</b>}
                </button>
              );
            })}

            {!rooms.length && (
              <span className="admin-inquiry-directory-empty">
                {searchText ? "검색 결과가 없습니다." : "문의방이 없습니다."}
              </span>
            )}
          </nav>

          <AdminPager meta={pageMeta} onPageChange={onPageChange} />
        </aside>

        {rooms.length ? (
          <>
            <article className="admin-inquiry-thread">
              <header className="admin-inquiry-thread-head">
                <button
                  aria-label="문의 목록으로 돌아가기"
                  className="admin-inquiry-thread-back"
                  onClick={() => {
                    setMemberInfoOpen(false);
                    setMobileView("list");
                  }}
                  type="button"
                >
                  <ArrowBackOutlinedIcon />
                </button>
                <div className="admin-inquiry-thread-person">
                  <span
                    aria-hidden="true"
                    className={`admin-inquiry-avatar is-thread is-${avatarTone(selectedSummary?.user?.name)}`}
                  >
                    {initial(selectedSummary?.user?.name)}
                  </span>
                  <span>
                    <strong>{selectedSummary?.user?.name ?? "회원"}</strong>
                    <small>
                      {selectedSummary?.user?.phone ?? "연락처 없음"}
                    </small>
                  </span>
                </div>
                <div className="admin-inquiry-thread-actions">
                  <em>
                    {loadingRoom
                      ? "불러오는 중"
                      : `${messages.length}개 메시지`}
                  </em>
                  <button
                    aria-expanded={memberInfoOpen}
                    className="admin-inquiry-info-toggle"
                    onClick={() => setMemberInfoOpen(true)}
                    type="button"
                  >
                    <InfoOutlinedIcon />
                    <span>회원정보</span>
                  </button>
                </div>
              </header>

              <div className="admin-inquiry-messages" ref={messagesRef}>
                {messages.map((message) => {
                  const fromManager = isManagerMessage(message);
                  return (
                    <div
                      className={`admin-inquiry-message ${fromManager ? "is-manager" : "is-member"}`}
                      key={message.id}
                    >
                      <span
                        aria-hidden="true"
                        className={`admin-inquiry-avatar is-message is-${avatarTone(message.sender?.name)}`}
                      >
                        {initial(message.sender?.name)}
                      </span>
                      <div className="admin-inquiry-message-body">
                        <span>{message.sender?.name ?? "회원"}</span>
                        <div className="admin-inquiry-bubble">
                          {message.content && <p>{message.content}</p>}
                          {!!message.attachments?.length && (
                            <div className="admin-inquiry-attachments">
                              {message.attachments.map((attachment) =>
                                attachment.signedUrl ? (
                                  <a
                                    href={attachment.signedUrl}
                                    key={attachment.id}
                                    rel="noreferrer"
                                    target="_blank"
                                  >
                                    <img
                                      alt={
                                        attachment.fileName ??
                                        "문의 첨부 이미지"
                                      }
                                      src={attachment.signedUrl}
                                    />
                                  </a>
                                ) : null,
                              )}
                            </div>
                          )}
                        </div>
                        <time>
                          {dateText(message.createdAt)}
                          {fromManager && (
                            <i
                              className={`admin-inquiry-read${message.isRead ? " is-read" : ""}`}
                            >
                              {message.isRead ? " · 읽음" : " · 전송됨"}
                            </i>
                          )}
                        </time>
                      </div>
                    </div>
                  );
                })}

                {!messages.length && (
                  <div className="admin-inquiry-message-empty">
                    선택한 회원과의 대화가 아직 없습니다.
                  </div>
                )}
              </div>

              <div className="admin-inquiry-compose">
                {!!selectedImages.length && (
                  <div
                    aria-label="첨부 이미지 미리보기"
                    className="admin-inquiry-image-preview"
                  >
                    {selectedImages.map((image, index) => (
                      <div key={`${image.file.name}-${index}`}>
                        <img src={image.url} alt={image.file.name} />
                        <button
                          aria-label={`${image.file.name} 첨부 취소`}
                          onClick={() => removeImage(index)}
                          type="button"
                        >
                          <CloseOutlinedIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="admin-inquiry-attach">
                  <ImageOutlinedIcon />
                  <span>이미지 첨부</span>
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
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.nativeEvent.isComposing
                    ) {
                      sendReply();
                    }
                  }}
                  placeholder="회원에게 보낼 메시지"
                />
                <button
                  disabled={
                    sending || (!draft.trim() && !selectedImages.length)
                  }
                  onClick={sendReply}
                  type="button"
                >
                  <SendOutlinedIcon />
                  <span>{sending ? "전송 중" : "전송"}</span>
                </button>
              </div>
            </article>

            <button
              aria-label="회원정보 닫기"
              className={`admin-inquiry-context-backdrop${memberInfoOpen ? " is-open" : ""}`}
              onClick={() => setMemberInfoOpen(false)}
              type="button"
            />

            <aside
              aria-label="선택 회원 정보"
              className={`admin-inquiry-context${memberInfoOpen ? " is-open" : ""}`}
            >
              <section>
                <div className="admin-inquiry-context-head">
                  <span
                    aria-hidden="true"
                    className={`admin-inquiry-avatar is-context is-${avatarTone(selectedMember?.name)}`}
                  >
                    {initial(selectedMember?.name)}
                  </span>
                  <div>
                    <small>회원 정보</small>
                    <strong>{selectedMember?.name ?? "회원"}</strong>
                    <em>{selectedMember?.phone ?? "연락처 없음"}</em>
                  </div>
                  <button
                    aria-label="회원정보 닫기"
                    className="admin-inquiry-context-close"
                    onClick={() => setMemberInfoOpen(false)}
                    type="button"
                  >
                    <CloseOutlinedIcon />
                  </button>
                </div>
                <dl>
                  <div>
                    <dt>자격증</dt>
                    <dd>{userDetail(selectedMember?.examType)}</dd>
                  </div>
                  <div>
                    <dt>지역</dt>
                    <dd>{userDetail(selectedMember?.residenceArea)}</dd>
                  </div>
                  <div>
                    <dt>만료일</dt>
                    <dd>{membershipEndText(selectedMember?.membershipEnd)}</dd>
                  </div>
                  <div>
                    <dt>미확인</dt>
                    <dd>{selectedSummary?.unreadCount ?? 0}개</dd>
                  </div>
                  <div>
                    <dt>상태</dt>
                    <dd>
                      {selectedMember?.isActive === false ? "비활성" : "활성"}
                    </dd>
                  </div>
                </dl>
              </section>

              <button
                className="admin-inquiry-refresh"
                onClick={onRefresh}
                type="button"
              >
                문의 목록 새로고침
              </button>
            </aside>
          </>
        ) : (
          <div className="admin-inquiry-empty">
            <ChatBubbleOutlineOutlinedIcon />
            <strong>
              {searchText
                ? "조건에 맞는 문의방이 없습니다."
                : "아직 열린 문의방이 없습니다."}
            </strong>
            <span>
              {searchText
                ? "검색어를 바꾸거나 초기화해 주세요."
                : "회원이 메시지를 보내면 이곳에 표시됩니다."}
            </span>
            <button onClick={onRefresh} type="button">
              문의 목록 새로고침
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
