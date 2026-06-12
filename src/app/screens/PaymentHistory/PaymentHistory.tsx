import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import HeadsetMicOutlinedIcon from "@mui/icons-material/HeadsetMicOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import {
  checkoutMembership,
  getMembershipPlans,
  getMyMembership,
  getMyPayments,
} from "../../services/membership.service";
import { TOSS_CLIENT_KEY } from "../../../lib/config";
import type {
  CheckoutResult,
  MembershipPlan,
  MembershipStatus,
  PaymentRecord,
} from "../../../lib/types";
import { useAuth } from "../../context/AuthContext";
import "./payment-history.css";

type TossPaymentsClient = {
  requestPayment: (
    method: "카드",
    options: {
      amount: number;
      orderId: string;
      orderName: string;
      customerName?: string;
      successUrl: string;
      failUrl: string;
    },
  ) => Promise<void>;
};

declare global {
  interface Window {
    TossPayments?: (clientKey: string) => TossPaymentsClient;
  }
}

const FALLBACK_PLANS: MembershipPlan[] = [
  { months: 1, days: 30, total: 370000 },
  { months: 2, days: 60, total: 700000 },
  { months: 3, days: 90, total: 990000 },
];

function money(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

function dateText(value?: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export default function PaymentHistory() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [plans, setPlans] = useState<MembershipPlan[]>(FALLBACK_PLANS);
  const [membership, setMembership] = useState<MembershipStatus | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [selected, setSelected] = useState(3);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const selectedPlan = useMemo(
    () => plans.find((p) => p.months === selected) ?? plans[0],
    [plans, selected],
  );

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        const [planData, membershipData, paymentData] = await Promise.all([
          getMembershipPlans(),
          getMyMembership(),
          getMyPayments(),
        ]);
        if (!alive) return;
        setPlans(planData.length ? planData : FALLBACK_PLANS);
        setSelected((current) =>
          planData.some((p) => p.months === current) ? current : 3,
        );
        setMembership(membershipData);
        setPayments(paymentData);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "결제 정보를 불러오지 못했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  async function startPayment() {
    if (!selectedPlan || paying) return;
    setError("");

    if (!TOSS_CLIENT_KEY) {
      setError("Toss 클라이언트 키가 설정되지 않았습니다.");
      return;
    }
    if (!window.TossPayments) {
      setError("Toss 결제 스크립트를 불러오지 못했습니다.");
      return;
    }

    try {
      setPaying(true);
      const checkout: CheckoutResult = await checkoutMembership(selectedPlan.months);
      const toss = window.TossPayments(TOSS_CLIENT_KEY);
      await toss.requestPayment("카드", {
        amount: checkout.amount,
        orderId: checkout.paymentId,
        orderName: `자격증공장 재택근무반 ${checkout.planMonths}개월권`,
        customerName: session?.user.name,
        successUrl: `${window.location.origin}/payments/success`,
        failUrl: `${window.location.origin}/payments/fail`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "결제를 시작하지 못했습니다.");
      setPaying(false);
    }
  }

  const paidPayments = payments.filter((p) => p.status === "PAID");

  return (
    <div className="pay">
      <header className="pay-head">
        <button onClick={() => navigate("/waiting-room")}>
          <ArrowBackIcon /> 대기장
        </button>
        <h1>결제/이용내역</h1>
        <button type="button">
          <MenuOutlinedIcon />
        </button>
      </header>

      <main className="pay-body">
        {error && <p className="pay-error">{error}</p>}

        <section className="pay-ticket">
          <ConfirmationNumberOutlinedIcon />
          <div>
            <strong>현재 이용권</strong>
            <p>
              시작일 {dateText(membership?.startDate)} · 만료일{" "}
              {dateText(membership?.membershipEnd)}
            </p>
          </div>
          <span>
            {loading
              ? "확인중"
              : membership?.active
                ? `D-${membership.daysLeft ?? 0}`
                : "만료"}
          </span>
        </section>

        <section className="pay-calendar">
          <div className="pay-cal-head">
            <button type="button">{"<"}</button>
            <strong>이용기간</strong>
            <button type="button">{">"}</button>
          </div>
          <div className="pay-period-box">
            <p>언제든 연장 가능하며 남은 이용기간 뒤로 누적 적용됩니다.</p>
            <strong>{dateText(membership?.membershipEnd)}</strong>
          </div>
        </section>

        <section className="pay-alert">
          <HeadsetMicOutlinedIcon />
          <div>
            <strong>관리자 알림</strong>
            <p>만료 5일 전 · 3일 전 · 1일 전 · 당일에 자동 알림이 가요</p>
          </div>
        </section>

        <section className="pay-fees">
          <h2>이용료</h2>
          <div>
            {plans.map((plan) => (
              <button
                className={selected === plan.months ? "is-active" : ""}
                key={plan.months}
                onClick={() => setSelected(plan.months)}
                type="button"
              >
                <span>{plan.months}달</span>
                <p>
                  월{" "}
                  {money(Math.round(plan.total / plan.months)).replace("원", "원")}
                </p>
                <strong>총 {money(plan.total)}</strong>
              </button>
            ))}
          </div>
          <button
            className="pay-extend"
            disabled={paying || loading}
            onClick={startPayment}
            type="button"
          >
            {paying ? "결제창 여는 중..." : "카드로 연장하기"}
          </button>
        </section>

        <section className="pay-history">
          <div>
            <h2>지난 결제내역</h2>
            <p>카드결제와 관리자 수동 등록 내역을 확인할 수 있어요</p>
          </div>
          {paidPayments.length === 0 && (
            <p className="pay-empty">아직 완료된 결제내역이 없습니다.</p>
          )}
          {paidPayments.map((payment) => (
            <div className="pay-row" key={payment.id}>
              <span>{dateText(payment.createdAt)}</span>
              <em>{payment.planMonths}개월</em>
              <ReceiptLongOutlinedIcon />
              {payment.receiptSignedUrl ? (
                <a href={payment.receiptSignedUrl} rel="noreferrer" target="_blank">
                  영수증 보기
                </a>
              ) : (
                <button type="button" disabled>
                  영수증 준비중
                </button>
              )}
            </div>
          ))}
        </section>
      </main>

      <p className="app-foot">자격증공장 재택근무반</p>
    </div>
  );
}
