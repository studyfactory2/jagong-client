import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
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
import { WorkroomSessionProvider } from "./app/context/WorkroomSessionContext";
import { memberHomePath } from "./app/utils/access";
import AppLoading from "./app/components/ui/AppLoading";

const WaitingRoom = lazy(() => import("./app/screens/WaitingRoom"));
const StudyLine = lazy(() => import("./app/screens/StudyLine"));
const StudyRoom = lazy(() => import("./app/screens/StudyRoom"));
const WeeklyPlan = lazy(() => import("./app/screens/WeeklyPlan"));
const LeaveRequest = lazy(() => import("./app/screens/LeaveRequest"));
const Attendance = lazy(() => import("./app/screens/Attendance"));
const Inquiry = lazy(() => import("./app/screens/Inquiry"));
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
      <Outlet />
    </WorkroomSessionProvider>
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
              <Route path="/study-line" element={<StudyLine />} />
              <Route path="/study-room" element={<StudyRoom />} />
            </Route>
            <Route path="/weekly-plan" element={<WeeklyPlan />} />
            <Route path="/leaves" element={<LeaveRequest />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/inquiry" element={<Inquiry />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
