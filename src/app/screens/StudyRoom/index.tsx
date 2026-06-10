import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DoorFrontOutlinedIcon from "@mui/icons-material/DoorFrontOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import MicNoneIcon from "@mui/icons-material/MicNone";
import MicOffIcon from "@mui/icons-material/MicOff";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import "./study-room.css";

const WORKERS = [
  "오늘도합격",
  "정리왕",
  "해피스터디",
  "공부는내일",
  "꾸준히가자",
  "합격기원",
  "포기하지마",
  "노력은배신X",
  "내일은합격",
  "자격증러버",
  "끝까지한다",
  "로스팅중",
  "매일출근",
  "고득점가자",
  "기초튼튼",
  "집중모드",
];

export default function StudyRoom() {
  const navigate = useNavigate();
  const [visibleCount, setVisibleCount] = useState(16);

  return (
    <div className="sr">
      <header className="sr-head">
        <button className="sr-back" onClick={() => navigate("/waiting-room")}>
          <ArrowBackIcon /> 대기장
        </button>

        <h1 className="sr-title">단체작업장</h1>

        <button className="sr-pill" onClick={() => navigate("/study-line")}>
          <DoorFrontOutlinedIcon />
          개인작업실
          <span>→</span>
        </button>
      </header>

      <main className="sr-body">
        <section className="sr-panel sr-cams">
          <div className="sr-panel-head">
            <div className="sr-panel-title">
              <GroupsOutlinedIcon />
              <span>전국 단체 작업 캠</span>
            </div>

            <button
              className="sr-view-btn"
              onClick={() => setVisibleCount((n) => (n === 8 ? 16 : 8))}
            >
              <GridViewOutlinedIcon />
              {visibleCount}개 보기
              <small>8 → 16 → 25</small>
            </button>
          </div>

          <div className="sr-grid">
            {WORKERS.slice(0, visibleCount).map((name, index) => {
              const micOn = index % 3 !== 2;
              return (
                <div
                  className="sr-cam"
                  key={`${name}-${index}`}
                  style={{
                    background:
                      index % 4 === 0
                        ? "linear-gradient(135deg,#3f5b6e,#273d4d)"
                        : index % 4 === 1
                          ? "linear-gradient(135deg,#6a8f6f,#4f7a5a)"
                          : index % 4 === 2
                            ? "linear-gradient(135deg,#7d7aa8,#5d5a88)"
                            : "linear-gradient(135deg,#b08a4f,#8a6a2f)",
                  }}
                >
                  <img
                    src={`/preview/${(index % 8) + 1}.jpg`}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                  <span className="sr-cam-name">{name}</span>
                  <span className={`sr-cam-state${micOn ? "" : " is-off"}`}>
                    {micOn ? <MicNoneIcon /> : <MicOffIcon />}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="sr-hint">
            창분할 버튼을 누르면 다른 사람 공부캠 수가 8개, 16개, 25개 순서로
            바뀝니다.
          </p>
        </section>

        <section className="sr-notice">
          <span>공지창</span>
          관리자 공지: 3교시 집중 체크 중입니다. 화면을 켜고 자리를 유지해
          주세요.
          <em>실시간</em>
        </section>

        <section className="sr-panel sr-progress">
          <div className="sr-panel-head">
            <div className="sr-panel-title">
              <CampaignOutlinedIcon />
              <span>오늘 진행률 · 교시 안내</span>
            </div>
            <button className="sr-check">접기 ▲</button>
          </div>

          <div className="sr-progress-grid">
            <div className="sr-progress-box">
              <span>오늘 진행률</span>
              <strong>40%</strong>
              <em>(4/10)</em>
              <div className="sr-bar">
                <i />
              </div>
              <p>오늘도 차근차근 진행 중!</p>
            </div>

            <div className="sr-period is-now">
              <span>현재 진행중</span>
              <strong>3교시</strong>
              <p>
                <NotificationsOutlinedIcon /> 13:20 - 14:30
              </p>
            </div>

            <div className="sr-period is-next">
              <span>다음 교시</span>
              <strong>4교시</strong>
              <p>
                <NotificationsOutlinedIcon /> 14:45 - 16:15
              </p>
            </div>
          </div>
        </section>

        <div className="sr-dots">
          <i className="is-active" />
          <i />
          <i />
          <i />
          <i />
        </div>
      </main>

      <p className="app-foot">자격증공장 재택근무반</p>
    </div>
  );
}
