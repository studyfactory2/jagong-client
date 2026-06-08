export interface Branch {
  id: string;
  name: string;
}

export interface AuthUser {
  userId?: string;
  id?: string;
  name: string;
  role: string;
  branchId?: string;
}

export interface Session {
  token: string;
  user: AuthUser;
}

export interface TimetableSlot {
  id?: string;
  slot: number;
  label: string;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  duration?: number;
  isBreak: boolean;
  messages?: string[];
}
