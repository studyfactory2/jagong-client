import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import CheckIcon from "@mui/icons-material/Check";
import { confirmMembershipPayment } from "../../services/membership.service";
import "./payment-result.css";

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [message, setMessage] = useState("결제 승인 중입니다.");
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    async function confirm() {
      const paymentKey = params.get("paymentKey");
      const orderId = params.get("orderId");

      if (!paymentKey || !orderId) {
        setFailed(true);
        setMessage("결제 승인 정보가 올바르지 않습니다.");
        return;
      }

      try {
        await confirmMembershipPayment({
          paymentId: orderId,
          pgKey: paymentKey,
        });
        if (!alive) return;
        setDone(true);
        setMessage("결제가 완료되었고 이용기간이 연장되었습니다.");
      } catch (err) {
        if (!alive) return;
        setFailed(true);
        setMessage(err instanceof Error ? err.message : "결제 승인에 실패했습니다.");
      }
    }
    confirm();
    return () => {
      alive = false;
    };
  }, [params]);

  return (
    <main className="pay-result">
      <section>
        <CheckIcon className={failed ? "is-failed" : ""} />
        <h1>{failed ? "결제 확인 필요" : done ? "결제 완료" : "결제 승인중"}</h1>
        <p>{message}</p>
        <button onClick={() => navigate("/payments")} type="button">
          이용내역으로 돌아가기
        </button>
      </section>
    </main>
  );
}
