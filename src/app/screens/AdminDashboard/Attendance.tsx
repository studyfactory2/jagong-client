import { useEffect, useMemo, useState } from "react";
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

const STATUS_LABEL: Record<AttendanceStatusName, string> = {
  PRESENT: "출석",
  LATE: "지각",
  ABSENT: "결석",
  EXCUSED: "인정",
};

const STATUS_OPTIONS: Array<{
  value: AttendanceStatusName;
  label: string;
}> = [
  { value: "PRESENT", label: "출석" },
  { value: "LATE", label: "지각" },
  { value: "ABSENT", label: "결석" },
  { value: "EXCUSED", label: "인정" },
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function recordKey(userId: string, slot: number) {
  return `${userId}:${slot}`;
}

function statusClass(status?: string) {
  return status ? `is-${status.toLowerCase()}` : "is-empty";
}

export default function Attendance({ users, timetable }: AttendanceProps) {
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{
    userId: string;
    slot: number;
  } | null>(null);
  const [savingKey, setSavingKey] = useState("");
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

  useEffect(() => {
    void load();
  }, [selectedDate]);

  async function load() {
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
  }

  async function updateStatus(status: AttendanceStatusName) {
    if (!selected) return;
    const key = recordKey(selected.userId, selected.slot);
    setSavingKey(key);
    setError("");
    try {
      const updated = await markAttendance({
        userId: selected.userId,
        date: selectedDate,
        slot: selected.slot,
        status,
      });
      setRecords((current) => {
        const exists = current.some((record) => record.id === updated.id);
        if (exists) {
          return current.map((record) =>
            record.id === updated.id ? updated : record,
          );
        }
        return [updated, ...current];
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "출석 상태를 저장하지 못했습니다.",
      );
    } finally {
      setSavingKey("");
    }
  }

  const selectedUser = users.find((user) => user.id === selected?.userId);
  const selectedSlot = workSlots.find((slot) => slot.slot === selected?.slot);
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
        <div>
          <span>선택한 칸</span>
          <strong>
            {selectedUser && selectedSlot
              ? `${selectedUser.name} · ${selectedSlot.label}`
              : "수정할 교시를 선택하세요"}
          </strong>
        </div>

        <div className="admin-att-actions">
          {STATUS_OPTIONS.map((option) => (
            <button
              className={`admin-att-status ${statusClass(option.value)}`}
              disabled={!selected || Boolean(savingKey)}
              key={option.value}
              onClick={() => void updateStatus(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
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
                  key={slot.slot}
                  onClick={() => setSelected({ userId: user.id, slot: slot.slot })}
                  type="button"
                >
                  {record
                    ? STATUS_LABEL[record.status as AttendanceStatusName] ??
                      "확인"
                    : "미기록"}
                </button>
              );
            })}
          </div>
        ))}

        {filteredUsers.length === 0 && (
          <p className="admin-att-empty">조건에 맞는 회원이 없습니다.</p>
        )}
      </div>
    </section>
  );
}
