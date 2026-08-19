import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { BrowserRouter } from "react-router-dom";
import { theme } from "./app/theme";
import { AuthProvider } from "./app/context/AuthContext";
import { SocketProvider } from "./app/context/SocketContext";
import { WorkroomAnnouncementRuntimeProvider } from "./app/context/WorkroomAnnouncementRuntimeContext";
import GlobalScheduleAnnouncement from "./app/components/ui/GlobalScheduleAnnouncement";
import App from "./App";
import "./app/theme/tokens.css";
import "./styles/base.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <WorkroomAnnouncementRuntimeProvider>
            <SocketProvider>
              <App />
              <GlobalScheduleAnnouncement />
            </SocketProvider>
          </WorkroomAnnouncementRuntimeProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((error) => {
      console.log("Service worker registration failed", error);
    });
  });
}
