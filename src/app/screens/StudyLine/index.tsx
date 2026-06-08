import { useEffect, useMemo, useState } from "react";
import { Box, Paper, Typography, Chip, Stack } from "@mui/material";
import { getTimetable } from "../../services/api";
import type { TimetableSlot } from "../../../lib/types";

const toSec = (t: string) => {
  const [h, m] = t.split(":");
  return Number(h) * 3600 + Number(m) * 60;
};

export default function StudyLine() {
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    getTimetable()
      .then((s) =>
        setSlots(
          [...s].sort((a, b) => toSec(a.startTime) - toSec(b.startTime)),
        ),
      )
      .catch(() => {});
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000); // 30s is plenty for highlighting
    return () => clearInterval(t);
  }, []);

  const nowSec =
    now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const currentSlot = useMemo(
    () =>
      slots.find(
        (s) => toSec(s.startTime) <= nowSec && nowSec < toSec(s.endTime),
      )?.slot,
    [slots, nowSec],
  );

  return (
    <Box sx={{ maxWidth: 720, mx: "auto", p: { xs: 2, md: 3 } }}>
      <Typography variant="h2" sx={{ fontSize: { xs: 22, md: 26 }, mb: 0.5 }}>
        나의 학습라인
      </Typography>
      <Typography color="text.secondary" sx={{ fontSize: 13, mb: 2 }}>
        오늘 하루의 흐름이에요. 현재 교시가 강조됩니다.
      </Typography>

      <Stack spacing={1.25}>
        {slots.length === 0 && (
          <Typography color="text.secondary" sx={{ fontSize: 13 }}>
            시간표를 불러오는 중…
          </Typography>
        )}
        {slots.map((s) => {
          const isNow = currentSlot === s.slot;
          return (
            <Paper
              key={`${s.slot}-${s.startTime}`}
              elevation={0}
              sx={{
                p: { xs: 1.75, md: 2.25 },
                border: "1px solid",
                borderColor: isNow ? "primary.main" : "divider",
                bgcolor: isNow ? "#fbf1e7" : "background.paper",
              }}
            >
              <Stack
                direction="row"
                sx={{
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Box>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    <Typography
                      sx={{
                        fontWeight: 700,
                        color: s.isBreak ? "text.secondary" : "text.primary",
                      }}
                    >
                      {s.label}
                    </Typography>
                    {isNow && (
                      <Chip size="small" color="primary" label="진행 중" />
                    )}
                    {s.isBreak && !isNow && (
                      <Chip size="small" variant="outlined" label="휴식" />
                    )}
                  </Stack>
                  {s.messages && s.messages.length > 0 && (
                    <Typography
                      color="text.secondary"
                      sx={{ fontSize: 12.5, mt: 0.5 }}
                    >
                      {s.messages.join(" · ")}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ textAlign: "right" }}>
                  <Typography
                    sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}
                  >
                    {s.startTime}–{s.endTime}
                  </Typography>
                  {s.duration != null && (
                    <Typography color="text.secondary" sx={{ fontSize: 12 }}>
                      {s.duration}분
                    </Typography>
                  )}
                </Box>
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
}
