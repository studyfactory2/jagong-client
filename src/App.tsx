import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./app/components/ProtectedRoute";
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

export default function App() {
  return (
    <Routes>
      {/* public */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/booking" element={<ConsultationBooking />} />

      {/* behind login */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<WaitingRoom />} />
        <Route path="/study-line" element={<StudyLine />} />
        <Route path="/study-room" element={<StudyRoom />} />
        <Route path="/weekly-plan" element={<WeeklyPlan />} />
        <Route path="/leaves" element={<LeaveRequest />} />
        <Route path="/inquiry" element={<Inquiry />} />
        <Route path="/video-consult" element={<VideoConsult />} />
        <Route path="/payments" element={<PaymentHistory />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
