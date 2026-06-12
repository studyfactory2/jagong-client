import { useNavigate, useSearchParams } from "react-router-dom";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import "./payment-result.css";

export default function PaymentFail() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const message =
    params.get("message") ?? "결제가 완료되지 않았습니다. 다시 시도해 주세요.";

  return (
    <main className="pay-result">
      <section>
        <ErrorOutlineIcon className="is-failed" />
        <h1>결제 실패</h1>
        <p>{message}</p>
        <button onClick={() => navigate("/payments")} type="button">
          다시 결제하기
        </button>
      </section>
    </main>
  );
}
