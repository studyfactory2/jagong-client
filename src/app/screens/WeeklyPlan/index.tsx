import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import "./weekly-plan.css";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const PERIODS = ["1교시", "2교시", "점심", "3교시", "4교시", "5교시", "저녁", "6교시", "7교시"];

const seedTasks = [
  "기본서 p.20",
  "강의 2개",
  "회계 복습",
  "문제 15개",
  "오답 정리",
  "모의고사",
  "기출 30분",
  "세법 회독",
  "약점 정리",
  "내일 계획",
];

export default function WeeklyPlan() {
  const navigate = useNavigate();
  const [boardMode, setBoardMode] = useState(false);
  const [goal, setGoal] = useState("");
  const [tasks, setTasks] = useState(seedTasks);

  return (
    <div className="wp">
      <header className="wp-head">
        <button onClick={() => navigate("/")}>
          <ArrowBackIcon /> 대기장
        </button>
        <h1>{boardMode ? "주간학습장" : "나의 주간 작업계획"}</h1>
        <button className="wp-save" onClick={() => setBoardMode((v) => !v)}>
          {boardMode ? <SaveOutlinedIcon /> : <EditNoteOutlinedIcon />}
          {boardMode ? "저장" : "주간학습장 →"}
        </button>
      </header>

      {!boardMode ? (
        <main className="wp-body">
          <section className="wp-guide">
            <span>🐰</span>
            <div>
              <strong>이번 주 공부를 직접 설계해요</strong>
              <p>월 목표 → 주간 계획 → 교시별 할 일까지 한번에 관리할 수 있어요.</p>
            </div>
          </section>

          <section className="wp-calendar">
            <div className="wp-cal-head">
              <button>{"<"}</button>
              <strong>2026년 6월</strong>
              <button>{">"}</button>
            </div>
            <div className="wp-weekdays">
              {DAYS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="wp-days">
              {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => (
                <button className={day === 10 ? "is-picked" : ""} key={day}>
                  {day}
                </button>
              ))}
            </div>
            <p>선택된 주: 6월 2주차 06.08 - 06.14</p>
          </section>

          <section className="wp-month-goal">
            <label>
              <EditNoteOutlinedIcon />
              이번달의 목표
            </label>
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="예) 6월 목표: 재무회계 2회독 + 기출 300문제 완료"
            />
          </section>

          <section className="wp-actions">
            <button className="wp-week-select">6월 2주차 06.08 - 06.14⌄</button>
            <button className="wp-main-action" onClick={() => setBoardMode(true)}>
              <EditNoteOutlinedIcon /> 주간학습장 작성하기 →
            </button>
          </section>

          <section className="wp-stats">
            <div>
              <span>작성한 할 일</span>
              <strong>35개</strong>
            </div>
            <div>
              <span>완료 체크</span>
              <strong>12개</strong>
            </div>
          </section>

          <section className="wp-help">
            <span>🐻</span>
            <div>
              <strong>주간학습장 사용법</strong>
              <p>각 교시 칸마다 할 일을 여러 개 적고, 투두리스트처럼 완료 체크할 수 있어요.</p>
            </div>
          </section>
        </main>
      ) : (
        <main className="wp-board">
          <section className="wp-board-top">
            <span>🐶</span>
            <div>
              <strong>6월 2주차 목표 작업량</strong>
              <p>매 교시마다 할 일을 추가하고, 완료 체크해요.</p>
            </div>
            <button>06.08 - 06.14⌄</button>
          </section>

          <div className="wp-board-note">
            <MenuBookOutlinedIcon />
            각 칸은 투두리스트처럼 여러 개 작성 가능 · 체크박스로 완료 표시 가능
          </div>

          <section className="wp-table">
            <div className="wp-table-head">
              <b>교시</b>
              {DAYS.map((day, index) => (
                <b key={day}>
                  {day}
                  <small>6/{8 + index}</small>
                </b>
              ))}
            </div>

            {PERIODS.map((period, row) =>
              period === "점심" || period === "저녁" ? (
                <div className="wp-break" key={period}>
                  {period}시간 (75분)
                </div>
              ) : (
                <div className="wp-table-row" key={period}>
                  <div className="wp-period">
                    <strong>{period}</strong>
                    <span>{row === 0 || row === 3 ? "90분" : "80분"}</span>
                  </div>
                  {DAYS.map((day, col) => {
                    const task = tasks[(row + col) % tasks.length];
                    return (
                      <button
                        key={`${period}-${day}`}
                        onClick={() =>
                          setTasks((prev) =>
                            prev.map((t) =>
                              t === task ? (t.startsWith("✓ ") ? t.slice(2) : `✓ ${t}`) : t,
                            ),
                          )
                        }
                      >
                        {task.startsWith("✓ ") ? "☑" : "☐"} {task}
                      </button>
                    );
                  })}
                </div>
              ),
            )}
          </section>

          <section className="wp-board-actions">
            <button>지난주 불러오기</button>
            <button>임시저장</button>
            <button className="is-save">이번 주 계획 저장하기</button>
          </section>
        </main>
      )}

      <p className="app-foot">자격증공장 재택근무반</p>
    </div>
  );
}
