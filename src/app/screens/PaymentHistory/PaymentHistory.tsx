import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import HeadsetMicOutlinedIcon from "@mui/icons-material/HeadsetMicOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import {
  checkoutMembership,
  getMembershipPlans,
  getMyMembership,
  getMyPayments,
} from "../../services/membership.service";
import { PORTONE_CHANNEL_KEY, PORTONE_STORE_ID } from "../../../lib/config";
import type {
  CheckoutResult,
  MemberPaymentRecord,
  MembershipPlan,
  MembershipStatus,
} from "../../../lib/types";
import { useAuth } from "../../context/AuthContext";
import "./payment-history.css";

type PaymentPhase = "idle" | "checkout" | "portone";
type MembershipViewState = "loading" | "active" | "future" | "expired" | "none";

function money(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

function dateText(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return dateObjectText(date);
}

function dateObjectText(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function membershipEndText(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  date.setDate(date.getDate() - 1);
  return dateObjectText(date);
}

function paymentPhaseText(phase: PaymentPhase): string {
  if (phase === "checkout") return "결제 정보를 준비하는 중...";
  if (phase === "portone") return "결제창에서 결제를 진행해주세요.";
  return "결제하기";
}

function isAlreadyPaidPaymentError(message?: string | null): boolean {
  const value = (message ?? "").toLowerCase();
  return value.includes("이미 결제") || value.includes("already paid");
}

function membershipViewState(
  membership: MembershipStatus | null,
  loading: boolean,
): MembershipViewState {
  if (loading) return "loading";
  if (!membership?.startDate || !membership.membershipEnd) return "none";

  const start = new Date(membership.startDate);
  const end = new Date(membership.membershipEnd);
  const now = Date.now();

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "none";
  }

  if (end.getTime() <= now) return "expired";
  if (start.getTime() > now) return "future";
  return "active";
}

function daysUntil(value?: string | null): number | null {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function projectedMembershipEndText(
  membership: MembershipStatus | null,
  selectedPlan: MembershipPlan | undefined,
  hasValidMembership: boolean,
): string {
  if (!selectedPlan) return "-";
  const base =
    hasValidMembership && membership?.membershipEnd
      ? new Date(membership.membershipEnd)
      : new Date();
  if (Number.isNaN(base.getTime())) return "-";
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + selectedPlan.days - 1);
  return dateObjectText(base);
}

function paymentNotice(
  viewState: MembershipViewState,
  membership: MembershipStatus | null,
): { title: string; body: string } | null {
  if (viewState === "future") {
    return {
      title: "이용 시작 전입니다",
      body: `결제는 완료되어 있어요. ${dateText(
        membership?.startDate,
      )}부터 대기장과 공부방 전체 기능을 이용할 수 있습니다.`,
    };
  }

  if (viewState === "expired") {
    return {
      title: "이용권이 만료되었습니다",
      body: "다시 이용하려면 아래에서 이용권을 결제하거나 연장해주세요.",
    };
  }

  if (viewState === "none") {
    return {
      title: "이용권 결제가 필요합니다",
      body: "결제가 완료되면 시작일에 맞춰 대기장과 공부방 기능을 이용할 수 있습니다.",
    };
  }

  return null;
}

export default function PaymentHistory() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [membership, setMembership] = useState<MembershipStatus | null>(null);
  const [payments, setPayments] = useState<MemberPaymentRecord[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState("");
  const [loading, setLoading] = useState(true);
  const [paymentPhase, setPaymentPhase] = useState<PaymentPhase>("idle");
  const [error, setError] = useState("");
  const [showAllPayments, setShowAllPayments] = useState(false);
  const paying = paymentPhase !== "idle";

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.months === selected),
    [plans, selected],
  );
  const availablePlan =
    !plansLoading && !plansError ? selectedPlan : undefined;
  const viewState = membershipViewState(membership, loading);
  const hasValidMembership = viewState === "active" || viewState === "future";
  const canEnterWaitingRoom = viewState === "active";
  const notice = paymentNotice(viewState, membership);
  const startDDay = daysUntil(membership?.startDate);
  const ticketBadge =
    viewState === "loading"
      ? "확인중"
      : viewState === "future"
        ? startDDay !== null
          ? `시작 D-${Math.max(0, startDDay)}`
          : "시작 전"
        : viewState === "active"
          ? `D-${membership?.daysLeft ?? 0}`
          : "만료";
  const ticketSubtext =
    viewState === "active"
      ? "남았어요"
      : viewState === "future"
        ? "부터 시작합니다"
        : "이용권 상태를 확인해주세요";

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlansError("");
    try {
      const planData = await getMembershipPlans();
      setPlans(planData);
      setSelected((current) => {
        if (
          current !== null &&
          planData.some((plan) => plan.months === current)
        ) {
          return current;
        }
        return (planData.find((plan) => plan.months === 3) ?? planData[0])
          .months;
      });
    } catch {
      setPlansError(
        "이용권 가격을 확인하지 못했습니다. 다시 불러온 후 결제를 진행해주세요.",
      );
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPlans();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPlans]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        const [membershipData, paymentData] = await Promise.all([
          getMyMembership(),
          getMyPayments(),
        ]);
        if (!alive) return;
        setMembership(membershipData);
        setPayments(paymentData);
      } catch (err) {
        if (!alive) return;
        setError(
          err instanceof Error
            ? err.message
            : "결제 정보를 불러오지 못했습니다.",
        );
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
    if (paying) return;
    if (!availablePlan) {
      setError(
        "이용권 가격을 확인할 수 없어 결제를 시작하지 못했습니다. 가격을 다시 불러와주세요.",
      );
      return;
    }
    setError("");

    if (!PORTONE_STORE_ID || !PORTONE_CHANNEL_KEY) {
      setError("포트원 결제 설정이 완료되지 않았습니다.");
      return;
    }

    try {
      setPaymentPhase("checkout");
      const checkout: CheckoutResult = await checkoutMembership(
        availablePlan.months,
      );
      const PortOne = await import("@portone/browser-sdk/v2");
      setPaymentPhase("portone");
      const response = await PortOne.requestPayment({
        storeId: PORTONE_STORE_ID,
        channelKey: PORTONE_CHANNEL_KEY,
        paymentId: checkout.paymentId,
        orderName: `자격증공장 재택근무반 ${checkout.planMonths}개월권`,
        totalAmount: checkout.amount,
        currency: "CURRENCY_KRW",
        payMethod: "CARD",
        customer: {
          fullName: session?.user.name,
          phoneNumber: session?.user.phone ?? undefined,
        },
        redirectUrl: `${window.location.origin}/payments/success`,
      });

      if (!response) {
        setError("결제가 취소되었습니다.");
        setPaymentPhase("idle");
        return;
      }

      if (response.code) {
        if (isAlreadyPaidPaymentError(response.message)) {
          navigate(
            "/payments/success?" +
              new URLSearchParams({ paymentId: checkout.paymentId }).toString(),
          );
          return;
        }
        setError(response.message ?? "결제에 실패했습니다.");
        setPaymentPhase("idle");
        return;
      }

      const successParams = new URLSearchParams({
        paymentId: response.paymentId,
      });
      const paymentKey = (response as { paymentKey?: string }).paymentKey;
      if (paymentKey) successParams.set("paymentKey", paymentKey);
      navigate("/payments/success?" + successParams.toString());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "결제를 시작하지 못했습니다.",
      );
      setPaymentPhase("idle");
    }
  }

  const paidPayments = payments.filter((p) => p.status === "PAID");
  const visiblePayments = showAllPayments
    ? paidPayments
    : paidPayments.slice(0, 3);
  const backPath = canEnterWaitingRoom ? "/waiting-room" : "/my-page";
  const backLabel = canEnterWaitingRoom ? "대기장" : "내 정보";
  const selectedMonthly = availablePlan
    ? Math.round(availablePlan.total / availablePlan.months)
    : 0;
  const baseMonthly = plans.find((plan) => plan.months === 1)?.total ?? 0;
  const projectedEnd = projectedMembershipEndText(
    membership,
    availablePlan,
    hasValidMembership,
  );

  return (
    <div className="pay">
      <header className="pay-head">
        <button onClick={() => navigate(backPath)} type="button">
          <ArrowBackIcon /> {backLabel}
        </button>
        <h1>결제/이용내역</h1>
        <span aria-hidden="true" />
      </header>

      <main className="pay-body">
        {error && <p className="pay-error">{error}</p>}
        {paying && (
          <p className="pay-status" aria-live="polite">
            {paymentPhaseText(paymentPhase)}
          </p>
        )}

        <section className="pay-ticket">
          <div className="pay-ticket-metrics">
            <div className="pay-ticket-metric is-days">
              <span>남은 기간</span>
              <strong>{ticketBadge}</strong>
              <small>{ticketSubtext}</small>
            </div>
            <div className="pay-ticket-metric">
              <span>시작일</span>
              <strong>{dateText(membership?.startDate)}</strong>
            </div>
            <div className="pay-ticket-metric">
              <span>만료일</span>
              <strong>{membershipEndText(membership?.membershipEnd)}</strong>
            </div>
          </div>
        </section>

        {notice && (
          <section className="pay-pending-start">
            <strong>{notice.title}</strong>
            <p>{notice.body}</p>
          </section>
        )}

        <section className="pay-fees">
          <h2>이용권 선택</h2>
          <p className="pay-fees-copy">남은 기간 뒤로 누적 적용돼요</p>
          {plansLoading ? (
            <p className="pay-plan-state" aria-live="polite">
              이용권 가격을 확인하는 중입니다.
            </p>
          ) : plansError ? (
            <p className="pay-plan-state is-error" role="alert">
              <span>{plansError}</span>
              <button onClick={() => void loadPlans()} type="button">
                다시 불러오기
              </button>
            </p>
          ) : (
            <div>
              {plans.map((plan) => {
                const monthly = Math.round(plan.total / plan.months);
                const discount =
                  baseMonthly > monthly ? baseMonthly - monthly : 0;
                return (
                  <button
                    className={selected === plan.months ? "is-active" : ""}
                    key={plan.months}
                    onClick={() => setSelected(plan.months)}
                    type="button"
                  >
                    <i aria-hidden="true" />
                    <span className="pay-plan-term">
                      <strong>{plan.months}달</strong>
                      {discount > 0 && (
                        <small className="pay-plan-discount">
                          월 {money(discount)} 할인
                        </small>
                      )}
                    </span>
                    <b className="pay-plan-price">
                      {money(plan.total)}
                      <small>월 {money(monthly)}</small>
                    </b>
                  </button>
                );
              })}
            </div>
          )}
          <p className="pay-fee-note">모든 금액은 부가세 포함 금액이에요</p>
        </section>

        <section className="pay-summary">
          <div className="pay-summary-head">
            <span>선택한 이용권</span>
            <strong>
              {availablePlan ? `${availablePlan.months}개월권` : "가격 확인 필요"}
            </strong>
          </div>
          <dl className="pay-summary-list">
            <div>
              <dt>이용 기간</dt>
              <dd>{availablePlan ? `${availablePlan.months}개월` : "-"}</dd>
            </div>
            <div>
              <dt>적용 후 만료일</dt>
              <dd>{projectedEnd}</dd>
            </div>
          </dl>
          <div className="pay-summary-total">
            <span>결제 금액</span>
            <strong>{availablePlan ? money(availablePlan.total) : "-"}</strong>
            <small>월 {selectedMonthly ? money(selectedMonthly) : "-"}</small>
          </div>
          <button
            className="pay-extend"
            disabled={
              paying ||
              loading ||
              plansLoading ||
              Boolean(plansError) ||
              !availablePlan
            }
            onClick={startPayment}
            type="button"
          >
            {plansLoading
              ? "가격 확인 중..."
              : plansError || !availablePlan
                ? "가격 확인 필요"
                : paying
                  ? paymentPhaseText(paymentPhase)
                  : hasValidMembership
                    ? "결제수단으로 연장하기"
                    : "결제수단으로 결제하기"}
          </button>
          <p className="pay-safe-line">
            결제는 포트원(PG)을 통해 안전하게 처리돼요
          </p>
        </section>

        <section className="pay-alert">
          <HeadsetMicOutlinedIcon />
          <div>
            <strong>만료 5일 전부터 미리 알려드려요</strong>
            <p>5일 · 3일 · 1일 · 당일에 알림을 보내드려요</p>
          </div>
        </section>

        <section className="pay-history">
          <div className="pay-history-head">
            <div>
              <span>지난 결제내역</span>
              <h2>최근 결제 기록</h2>
            </div>
            {paidPayments.length > 3 && (
              <button
                className="pay-history-toggle"
                onClick={() => setShowAllPayments((value) => !value)}
                type="button"
              >
                {showAllPayments ? "접기" : "전체 보기"}
              </button>
            )}
          </div>
          <div
            className={
              showAllPayments ? "pay-history-list is-open" : "pay-history-list"
            }
          >
            {paidPayments.length === 0 && (
              <p className="pay-empty">아직 완료된 결제내역이 없습니다.</p>
            )}
            {visiblePayments.map((payment) => (
              <div className="pay-row" key={payment.id}>
                <div>
                  <strong>{dateText(payment.createdAt)}</strong>
                  <span>
                    {payment.planMonths}개월 · {money(payment.amount)}
                  </span>
                </div>
                <em>
                  {payment.status === "PAID" ? "결제완료" : payment.status}
                </em>
                <ReceiptLongOutlinedIcon />
                {payment.receiptSignedUrl ? (
                  <a
                    href={payment.receiptSignedUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    영수증 보기
                  </a>
                ) : (
                  <button type="button" disabled>
                    영수증 준비중
                  </button>
                )}
              </div>
            ))}
          </div>
          {paidPayments.length > 3 && !showAllPayments && (
            <p className="pay-history-more">
              총 {paidPayments.length}건 중 최근 3건만 표시 중입니다.
            </p>
          )}
        </section>
      </main>

      <p className="app-foot">자격증공장 재택근무반</p>
    </div>
  );
}
