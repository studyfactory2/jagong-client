import { Route, Routes } from "react-router-dom";
import AdminDashboard from "./AdminDashboard";

export default function AdminDashboardPage() {
  return (
    <div className="admin-dashboard-page">
      <Routes>
        <Route index element={<AdminDashboard />} />
      </Routes>
    </div>
  );
}
