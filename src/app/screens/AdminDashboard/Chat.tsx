import type { AdminUser, ChatMessage } from "../../../lib/types";
import { userName } from "./admin.utils";

type ChatProps = {
  chats: ChatMessage[];
  users: AdminUser[];
  replyDrafts: Record<string, string>;
  onReplyDraftChange: (id: string, value: string) => void;
  onReply: (id: string) => void;
};

export default function Chat(props: ChatProps) {
  const { chats, users, replyDrafts, onReplyDraftChange, onReply } = props;

  return (
    <section className="admin-card">
      <h2>1:1 문의</h2>
      <div className="admin-table">
        {chats.map((chat) => (
          <div className="admin-chat-row" key={chat.id}>
            <div>
              <strong>{chat.user?.name ?? userName(users, chat.userId)}</strong>
              <p>{chat.message}</p>
              {chat.reply && <em>답변: {chat.reply}</em>}
            </div>
            <input
              value={replyDrafts[chat.id] ?? ""}
              onChange={(event) => onReplyDraftChange(chat.id, event.target.value)}
              placeholder="답변 입력"
            />
            <button onClick={() => onReply(chat.id)} type="button">
              답변
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
