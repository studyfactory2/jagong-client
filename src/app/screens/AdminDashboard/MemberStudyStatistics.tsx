import { useCallback, useEffect, useRef, useState } from "react";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import type { MyStudyStatistics } from "../../../lib/types";
import { getMemberStudyStatistics } from "../../services/study-statistics.service";

const seoulDateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return `${hours}시간 ${String(minutes).padStart(2, "0")}분`;
}

function formatGeneratedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "--"
    : seoulDateTimeFormatter.format(date);
}

export default function MemberStudyStatistics({
  memberId,
}: {
  memberId: string;
}) {
  const [statistics, setStatistics] = useState<MyStudyStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  const loadStatistics = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");

    try {
      const response = await getMemberStudyStatistics(memberId);
      if (requestId !== requestIdRef.current) return;
      setStatistics(response);
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "공부시간을 불러오지 못했습니다.",
      );
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadStatistics(), 0);
    return () => {
      window.clearTimeout(timer);
      requestIdRef.current += 1;
    };
  }, [loadStatistics]);

  return (
    <section
      aria-busy={loading}
      aria-labelledby="admin-member-study-statistics-title"
      className="admin-member-study-statistics"
    >
      <header className="admin-member-study-statistics-head">
        <span aria-hidden="true">
          <AccessTimeOutlinedIcon />
        </span>
        <div>
          <strong id="admin-member-study-statistics-title">공부시간</strong>
          <small>실제로 기록된 공부시간만 집계합니다.</small>
        </div>
        <button
          aria-label="회원 공부시간 새로고침"
          disabled={loading}
          onClick={() => void loadStatistics()}
          type="button"
        >
          <RefreshOutlinedIcon />
        </button>
      </header>

      {loading && !statistics ? (
        <p className="admin-member-study-statistics-message" role="status">
          공부시간을 불러오는 중입니다.
        </p>
      ) : error ? (
        <div className="admin-member-study-statistics-error" role="alert">
          <p>{error}</p>
          <button onClick={() => void loadStatistics()} type="button">
            다시 시도
          </button>
        </div>
      ) : statistics ? (
        <>
          <div className="admin-member-study-statistics-summary">
            <div className="is-today">
              <span>오늘</span>
              <strong>{formatDuration(statistics.today.studySeconds)}</strong>
            </div>
            <div className="is-week">
              <span>이번 주</span>
              <strong>
                {formatDuration(statistics.currentWeek.studySeconds)}
              </strong>
            </div>
            <div className="is-month">
              <span>이번 달</span>
              <strong>
                {formatDuration(statistics.currentMonth.studySeconds)}
              </strong>
            </div>
          </div>
          <p className="admin-member-study-statistics-generated">
            집계 기준 {formatGeneratedAt(statistics.generatedAt)}
          </p>
        </>
      ) : null}
    </section>
  );
}
