import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PersonOutlineIcon from "@mui/icons-material/Person2Outlined";
import CakeOutlinedIcon from "@mui/icons-material/CakeOutlined";
import CallOutlinedIcon from "@mui/icons-material/CallOutlined";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import BoltIcon from "@mui/icons-material/Bolt";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { createConsultation } from "../../services/consultation.service";
import "./booking.css";

// TODO(대표님): real 자격증공장 카카오톡 채널 1:1 채팅 URL
const KAKAO_CHANNEL_URL = "https://pf.kakao.com/_xxxxx/chat";

const STEPS = [
  { n: 1, label: "상담예약", sub: "현재페이지" },
  { n: 2, label: "상담", sub: "전화·화상" },
  { n: 3, label: "결제", sub: "" },
  { n: 4, label: "재택근무", sub: "시작" },
];
const EXAMS = [
  "변호사",
  "변리사",
  "회계사",
  "감정평가사",
  "세무사",
  "노무사",
  "임용고시",
  "공무원",
  "공기업",
  "기타",
];

const SLOTS = [
  { id: "9-10", label: "9-10시", open: true },
  { id: "10-11", label: "10-11시", open: false },
  { id: "11-12", label: "11-12시", open: true },
  { id: "13-14", label: "13-14시", open: true },
  { id: "14-15", label: "14-15시", open: false },
  { id: "15-16", label: "15-16시", open: true },
  { id: "16-17", label: "16-17시", open: true },
  { id: "17-18", label: "17-18시", open: false },
];

const pad = (n: number) => String(n).padStart(2, "0");

