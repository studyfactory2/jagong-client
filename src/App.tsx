import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./app/components/ProtectedRoute";
import Layout from "./app/components/Layout";
import Login from "./app/screens/Login";
import Register from "./app/screens/Register";
import ConsultationBooking from "./app/screens/ConsultationBooking";
import WaitingRoom from "./app/screens/WaitingRoom";
import StudyLine from "./app/screens/StudyLine";

export default function App() {
  return (
    <Routes>
      {/* public */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/booking" element={<ConsultationBooking />} />

      {/* behind login */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<WaitingRoom />} />
          <Route path="/study-line" element={<StudyLine />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
