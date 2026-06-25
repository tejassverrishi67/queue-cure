import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import Patient, { IPatient } from "../models/Patient";
import QueueSettings, { IQueueSettings } from "../models/QueueSettings";
import EmergencyRequest, { IEmergencyRequest } from "../models/EmergencyRequest";
import { QueueState } from "../types/socketEvents";

let io: SocketIOServer | null = null;
let connectionCount = 0;

export const initSocketServer = (server: HttpServer): SocketIOServer => {
  // Parse allowed CORS origins from environment or use defaults
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map(s => s.trim())
    : [
        "https://queue-cure-analytics.onrender.com",
        "https://queue-cure-virid.vercel.app",
        "http://localhost:3000",
        "http://localhost:8000"
      ];

  io = new SocketIOServer(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST", "PUT"],
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    connectionCount++;

    if (process.env.NODE_ENV !== "production") {
      console.log(`[Socket.IO] Client connected: ${socket.id}. Active connections: ${connectionCount}`);
    }

    // Send initial queue state immediately to the newly connected client
    publishQueueStateForSocket(socket).catch((err) => {
      console.error("[Socket.IO] Error publishing initial queue state to new socket connection:", err);
    });

    socket.on("disconnect", () => {
      connectionCount--;
      if (process.env.NODE_ENV !== "production") {
        console.log(`[Socket.IO] Client disconnected: ${socket.id}. Active connections: ${connectionCount}`);
      }
    });
  });

  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error("Socket.IO server has not been initialized.");
  }
  return io;
};

export const getConnectionCount = (): number => {
  return connectionCount;
};

/**
 * Fetch current state from MongoDB and construct a complete QueueState object.
 * Uses .lean() for performance — returns plain JS objects instead of Mongoose documents.
 */
export const fetchQueueState = async (): Promise<QueueState> => {
  // 1. Fetch patients with .lean() for performance
  const patients = await Patient.find({}).sort({ createdAt: 1 }).lean<IPatient[]>();
  const waitingPatients = patients.map((p) => ({
    id: String(p._id),
    name: p.name,
    tokenNumber: p.tokenNumber,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
    calledAt: p.calledAt ? (p.calledAt instanceof Date ? p.calledAt.toISOString() : String(p.calledAt)) : undefined,
    status: p.status as "waiting" | "called",
    isEmergency: p.isEmergency || false
  }));

  // 2. Fetch settings with .lean()
  const settings = await QueueSettings.findOne({ configId: 1 }).lean<IQueueSettings>();
  const currentToken = settings?.currentToken || null;
  const averageConsultationTime = settings?.averageConsultationTime ?? 5;
  const lastTokenIndex = settings?.lastTokenIndex ?? 0;

  // 3. Fetch emergency requests with fail-safe isolation and .lean()
  let emergencyRequests: QueueState["emergencyRequests"] = [];
  try {
    const requests = await EmergencyRequest.find({}).sort({ createdAt: 1 }).lean<IEmergencyRequest[]>();
    emergencyRequests = requests.map((r) => ({
      id: String(r._id),
      tokenNumber: r.tokenNumber,
      reason: r.reason,
      status: r.status as "pending" | "approved" | "rejected",
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      reviewedAt: r.reviewedAt ? (r.reviewedAt instanceof Date ? r.reviewedAt.toISOString() : String(r.reviewedAt)) : undefined
    }));
  } catch (error) {
    console.error("[Socket.IO] Failed to query emergency requests (isolated failure):", error);
    // Queue state sync will still work even if emergency request queries fail
  }

  return {
    currentToken,
    averageConsultationTime,
    lastTokenIndex,
    waitingPatients,
    emergencyRequests
  };
};

/**
 * Broadcast current queue state to all connected Socket.IO clients.
 */
export const publishQueueState = async (): Promise<void> => {
  try {
    const serverIo = getIO();
    const state = await fetchQueueState();
    serverIo.emit("queueUpdated", state);
  } catch (error) {
    console.error("[Socket.IO] Error publishing queue state to clients:", error);
  }
};

/**
 * Private helper to send queue state to a single socket connection on init.
 */
const publishQueueStateForSocket = async (socket: { id: string; emit: (event: string, data: unknown) => void }): Promise<void> => {
  try {
    const state = await fetchQueueState();
    socket.emit("queueUpdated", state);
  } catch (error) {
    console.error("[Socket.IO] Error publishing queue state to socket:", socket.id, error);
  }
};
