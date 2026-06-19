import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./app/components/ProtectedRoute";
import MembershipRoute from "./app/components/MembershipRoute";
import Login from "./app/screens/Login";
import Register from "./app/screens/Register";
import ConsultationBooking from "./app/screens/ConsultationBooking";
import WaitingRoom from "./app/screens/WaitingRoom";
import StudyLine from "./app/screens/StudyLine";
import StudyRoom from "./app/screens/StudyRoom";
import WeeklyPlan from "./app/screens/WeeklyPlan";
import LeaveRequest from "./app/screens/LeaveRequest";
import Inquiry from "./app/screens/Inquiry";
import VideoConsult from "./app/screens/VideoConsult";
import PaymentHistory from "./app/screens/PaymentHistory";
import PaymentSuccess from "./app/screens/PaymentSuccess";
import PaymentFail from "./app/screens/PaymentFail";
import MyPage from "./app/screens/MyPage";
import AdminDashboard from "./app/screens/AdminDashboard";
import { useAuth } from "./app/context/AuthContext";
import { memberHomePath } from "./app/utils/access";

function RootRedirect() {
  const { session } = useAuth();
  return <Navigate to={session ? memberHomePath(session.user) : "/login"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      {/* public */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/booking" element={<ConsultationBooking />} />

      {/* behind login */}
      <Route element={<ProtectedRoute />}>
        <Route path="/payments" element={<PaymentHistory />} />
        <Route path="/payments/success" element={<PaymentSuccess />} />
        <Route path="/payments/fail" element={<PaymentFail />} />
        <Route path="/my-page" element={<MyPage />} />
        <Route path="/admin/*" element={<AdminDashboard />} />

        <Route element={<MembershipRoute />}>
          <Route path="/waiting-room/*" element={<WaitingRoom />} />
          <Route path="/study-line" element={<StudyLine />} />
          <Route path="/study-room" element={<StudyRoom />} />
          <Route path="/weekly-plan" element={<WeeklyPlan />} />
          <Route path="/leaves" element={<LeaveRequest />} />
          <Route path="/inquiry" element={<Inquiry />} />
          <Route path="/video-consult" element={<VideoConsult />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
