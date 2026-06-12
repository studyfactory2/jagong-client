import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import "./study-line.css";

const LINE = [
  ["출근", "08:00 - 09:00", "완료"],
  ["1교시", "09:00 - 10:30", "진행중"],
  ["2교시", "10:45 - 12:05", "대기"],
  ["점심", "12:05 - 13:20", "대기"],
  ["3교시", "13:20 - 14:30", "대기"],
  ["4교시", "14:45 - 16:15", "대기"],
  ["5교시", "16:30 - 17:50", "대기"],
  ["저녁", "17:50 - 19:05", "대기"],
  ["6교시", "19:05 - 20:25", "대기"],
  ["7교시", "20:40 - 22:00", "대기"],
];

export default function StudyLine() {
  const navigate = useNavigate();

  return (
    <div className="sl">
      <header className="sl-head">
        <button className="sl-back" onClick={() => navigate("/waiting-room")}>
          <ArrowBackIcon /> 뒤로가기
        </button>
        <h1>개인작업실</h1>
        <button className="sl-pill" onClick={() => navigate("/study-room")}>
          단체작업장 →
        </button>
      </header>

      <main className="sl-body">
        <section className="sl-card sl-intro">
          <div>
            <strong>오늘 나의 학습라인</strong>
            <p>내 자리에서 선택한 교시 흐름과 진행 상태를 바로 확인해요.</p>
          </div>
          <span>
            <NotificationsOutlinedIcon />
            출근 알림 설정
          </span>
        </section>

        <section className="sl-card sl-line">
          {LINE.map(([label, time, state], index) => (
            <div
              className={`sl-row ${state === "진행중" ? "is-now" : ""}`}
              key={label}
            >
              <i>{index + 1}</i>
              {label.includes("점심") || label.includes("저녁") ? (
                <HourglassEmptyOutlinedIcon />
              ) : (
                <NotificationsOutlinedIcon />
              )}
              <strong>{label}</strong>
              <span>{time}</span>
              <em>{state}</em>
            </div>
          ))}
          <p className="sl-note">
            출근 알림 · 쉬는 시간 · 휴식 · 유동 / 제시마다 입장 상태 가능
          </p>
        </section>

        <section className="sl-notice">
          <span>알림</span>
          관리자 공지: 1교시 중에는 화면을 켜 상태를 유지해 주세요.
          <GroupsOutlinedIcon />
        </section>

        <section className="sl-bottom">
          <div>
            <span>오늘 나의 진행률</span>
            <strong>10%</strong>
            <em>(1/10 완료)</em>
            <div>
              <i />
            </div>
          </div>
          <div>
            <span>다음 종까지</span>
            <strong>00:42:18</strong>
            <em>1교시 종료 알림 예정</em>
          </div>
        </section>
      </main>

      <p className="app-foot">자격증공장 재택근무반</p>
    </div>
  );
}
