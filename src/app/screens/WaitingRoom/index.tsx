import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Chip,
  Button,
  Stack,
  Divider,
  Alert,
} from "@mui/material";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { getTimetable } from "../../services/api";
import type { TimetableSlot } from "../../../lib/types";

// "HH:mm" (or "HH:mm:ss") -> seconds since midnight
const toSec = (t: string) => {
  const [h, m] = t.split(":");
  return Number(h) * 3600 + Number(m) * 60;
};
const fmt = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export default function WaitingRoom() {
  const { session, logout } = useAuth();
  const { online, connected, socket } = useSocket();

  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [bellMsg, setBellMsg] = useState("");

  // load the (global) timetable once
  useEffect(() => {
    getTimetable()
      .then((s) =>
        setSlots(
          [...s].sort((a, b) => toSec(a.startTime) - toSec(b.startTime)),
        ),
      )
      .catch(() => {});
  }, []);

  // tick every second so the countdown + "now" highlight stay live
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // react to live bell pushes
  useEffect(() => {
    if (!socket) return;
    const onBell = (d: { type: string; label?: string }) => {
      const msg =
        d.type === "countdown"
          ? `곧 ${d.label ?? "다음 교시"} 시작돼요`
          : d.type === "periodStart"
            ? `${d.label ?? "수업"} 시작! 집중해볼까요 📚`
            : d.type === "breakStart"
              ? "쉬는시간입니다 ☕"
              : "";
      if (msg) {
        setBellMsg(msg);
        setTimeout(() => setBellMsg(""), 8000);
      }
    };
    socket.on("bell", onBell);
    return () => {
      socket.off("bell", onBell);
    };
  }, [socket]);

  const nowSec =
    now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const current = useMemo(
    () =>
      slots.find(
        (s) => toSec(s.startTime) <= nowSec && nowSec < toSec(s.endTime),
      ),
    [slots, nowSec],
  );
  const countdown = current ? toSec(current.endTime) - nowSec : null;

  return (
    <Box sx={{ maxWidth: 760, mx: "auto", p: { xs: 2, md: 3 } }}>
      {/* header */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          py: 2,
        }}
      >
        <Box>
          <Typography
            sx={{
              color: "primary.main",
              fontSize: 12,
              letterSpacing: 2,
              fontWeight: 700,
            }}
          >
            자격증공장 · 재택근무반
          </Typography>
          <Typography sx={{ fontSize: 14, mt: 0.5 }}>
            안녕하세요, <b>{session?.user.name}</b> 님 · 대기창
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Chip
            size="small"
            label={connected ? "접속됨" : "연결 중…"}
            color={connected ? "success" : "default"}
          />
          <Button variant="outlined" size="small" onClick={logout}>
            로그아웃
          </Button>
        </Stack>
      </Stack>

      {bellMsg && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {bellMsg}
        </Alert>
      )}

      {/* online count */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 3 },
          mb: 2,
          border: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "baseline",
          gap: 1.5,
        }}
      >
        <Typography
          variant="h2"
          sx={{
            fontSize: { xs: 34, md: 42 },
            color: "primary.dark",
            lineHeight: 1,
          }}
        >
          {online ?? "–"}
        </Typography>
        <Typography color="text.secondary">명 근무 중 · 전국 현황</Typography>
      </Paper>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1.3fr 1fr" },
          gap: 2,
        }}
      >
        {/* timetable */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 3 },
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="h3" sx={{ fontSize: 15, mb: 1.5 }}>
            오늘의 시간표
          </Typography>
          <Divider sx={{ mb: 1 }} />
          {slots.length === 0 && (
            <Typography color="text.secondary" sx={{ fontSize: 13 }}>
              시간표를 불러오는 중…
            </Typography>
          )}
          {slots.map((s) => {
            const isNow =
              current?.slot === s.slot && !current?.isBreak === !s.isBreak;
            return (
              <Stack
                key={`${s.slot}-${s.startTime}`}
                direction="row"
                sx={{
                  justifyContent: "space-between",
                  alignItems: "center",
                  px: 1.5,
                  py: 1,
                  borderRadius: 2,
                  fontSize: 13.5,
                  ...(isNow
                    ? {
                        bgcolor: "#f6e3d3",
                        color: "primary.dark",
                        fontWeight: 700,
                      }
                    : s.isBreak
                      ? { color: "text.secondary" }
                      : {}),
                }}
              >
                <span>
                  {s.label}
                  {isNow ? " · 진행 중" : ""}
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {s.startTime}–{s.endTime}
                </span>
              </Stack>
            );
          })}
        </Paper>

        {/* countdown + enter */}
        <Stack spacing={2}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 3 },
              border: "1px solid",
              borderColor: "divider",
              textAlign: "center",
            }}
          >
            <Typography color="text.secondary" sx={{ fontSize: 13 }}>
              {current
                ? current.isBreak
                  ? "쉬는시간 종료까지"
                  : "다음 종소리까지"
                : "현재 진행 중인 교시 없음"}
            </Typography>
            <Typography
              variant="h2"
              sx={{
                fontSize: 40,
                color: "primary.dark",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {countdown != null ? fmt(countdown) : "--:--"}
            </Typography>
            {current && (
              <Typography color="text.secondary" sx={{ fontSize: 12 }}>
                {current.label}
              </Typography>
            )}
          </Paper>

          <Button variant="contained" size="large" disabled>
            작업장 입장 · 준비 중
          </Button>
          <Typography
            color="text.secondary"
            sx={{ fontSize: 11, textAlign: "center" }}
          >
            작업장(화상) 화면은 카메라 단계에서 열립니다.
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}
