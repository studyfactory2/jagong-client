import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import "./policies.css";

const policyNav = [
  { id: "terms", label: "이용약관" },
  { id: "privacy", label: "개인정보" },
  { id: "refund", label: "결제·환불" },
  { id: "camera", label: "카메라" },
  { id: "rules", label: "운영수칙" },
];

export default function Policies() {
  const navigate = useNavigate();

  return (
    <main className="policy">
      <header className="policy-head">
        <button onClick={() => navigate(-1)} type="button">
          <ArrowBackIcon /> 뒤로가기
        </button>
        <span>자격증공장 재택근무반</span>
        <h1>서비스 정책</h1>
        <p>시행일 2026.06.29</p>
      </header>

      <nav className="policy-nav" aria-label="서비스 정책 목차">
        {policyNav.map((item) => (
          <a href={`#${item.id}`} key={item.id}>
            {item.label}
          </a>
        ))}
      </nav>

      <section className="policy-section" id="terms">
        <span className="policy-kicker">Terms</span>
        <h2>서비스 이용약관</h2>
        <p>
          자격증공장 재택근무반은 성인 수험생이 자택 또는 개인 학습공간에서
          정해진 시간표에 따라 온라인으로 학습하고, 회사가 출석, 착석, 이탈,
          휴식, 학습 참여 상태를 확인하는 온라인 관리형 학습 서비스입니다.
        </p>
        <div className="policy-list">
          <p>회원은 상담, 결제, 사전등록 또는 승인 절차 후 서비스를 이용합니다.</p>
          <p>계정, PIN, 접속권한은 본인만 사용할 수 있으며 양도나 대여가 금지됩니다.</p>
          <p>회사는 안정적인 서비스 제공, 개인정보 보호, 문의 응대, 운영기준 안내를 위해 노력합니다.</p>
          <p>서비스는 학습환경과 시간관리를 돕는 서비스이며 특정 시험 합격이나 성적 향상을 보장하지 않습니다.</p>
        </div>
      </section>

      <section className="policy-section" id="privacy">
        <span className="policy-kicker">Privacy</span>
        <h2>개인정보 처리방침</h2>
        <p>
          수험생연구소는 서비스 제공에 필요한 최소한의 개인정보를 처리하며,
          수집 목적이 변경되는 경우 관련 법령에 따라 필요한 안내와 동의를
          진행합니다.
        </p>
        <div className="policy-grid">
          <article>
            <h3>수집 항목</h3>
            <p>
              이름, 연락처, 지역, 연령, 시험종류, 공부기간, 학습장소, 상담 희망
              시간, 회원 등록 정보, 이용권 정보, 출석·이탈·휴식 기록, 문의 및
              상담 기록, 결제·환불 처리 정보, 접속 일시, IP, 기기 및 브라우저
              정보가 처리될 수 있습니다.
            </p>
          </article>
          <article>
            <h3>이용 목적</h3>
            <p>
              상담 예약, 회원 등록, 본인 확인, 온라인 작업장 입장, 출석 및
              착석 확인, 학습관리, 결제·환불 처리, 고객 문의, 부정이용 확인,
              서비스 안정화와 보안 관리에 사용합니다.
            </p>
          </article>
          <article>
            <h3>보유 기간</h3>
            <p>
              상담예약 정보는 상담 종료 후 3개월, 회원 등록 및 이용기록은 이용
              종료 후 1년, 결제 및 환불 관련 기록은 관련 법령상 보관기간 동안
              보관할 수 있습니다. 캠 화면은 원칙적으로 저장하지 않습니다.
            </p>
          </article>
          <article>
            <h3>처리 위탁</h3>
            <p>
              결제 처리는 PortOne, 알림 발송은 Solapi/Kakao Alimtalk, 서버
              운영은 AWS, 캠 기능은 LiveKit, 영수증 이미지 보관은 Cloudflare
              R2를 사용할 수 있습니다.
            </p>
          </article>
        </div>
        <div className="policy-callout">
          <strong>민감 결제정보</strong>
          <p>
            회사는 카드번호 전체, 계좌 비밀번호, 주민등록번호처럼 서비스
            제공에 필요하지 않은 민감 정보를 저장하지 않습니다.
          </p>
        </div>
        <p>
          회원은 개인정보 열람, 정정, 삭제, 처리정지, 동의 철회를 요청할 수
          있습니다. 요청은 앱 내 문의, 카카오톡 채널, 고객센터 등 회사가 안내한
          방법으로 접수합니다.
        </p>
      </section>

      <section className="policy-section" id="refund">
        <span className="policy-kicker">Payment</span>
        <h2>결제 및 환불정책</h2>
        <p>
          이용권 기간은 개월 단위로 계산합니다. 시작일 기준 1/2/3개월 뒤 같은
          날짜를 내부 종료 기준으로 하며, 화면에는 마지막 이용 가능일을
          표시합니다. 같은 날짜가 없는 경우 해당 월의 마지막 날까지 이용할 수
          있도록 처리합니다.
        </p>
        <div className="policy-list">
          <p>이용 시작 전 환불 요청 시 결제금액 전액을 환불합니다.</p>
          <p>이용 시작 후 환불은 결제금액에서 이미 이용한 기간의 금액을 공제한 뒤 산정합니다.</p>
          <p>2개월권 또는 3개월권 환불 시 이미 이용한 기간은 1개월권 정상가 기준으로 계산합니다.</p>
          <p>아직 시작하지 않은 뒤쪽 연장 이용권은 100% 환불할 수 있습니다.</p>
          <p>환불은 앱 내 문의, 카카오톡 채널, 문자, 전화 등 회사가 안내한 방법으로 신청할 수 있습니다.</p>
        </div>
      </section>

      <section className="policy-section" id="camera">
        <span className="policy-kicker">Camera</span>
        <h2>카메라 이용 동의</h2>
        <p>
          회사는 오프라인 관리형 독서실과 유사한 학습관리 환경을 제공하기 위해
          서비스 이용 중 회원의 카메라 화면을 실시간으로 확인할 수 있습니다.
        </p>
        <div className="policy-list">
          <p>카메라는 출석, 착석, 장시간 이탈, 학습 참여 여부 확인에 사용됩니다.</p>
          <p>회사는 원칙적으로 회원의 캠 화면을 녹화하거나 저장하지 않습니다.</p>
          <p>자리이탈 감지는 브라우저에서 처리되며, 백엔드는 필요한 운영 이벤트와 알림 기록만 저장합니다.</p>
          <p>회원은 화면에 주민등록증, 신용카드, 가족 얼굴, 민감한 문서 등 불필요한 개인정보가 노출되지 않도록 주의해야 합니다.</p>
        </div>
      </section>

      <section className="policy-section" id="rules">
        <span className="policy-kicker">Rules</span>
        <h2>재택근무반 운영수칙</h2>
        <div className="policy-list">
          <p>회원은 정해진 출근시간, 학습시간, 휴식시간, 종료시간을 따라야 합니다.</p>
          <p>무단 이탈, 반복 지각, 허위 출석, 대리 출석, 카메라 조작은 금지됩니다.</p>
          <p>다른 회원의 화면, 상담 내용, 개인정보를 무단 촬영·녹화·저장·유포할 수 없습니다.</p>
          <p>욕설, 비방, 괴롭힘, 광고, 정치·종교적 강요 등 공동학습 분위기를 해치는 행위는 금지됩니다.</p>
          <p>운영수칙 위반 시 회사는 주의, 상담, 경고, 이용 제한, 계약 해지 등 필요한 조치를 할 수 있습니다.</p>
        </div>
      </section>

      <footer className="policy-foot">
        <strong>수험생연구소</strong>
        <span>자격증공장 재택근무반 서비스 정책</span>
      </footer>
    </main>
  );
}
