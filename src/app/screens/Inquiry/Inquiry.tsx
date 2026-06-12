import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import ChevronRightOutlinedIcon from "@mui/icons-material/ChevronRightOutlined";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import "./inquiry.css";

const NOTICES = [
  ["공지", "오늘 3교시 시작 1분 전 안내", "2026.06.08 (월) 13:19"],
  ["중요", "캠 화면 점검 및 자리 정돈 안내", "2026.06.08 (월) 08:02"],
  ["공지", "이번 주 모의고사 신청 안내", "2026.06.07 (일) 20:10"],
  ["공지", "휴가 신청 규칙 안내", "2026.06.06 (토) 09:30"],
];

const INITIAL_MESSAGES = [
  ["admin", "안녕하세요. 오늘 캠 각도를 조금만 더 책상 쪽으로 내려주세요 :)", "09:12"],
  ["me", "네! 조정했습니다. 확인 부탁드려요.", "09:15"],
  ["admin", "좋아요. 3교시에는 계획표에 적은 기출풀이 먼저 진행해주세요.", "09:17"],
  ["me", "선생님, 오늘 오후 모의고사 외출 가능한가요?", "10:03"],
];

export default function Inquiry() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(INITIAL_MESSAGES);

  function send() {
    if (!message.trim()) return;
    setMessages((prev) => [...prev, ["me", message.trim(), "지금"]]);
    setMessage("");
  }

  return (
    <div className="iq">
      <header className="iq-head">
        <button onClick={() => navigate("/waiting-room")}>
          <ArrowBackIcon /> 대기장
        </button>
        <h1>게시판</h1>
        <button onClick={() => navigate("/video-consult")}>상담실 →</button>
      </header>

      <main className="iq-body">
        <section className="iq-panel">
          <div className="iq-panel-title">
            <CampaignOutlinedIcon />
            <div>
              <strong>관리자 공지</strong>
              <p>공지표시 · 제목 · 등록날짜/요일/시간을 최신순으로 확인해요</p>
            </div>
            <button>전체보기 ›</button>
          </div>

          <div className="iq-notices">
            {NOTICES.map(([tag, title, date]) => (
              <button key={title}>
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
            <span>🌙</span>
            <div>
              <strong>1:1 문의 게시판</strong>
              <p>관리자와 해당 학원만 보는 카톡형 형식의 대화창</p>
            </div>
            <button>지난 대화 접기</button>
          </div>

          <div className="iq-chat-meta">
            <span>지난 대화 12개가 자동으로 접혀 있어요</span>
            <button>펼쳐보기⌄</button>
          </div>

          <div className="iq-chat-date">오늘 2026.06.08 (월)</div>

          <div className="iq-messages">
            {messages.map(([who, text, time], index) => (
              <div className={`iq-msg ${who === "me" ? "is-me" : ""}`} key={`${text}-${index}`}>
                {who !== "me" && <span className="iq-avatar">🐱</span>}
                <div>
                  {who !== "me" && <em>관리자</em>}
                  <p>{text}</p>
                </div>
                <time>{time}</time>
              </div>
            ))}
          </div>

          <div className="iq-input">
            <AddOutlinedIcon />
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="문의 내용을 입력해 주세요"
            />
            <button onClick={send}>
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
