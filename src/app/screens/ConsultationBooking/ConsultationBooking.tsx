import { Fragment, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import BoltIcon from "@mui/icons-material/Bolt";
import CakeOutlinedIcon from "@mui/icons-material/CakeOutlined";
import CallOutlinedIcon from "@mui/icons-material/CallOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PersonOutlineIcon from "@mui/icons-material/Person2Outlined";
import { createConsultation } from "../../services/consultation.service";
import { getCurrentPolicyVersion } from "../../services/policy.service";
import BusinessFooter from "../../components/ui/BusinessFooter";
import "./booking.css";

const KAKAO_CHANNEL_URL = "https://pf.kakao.com/_ZRvnX/chat";
const BUSINESS_PHONE = "0516365134";

const BANK_ACCOUNT = {
  bank: "신한은행",
  display: "110-498-435650",
  copy: "110498435650",
  holder: "김지원",
};

const STEPS = [
  { n: 1, label: "신청서작성", sub: "현재페이지" },
  { n: 2, label: "결제", sub: "" },
  { n: 3, label: "사원등록", sub: "" },
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

const PRICES = [
  { months: "1개월", total: "150,000원" },
  { months: "2개월", monthly: "월 130,000원", total: "260,000원" },
  { months: "3개월", monthly: "월 110,000원", total: "330,000원" },
];

type ChallengeChoice = "" | "yes" | "no";
type CopyStatus = "" | "copied" | "failed";

export default function ConsultationBooking() {
  const navigate = useNavigate();
  const examMenuRef = useRef<HTMLDivElement | null>(null);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [residenceArea, setResidenceArea] = useState("");
  const [exam, setExam] = useState("");
  const [examOpen, setExamOpen] = useState(false);
  const [place, setPlace] = useState("");
  const [challengeChoice, setChallengeChoice] = useState<ChallengeChoice>("");
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("");

  useEffect(() => {
    function closeExamMenu(event: MouseEvent) {
      if (
        examMenuRef.current &&
        !examMenuRef.current.contains(event.target as Node)
      ) {
        setExamOpen(false);
      }
    }

    document.addEventListener("mousedown", closeExamMenu);
    return () => document.removeEventListener("mousedown", closeExamMenu);
  }, []);

  function validate() {
    if (!name.trim()) return "이름을 입력해 주세요.";
    const parsedAge = Number(age);
    if (!Number.isInteger(parsedAge) || parsedAge < 19 || parsedAge > 55) {
      return "연령은 19~55세의 숫자로 입력해 주세요.";
    }
    if (!phone.trim()) return "연락처를 입력해 주세요.";
    if (!residenceArea.trim()) return "거주지역을 입력해 주세요.";
    if (!exam) return "시험 종류를 선택해 주세요.";
    if (!challengeChoice) return "주 60시간 도전 여부를 선택해 주세요.";
    if (!privacyAgreed) return "개인정보 수집 및 이용에 동의해 주세요.";
    return "";
  }

  async function showBankAccount() {
    if (submitting) return;

    const validationError = validate();
    if (validationError) {
      setErr(validationError);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setErr("");
    setSubmitting(true);
    try {
      if (!applicationSubmitted) {
        const policyVersion = await getCurrentPolicyVersion();
        await createConsultation({
          name: name.trim(),
          age: Number(age),
          phone: phone.trim(),
          residenceArea: residenceArea.trim(),
          examType: exam,
          studyPlace: place.trim() || undefined,
          studyChallengeInterested: challengeChoice === "yes",
          type: "IMMEDIATE",
          policyVersion,
          privacyAgreed,
        });
        setApplicationSubmitted(true);
      }

      setCopyStatus("");
      setBankOpen(true);
    } catch (error) {
      setErr(
        error instanceof Error
          ? error.message
          : "입사 신청에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  }

  async function copyBankAccount() {
    try {
      await navigator.clipboard.writeText(BANK_ACCOUNT.copy);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  function openKakao() {
    window.open(KAKAO_CHANNEL_URL, "_blank", "noopener,noreferrer");
  }

  function callBusiness() {
    window.location.href = `tel:${BUSINESS_PHONE}`;
  }

  return (
    <div className="bk">
      <div className="bk-topbar">
        <button className="bk-back" onClick={() => navigate("/login")}>
          <ArrowBackIcon /> 뒤로가기
        </button>
      </div>

      <div className="bk-head">
        <img className="bk-logo" src="/logo/jagong-mark.png" alt="자격증공장" />
        <div>
          <h1 className="bk-title">입사신청서</h1>
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
          {STEPS.map((step, index) => (
            <Fragment key={step.n}>
              <div className={`bk-step${step.n === 1 ? " is-active" : ""}`}>
                <span className="bk-step-num">{step.n}</span>
                <span className="bk-step-label">{step.label}</span>
                {step.sub && <span className="bk-step-sub">{step.sub}</span>}
              </div>
              {index < STEPS.length - 1 && <span className="bk-step-line" />}
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
              disabled={applicationSubmitted}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="bk-field">
            <CakeOutlinedIcon className="bk-fi" />
            <span className="bk-fl">연령</span>
            <span className="bk-fdiv" />
            <input
              className="bk-fin bk-fin--hint"
              inputMode="numeric"
              placeholder="19~55세"
              value={age}
              disabled={applicationSubmitted}
              onChange={(event) =>
                setAge(event.target.value.replace(/\D/g, ""))
              }
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
              placeholder="연락처를 입력해 주세요."
              value={phone}
              disabled={applicationSubmitted}
              onChange={(event) => setPhone(event.target.value)}
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
              disabled={applicationSubmitted}
              onChange={(event) => setResidenceArea(event.target.value)}
            />
          </div>
        </div>

        <div className="bk-field bk-select-field" ref={examMenuRef}>
          <FormatListBulletedIcon className="bk-fi" />
          <span className="bk-fl">시험종류</span>
          <span className="bk-fdiv" />
          <button
            type="button"
            className={`bk-select-btn${exam ? " is-selected" : ""}`}
            disabled={applicationSubmitted}
            onClick={() => setExamOpen((open) => !open)}
          >
            <span>{exam || "시험 선택"}</span>
            <ExpandMoreIcon className={examOpen ? "is-open" : ""} />
          </button>

          {examOpen && (
            <div className="bk-select-menu">
              {EXAMS.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={`bk-select-option${exam === item ? " is-active" : ""}`}
                  onClick={() => {
                    setExam(item);
                    setExamOpen(false);
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bk-field">
          <HomeOutlinedIcon className="bk-fi" />
          <span className="bk-fl">공부할 장소</span>
          <span className="bk-fdiv" />
          <input
            className="bk-fin"
            placeholder="자유기입  예) 집 / 독서실 / 스터디카페"
            value={place}
            disabled={applicationSubmitted}
            onChange={(event) => setPlace(event.target.value)}
          />
        </div>

        <div className="bk-fulltime">
          <span className="bk-q">주 60시간 도전유무?</span>
          <label className="bk-radio">
            <input
              type="radio"
              name="studyChallengeInterested"
              checked={challengeChoice === "yes"}
              disabled={applicationSubmitted}
              onChange={() => setChallengeChoice("yes")}
            />
            예
          </label>
          <label className="bk-radio">
            <input
              type="radio"
              name="studyChallengeInterested"
              checked={challengeChoice === "no"}
              disabled={applicationSubmitted}
              onChange={() => setChallengeChoice("no")}
            />
            아니요
          </label>
        </div>

        <div className="bk-warn">
          <span className="bk-warn-tag">도전시</span>
          <p>
            주 60시간 4주 성공 시, 다음 4주 도전 기회가 무료로 제공됩니다. 결제
            후 가까운 월요일부터 도전이 시작됩니다.
          </p>
        </div>

        <section
          className="bk-operation-guide"
          aria-labelledby="operation-guide-title"
        >
          <h2 id="operation-guide-title">이용 안내</h2>
          <div className="bk-operation-row">
            <strong>휴무</strong>
            <span>월~일 일주일간 월차 1회, 반차 1회 사용 가능</span>
          </div>
          <div className="bk-operation-row">
            <strong>시간표</strong>
            <span>공부 중 작업장 이탈 불가 · 모든 볼일은 쉬는 시간에!</span>
          </div>
        </section>

        <div className="bk-info bk-info--privacy">
          <InfoOutlinedIcon className="bk-info-icon" />
          <p>
            관리자가 스케줄 관리와 공부 감독을 하고 있으며, 영상 녹화 기능은
            설치되어 있지 않습니다.
          </p>
        </div>

        <label className="bk-agree">
          <input
            type="checkbox"
            checked={privacyAgreed}
            disabled={applicationSubmitted}
            onChange={(event) => setPrivacyAgreed(event.target.checked)}
          />
          <span>
            [필수] 이용을 위한 개인정보 수집 및 이용에 동의합니다.
            <a href="/policies#privacy" target="_blank" rel="noreferrer">
              전문보기
            </a>
          </span>
        </label>

        {err && <div className="bk-error">{err}</div>}

        <div className="bk-actions-label">
          입사 방법 선택 <span>↳</span>
        </div>
        <div className="bk-actions">
          <button
            className="bk-act bk-act--coral"
            onClick={showBankAccount}
            disabled={submitting}
            type="button"
          >
            <AccountBalanceOutlinedIcon />
            <span>{submitting ? "신청중" : "바로결제"}</span>
          </button>
          <button
            className="bk-act bk-act--mint bk-act--offline"
            disabled
            type="button"
          >
            <BadgeOutlinedIcon />
            <span>자격증공장 회원전용 입장권</span>
            <small>준비중</small>
          </button>
          <button
            className="bk-act bk-act--cream"
            onClick={openKakao}
            type="button"
          >
            <ChatBubbleOutlineIcon />
            <span>카카오채널</span>
          </button>
          <button
            className="bk-act bk-act--cream"
            onClick={callBusiness}
            type="button"
          >
            <CallOutlinedIcon />
            <span>전화하기</span>
          </button>
        </div>

        <section className="bk-price-section" aria-labelledby="price-title">
          <div className="bk-price-head">
            <div>
              <span>이용요금</span>
              <h2 id="price-title">기간별 할인가</h2>
            </div>
            <BoltIcon />
          </div>
          <div className="bk-price-grid">
            {PRICES.map((price) => (
              <div className="bk-price-card" key={price.months}>
                <strong>{price.months}</strong>
                {price.monthly && <small>{price.monthly}</small>}
                <b>{price.total}</b>
              </div>
            ))}
          </div>
          <p className="bk-price-note">
            주 60시간 도전자는 1·2·3개월 이용권에 따라 각각 1·2·3회 도전할 수
            있습니다.
          </p>
        </section>

        <div className="bk-transfer-note">
          <strong>계좌이체 안내</strong>
          <span>
            현금영수증이 필요하신 경우 카카오채널에 이름과 발급번호를 남겨
            주세요.
          </span>
        </div>
      </div>

      {bankOpen && (
        <div className="bk-modal-overlay" onClick={() => setBankOpen(false)}>
          <div
            className="bk-modal bk-bank-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bank-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bk-modal-icon">
              <CheckCircleIcon />
            </div>
            <h2 id="bank-modal-title">입사 신청이 완료되었습니다</h2>
            <p>아래 계좌로 이용하실 기간에 맞는 금액을 입금해 주세요.</p>

            <div className="bk-bank-details">
              <span>{BANK_ACCOUNT.bank}</span>
              <strong>{BANK_ACCOUNT.display}</strong>
              <small>예금주: {BANK_ACCOUNT.holder}</small>
              <button type="button" onClick={copyBankAccount}>
                <ContentCopyOutlinedIcon /> 계좌번호 복사
              </button>
              <em aria-live="polite">
                {copyStatus === "copied" && "계좌번호가 복사되었습니다."}
                {copyStatus === "failed" &&
                  "복사하지 못했습니다. 계좌번호를 직접 입력해 주세요."}
              </em>
            </div>

            <div className="bk-bank-receipt">
              현금영수증 발급은 카카오채널에 이름과 발급번호를 남겨 주세요.
            </div>
            <div className="bk-modal-actions">
              <button
                className="bk-modal-btn bk-modal-btn--subtle"
                onClick={openKakao}
              >
                카카오채널
              </button>
              <button
                className="bk-modal-btn"
                onClick={() => setBankOpen(false)}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      <BusinessFooter />
    </div>
  );
}
