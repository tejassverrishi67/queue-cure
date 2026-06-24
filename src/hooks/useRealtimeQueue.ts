"use client";

import {
  Patient as SocketPatient,
  EmergencyRequest as SocketEmergencyRequest,
  QueueState as SocketQueueState,
  EventPayloadMap as SocketEventPayloadMap,
  ActionPayloadMap as SocketActionPayloadMap,
  IQueueManager as SocketIQueueManager,
  useSocketQueue
} from "./useSocketQueue";

export type Patient = SocketPatient;
export type EmergencyRequest = SocketEmergencyRequest;
export type QueueState = SocketQueueState;
export type EventPayloadMap = SocketEventPayloadMap;
export type ActionPayloadMap = SocketActionPayloadMap;
export type IQueueManager = SocketIQueueManager;

export { useSocketQueue as useRealtimeQueue };
