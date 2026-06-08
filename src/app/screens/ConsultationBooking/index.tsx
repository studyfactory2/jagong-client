import { useNavigate } from "react-router-dom";
import { Box, Paper, Typography, Button } from "@mui/material";

export default function ConsultationBooking() {
  const navigate = useNavigate();
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 3,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 4,
          maxWidth: 440,
          textAlign: "center",
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="h2" sx={{ fontSize: 24, mb: 1 }}>
          가입상담예약
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: 14, mb: 3 }}>
          입사상담 예약 화면은 곧 만들어집니다. (대표님 확인 후 백엔드 연동
          예정)
        </Typography>
        <Button variant="outlined" onClick={() => navigate("/login")}>
          로그인으로 돌아가기
        </Button>
      </Paper>
    </Box>
  );
}
