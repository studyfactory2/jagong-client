import { useCallback, useEffect, useRef, useState } from "react";
import NightsStayOutlinedIcon from "@mui/icons-material/NightsStayOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import type { OvernightVoluntaryStudyReport } from "../../../lib/types";
import { getMemberOvernightVoluntaryStudy } from "../../services/study-statistics.service";
import {
  addDaysDateOnly,
  formatDateInputForDisplay,
  todayDateInputValue,
} from "./admin.utils";

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
  const remainder = safeSeconds % 60;

  return [hours, minutes, remainder]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatInstant(value?: string | null): string {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "--"
    : seoulDateTimeFormatter.format(date);
}

function reportWindowLabel(report: OvernightVoluntaryStudyReport): string {
  const previousDate = addDaysDateOnly(report.date, -1);
  return `${formatDateInputForDisplay(previousDate)} 22:00 – ${formatDateInputForDisplay(report.date)} 09:00`;
}

function reportComplete(report: OvernightVoluntaryStudyReport): boolean {
  const countedThrough = new Date(report.countedThroughAt).getTime();
  const windowEnd = new Date(report.window.endsAtExclusive).getTime();
  return Number.isFinite(countedThrough) && countedThrough >= windowEnd;
}

export default function MemberOvernightStudyReport({
  memberId,
}: {
  memberId: string;
}) {
  const [date, setDate] = useState(todayDateInputValue);
  const [report, setReport] = useState<OvernightVoluntaryStudyReport | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);
  const maxDate = todayDateInputValue();

  const loadReport = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!date) {
      setReport(null);
      setLoading(false);
      setError("조회 날짜를 선택해 주세요.");
      return;
    }

    setLoading(true);
    setError("");
    setReport(null);

    try {
      const response = await getMemberOvernightVoluntaryStudy(memberId, date);
      if (requestId !== requestIdRef.current) return;
      setReport(response);
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "야간 자율학습 기록을 불러오지 못했습니다.",
      );
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [date, memberId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadReport(), 0);
    return () => {
      window.clearTimeout(timer);
      requestIdRef.current += 1;
    };
  }, [loadReport]);

  function changeDate(nextDate: string) {
    requestIdRef.current += 1;
    setDate(nextDate);
    setReport(null);
    setError("");
  }

  const complete = report ? reportComplete(report) : false;

  return (
    <section
      aria-busy={loading}
      className="admin-member-overnight"
      aria-labelledby="admin-member-overnight-title"
    >
      <header className="admin-member-overnight-head">
        <span aria-hidden="true">
          <NightsStayOutlinedIcon />
        </span>
        <div>
          <strong id="admin-member-overnight-title">야간 자율학습</strong>
          <small>전날 22:00부터 선택일 09:00까지 집계합니다.</small>
        </div>
      </header>

      <div className="admin-member-overnight-toolbar">
        <label>
          <span>오전 종료일</span>
          <input
            max={maxDate}
            onChange={(event) => changeDate(event.target.value)}
            required
            type="date"
            value={date}
          />
        </label>
        <button
          aria-label="야간 자율학습 기록 새로고침"
          className="admin-member-overnight-refresh"
          disabled={loading || !date}
          onClick={() => void loadReport()}
          type="button"
        >
          <RefreshOutlinedIcon />
          <span>{loading ? "조회 중" : "새로고침"}</span>
        </button>
      </div>

      {loading ? (
        <p className="admin-member-overnight-message" role="status">
          야간 자율학습 기록을 불러오는 중입니다.
        </p>
      ) : error ? (
        <div className="admin-member-overnight-error" role="alert">
          <p>{error}</p>
          <button onClick={() => void loadReport()} type="button">
            다시 시도
          </button>
        </div>
      ) : report ? (
        <div className="admin-member-overnight-content">
          <div className="admin-member-overnight-window">
            <span>{reportWindowLabel(report)}</span>
            <em className={complete ? "is-complete" : "is-progress"}>
              {complete ? "집계 완료" : "집계 중"}
            </em>
          </div>

          <div className="admin-member-overnight-summary">
            <div className="is-total">
              <span>총 공부시간</span>
              <strong>{formatDuration(report.studySeconds)}</strong>
            </div>
            <div>
              <span>공부 구간</span>
              <strong>{report.studyBlockCount}회</strong>
            </div>
            <div>
              <span>최장 연속</span>
              <strong>
                {formatDuration(report.longestContinuousStudySeconds)}
              </strong>
            </div>
            <div>
              <span>첫 시작 / 마지막 집계</span>
              <strong>
                {formatInstant(report.firstStudyStartedAt)}
                <i aria-hidden="true">→</i>
                {formatInstant(report.lastStudyEndedAtExclusive)}
              </strong>
            </div>
          </div>

          <p className="admin-member-overnight-counted">
            집계 기준 {formatInstant(report.countedThroughAt)}
          </p>

          {report.blocks.length === 0 ? (
            <p className="admin-member-overnight-empty">
              해당 야간 자율학습 기록이 없습니다.
            </p>
          ) : (
            <div className="admin-member-overnight-blocks">
              <strong>공부 구간 상세</strong>
              <ol>
                {report.blocks.map((block, index) => (
                  <li key={`${block.startsAt}-${block.endsAtExclusive}`}>
                    <span>{index + 1}</span>
                    <p>
                      <strong>
                        {formatInstant(block.startsAt)} –{" "}
                        {formatInstant(block.endsAtExclusive)}
                      </strong>
                      <small>{formatDuration(block.studySeconds)}</small>
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
