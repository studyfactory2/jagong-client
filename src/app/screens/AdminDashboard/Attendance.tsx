import { useCallback, useEffect, useMemo, useState } from "react";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import {
  getAdminAttendance,
  markAttendance,
} from "../../services/attendance.service";
import type {
  AdminUser,
  AttendanceRecord,
  AttendanceStatusName,
  TimetableSlot,
} from "../../../lib/types";

type AttendanceProps = {
  users: AdminUser[];
  timetable: TimetableSlot[];
};

type ReasonDialogState = {
  userId: string;
  userName: string;
  date: string;
  slots: number[];
  anchorSlot: number;
  reasonType: string;
  reason: string;
};

const STATUS_LABEL: Record<AttendanceStatusName, string> = {
  PRESENT: "출석",
  LATE: "지각",
  ABSENT: "결석",
  EXCUSED: "기타",
};

const STATUS_OPTIONS: Array<{
  value: AttendanceStatusName;
  label: string;
}> = [
  { value: "PRESENT", label: "출석" },
  { value: "LATE", label: "지각" },
  { value: "ABSENT", label: "결석" },
  { value: "EXCUSED", label: "기타" },
];

const REASON_TYPES = ["지각", "조퇴", "외출", "이동", "시험", "컨디션"];

const DEFAULT_STATUS_OPTION: {
  value: AttendanceStatusName;
  label: string;
} = {
  value: "PRESENT",
  label: "출석",
};

function todayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function recordKey(userId: string, slot: number) {
  return `${userId}:${slot}`;
}

function statusClass(status?: string) {
  return status ? `is-${status.toLowerCase()}` : "is-empty";
}

function isAttendanceStatus(value: string): value is AttendanceStatusName {
  return STATUS_OPTIONS.some((option) => option.value === value);
}

