"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

let globalSocket: Socket | null = null;

// Instantly initialize the socket at the module level on client side
if (typeof window !== "undefined" && !globalSocket) {
  globalSocket = io({
    autoConnect: true,
    transports: ["websocket", "polling"]
  });
}

export interface Patient {
  id: string;
  name: string;
  tokenNumber: string;
  createdAt: string;
  calledAt?: string;
  status: "waiting" | "called";
}

export interface QueueState {
  currentToken: string | null;
  averageConsultationTime: number;
  waitingPatients: Patient[];
  lastTokenIndex: number;
}

export function useSocket() {
  const [socket] = useState<Socket | null>(globalSocket);
  const [isConnected, setIsConnected] = useState(globalSocket ? globalSocket.connected : false);

  useEffect(() => {
    if (!globalSocket) return;

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    globalSocket.on("connect", handleConnect);
    globalSocket.on("disconnect", handleDisconnect);

    // Keep connection state aligned asynchronously
    if (globalSocket.connected !== isConnected) {
      const currentConnected = globalSocket.connected;
      setTimeout(() => {
        setIsConnected(currentConnected);
      }, 0);
    }

    return () => {
      if (globalSocket) {
        globalSocket.off("connect", handleConnect);
        globalSocket.off("disconnect", handleDisconnect);
      }
    };
  }, [isConnected]);

  return { socket, isConnected };
}
