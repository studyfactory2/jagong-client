import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Box, Typography, Button, Chip, Stack } from "@mui/material";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

const NAV = [
  { to: "/", label: "대기창" },
  { to: "/study-line", label: "나의 학습라인" },
  // we add 휴가신청 · 문의 here as we build them
];

export default function Layout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { session, logout } = useAuth();
  const { connected } = useSocket();

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          bgcolor: "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box
          sx={{
            maxWidth: 900,
            mx: "auto",
            px: { xs: 2, md: 3 },
            py: 1.25,
            display: "flex",
            alignItems: "center",
            gap: { xs: 1, md: 2 },
            flexWrap: "wrap",
          }}
        >
          <Typography
            sx={{
              color: "primary.main",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: 1,
            }}
          >
            자격증공장
          </Typography>

          <Stack
            direction="row"
            spacing={0.5}
            sx={{ flexGrow: 1, flexWrap: "wrap" }}
          >
            {NAV.map((n) => {
              const active = pathname === n.to;
              return (
                <Button
                  key={n.to}
                  size="small"
                  onClick={() => navigate(n.to)}
                  sx={{
                    minWidth: "auto",
                    px: 1.5,
                    color: active ? "primary.main" : "text.secondary",
                    fontWeight: active ? 700 : 500,
                    bgcolor: active ? "#f6e3d3" : "transparent",
                  }}
                >
                  {n.label}
                </Button>
              );
            })}
          </Stack>

          <Chip
            size="small"
            label={connected ? "접속됨" : "연결 중…"}
            color={connected ? "success" : "default"}
          />
          <Typography
            sx={{
              fontSize: 13,
              color: "text.secondary",
              display: { xs: "none", sm: "block" },
            }}
          >
            {session?.user.name}
          </Typography>
          <Button size="small" variant="outlined" onClick={logout}>
            로그아웃
          </Button>
        </Box>
      </Box>

      <Box component="main">
        <Outlet />
      </Box>
    </Box>
  );
}
