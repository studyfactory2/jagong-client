import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import "./leave-request.css";

const DAYS = Array.from({ length: 30 }, (_, i) => i + 1);
const REQUESTS = [
  ["2026.06.10 (수)", "월차", "취소"],
  ["2026.06.12 (금)", "오전반차", "취소"],
  ["2026.06.04 (목)", "오후반차", "지난 신청"],
];

export default function LeaveRequest() {
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState(10);
  const [leaveType, setLeaveType] = useState("월차");

  return (
    <div className="lv">
      <header className="lv-head">
        <button onClick={() => navigate("/waiting-room")}>
          <ArrowBackIcon /> 대기실
        </button>
        <h1>휴가신청</h1>
        <span>2026.06</span>
      </header>

      <main className="lv-body">
        <section className="lv-guide">
          <span>🐻</span>
          <div>
            <strong>쉬는 날도 계획적으로 관리해요</strong>
            <p>월차·반차 신청과 지난 휴가 내역을 한눈에 볼 수 있어요.</p>
          </div>
        </section>

        <section className="lv-calendar">
          <div className="lv-cal-head">
            <button>{"<"}</button>
            <strong>2026년 6월</strong>
            <button>{">"}</button>
          </div>
          <div className="lv-weekdays">
            {["월", "화", "수", "목", "금", "토", "일"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="lv-days">
            {DAYS.map((day) => (
              <button
                className={selectedDay === day ? "is-picked" : ""}
                key={day}
                onClick={() => setSelectedDay(day)}
              >
                {day}
                {day === 9 && <em>월차</em>}
                {day === 11 && <em>오전</em>}
                {day === 12 && <em>오후</em>}
                {day === 23 && <em>모의</em>}
                {day === 25 && <em>외출</em>}
              </button>
            ))}
          </div>
        </section>

        <div className="lv-info is-yellow">
          매주(월-일) 월차 1개, 반차 1개 또는 반차 3개로 쉴 수 있으며, 반차는
          3개 교시 이상 공부하셔야 합니다.
        </div>
        <div className="lv-info is-green">
          관리자 등록 일정 · 외출 · 모의 · 스터디 등은 허락 후 달력에 함께
          표시돼요.
        </div>

        <section className="lv-apply">
          <strong>선택한 날짜 2026.06.{String(selectedDay).padStart(2, "0")} (수)</strong>
          <div>
            {["월차", "오전반차", "오후반차"].map((type) => (
              <button
                className={leaveType === type ? "is-active" : ""}
                key={type}
                onClick={() => setLeaveType(type)}
              >
                {type}
              </button>
            ))}
            <button className="lv-submit">신청하기</button>
          </div>
        </section>

        <section className="lv-list">
          <div className="lv-list-head">
            <strong>신청내역 리스트</strong>
            <span>취소 가능</span>
          </div>
          {REQUESTS.map(([date, type, action]) => (
            <div className="lv-list-row" key={`${date}-${type}`}>
              <CalendarMonthOutlinedIcon />
              <span>{date}</span>
              <em className={type.includes("월차") ? "is-green" : "is-coral"}>
                {type}
              </em>
              <button>{action}</button>
            </div>
          ))}
        </section>

        <div className="lv-info is-yellow">
          오늘보다 과거에 신청한 휴가 내역은 취소할 수 없어요. 변경이 필요하면
          관리자에게 문의해주세요.
        </div>
      </main>

      <p className="app-foot">자격증공장 재택근무반</p>
    </div>
  );
}
