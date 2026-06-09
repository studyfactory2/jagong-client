import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import HeadsetMicOutlinedIcon from "@mui/icons-material/HeadsetMicOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import "./payment-history.css";

export default function PaymentHistory() {
  const navigate = useNavigate();

  return (
    <div className="pay">
      <header className="pay-head">
        <button onClick={() => navigate("/")}>
          <ArrowBackIcon /> 대기장
        </button>
        <h1>결제/이용내역</h1>
        <button>
          <MenuOutlinedIcon />
        </button>
      </header>

      <main className="pay-body">
        <section className="pay-ticket">
          <ConfirmationNumberOutlinedIcon />
          <div>
            <strong>현재 이용권</strong>
            <p>3개월권 · 시작일 2026.06.10 · 만료일 2026.09.07</p>
          </div>
          <span>만료일 9.7</span>
        </section>

        <section className="pay-calendar">
          <div className="pay-cal-head">
            <button>{"<"}</button>
            <strong>2026년 09월</strong>
            <button>{">"}</button>
          </div>
          <div className="pay-weekdays">
            {["월", "화", "수", "목", "금", "토", "일"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="pay-days">
            {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => (
              <div className={day === 7 ? "is-expire" : ""} key={day}>
                <span>{day}</span>
                {day <= 7 && <em>{day === 7 ? "만료 D-0" : `D-${7 - day}`}</em>}
              </div>
            ))}
          </div>
        </section>

        <section className="pay-alert">
          <HeadsetMicOutlinedIcon />
          <div>
            <strong>관리자 알림</strong>
            <p>회원 만료 3일 전 · 1일 전 · 당일에 관리자에게 자동 알림이 가요</p>
          </div>
        </section>

        <section className="pay-fees">
          <h2>이용료</h2>
          <div>
            <button>
              <span>1달</span>
              <p>월 37만원</p>
              <strong>총 37만원</strong>
            </button>
            <button>
              <span>2달</span>
              <p>월 35만원 × 2</p>
              <strong>총 70만원</strong>
            </button>
            <button className="is-active">
              <span>3달</span>
              <p>월 33만원 × 3</p>
              <strong>총 99만원</strong>
            </button>
          </div>
          <button className="pay-extend">연장하기</button>
        </section>

        <section className="pay-history">
          <div>
            <h2>지난 결제내역</h2>
            <p>관리자가 첨부한 영수증 사진을 확인할 수 있어요</p>
          </div>
          {["2026.06.10 (수)", "2026.03.12 (목)"].map((date) => (
            <div className="pay-row" key={date}>
              <span>{date}</span>
              <em>3개월</em>
              <ReceiptLongOutlinedIcon />
              <button>영수증 사진보기</button>
            </div>
          ))}
        </section>
      </main>

      <p className="app-foot">자격증공장 재택근무반</p>
    </div>
  );
}
