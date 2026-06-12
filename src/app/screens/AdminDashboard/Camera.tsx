import { useMemo, useState } from "react";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import NavigateBeforeOutlinedIcon from "@mui/icons-material/NavigateBeforeOutlined";
import NavigateNextOutlinedIcon from "@mui/icons-material/NavigateNextOutlined";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import type { AdminUser, CamSessionRecord, TimetableSlot } from "../../../lib/types";
import { dDayText, dateText, userDetail } from "./admin.utils";

type CameraProps = {
  camSessions: CamSessionRecord[];
  timetable: TimetableSlot[];
  users: AdminUser[];
  onWarn: (userId: string, message: string, type?: string) => Promise<void>;
};

type CameraTile = {
  id: string;
  name: string;
  status: "working" | "waiting";
  age?: number | null;
  membershipEnd?: string | null;
  slot?: number;
  joinedAt?: string | null;
};

const PAGE_SIZE = 12;
const WARNING_PRESETS = [
  { type: "SLEEP", label: "졸음", message: "졸지 말고 다시 집중해주세요." },
  { type: "POSTURE", label: "자세", message: "자세를 바로 하고 화면에 집중해주세요." },
  { type: "CAMERA", label: "카메라", message: "카메라 상태를 확인해주세요." },
  { type: "AWAY", label: "자리", message: "자리비움이 감지되었습니다. 자리로 돌아와 주세요." },
];

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function currentSlot(slots: TimetableSlot[]) {
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  return slots.find((slot) => {
    const start = minutes(slot.startTime);
    const end = minutes(slot.endTime);
    return current >= start && current < end;
  });
}

export default function Camera({ camSessions, timetable, users, onWarn }: CameraProps) {
  /** STATE **/
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);

  /** DERIVED **/
  const activeSlot = useMemo(() => currentSlot(timetable), [timetable]);
  const isStudyTime = Boolean(activeSlot && !activeSlot.isBreak);

  const tiles = useMemo<CameraTile[]>(() => {
    const liveByUser = new Map(
      camSessions
        .filter((session) => !session.leftAt)
        .map((session) => [session.userId, session]),
    );

    const members = users.filter((user) => user.role === "MEMBER");
    return members.map((user) => {
      const live = liveByUser.get(user.id);
      return {
        id: user.id,
        name: user.name,
        status: live ? "working" : "waiting",
        age: user.age,
        membershipEnd: user.membershipEnd,
        slot: live?.slot,
        joinedAt: live?.joinedAt ?? live?.date,
      };
    });
  }, [camSessions, users]);

  const totalPages = Math.max(1, Math.ceil(tiles.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleTiles = tiles.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selectedTile = tiles.find((tile) => tile.id === selectedId) ?? visibleTiles[0];
  const workingCount = tiles.filter((tile) => tile.status === "working").length;
  const modeText = isStudyTime
    ? String(activeSlot?.label ?? activeSlot?.slot ?? "수업") + " 집중중"
    : activeSlot
      ? String(activeSlot.label ?? "쉬는시간")
      : "교시 외 시간";

  /** HANDLERS **/
  function goPrevious() {
    setPage((current) => Math.max(1, current - 1));
  }

  function goNext() {
    setPage((current) => Math.min(totalPages, current + 1));
  }

  async function sendWarning(message: string, type?: string) {
    if (!selectedTile || sending) return;
    setSending(true);
    try {
      await onWarn(selectedTile.id, message, type);
      setCustomMessage("");
    } finally {
      setSending(false);
    }
  }

  /** RENDER **/
  return (
    <section className={"admin-camera" + (isStudyTime ? " is-study-time" : " is-info-time")}>
      <div className="admin-camera-head">
        <div>
          <h2>
            <VideocamOutlinedIcon /> 실시간 작업장 모니터
          </h2>
          <p>{isStudyTime ? "집중 시간에는 화면과 이름만 간결하게 확인합니다." : "쉬는시간에는 회원 정보를 함께 확인합니다."}</p>
        </div>

        <div className="admin-camera-stats">
          <span>{modeText}</span>
          <span>
            <i /> {workingCount}명 근무중
          </span>
          <span>{tiles.length - workingCount}명 대기/미입장</span>
        </div>
      </div>

      <div className="admin-camera-grid">
        {visibleTiles.map((tile, index) => (
          <button
            className={"admin-camera-tile" + (selectedTile?.id === tile.id ? " is-selected" : "")}
            key={tile.id}
            onClick={() => setSelectedId(tile.id)}
            type="button"
          >
            <div className="admin-camera-video">
              <PersonRoundedIcon />
              <strong>{tile.name}</strong>
              <span className={tile.status === "working" ? "is-live" : ""}>
                {tile.status === "working" ? "LIVE" : "OFF"}
              </span>
            </div>

            {!isStudyTime && (
              <div className="admin-camera-meta">
                <div className="admin-camera-title">
                  <strong>{tile.name}</strong>
                  <em>{dDayText(tile.membershipEnd)}</em>
                </div>
                <span>{tile.status === "working" ? String(tile.slot ?? "-") + "교시 입장중" : "미입장"}</span>
                <small>{tile.joinedAt ? dateText(tile.joinedAt) : "자리 " + String(index + 1)}</small>
                <dl>
                  <div><dt>나이</dt><dd>{userDetail(tile.age)}</dd></div>
                  <div><dt>결제</dt><dd>{dDayText(tile.membershipEnd)}</dd></div>
                </dl>
              </div>
            )}
          </button>
        ))}

        {visibleTiles.length === 0 && (
          <div className="admin-camera-empty">
            <GroupsOutlinedIcon />
            <strong>표시할 회원이 없습니다.</strong>
            <span>회원 등록 후 캠 상태가 이곳에 표시됩니다.</span>
          </div>
        )}
      </div>

      {selectedTile && (
        <div className="admin-warning-panel">
          <div>
            <strong>{selectedTile.name}님에게 알림</strong>
            <span>선택한 문구는 학생 화면에 바로 표시됩니다.</span>
          </div>
          <div className="admin-warning-presets">
            {WARNING_PRESETS.map((preset) => (
              <button
                disabled={sending}
                key={preset.type}
                onClick={() => sendWarning(preset.message, preset.type)}
                type="button"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <label>
            직접 입력
            <input
              value={customMessage}
              onChange={(event) => setCustomMessage(event.target.value)}
              placeholder="예) 졸지 말고 집중해주세요."
            />
          </label>
          <button
            className="admin-warning-send"
            disabled={sending || !customMessage.trim()}
            onClick={() => sendWarning(customMessage, "CUSTOM")}
            type="button"
          >
            <SendOutlinedIcon /> {sending ? "전송중" : "보내기"}
          </button>
        </div>
      )}

      <div className="admin-camera-pager">
        <button onClick={goPrevious} disabled={safePage === 1} type="button">
          <NavigateBeforeOutlinedIcon /> 이전
        </button>
        <span>
          {safePage} / {totalPages}
        </span>
        <button onClick={goNext} disabled={safePage === totalPages} type="button">
          다음 <NavigateNextOutlinedIcon />
        </button>
      </div>
    </section>
  );
}