export default function Attendance({ users, timetable }: AttendanceProps) {
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{
    userId: string;
    slot: number;
  } | null>(null);
  const [paintStatus, setPaintStatus] =
    useState<AttendanceStatusName>("PRESENT");
  const [savingKey, setSavingKey] = useState("");
  const [reasonDialog, setReasonDialog] = useState<ReasonDialogState | null>(
    null,
  );
  const [reasonSaving, setReasonSaving] = useState(false);
  const [error, setError] = useState("");

  const workSlots = useMemo(
    () =>
      timetable
        .filter((slot) => !slot.isBreak)
        .sort((a, b) => a.slot - b.slot),
    [timetable],
  );

  const recordMap = useMemo(
    () =>
      new Map(
        records.map((record) => [
          recordKey(record.userId, record.slot),
          record,
        ]),
      ),
    [records],
  );

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return users.filter((user) => {
      if (user.role !== "MEMBER") return false;
      if (!keyword) return true;
      return [user.name, user.phone, user.examType, user.residenceArea]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [search, users]);

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await getAdminAttendance({ date: selectedDate });
      setRecords(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "출석 정보를 불러오지 못했습니다.",
      );
    }
  }, [selectedDate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function mergeUpdatedRecords(updatedRecords: AttendanceRecord[]) {
    setRecords((current) => {
      const next = [...current];
      updatedRecords.forEach((updated) => {
        const index = next.findIndex((record) => record.id === updated.id);
        if (index >= 0) next[index] = updated;
        else next.unshift(updated);
      });
      return next;
    });
  }

  async function saveAttendanceMark(input: {
    userId: string;
    date: string;
    slot: number;
    status: AttendanceStatusName;
    reasonType?: string;
    reason?: string;
  }) {
    return await markAttendance(input);
  }

  async function paintCell(userId: string, slot: number) {
    if (
      !userId ||
      !selectedDate ||
      !Number.isInteger(slot) ||
      !isAttendanceStatus(paintStatus)
    ) {
      setError("출석 저장값을 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요.");
      return;
    }

    const user = users.find((item) => item.id === userId);
    const key = recordKey(userId, slot);
    setSelected({ userId, slot });

    if (paintStatus === "EXCUSED") {
      const existing = recordMap.get(key);
      setReasonDialog({
        userId,
        userName: user?.name ?? "회원",
        date: selectedDate,
        slots: [slot],
        anchorSlot: slot,
        reasonType: existing?.reasonType || "컨디션",
        reason: existing?.reason || "",
      });
      return;
    }

    setSavingKey(key);
    setError("");
    try {
      const updated = await saveAttendanceMark({
        userId,
        date: selectedDate,
        slot,
        status: paintStatus,
      });
      mergeUpdatedRecords([updated]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "출석 상태를 저장하지 못했습니다.",
      );
    } finally {
      setSavingKey("");
    }
  }

  function toggleReasonSlot(slot: number) {
    setReasonDialog((current) => {
      if (!current) return current;
      const exists = current.slots.includes(slot);
      const slots = exists
        ? current.slots.filter((item) => item !== slot)
        : [...current.slots, slot].sort((a, b) => a - b);
      return { ...current, slots: slots.length > 0 ? slots : [slot] };
    });
  }

  function selectAllReasonSlots() {
    setReasonDialog((current) =>
      current
        ? { ...current, slots: workSlots.map((slot) => slot.slot) }
        : current,
    );
  }

  async function submitReasonDialog() {
    if (!reasonDialog || reasonDialog.slots.length === 0) return;
    const reasonType = reasonDialog.reasonType.trim();
    const reason = reasonDialog.reason.trim();
    if (!reasonType && !reason) {
      setError("기타 사유를 선택하거나 입력해 주세요.");
      return;
    }

    setReasonSaving(true);
    setError("");
    try {
      const updated = await Promise.all(
        reasonDialog.slots.map((slot) =>
          saveAttendanceMark({
            userId: reasonDialog.userId,
            date: reasonDialog.date,
            slot,
            status: "EXCUSED",
            reasonType,
            reason,
          }),
        ),
      );
      if (reasonDialog.date === selectedDate) mergeUpdatedRecords(updated);
      else setSelectedDate(reasonDialog.date);
      setSelected({
        userId: reasonDialog.userId,
        slot: reasonDialog.anchorSlot,
      });
      setReasonDialog(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "기타 사유를 저장하지 못했습니다.",
      );
    } finally {
      setReasonSaving(false);
    }
  }

  const selectedUser = users.find((user) => user.id === selected?.userId);
  const selectedSlot = workSlots.find((slot) => slot.slot === selected?.slot);
  const selectedPaint =
    STATUS_OPTIONS.find((option) => option.value === paintStatus) ??
    DEFAULT_STATUS_OPTION;
  const gridStyle = {
    gridTemplateColumns: `180px repeat(${workSlots.length}, minmax(84px, 1fr))`,
  };

  return (
    <section className="admin-card admin-attendance">
      <div className="admin-section-head">
        <div>
          <FactCheckOutlinedIcon />
          <span>출석 관리</span>
        </div>
        <p>스태프와 관리자가 교시별 출석을 확인하고 수정합니다.</p>
      </div>

      <div className="admin-att-toolbar">
        <label>
          날짜
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </label>
        <label className="admin-att-search">
          회원 검색
          <span>
            <SearchOutlinedIcon />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="이름, 연락처, 자격증, 지역 검색"
            />
          </span>
        </label>
      </div>

      {error && <p className="admin-error">{error}</p>}

      <div className="admin-att-editor">
        <div className="admin-att-brush-copy">
          <span>선택한 출석 상태</span>
          <strong>{selectedPaint.label}</strong>
          <p>
            기타는 사유 입력창이 열리고, 나머지 상태는 교시 칸을 누르면 바로
            저장됩니다.
          </p>
        </div>

        <div className="admin-att-actions">
          {STATUS_OPTIONS.map((option) => (
            <button
              aria-pressed={paintStatus === option.value}
              className={[
                "admin-att-status",
                statusClass(option.value),
                paintStatus === option.value ? "is-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={option.value}
              onClick={() => setPaintStatus(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="admin-att-last">
          <span>최근 수정</span>
          <strong>
            {selectedUser && selectedSlot
              ? `${selectedUser.name} · ${selectedSlot.label}`
              : "아직 선택한 칸이 없습니다"}
          </strong>
        </div>
      </div>

      <div className="admin-att-grid">
        <div className="admin-att-head" style={gridStyle}>
          <span>회원</span>
          {workSlots.map((slot) => (
            <span key={slot.slot}>{slot.label}</span>
          ))}
        </div>

        {filteredUsers.map((user) => (
          <div className="admin-att-row" key={user.id} style={gridStyle}>
            <div className="admin-att-user">
              <strong>{user.name}</strong>
              <span>{user.phone || "연락처 없음"}</span>
            </div>

            {workSlots.map((slot) => {
              const record = recordMap.get(recordKey(user.id, slot.slot));
              const isSelected =
                selected?.userId === user.id && selected.slot === slot.slot;
              const key = recordKey(user.id, slot.slot);
              const statusLabel = record
                ? STATUS_LABEL[record.status as AttendanceStatusName] ?? "확인"
                : "미기록";
              const excuseReason =
                record?.status === "EXCUSED"
                  ? record.reason?.trim() || record.reasonType?.trim() || ""
                  : "";
              const cellLabel = excuseReason || statusLabel;

              return (
                <button
                  className={[
                    "admin-att-cell",
                    statusClass(record?.status),
                    isSelected ? "is-selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={savingKey === key}
                  data-slot={slot.label}
                  key={slot.slot}
                  onClick={() => void paintCell(user.id, slot.slot)}
                  title={`${user.name} ${slot.label} ${cellLabel}`}
                  type="button"
                >
                  <span>{cellLabel}</span>
                </button>
              );
            })}
          </div>
        ))}

        {filteredUsers.length === 0 && (
          <p className="admin-att-empty">조건에 맞는 회원이 없습니다.</p>
        )}
      </div>

      {reasonDialog && (
        <div className="admin-att-modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="admin-att-modal"
            role="dialog"
          >
            <header>
              <span>기타 사유 입력</span>
              <strong>{reasonDialog.userName}</strong>
            </header>

            <label className="admin-att-modal-date">
              날짜
              <input
                type="date"
                value={reasonDialog.date}
                onChange={(event) =>
                  setReasonDialog((current) =>
                    current ? { ...current, date: event.target.value } : current,
                  )
                }
              />
            </label>

            <div className="admin-att-modal-block">
              <span>교시</span>
              <div className="admin-att-modal-slots">
                {workSlots.map((slot) => (
                  <button
                    className={
                      reasonDialog.slots.includes(slot.slot) ? "is-active" : ""
                    }
                    key={slot.slot}
                    onClick={() => toggleReasonSlot(slot.slot)}
                    type="button"
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
              <button
                className="admin-att-modal-secondary"
                onClick={selectAllReasonSlots}
                type="button"
              >
                전체 선택
              </button>
            </div>

            <div className="admin-att-modal-block">
              <span>사유 선택</span>
              <div className="admin-att-reasons">
                {REASON_TYPES.map((reasonType) => (
                  <button
                    className={
                      reasonDialog.reasonType === reasonType ? "is-active" : ""
                    }
                    key={reasonType}
                    onClick={() =>
                      setReasonDialog((current) =>
                        current ? { ...current, reasonType } : current,
                      )
                    }
                    type="button"
                  >
                    {reasonType}
                  </button>
                ))}
              </div>
            </div>

            <label className="admin-att-modal-reason">
              사유 입력
              <input
                placeholder="예: 아픔, 병원 방문, 가족 일정"
                value={reasonDialog.reason}
                onChange={(event) =>
                  setReasonDialog((current) =>
                    current
                      ? { ...current, reason: event.target.value }
                      : current,
                  )
                }
              />
            </label>

            <div className="admin-att-modal-actions">
              <button onClick={() => setReasonDialog(null)} type="button">
                닫기
              </button>
              <button
                disabled={reasonSaving}
                onClick={() => void submitReasonDialog()}
                type="button"
              >
                {reasonSaving ? "저장중" : "저장"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
