"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

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

type Listener<K extends keyof EventPayloadMap> = (payload: EventPayloadMap[K]) => void;

export interface IQueueManager {
  isConnected(): boolean;
  on<K extends keyof EventPayloadMap>(event: K, callback: Listener<K>): void;
  off<K extends keyof EventPayloadMap>(event: K, callback: Listener<K>): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendAction<K extends keyof ActionPayloadMap>(event: K, data?: ActionPayloadMap[K]): Promise<any>;
}

class SocketQueueManager implements IQueueManager {
  private socket: Socket | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private listeners: { [event: string]: Set<(...args: any[]) => void> } = {};
  private queueState: QueueState = {
    currentToken: null,
    averageConsultationTime: 5,
    waitingPatients: [],
    lastTokenIndex: 0
  };
  private connected = false;
  private socketUrl: string;

  constructor() {
    const defaultUrl = "http://localhost:5000";
    this.socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || defaultUrl;
    this.init();
  }

  isConnected() {
    return this.connected;
  }

  on<K extends keyof EventPayloadMap>(event: K, callback: Listener<K>) {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.listeners[event].add(callback as (...args: any[]) => void);

    // Immediately trigger state update for new queueUpdated subscribers if initialized
    if (event === "queueUpdated") {
      (callback as Listener<"queueUpdated">)(this.queueState);
    }
  }

  off<K extends keyof EventPayloadMap>(event: K, callback: Listener<K>) {
    if (this.listeners[event]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.listeners[event].delete(callback as (...args: any[]) => void);
    }
  }

