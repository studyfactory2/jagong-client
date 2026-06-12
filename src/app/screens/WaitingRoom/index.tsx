import { Route, Routes } from "react-router-dom";
import WaitingRoom from "./WaitingRoom";

export default function WaitingRoomPage() {
  return (
    <div className="waiting-room-page">
      <Routes>
        <Route index element={<WaitingRoom />} />
      </Routes>
    </div>
  );
}
