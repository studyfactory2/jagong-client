import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#c2693a", dark: "#9a4f2a", contrastText: "#ffffff" },
    background: { default: "#f6efe4", paper: "#fffdf9" },
    text: { primary: "#2b2117", secondary: "#8a7c69" },
    success: { main: "#3f8a5b" },
    error: { main: "#c0492f" },
    divider: "#e2d6c3",
  },
  typography: {
    fontFamily: "Pretendard, system-ui, -apple-system, sans-serif",
    h1: {
      fontFamily: '"Gowun Batang", serif',
      fontWeight: 700,
      letterSpacing: "-0.5px",
    },
    h2: { fontFamily: '"Gowun Batang", serif', fontWeight: 700 },
    h3: { fontFamily: '"Gowun Batang", serif', fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 700 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
  },
});