export default function ConsultationBooking() {
  const navigate = useNavigate();
  const examMenuRef = useRef<HTMLDivElement | null>(null);
  const dateMenuRef = useRef<HTMLDivElement | null>(null);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [residenceArea, setResidenceArea] = useState("");
  const [exam, setExam] = useState("");
  const [examOpen, setExamOpen] = useState(false);
  const [period, setPeriod] = useState("");
  const [place, setPlace] = useState("");
  const [fullTime, setFullTime] = useState<"" | "yes" | "no">("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [slot, setSlot] = useState("");
  const [customTime, setCustomTime] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState<null | "PHONE" | "VIDEO">(null);

  const dates = useMemo(() => {
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return {
        v: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        label: `${d.getMonth() + 1}.${d.getDate()} (${days[d.getDay()]})`,
      };
    });
  }, []);

  const selectedDate = dates.find((d) => d.v === date);

  useEffect(() => {
    function closeMenus(event: MouseEvent) {
      const target = event.target as Node;

      if (examMenuRef.current && !examMenuRef.current.contains(target)) {
        setExamOpen(false);
      }

      if (dateMenuRef.current && !dateMenuRef.current.contains(target)) {
        setDateOpen(false);
      }
    }

    document.addEventListener("mousedown", closeMenus);
    return () => document.removeEventListener("mousedown", closeMenus);
  }, []);

  function validate() {
    if (!name.trim()) return "이름을 입력해 주세요.";
    const a = Number(age);
    if (!a || a < 21 || a > 40) return "연령은 21~40세만 가능해요.";
    if (!phone.trim()) return "연락처를 입력해 주세요.";
    if (!residenceArea.trim()) return "거주지역을 입력해 주세요.";
    if (!exam) return "시험 종류를 선택해 주세요.";
    if (!fullTime) return "전업 수험생 여부를 선택해 주세요.";
    if (!date) return "희망 상담 날짜를 선택해 주세요.";
    if (!slot) return "희망 상담 시간을 선택해 주세요.";
    if (slot === "other" && !customTime.trim())
      return "원하는 시간을 적어 주세요.";
    return "";
  }

  async function book(type: "PHONE" | "VIDEO") {
    const v = validate();
    if (v) {
      setErr(v);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setErr("");
    try {
      await createConsultation({
        name: name.trim(),
        age: Number(age),
        phone: phone.trim(),
        residenceArea: residenceArea.trim(),
        examType: exam,
        studyPeriod: period,
        studyPlace: place,
        fullTime: fullTime === "yes",
        reason,
        date,
        timeSlot: slot === "other" ? customTime : slot,
        type,
      });
    } catch {
      /* backend consultation-expand is phase 2; ignore for now so the flow is demoable */
    }
    setDone(type);
  }

  // 질문하기 / 바로시작 → 자격증공장 카카오톡 채널 1:1 채팅
  function openKakao() {
    window.open(KAKAO_CHANNEL_URL, "_blank");
  }

  return (
    <div className="bk">
      <div className="bk-topbar">
        <button className="bk-back" onClick={() => navigate("/login")}>
          <ArrowBackIcon /> 뒤로가기
        </button>
      </div>

      <div className="bk-head">
        <img className="bk-logo" src="/logo.png" alt="" />
        <div>
          <h1 className="bk-title">입사상담예약</h1>
          <p className="bk-sub">전문자격 온라인 성인관리형독서실</p>
        </div>
      </div>

      <div className="bk-body">
        <div className="bk-info">
          <InfoOutlinedIcon className="bk-info-icon" />
          <p>
            자격증공장은
            변호사·변리사·회계사·감정평가사·세무사·노무사·임용고시·공무원·공기업
            등 성인고시 수험자만을 관리해 온 성인전문 관리형 독서실입니다. 이제,
            전국 어디에 계시든 자격증공장의 관리를 받아 보세요.
          </p>
        </div>

        <div className="bk-steps">
          {STEPS.map((s, i) => (
            <Fragment key={s.n}>
              <div className={`bk-step${s.n === 1 ? " is-active" : ""}`}>
                <span className="bk-step-num">{s.n}</span>
                <span className="bk-step-label">{s.label}</span>
                {s.sub && <span className="bk-step-sub">{s.sub}</span>}
              </div>
              {i < STEPS.length - 1 && <span className="bk-step-line" />}
            </Fragment>
          ))}
        </div>

        <div className="bk-grid2">
          <div className="bk-field">
            <PersonOutlineIcon className="bk-fi" />
            <span className="bk-fl">이름</span>
            <span className="bk-fdiv" />
            <input
              className="bk-fin"
              placeholder="이름을 입력해 주세요."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="bk-field">
            <CakeOutlinedIcon className="bk-fi" />
            <span className="bk-fl">연령</span>
            <span className="bk-fdiv" />
            <input
              className="bk-fin bk-fin--hint"
              inputMode="numeric"
              placeholder="21-40세까지만 입사가능"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </div>
        </div>

        <div className="bk-grid2">
          <div className="bk-field">
            <CallOutlinedIcon className="bk-fi" />
            <span className="bk-fl">연락처</span>
            <span className="bk-fdiv" />
            <input
              className="bk-fin"
              inputMode="tel"
              placeholder="상담 후 폐기됩니다."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="bk-field">
            <HomeOutlinedIcon className="bk-fi" />
            <span className="bk-fl">거주지역</span>
            <span className="bk-fdiv" />
            <input
              className="bk-fin"
              placeholder="예) 서울 / 부산 / 수원"
              value={residenceArea}
              onChange={(e) => setResidenceArea(e.target.value)}
            />
          </div>
        </div>

        <div className="bk-grid2">
          <div className="bk-field bk-select-field" ref={examMenuRef}>
            <FormatListBulletedIcon className="bk-fi" />
            <span className="bk-fl">시험종류</span>
            <span className="bk-fdiv" />
            <button
              type="button"
              className={`bk-select-btn${exam ? " is-selected" : ""}`}
              onClick={() => setExamOpen((open) => !open)}
            >
              <span>{exam || "시험 선택"}</span>
              <ExpandMoreIcon className={examOpen ? "is-open" : ""} />
            </button>

            {examOpen && (
              <div className="bk-select-menu">
                {EXAMS.map((x) => (
                  <button
                    type="button"
                    key={x}
                    className={`bk-select-option${exam === x ? " is-active" : ""}`}
                    onClick={() => {
                      setExam(x);
                      setExamOpen(false);
                    }}
                  >
                    {x}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bk-field">
          <CalendarMonthOutlinedIcon className="bk-fi" />
          <span className="bk-fl">공부한 기간</span>
          <span className="bk-fdiv" />
          <input
            className="bk-fin"
            placeholder="자유기입  예) 6개월 / 1년 3개월"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>

        <div className="bk-field">
          <HomeOutlinedIcon className="bk-fi" />
          <span className="bk-fl">공부할 장소</span>
          <span className="bk-fdiv" />
          <input
            className="bk-fin"
            placeholder="자유기입  예) 집 / 독서실 / 스터디카페"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
          />
        </div>

        <div className="bk-fulltime">
          <span className="bk-q">전업 수험생이신가요?</span>
          <label className="bk-radio">
            <input
              type="checkbox"
              checked={fullTime === "yes"}
              onChange={() => setFullTime("yes")}
            />{" "}
            예
          </label>
          <label className="bk-radio">
            <input
              type="checkbox"
              checked={fullTime === "no"}
              onChange={() => setFullTime("no")}
            />{" "}
            아니요
          </label>
        </div>

        <div className="bk-warn">
          <span className="bk-warn-tag">아닌 경우</span>
          <p>
            자격증공장 재택근무반은 짧은 알바, 스터디, 모의고사만 허용하고
            있으며 직장인은 등록 불가합니다. 공부교시를 빠져야 하는 시간과
            사유를 적어주세요.
          </p>
        </div>
        <div className="bk-reason">
          <textarea
            maxLength={200}
            placeholder="예) 매주 수요일 16:00-17:00 모의고사 / 사유 작성"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="bk-reason-foot">
            <FavoriteBorderIcon />
            <span>{reason.length} / 200</span>
          </div>
        </div>

        <div className="bk-field bk-select-field" ref={dateMenuRef}>
          <CalendarMonthOutlinedIcon className="bk-fi" />
          <span className="bk-fl">희망상담날짜</span>
          <span className="bk-fdiv" />
          <button
            type="button"
            className={`bk-select-btn${date ? " is-selected" : ""}`}
            onClick={() => setDateOpen((open) => !open)}
          >
            <span>{selectedDate?.label || "날짜/요일을 선택해 주세요."}</span>
            <ExpandMoreIcon className={dateOpen ? "is-open" : ""} />
          </button>

          {dateOpen && (
            <div className="bk-select-menu bk-select-menu--date">
              {dates.map((d) => (
                <button
                  type="button"
                  key={d.v}
                  className={`bk-select-option${date === d.v ? " is-active" : ""}`}
                  onClick={() => {
                    setDate(d.v);
                    setDateOpen(false);
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bk-slots-head">
          <h3>희망 상담시간</h3>
          <span>
            원하시는 시간을 선택해 주세요. <em>※ 예약상태 표시</em>
          </span>
        </div>
        <div className="bk-slots">
          {SLOTS.map((s) => (
            <button
              key={s.id}
              disabled={!s.open}
              className={`bk-slot${slot === s.id ? " is-sel" : ""}${s.open ? "" : " is-closed"}`}
              onClick={() => s.open && setSlot(s.id)}
            >
              <span className="bk-slot-time">{s.label}</span>
              <span className="bk-slot-state">
                <FiberManualRecordIcon /> {s.open ? "예약가능" : "예약완료"}
              </span>
            </button>
          ))}
          <button
            className={`bk-slot bk-slot--other${slot === "other" ? " is-sel" : ""}`}
            onClick={() => setSlot("other")}
          >
            다른시간 선택하기
          </button>
        </div>
        {slot === "other" && (
          <input
            className="bk-custom"
            placeholder="원하는 시간을 적어 주세요 (예: 20:00-21:00)"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
          />
        )}

        {err && <div className="bk-error">{err}</div>}

        <div className="bk-actions-label">
          상담 예약 선택 <span>↳</span>
        </div>
        <div className="bk-actions">
          <button
            className="bk-act bk-act--coral"
            onClick={() => book("PHONE")}
          >
            <CallOutlinedIcon />
            <span>전화상담</span>
          </button>
          <button className="bk-act bk-act--mint" onClick={() => book("VIDEO")}>
            <VideocamOutlinedIcon />
            <span>화상상담</span>
          </button>
          <button className="bk-act bk-act--cream" onClick={openKakao}>
            <ChatBubbleOutlineIcon />
            <span>질문하기</span>
          </button>
          <button className="bk-act bk-act--coral" onClick={openKakao}>
            <BoltIcon />
            <span>바로시작</span>
          </button>
        </div>
      </div>

      {done && (
        <div className="bk-modal-overlay" onClick={() => setDone(null)}>
          <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bk-modal-icon">
              <CheckCircleIcon />
            </div>
            <h2>예약 신청 완료</h2>
            <p>
              {done === "PHONE" ? "전화상담" : "화상상담"} 예약이 신청되었어요.
              <br />
              확정되면 카카오톡으로 안내드릴게요.
            </p>
            <button className="bk-modal-btn" onClick={() => navigate("/login")}>
              확인
            </button>
          </div>
        </div>
      )}

      <p className="app-foot">자격증공장 재택근무반</p>
    </div>
  );
}
