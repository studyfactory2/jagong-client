import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
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
  const [preferredUserId, setPreferredUserId] = useState("");
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [draft, setDraft] = useState("");
  const [selectedImages, setSelectedImages] = useState<SelectedChatImage[]>([]);
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const onRoomReadRef = useRef(onRoomRead);
  const selectedImagesRef = useRef<SelectedChatImage[]>([]);

  useEffect(() => {
    onRoomReadRef.current = onRoomRead;
  }, [onRoomRead]);

  function clearImages() {
    selectedImagesRef.current.forEach((image) => URL.revokeObjectURL(image.url));
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
    setPreferredUserId(userId);
    setDraft("");
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

      <label className="admin-search">
        <span>문의 검색</span>
        <input
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="회원명 또는 연락처 검색"
        />
      </label>

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
                onClick={() => selectRoom(room.userId)}
                type="button"
              >
                <span
                  className={`admin-chat-avatar is-${avatarTone(room.user?.name)}`}
                >
                  {initial(room.user?.name)}
                </span>
                <span className="admin-chat-room-body">
                  <strong>{room.user?.name ?? "회원"}</strong>
                  <span>{latestText(room)}</span>
                  <em>{roomTime(room)}</em>
                </span>
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

            <div className="admin-chat-messages" ref={messagesRef}>
              {messages.map((message) => {
                const fromManager = isManagerMessage(message);
                return (
                  <div
                    className={fromManager ? "is-manager" : ""}
                    key={message.id}
                  >
                    <span
                      className={`admin-chat-avatar is-message is-${avatarTone(message.sender?.name)}`}
                    >
                      {initial(message.sender?.name)}
                    </span>
                    <div className="admin-chat-message-body">
                      <span>{message.sender?.name ?? "회원"}</span>
                      {message.content && <p>{message.content}</p>}
                      {!!message.attachments?.length && (
                        <div className="admin-chat-attachments">
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
                                    attachment.fileName ?? "문의 첨부 이미지"
                                  }
                                  src={attachment.signedUrl}
                                />
                              </a>
                            ) : null,
                          )}
                        </div>
                      )}
                      <time>
                        {dateText(message.createdAt)}
                        {fromManager && (
                          <i
                            className={
                              message.isRead
                                ? "admin-chat-read is-read"
                                : "admin-chat-read"
                            }
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
                <div className="admin-chat-placeholder">
                  선택한 회원과의 대화가 아직 없습니다.
                </div>
              )}
            </div>

            <div className="admin-chat-compose">
              {!!selectedImages.length && (
                <div
                  className="admin-chat-image-preview"
                  aria-label="첨부 이미지 미리보기"
                >
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
              <label className="admin-chat-attach">
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
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                    sendReply();
                  }
                }}
                placeholder="회원에게 보낼 메시지"
              />
              <button
                disabled={sending || (!draft.trim() && !selectedImages.length)}
                onClick={sendReply}
                type="button"
              >
                <SendOutlinedIcon />
                전송
              </button>
            </div>
          </div>

          <aside className="admin-chat-context" aria-label="선택 회원 정보">
            <section>
              <div className="admin-chat-context-head">
                <span
                  className={`admin-chat-avatar is-context is-${avatarTone(selectedMember?.name)}`}
                >
                  {initial(selectedMember?.name)}
                </span>
                <div>
                  <span>회원 정보</span>
                  <strong>{selectedMember?.name ?? "회원"}</strong>
                  <em>{selectedMember?.phone ?? "연락처 없음"}</em>
                </div>
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
                  <dt>이용권</dt>
                  <dd>{membershipEndText(selectedMember?.membershipEnd)}</dd>
                </div>
                <div>
                  <dt>미확인</dt>
                  <dd>{selectedSummary?.unreadCount ?? 0}개</dd>
                </div>
              </dl>
            </section>

            <button
              className="admin-chat-context-refresh"
              onClick={onRefresh}
              type="button"
            >
              문의 목록 새로고침
            </button>
          </aside>
        </div>
      )}

      <AdminPager meta={pageMeta} onPageChange={onPageChange} />
    </section>
  );
}
