import { getIO, publishQueueState } from "./socketServer";

/**
 * Emit patientAdded notification + full queue state broadcast.
 * The specific event is used for toast notifications on clients,
 * while queueUpdated provides the authoritative state.
 */
export const emitPatientAdded = async (name: string, tokenNumber: string): Promise<void> => {
  try {
    const io = getIO();
    io.emit("patientAdded", { name, tokenNumber });
    await publishQueueState();
  } catch (error) {
    console.error("[Socket.IO] Error emitting patientAdded:", error);
  }
};

/**
 * Emit tokenAdvanced notification + full queue state broadcast.
 */
export const emitTokenAdvanced = async (currentToken: string, patientName: string): Promise<void> => {
  try {
    const io = getIO();
    io.emit("tokenAdvanced", { currentToken, patientName });
    await publishQueueState();
  } catch (error) {
    console.error("[Socket.IO] Error emitting tokenAdvanced:", error);
  }
};

/**
 * Emit queueReset notification + full queue state broadcast.
 */
export const emitQueueReset = async (): Promise<void> => {
  try {
    const io = getIO();
    io.emit("queueReset", undefined);
    await publishQueueState();
  } catch (error) {
    console.error("[Socket.IO] Error emitting queueReset:", error);
  }
};

/**
 * Emit consultationTimeUpdated notification + full queue state broadcast.
 */
export const emitConsultationTimeUpdated = async (minutes: number): Promise<void> => {
  try {
    const io = getIO();
    io.emit("consultationTimeUpdated", { minutes });
    await publishQueueState();
  } catch (error) {
    console.error("[Socket.IO] Error emitting consultationTimeUpdated:", error);
  }
};

/**
 * Emit emergencyRequestSubmitted notification + full queue state broadcast.
 */
export const emitEmergencyRequestSubmitted = async (tokenNumber: string, reason: string): Promise<void> => {
  try {
    const io = getIO();
    io.emit("emergencyRequestSubmitted", { tokenNumber, reason });
    await publishQueueState();
  } catch (error) {
    console.error("[Socket.IO] Error emitting emergencyRequestSubmitted:", error);
  }
};

/**
 * Emit emergencyRequestReviewed notification + full queue state broadcast.
 */
export const emitEmergencyRequestReviewed = async (tokenNumber: string, status: "approved" | "rejected"): Promise<void> => {
  try {
    const io = getIO();
    io.emit("emergencyRequestReviewed", { tokenNumber, status });
    await publishQueueState();
  } catch (error) {
    console.error("[Socket.IO] Error emitting emergencyRequestReviewed:", error);
  }
};
