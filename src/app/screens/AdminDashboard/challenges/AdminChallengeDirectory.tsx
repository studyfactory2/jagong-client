import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import type { RefObject } from "react";
import type { AdminStudyChallengeListResult } from "../../../../lib/types";
import AdminPager from "../AdminPager";
import {
  STATUS_OPTIONS,
  displayedPendingWeekCount,
  displayedUnstartedWeekCount,
  durationText,
  memberMeta,
  periodText,
  statusLabel,
  type ChallengeStatusFilter,
} from "./admin-challenge.helpers";

type AdminChallengeDirectoryProps = {
  searchText: string;
  statusFilter: ChallengeStatusFilter;
  result: AdminStudyChallengeListResult;
  selectedId: string;
  loading: boolean;
  error: string;
  selectedRowRef: RefObject<HTMLButtonElement | null>;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: ChallengeStatusFilter) => void;
  onSelect: (challengeId: string) => void;
  onPageChange: (page: number) => void;
};

export default function AdminChallengeDirectory({
  searchText,
  statusFilter,
  result,
  selectedId,
  loading,
  error,
  selectedRowRef,
  onSearchChange,
  onStatusChange,
  onSelect,
  onPageChange,
}: AdminChallengeDirectoryProps) {
  return (
    <aside className="admin-challenge-directory">
      <div className="admin-challenge-filters">
        <label className="admin-challenge-search">
          <span>참여자 검색</span>
          <div>
            <SearchOutlinedIcon />
            <input
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="회원명, 연락처 또는 시험"
              type="search"
              value={searchText}
            />
          </div>
        </label>
        <label className="admin-challenge-status-filter">
          <span>도전 상태</span>
          <select
            onChange={(event) =>
              onStatusChange(event.target.value as ChallengeStatusFilter)
            }
            value={statusFilter}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p className="admin-challenge-error" role="alert">
          {error}
        </p>
      )}

      <div
        aria-busy={loading}
        aria-label="도전 참여자 목록"
        className="admin-challenge-list"
      >
        {loading && !result.list.length && (
          <span className="admin-challenge-list-state">
            참여자 목록을 불러오는 중입니다.
          </span>
        )}

        {!loading && !error && !result.list.length && (
          <span className="admin-challenge-list-state">
            조건에 맞는 도전 참여자가 없습니다.
          </span>
        )}

        {result.list.map((item) => (
          <button
            aria-pressed={item.id === selectedId}
            className={`admin-challenge-list-item${item.id === selectedId ? " is-selected" : ""}`}
            key={item.id}
            onClick={() => onSelect(item.id)}
            ref={item.id === selectedId ? selectedRowRef : undefined}
            type="button"
          >
            <span aria-hidden="true" className="admin-challenge-avatar">
              {item.member.name.slice(0, 1)}
            </span>
            <span className="admin-challenge-list-person">
              <strong>{item.member.name}</strong>
              <small>{memberMeta(item) || "회원 정보 없음"}</small>
            </span>
            <em
              className={`admin-challenge-status is-${item.status.toLowerCase()}`}
            >
              {statusLabel(item.status)}
            </em>
            <span className="admin-challenge-list-period">
              {periodText(item.startsAt, item.endsAtExclusive)}
            </span>
            <span className="admin-challenge-list-progress">
              <b>
                달성 {item.weekSummary.passed} · 미달 {item.weekSummary.failed}
                · 미진행 {displayedUnstartedWeekCount(item)} · 대기{" "}
                {displayedPendingWeekCount(item)}
              </b>
              <small>
                {item.currentWeekNumber
                  ? `현재 ${item.currentWeekNumber}주차`
                  : `정산 ${durationText(item.weekSummary.finalizedStudySeconds)}`}
              </small>
            </span>
            <i aria-hidden="true">›</i>
          </button>
        ))}
      </div>

      <AdminPager meta={result} numbered onPageChange={onPageChange} />
    </aside>
  );
}