  private dispatch<K extends keyof EventPayloadMap>(event: K, payload: EventPayloadMap[K]) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((cb) => {
        try {
          (cb as unknown as Listener<K>)(payload);
        } catch (e) {
          console.error(`[SocketQueue] Error executing listener for event '${event}':`, e);
        }
      });
    }
  }

  private async init() {
    if (typeof window === "undefined") {
      return;
    }

    console.log(`[SocketQueue] Initializing Socket.IO connection to ${this.socketUrl}`);

    this.socket = io(this.socketUrl, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    this.socket.on("connect", async () => {
      console.log(`[SocketQueue] Connected to Socket.IO server: ${this.socket?.id}`);
      this.connected = true;
      this.dispatch("connect", undefined);
      
      // Load initial state on connection/reconnection to preserve refresh and reconnect behavior
      await this.fetchInitialState();
    });

    this.socket.on("disconnect", (reason) => {
      console.warn(`[SocketQueue] Disconnected from Socket.IO server. Reason: ${reason}`);
      this.connected = false;
      this.dispatch("disconnect", undefined);
    });

    this.socket.on("connect_error", (error) => {
      console.error("[SocketQueue] Socket connection error:", error);
      this.connected = false;
      this.dispatch("disconnect", undefined);
    });

    // Register handlers for realtime socket push events from the backend
    this.socket.on("queueUpdated", (state: QueueState) => {
      this.queueState = state;
      this.dispatch("queueUpdated", state);
    });

    this.socket.on("patientAdded", (payload: { name: string; tokenNumber: string }) => {
      this.dispatch("patientAdded", payload);
    });

    this.socket.on("tokenAdvanced", (payload: { currentToken: string; patientName: string }) => {
      this.dispatch("tokenAdvanced", payload);
    });

    this.socket.on("queueReset", () => {
      this.dispatch("queueReset", undefined);
    });

    this.socket.on("consultationTimeUpdated", (payload: { minutes: number }) => {
      this.dispatch("consultationTimeUpdated", payload);
    });

    this.socket.on("emergencyRequestSubmitted", (payload: { tokenNumber: string; reason: string }) => {
      this.dispatch("emergencyRequestSubmitted", payload);
    });

    this.socket.on("emergencyRequestReviewed", (payload: { tokenNumber: string; status: "approved" | "rejected" }) => {
      this.dispatch("emergencyRequestReviewed", payload);
    });
  }

  private async fetchInitialState() {
    try {
      // 1. Fetch settings
      const settingsRes = await fetch(`${this.socketUrl}/api/queue/settings`);
      if (!settingsRes.ok) throw new Error("Failed to fetch settings initial state");
      const settings = await settingsRes.json();

      // 2. Fetch patients list
      const patientsRes = await fetch(`${this.socketUrl}/api/patients`);
      if (!patientsRes.ok) throw new Error("Failed to fetch patients list initial state");
      const patients = await patientsRes.json();

      // 3. Fetch emergency requests list
      let emergencyRequests: EmergencyRequest[] = [];
      try {
        const emergenciesRes = await fetch(`${this.socketUrl}/api/emergencies`);
        if (emergenciesRes.ok) {
          emergencyRequests = await emergenciesRes.json();
        }
      } catch (err) {
        console.warn("[SocketQueue] Failed to load emergency requests on initial load (failure isolated):", err);
      }

      this.queueState = {
        currentToken: settings.currentToken,
        averageConsultationTime: settings.averageConsultationTime,
        lastTokenIndex: settings.lastTokenIndex,
        waitingPatients: patients,
        emergencyRequests
      };

      // Push initial constructed state to subscribers
      this.dispatch("queueUpdated", this.queueState);
    } catch (err) {
      console.error("[SocketQueue] Error loading initial state:", err);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async sendAction<K extends keyof ActionPayloadMap>(event: K, data?: ActionPayloadMap[K]): Promise<any> {
    let url = "";
    let method = "POST";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let bodyObj: any = null;

    if (event === "patientAdded") {
      url = `${this.socketUrl}/api/patients`;
      bodyObj = { name: (data as { name: string }).name };
    } else if (event === "tokenAdvanced") {
      url = `${this.socketUrl}/api/queue/next`;
    } else if (event === "queueReset") {
      url = `${this.socketUrl}/api/queue/reset`;
    } else if (event === "consultationTimeUpdated") {
      url = `${this.socketUrl}/api/queue/settings`;
      method = "PUT";
      bodyObj = { averageConsultationTime: (data as { minutes: number }).minutes };
    } else if (event === "emergencyRequestSubmitted") {
      url = `${this.socketUrl}/api/emergencies`;
      bodyObj = {
        tokenNumber: (data as { tokenNumber: string }).tokenNumber,
        reason: (data as { reason: string }).reason
      };
    } else if (event === "emergencyRequestReviewed") {
      url = `${this.socketUrl}/api/emergencies/review`;
      bodyObj = {
        requestId: (data as { requestId: string }).requestId,
        tokenNumber: (data as { tokenNumber: string }).tokenNumber,
        status: (data as { status: "approved" | "rejected" }).status
      };
    } else if (event === "queueUpdated") {
      await this.fetchInitialState();
      return;
    } else {
      throw new Error(`Unsupported queue action event: ${event}`);
    }

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: bodyObj ? JSON.stringify(bodyObj) : undefined
      });

      const resData = await response.json();

      if (!response.ok || resData.success === false) {
        throw new Error(resData.error || `Request failed with HTTP status ${response.status}`);
      }

      return resData;
    } catch (err) {
      console.error(`[SocketQueue] Action execution error for '${event}':`, err);
      throw err; // Reject the promise so that the page's toast/alert system can display the error
    }
  }
}

// Singleton Socket manager
let globalQueueManager: SocketQueueManager | null = null;

if (typeof window !== "undefined" && !globalQueueManager) {
  globalQueueManager = new SocketQueueManager();
}

export function useSocketQueue() {
  const [queueManager] = useState<SocketQueueManager | null>(globalQueueManager);
  const [isConnected, setIsConnected] = useState(
    globalQueueManager ? globalQueueManager.isConnected() : false
  );

  useEffect(() => {
    if (!globalQueueManager) return;

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    globalQueueManager.on("connect", handleConnect);
    globalQueueManager.on("disconnect", handleDisconnect);

    // Sync state on mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsConnected(globalQueueManager.isConnected());

    return () => {
      if (globalQueueManager) {
        globalQueueManager.off("connect", handleConnect);
        globalQueueManager.off("disconnect", handleDisconnect);
      }
    };
  }, []);

  return { queueManager, isConnected };
}
