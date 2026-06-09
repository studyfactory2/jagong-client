import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#143f56",
      dark: "#0d2f43",
      light: "#2b5f78",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#f48678",
      dark: "#de665a",
      light: "#ffe2dd",
      contrastText: "#ffffff",
    },
    background: {
      default: "#ffffff",
      paper: "#fffefa",
    },
    text: {
      primary: "#143f56",
      secondary: "#7d888c",
    },
    success: {
      main: "#4d9a68",
      light: "#e4f5ed",
    },
    error: {
      main: "#d65a4f",
      light: "#ffe3df",
    },
    divider: "#d8ddd9",
  },

  typography: {
    fontFamily: "Pretendard, system-ui, -apple-system, sans-serif",
    h1: {
      fontWeight: 700,
      letterSpacing: "0px",
      color: "#143f56",
    },
    h2: {
      fontWeight: 700,
      letterSpacing: "0px",
      color: "#143f56",
    },
    h3: {
      fontWeight: 700,
      letterSpacing: "0px",
      color: "#143f56",
    },
    body1: {
      fontWeight: 400,
      letterSpacing: "0px",
    },
    body2: {
      fontWeight: 400,
      letterSpacing: "0px",
    },
    button: {
      textTransform: "none",
      fontWeight: 600,
      letterSpacing: "0px",
    },
  },

  shape: {
    borderRadius: 10,
  },

  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          minHeight: 44,
          fontSize: 15,
          fontWeight: 600,
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "#fffefa",
        },
      },
    },
  },
});
