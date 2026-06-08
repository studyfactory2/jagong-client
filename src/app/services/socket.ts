import { io, type Socket } from "socket.io-client";
import { API_BASE } from "../../lib/config";

export function connectSocket(token: string): Socket {
  return io(API_BASE, {
    auth: { token },
    transports: ["websocket", "polling"],
  });
}
