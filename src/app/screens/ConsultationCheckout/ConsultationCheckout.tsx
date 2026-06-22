import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import CheckIcon from "@mui/icons-material/Check";
import {
  confirmPublicPayment,
  getPublicCheckout,
} from "../../services/membership.service";
import { PORTONE_CHANNEL_KEY, PORTONE_STORE_ID } from "../../../lib/config";
import type { ConsultationCheckoutRecord } from "../../../lib/types";
import "./consultation-checkout.css";

function money(value: number): string {
  return value.toLocaleString("ko-KR") + "원";
}

function dateText(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export default function ConsultationCheckout() {
  const navigate = useNavigate();
  const { paymentId = "" } = useParams();
  const [params] = useSearchParams();
  const confirmingRef = useRef(false);
  const [checkout, setCheckout] = useState<ConsultationCheckoutRecord | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isPaid = checkout?.status === "PAID";
  const canPay = checkout?.status === "PENDING";
  const orderName = useMemo(() => {
    if (!checkout) return "자격증공장 재택근무반 이용권";
    return "자격증공장 재택근무반 " + checkout.planMonths + "개월권";
  }, [checkout]);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!paymentId) return;
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
  }, [paymentId]);

  useEffect(() => {
    const code = params.get("code");
    const messageText = params.get("message");
    const returnedPaymentId =
      params.get("paymentId") ?? params.get("orderId") ?? paymentId;
    const paymentKey = params.get("paymentKey") ?? undefined;

    if (code) {
      setError(messageText ?? "결제가 완료되지 않았습니다.");
      return;
    }
    if (!params.has("paymentId") && !params.has("orderId")) return;
    confirm(returnedPaymentId, paymentKey);
  }, [params, paymentId]);

  async function confirm(id: string, pgKey?: string) {
    if (!id || confirmingRef.current) return;
    confirmingRef.current = true;
    try {
      setPaying(true);
      setMessage("결제 완료를 확인하는 중입니다.");
      const payment = await confirmPublicPayment({ paymentId: id, pgKey });
      const data = await getPublicCheckout(payment.id);
      setCheckout(data);
      setMessage("결제가 완료되었습니다. 상담 담당자가 사전등록을 진행합니다.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "결제 승인에 실패했습니다.",
      );
    } finally {
      setPaying(false);
      confirmingRef.current = false;
    }
  }

  async function startPayment() {
    if (!checkout || paying || checkout.status !== "PENDING") return;
    setError("");
    setMessage("");

    if (!PORTONE_STORE_ID || !PORTONE_CHANNEL_KEY) {
      setError("포트원 결제 설정이 완료되지 않았습니다.");
      return;
    }

    try {
      setPaying(true);
      setMessage("카드 결제창을 여는 중입니다.");
      const PortOne = await import("@portone/browser-sdk/v2");
      const response = await PortOne.requestPayment({
        storeId: PORTONE_STORE_ID,
        channelKey: PORTONE_CHANNEL_KEY,
        paymentId: checkout.id,
        orderName,
        totalAmount: checkout.amount,
        currency: "CURRENCY_KRW",
        payMethod: "CARD",
        customer: {
          fullName: checkout.consultation.name,
        },
        redirectUrl: window.location.href.split("?")[0],
      });

      if (!response) {
        setError("결제가 취소되었습니다.");
        return;
      }
      if (response.code) {
        setError(response.message ?? "결제에 실패했습니다.");
        return;
      }
      await confirm(response.paymentId);
    } catch (err) {
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
        {error && <p className="checkout-error">{error}</p>}
        {message && <p className="checkout-status">{message}</p>}

        {checkout && (
          <>
            <div className="checkout-title-row">
              {isPaid ? <CheckIcon /> : <CreditCardOutlinedIcon />}
              <div>
                <strong>{orderName}</strong>
                <p>
                  {checkout.consultation.name}님 상담 결제
                  {checkout.consultation.phoneLast4
                    ? " · 연락처 끝자리 " + checkout.consultation.phoneLast4
                    : ""}
                </p>
              </div>
              <span>{isPaid ? "결제완료" : "결제대기"}</span>
            </div>

            <dl className="checkout-info">
              <div>
                <dt>이용 시작일</dt>
                <dd>{dateText(checkout.periodStart)}</dd>
              </div>
              <div>
                <dt>이용 만료일</dt>
                <dd>{dateText(checkout.periodEnd)}</dd>
              </div>
              <div>
                <dt>상담 일정</dt>
                <dd>
                  {checkout.consultation.desiredDate ?? "-"} ·{" "}
                  {checkout.consultation.timeSlot ?? "-"}
                </dd>
              </div>
              <div>
                <dt>결제 금액</dt>
                <dd>{money(checkout.amount)}</dd>
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
                    ? "카드로 결제하기"
                    : "결제할 수 없는 링크"}
            </button>

            <p className="checkout-note">
              결제 완료 후 담당자가 사전등록을 진행합니다. 회원가입은 사전등록
              후 가능합니다.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
