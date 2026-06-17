import { http } from "./http";
import type {
  ConsultationInput,
  ConsultationRecord,
  PaginatedResult,
} from "../../lib/types";

/** PUBLIC CONSULTATION API **/

export async function createConsultation(input: ConsultationInput): Promise<void> {
  await http.post("/consultations", input);
}

export async function getConsultationAvailability(date: string): Promise<{
  date: string;
  takenSlots: string[];
}> {
  const { data } = await http.get<{
    date: string;
    takenSlots: string[];
  }>("/consultations/availability", { params: { date } });
  return data;
}

/** ADMIN CONSULTATION API **/

export async function getAdminConsultations(input?: {
  status?: string;
  consultType?: string;
  text?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<ConsultationRecord>> {
  const { data } = await http.get<PaginatedResult<ConsultationRecord>>(
    "/consultations",
    {
      params: input,
    },
  );
  return data;
}

export async function updateConsultation(
  id: string,
  input: {
    status?: string;
    adminNotes?: string;
    scheduledAt?: string;
    meetingLink?: string;
  },
): Promise<ConsultationRecord> {
  const { data } = await http.post<ConsultationRecord>(
    "/consultations/update/" + id,
    input,
  );
  return data;
}

export async function getConsultationFeedbacks(): Promise<ConsultationRecord[]> {
  const { data } = await http.get<ConsultationRecord[]>(
    "/consultations/feedbacks",
  );
  return data;
}
