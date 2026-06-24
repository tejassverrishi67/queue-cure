export interface Patient {
  id: string;
  name: string;
  tokenNumber: string;
  createdAt: string;
  calledAt?: string;
  status: "waiting" | "called";
  isEmergency?: boolean;
}

export interface EmergencyRequest {
  id: string;
  tokenNumber: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt?: string;
}

export interface QueueState {
  currentToken: string | null;
  averageConsultationTime: number;
  waitingPatients: Patient[];
  lastTokenIndex: number;
  emergencyRequests?: EmergencyRequest[];
}

export type EventPayloadMap = {
  queueUpdated: QueueState;
  patientAdded: { name: string; tokenNumber: string };
  tokenAdvanced: { currentToken: string; patientName: string };
  queueReset: undefined;
  consultationTimeUpdated: { minutes: number };
  emergencyRequestSubmitted: { tokenNumber: string; reason: string };
  emergencyRequestReviewed: { tokenNumber: string; status: "approved" | "rejected" };
  connect: undefined;
  disconnect: undefined;
};

export type ActionPayloadMap = {
  queueUpdated: undefined;
  patientAdded: { name: string };
  tokenAdvanced: undefined;
  queueReset: undefined;
  consultationTimeUpdated: { minutes: number };
  emergencyRequestSubmitted: { tokenNumber: string; reason: string };
  emergencyRequestReviewed: { requestId: string; tokenNumber: string; status: "approved" | "rejected" };
};
