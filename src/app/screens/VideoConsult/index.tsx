import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MicOutlinedIcon from "@mui/icons-material/MicOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import ScreenShareOutlinedIcon from "@mui/icons-material/ScreenShareOutlined";
import CallEndOutlinedIcon from "@mui/icons-material/CallEndOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import StarOutlinedIcon from "@mui/icons-material/StarOutlined";
import "./video-consult.css";

export default function VideoConsult() {
  const navigate = useNavigate();

  return (
    <div className="vc">
      <header className="vc-head">
        <button onClick={() => navigate("/inquiry")}>
          <ArrowBackIcon /> 게시판
        </button>
        <h1>1:1 화상상담</h1>
        <span />
      </header>

      <main className="vc-body">
        <section className="vc-room">
          <div className="vc-room-head">
            <div>
              <strong>상담실 입장</strong>
              <p>상담가능 버튼에 불이 켜지면 카메라를 켜주세요</p>
            </div>
            <span>🐱</span>
          </div>

          <div className="vc-status">
            <span>
              <CalendarMonthOutlinedIcon /> 예약 시간 06.10 (수) 14:00
            </span>
            <em>상담 가능</em>
          </div>

          <div className="vc-video">
            <img src="/preview/2.jpg" alt="" />
            <span>상담사 · 수험생연구소</span>
            <em>상대방 화면</em>
            <div>
              <strong>상담실에 연결되었습니다</strong>
              <p>상담방 얼굴만 크게 보이는 상담 화면입니다.</p>
            </div>
          </div>

          <div className="vc-controls">
            <button>
              <MicOutlinedIcon />
              켜기/끄기
              <small>마이크</small>
            </button>
            <button>
              <VideocamOutlinedIcon />
              방향전환
              <small>카메라</small>
            </button>
            <button>
              <ScreenShareOutlinedIcon />
              화면전환
              <small>화면</small>
            </button>
            <button>
              <span>🐱</span>
              상담초대
              <small>초대</small>
            </button>
            <button className="is-end">
              <CallEndOutlinedIcon />
              종료
              <small>통화종료</small>
            </button>
          </div>
        </section>

        <section className="vc-grid">
          <div className="vc-panel">
            <strong>AI 자동상담요약</strong>
            <p>상담 종료 후 자동 정리됩니다</p>
            <ul>
              <li>현재 학습 · 3교시 기출풀이 집중</li>
              <li>목표 조정 · 오늘 계획 80% 유지</li>
              <li>다음 과제 · 오답노트 2장 정리</li>
            </ul>
          </div>

          <div className="vc-panel">
            <strong>다음상담예약목록</strong>
            <p>상담 일정은 관리자 확인 후 확정됩니다.</p>
            <div className="vc-reserve">06.17 (수) 14:00 김*원</div>
            <div className="vc-reserve">06.24 (수) 14:00 김*원</div>
          </div>
        </section>

        <section className="vc-satisfaction">
          <span>🐱</span>
          <div>
            <strong>상담이 도움되셨나요?</strong>
            <p>한 줄 평을 남기면 다음 상담에 반영돼요</p>
          </div>
          <button>
            <StarOutlinedIcon />
            상담만족도 한줄평
          </button>
        </section>
      </main>

      <p className="app-foot">자격증공장 재택근무반</p>
    </div>
  );
}
