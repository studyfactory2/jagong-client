import { lazy, Suspense, useEffect, useMemo, type ReactNode } from "react";
import {
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import ProtectedRoute from "./app/components/ProtectedRoute";
import MembershipRoute from "./app/components/MembershipRoute";
import Login from "./app/screens/Login";
import Register from "./app/screens/Register";
import ConsultationBooking from "./app/screens/ConsultationBooking";
import ConsultationCheckout from "./app/screens/ConsultationCheckout";
import Policies from "./app/screens/Policies";
import PaymentHistory from "./app/screens/PaymentHistory";
import PaymentSuccess from "./app/screens/PaymentSuccess";
import PaymentFail from "./app/screens/PaymentFail";
import MyPage from "./app/screens/MyPage";
import { useAuth } from "./app/context/AuthContext";
import {
  WorkroomSessionProvider,
  useWorkroomSession,
} from "./app/context/WorkroomSessionContext";
import { memberHomePath } from "./app/utils/access";
import AppLoading from "./app/components/ui/AppLoading";
import WorkroomAnnouncementIntentController from "./app/components/WorkroomAnnouncementIntentController";
import { workroomAnnouncementIntentState } from "./app/utils/workroom-announcement";
import type { WorkroomMode } from "./lib/types";

const WaitingRoom = lazy(() => import("./app/screens/WaitingRoom"));
const WorkroomPreparation = lazy(
  () => import("./app/screens/WorkroomPreparation"),
);
const StudyLine = lazy(() => import("./app/screens/StudyLine"));
const StudyRoom = lazy(() => import("./app/screens/StudyRoom"));
const WeeklyPlan = lazy(() => import("./app/screens/WeeklyPlan"));
const LeaveRequest = lazy(() => import("./app/screens/LeaveRequest"));
const Attendance = lazy(() => import("./app/screens/Attendance"));
const StudyRecords = lazy(() => import("./app/screens/StudyRecords"));
const Inquiry = lazy(() => import("./app/screens/Inquiry"));
const Notifications = lazy(() => import("./app/screens/Notifications"));
const AdminDashboard = lazy(() => import("./app/screens/AdminDashboard"));

function RootRedirect() {
  const { session } = useAuth();
  return (
    <Navigate to={session ? memberHomePath(session.user) : "/login"} replace />
  );
}

function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, search]);

  return null;
}

function WorkroomSessionLayout() {
  return (
    <WorkroomSessionProvider>
      <WorkroomAnnouncementIntentController />
      <Outlet />
    </WorkroomSessionProvider>
  );
}

function JoinedWorkroomRoute({
  mode,
  children,
}: {
  mode: WorkroomMode;
  children: ReactNode;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { joined, joining, currentWorkroomMode, switchWorkroomMode } =
    useWorkroomSession();
  const announcementState = useMemo(
    () => workroomAnnouncementIntentState(location.state),
    [location.state],
  );

  useEffect(() => {
    if (!joined || currentWorkroomMode === mode) return undefined;

    let active = true;
    const reconcileTimer = window.setTimeout(() => {
      void switchWorkroomMode(mode).then((switched) => {
        if (!active || switched) return;

        if (currentWorkroomMode) {
          navigate(
            currentWorkroomMode === "line" ? "/study-line" : "/study-room",
            { replace: true, state: announcementState },
          );
          return;
        }
        navigate(`/workroom/prepare?mode=${mode}`, {
          replace: true,
          state: announcementState,
        });
      });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(reconcileTimer);
    };
  }, [
    announcementState,
    currentWorkroomMode,
    joined,
    mode,
    navigate,
    switchWorkroomMode,
  ]);

  if (joined && currentWorkroomMode === mode) return <>{children}</>;
  if (joined) {
    return <AppLoading message="작업장 화면을 전환하고 있습니다." />;
  }
  if (joining) {
    return <AppLoading message="작업장 연결을 확인하고 있습니다." />;
  }

  return (
    <Navigate
      replace
      state={announcementState}
      to={`/workroom/prepare?mode=${mode}`}
    />
  );
}

export default function App() {
  return (
    <Suspense fallback={<AppLoading message="화면을 불러오는 중입니다." />}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        {/* public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/booking" element={<ConsultationBooking />} />
        <Route path="/checkout/:paymentId" element={<ConsultationCheckout />} />
        <Route path="/policies" element={<Policies />} />

        {/* behind login */}
        <Route element={<ProtectedRoute />}>
          <Route path="/payments" element={<PaymentHistory />} />
          <Route path="/payments/success" element={<PaymentSuccess />} />
          <Route path="/payments/fail" element={<PaymentFail />} />
          <Route path="/my-page" element={<MyPage />} />
          <Route path="/admin/*" element={<AdminDashboard />} />

          <Route element={<MembershipRoute />}>
            <Route path="/waiting-room/*" element={<WaitingRoom />} />
            <Route element={<WorkroomSessionLayout />}>
              <Route
                path="/workroom/prepare"
                element={<WorkroomPreparation />}
              />
              <Route
                path="/study-line"
                element={
                  <JoinedWorkroomRoute mode="line">
                    <StudyLine />
                  </JoinedWorkroomRoute>
                }
              />
              <Route
                path="/study-room"
                element={
                  <JoinedWorkroomRoute mode="group">
                    <StudyRoom />
                  </JoinedWorkroomRoute>
                }
              />
            </Route>
            <Route path="/weekly-plan" element={<WeeklyPlan />} />
            <Route path="/leaves" element={<LeaveRequest />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/study-records" element={<StudyRecords />} />
            <Route path="/inquiry" element={<Inquiry />} />
            <Route path="/notifications" element={<Notifications />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
