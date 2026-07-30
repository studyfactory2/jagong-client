import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import CheckIcon from "@mui/icons-material/Check";
import {
  confirmPublicPayment,
  getPublicCheckout,
} from "../../services/membership.service";
import BusinessFooter from "../../components/ui/BusinessFooter";
import { PORTONE_CHANNEL_KEY, PORTONE_STORE_ID } from "../../../lib/config";
import type {
  ConsultationCheckoutRecord,
  PublicPaymentResult,
} from "../../../lib/types";
import "./consultation-checkout.css";

function money(value: number): string {
  return value.toLocaleString("ko-KR") + "원";
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

function isAlreadyPaidPaymentError(message?: string | null): boolean {
  const value = (message ?? "").toLowerCase();
  return value.includes("이미 결제") || value.includes("already paid");
}

export default function ConsultationCheckout() {
  const { paymentId = "" } = useParams();
  return (
    <ConsultationCheckoutContent key={paymentId} paymentId={paymentId} />
  );
}

function ConsultationCheckoutContent({ paymentId }: { paymentId: string }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mountedRef = useRef(true);
  const confirmAttemptRef = useRef(0);
  const confirmingPaymentIdRef = useRef<string | null>(null);
  const [checkout, setCheckout] = useState<ConsultationCheckoutRecord | null>(
    null,
  );
  const [confirmedPayment, setConfirmedPayment] =
    useState<PublicPaymentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const returnedCode = params.get("code");
  const returnedMessage = params.get("message");
  const returnedPaymentId = params.get("paymentId") ?? params.get("orderId");
  const returnedPaymentKey = params.get("paymentKey") ?? undefined;
  const hasReturnedPayment = Boolean(returnedPaymentId);
  const hasPaymentMismatch = Boolean(
    returnedPaymentId && returnedPaymentId !== paymentId,
  );
  const urlError = returnedCode
    ? (returnedMessage ?? "결제가 완료되지 않았습니다.")
    : hasPaymentMismatch
      ? "결제 승인 정보가 현재 결제 링크와 일치하지 않습니다."
      : "";
  const checkoutForRoute = checkout?.id === paymentId ? checkout : null;
  const confirmedPaymentForRoute =
    confirmedPayment?.id === paymentId ? confirmedPayment : null;
  const displayError = urlError || error;
  const paymentSummary = confirmedPaymentForRoute ?? checkoutForRoute;
  const isPaid = paymentSummary?.status === "PAID";
  const canPay =
    !confirmedPaymentForRoute && checkoutForRoute?.status === "PENDING";
  const orderName = useMemo(() => {
    if (!paymentSummary) return "자격증공장 재택근무반 이용권";
    return (
      "자격증공장 재택근무반 " + paymentSummary.planMonths + "개월권"
    );
  }, [paymentSummary]);

  useEffect(
    () => () => {
      mountedRef.current = false;
      confirmAttemptRef.current += 1;
      confirmingPaymentIdRef.current = null;
    },
    [],
  );

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!paymentId) return;
      if (hasReturnedPayment && !urlError) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await getPublicCheckout(paymentId);
        if (!alive) return;
        setCheckout(data);
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
  }, [hasReturnedPayment, paymentId, urlError]);

  useEffect(() => {
    if (urlError || !hasReturnedPayment) return;
    confirm(paymentId, returnedPaymentKey);
  }, [hasReturnedPayment, paymentId, returnedPaymentKey, urlError]);

  async function confirm(id: string, pgKey?: string) {
    if (!id || confirmingPaymentIdRef.current === id) return;
    const attempt = confirmAttemptRef.current + 1;
    confirmAttemptRef.current = attempt;
    confirmingPaymentIdRef.current = id;
    const isCurrentAttempt = () =>
      mountedRef.current && confirmAttemptRef.current === attempt;

    try {
      setPaying(true);
      setError("");
      setMessage("결제 완료를 확인하는 중입니다.");
      const payment = await confirmPublicPayment({ paymentId: id, pgKey });
      if (!isCurrentAttempt()) return;
      setConfirmedPayment(payment);
      setCheckout((current) =>
        current?.id === id
          ? {
              ...current,
              status: payment.status,
              planMonths: payment.planMonths,
              amount: payment.amount,
              periodStart: payment.periodStart,
              periodEnd: payment.periodEnd,
            }
          : current,
      );
      setMessage("결제가 완료되었습니다. 상담 담당자가 사전등록을 진행합니다.");
    } catch (err) {
      if (!isCurrentAttempt()) return;
      setMessage("");
      setError(
        err instanceof Error ? err.message : "결제 승인에 실패했습니다.",
      );
    } finally {
      if (isCurrentAttempt()) setPaying(false);
      if (confirmingPaymentIdRef.current === id) {
        confirmingPaymentIdRef.current = null;
      }
    }
  }

  async function startPayment() {
    if (
      !checkoutForRoute ||
      paying ||
      checkoutForRoute.status !== "PENDING"
    ) {
      return;
    }
    setError("");
    setMessage("");

    if (!PORTONE_STORE_ID || !PORTONE_CHANNEL_KEY) {
      setError("포트원 결제 설정이 완료되지 않았습니다.");
      return;
    }

    try {
      setPaying(true);
      setMessage("결제창을 여는 중입니다.");
      const PortOne = await import("@portone/browser-sdk/v2");
      const response = await PortOne.requestPayment({
        storeId: PORTONE_STORE_ID,
        channelKey: PORTONE_CHANNEL_KEY,
        paymentId: checkoutForRoute.id,
        orderName,
        totalAmount: checkoutForRoute.amount,
        currency: "CURRENCY_KRW",
        payMethod: "CARD",
        customer: {
          fullName: checkoutForRoute.consultation.name,
        },
        redirectUrl: window.location.href.split("?")[0],
      });

      if (!response) {
        setMessage("");
        setError("결제가 취소되었습니다.");
        return;
      }
      if (response.code) {
        if (isAlreadyPaidPaymentError(response.message)) {
          await confirm(checkoutForRoute.id);
          return;
        }
        setMessage("");
        setError(response.message ?? "결제에 실패했습니다.");
        return;
      }
      if (response.paymentId !== checkoutForRoute.id) {
        setMessage("");
        setError("결제 승인 정보가 현재 결제 링크와 일치하지 않습니다.");
        return;
      }
      await confirm(checkoutForRoute.id);
    } catch (err) {
      setMessage("");
      setError(
        err instanceof Error ? err.message : "결제를 시작하지 못했습니다.",
      );
    } finally {
      setPaying(false);
    }
  }

  return (
    <main className="guest-checkout">
      <header>
        <button onClick={() => navigate("/login")} type="button">
          <ArrowBackIcon /> 로그인
        </button>
        <h1>상담 결제</h1>
        <span />
      </header>

      <section className="guest-checkout-card">
        {loading && (
          <p className="checkout-muted">결제 정보를 불러오는 중입니다.</p>
        )}
        {displayError && <p className="checkout-error">{displayError}</p>}
        {message && <p className="checkout-status">{message}</p>}

        {checkoutForRoute && (
          <>
            <div className="checkout-title-row">
              {isPaid ? <CheckIcon /> : <CreditCardOutlinedIcon />}
              <div>
                <strong>{orderName}</strong>
                <p>
                  {checkoutForRoute.consultation.name}님 상담 결제
                  {checkoutForRoute.consultation.phoneLast4
                    ? " · 연락처 끝자리 " +
                      checkoutForRoute.consultation.phoneLast4
                    : ""}
                </p>
              </div>
              <span className={isPaid ? "is-paid" : "is-pending"}>
                {isPaid ? "결제완료" : "결제대기"}
              </span>
            </div>

            <dl className="checkout-info">
              <div>
                <dt>이용 시작일</dt>
                <dd>{dateText(checkoutForRoute.periodStart)}</dd>
              </div>
              <div>
                <dt>이용 종료일</dt>
                <dd>{membershipEndText(checkoutForRoute.periodEnd)}</dd>
              </div>
              <div>
                <dt>상담 일정</dt>
                <dd>
                  {checkoutForRoute.consultation.desiredDate ?? "-"} ·{" "}
                  {checkoutForRoute.consultation.timeSlot ?? "-"}
                </dd>
              </div>
              <div>
                <dt>결제 금액</dt>
                <dd>{money(checkoutForRoute.amount)}</dd>
              </div>
            </dl>

            <button
              className="checkout-pay-button"
              disabled={paying || !canPay}
              onClick={startPayment}
              type="button"
            >
              {isPaid
                ? "결제 완료"
                : paying
                  ? "처리 중..."
                  : canPay
                    ? "결제수단으로 결제하기"
                    : "결제할 수 없는 링크"}
            </button>

            <p className="checkout-note">
              결제 완료 후 담당자가 사전등록을 진행합니다. 회원가입은 사전등록
              후 가능합니다.
            </p>
          </>
        )}

        {!checkoutForRoute && confirmedPaymentForRoute && (
          <>
            <div className="checkout-title-row">
              <CheckIcon />
              <div>
                <strong>{orderName}</strong>
                <p>상담 결제</p>
              </div>
              <span className="is-paid">결제완료</span>
            </div>

            <dl className="checkout-info">
              <div>
                <dt>이용 시작일</dt>
                <dd>{dateText(confirmedPaymentForRoute.periodStart)}</dd>
              </div>
              <div>
                <dt>이용 종료일</dt>
                <dd>{membershipEndText(confirmedPaymentForRoute.periodEnd)}</dd>
              </div>
              <div>
                <dt>결제 금액</dt>
                <dd>{money(confirmedPaymentForRoute.amount)}</dd>
              </div>
            </dl>

            <button className="checkout-pay-button" disabled type="button">
              결제 완료
            </button>

            <p className="checkout-note">
              결제 완료 후 담당자가 사전등록을 진행합니다. 회원가입은 사전등록
              후 가능합니다.
            </p>
          </>
        )}
      </section>

      <BusinessFooter />
    </main>
  );
}
