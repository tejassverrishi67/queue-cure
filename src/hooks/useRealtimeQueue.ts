"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

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

class SupabaseQueueManager {
  private listeners: { [event: string]: Set<(...args: never[]) => void> } = {};
  private isInitialized = false;
  private channel: RealtimeChannel | null = null;
  private queueState: QueueState = {
    currentToken: null,
    averageConsultationTime: 5,
    waitingPatients: [],
    lastTokenIndex: 0
  };
  private connected = false;

  constructor() {
    this.init();
  }

  isConnected() {
    return this.connected;
  }

  on<K extends keyof EventPayloadMap>(event: K, callback: Listener<K>) {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }
    this.listeners[event].add(callback as (...args: never[]) => void);

    // If we've already loaded the queueState, notify new listeners instantly on subscription
    if (event === "queueUpdated" && this.isInitialized) {
      (callback as Listener<"queueUpdated">)(this.queueState);
    }
  }

  off<K extends keyof EventPayloadMap>(event: K, callback: Listener<K>) {
    if (this.listeners[event]) {
      this.listeners[event].delete(callback as (...args: never[]) => void);
    }
  }

  private dispatch<K extends keyof EventPayloadMap>(event: K, payload: EventPayloadMap[K]) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        try {
          (cb as unknown as Listener<K>)(payload);
        } catch (e) {
          console.error(`[SupabaseQueue] Error executing listener for event '${event}':`, e);
        }
      });
    }
  }

  private async init() {
    if (typeof window === "undefined" || !supabase) {
      if (!supabase) {
        console.warn("[SupabaseQueue] Supabase client is not available. Real-time updates and database operations are disabled.");
      }
      return;
    }

    // 1. Fetch the initial queue state from database
    await this.fetchAndPublishState();
    this.isInitialized = true;

    // 2. Setup the Realtime subscription channel
    this.channel = supabase.channel("queue_events", {
      config: {
        broadcast: { self: false }
      }
    });

    // Wire up custom broadcast listener events
    this.channel
      .on("broadcast", { event: "patientAdded" }, ({ payload }: { payload: { name: string; tokenNumber: string } }) => {
        this.dispatch("patientAdded", payload);
      })
      .on("broadcast", { event: "tokenAdvanced" }, ({ payload }: { payload: { currentToken: string; patientName: string } }) => {
        this.dispatch("tokenAdvanced", payload);
      })
      .on("broadcast", { event: "queueReset" }, () => {
        this.dispatch("queueReset", undefined);
      })
      .on("broadcast", { event: "consultationTimeUpdated" }, ({ payload }: { payload: { minutes: number } }) => {
        this.dispatch("consultationTimeUpdated", payload);
      })
      .on("broadcast", { event: "emergencyRequestSubmitted" }, ({ payload }: { payload: { tokenNumber: string; reason: string } }) => {
        this.dispatch("emergencyRequestSubmitted", payload);
      })
      .on("broadcast", { event: "emergencyRequestReviewed" }, ({ payload }: { payload: { tokenNumber: string; status: "approved" | "rejected" } }) => {
        this.dispatch("emergencyRequestReviewed", payload);
      });

    // Wire up database change listeners to automatically refetch state on updates
    this.channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "patients" },
        () => {
          this.fetchAndPublishState();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_settings" },
        () => {
          this.fetchAndPublishState();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "emergency_requests" },
        () => {
          this.fetchAndPublishState();
        }
      );

    // Subscribe to the channel
    this.channel.subscribe((status: string) => {
      console.log(`[SupabaseQueue] Realtime subscription status: ${status}`);
      if (status === "SUBSCRIBED") {
        this.connected = true;
        this.dispatch("connect", undefined);
      } else {
        this.connected = false;
        this.dispatch("disconnect", undefined);
      }
    });
  }

  async fetchAndPublishState() {
    if (!supabase) return;

    try {
      // Retrieve settings, upserting default configuration if row id = 1 is missing
      const { data: settings, error: settingsError } = await supabase
        .from("queue_settings")
        .select("*")
        .eq("id", 1)
        .single();

      let currentSettings = settings;

      if (settingsError || !settings) {
        const { data: newSettings, error: initError } = await supabase
          .from("queue_settings")
          .upsert({
            id: 1,
            current_token: null,
            last_token_index: 0,
            average_consultation_time: 5
          })
          .select()
          .single();

        if (initError) {
          console.error("[SupabaseQueue] Error initializing default queue_settings:", initError);
        } else {
          currentSettings = newSettings;
        }
      }

      // Fetch all patients from the DB sorted by creation order
      const { data: patients, error: patientsError } = await supabase
        .from("patients")
        .select("*")
        .order("created_at", { ascending: true });

      if (patientsError) {
        console.error("[SupabaseQueue] Error fetching patients queue:", patientsError);
        return;
      }

      // Fetch all emergency requests from the DB sorted by creation order
      const { data: emergencyRequests, error: emergencyError } = await supabase
        .from("emergency_requests")
        .select("*")
        .order("created_at", { ascending: true });

      if (emergencyError) {
        console.error("[SupabaseQueue] Error fetching emergency requests:", emergencyError);
      }

      // Construct QueueState structure
      this.queueState = {
        currentToken: currentSettings?.current_token || null,
        averageConsultationTime: currentSettings?.average_consultation_time ?? 5,
        waitingPatients: (patients || []).map(p => ({
          id: p.id,
          name: p.name,
          tokenNumber: p.token_number,
          createdAt: p.created_at,
          calledAt: p.called_at || undefined,
          status: p.status as "waiting" | "called",
          isEmergency: p.is_emergency || false
        })),
        lastTokenIndex: currentSettings?.last_token_index ?? 0,
        emergencyRequests: (emergencyRequests || []).map(r => ({
          id: r.id,
          tokenNumber: r.token_number,
          reason: r.reason,
          status: r.status as "pending" | "approved" | "rejected",
          createdAt: r.created_at,
          reviewedAt: r.reviewed_at || undefined
        }))
      };

      this.dispatch("queueUpdated", this.queueState);
    } catch (err) {
      console.error("[SupabaseQueue] Failed to fetch and broadcast queue state:", err);
    }
  }

  async sendAction<K extends keyof ActionPayloadMap>(event: K, data?: ActionPayloadMap[K]) {
    if (!supabase) {
      console.warn(`[SupabaseQueue] Supabase client is not available. Cannot send action: ${event}`);
      return;
    }

    if (event === "queueUpdated") {
      this.fetchAndPublishState();
      return;
    }

    if (event === "patientAdded") {
      const payload = data as { name: string };
      if (!payload || !payload.name) return;
      const name = payload.name.trim();

      try {
        const { data: settings } = await supabase
          .from("queue_settings")
          .select("last_token_index")
          .eq("id", 1)
          .single();

        const nextIndex = (settings?.last_token_index ?? 0) + 1;
        const newToken = `A${String(nextIndex).padStart(3, "0")}`;

        await supabase
          .from("queue_settings")
          .update({ last_token_index: nextIndex })
          .eq("id", 1);

        const { error: insertError } = await supabase
          .from("patients")
          .insert({
            name,
            token_number: newToken,
            status: "waiting",
            created_at: new Date().toISOString()
          });

        if (insertError) {
          console.error("[SupabaseQueue] Error registering patient:", insertError);
          return;
        }

        if (this.channel) {
          this.channel.send({
            type: "broadcast",
            event: "patientAdded",
            payload: { name, tokenNumber: newToken }
          });
        }

        this.dispatch("patientAdded", { name, tokenNumber: newToken });
        await this.fetchAndPublishState();
      } catch (err) {
        console.error("[SupabaseQueue] Failed to process patientAdded event:", err);
      }
    }

    if (event === "tokenAdvanced") {
      try {
        const { data: nextPatient, error } = await supabase
          .from("patients")
          .select("*")
          .eq("status", "waiting")
          .order("is_emergency", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("[SupabaseQueue] Error searching next waiting patient:", error);
          return;
        }

        if (nextPatient) {
          const calledAt = new Date().toISOString();
          const currentToken = nextPatient.token_number;

          await supabase
            .from("patients")
            .update({ status: "called", called_at: calledAt })
            .eq("id", nextPatient.id);

          await supabase
            .from("queue_settings")
            .update({ current_token: currentToken })
            .eq("id", 1);

          if (this.channel) {
            this.channel.send({
              type: "broadcast",
              event: "tokenAdvanced",
              payload: { currentToken, patientName: nextPatient.name }
            });
          }

          this.dispatch("tokenAdvanced", { currentToken, patientName: nextPatient.name });
          await this.fetchAndPublishState();
        }
      } catch (err) {
        console.error("[SupabaseQueue] Failed to process tokenAdvanced event:", err);
      }
    }

    if (event === "consultationTimeUpdated") {
      const payload = data as { minutes: number };
      if (!payload || typeof payload.minutes === "undefined") return;
      const mins = parseInt(String(payload.minutes), 10);
      if (isNaN(mins) || mins < 1) return;

      try {
        await supabase
          .from("queue_settings")
          .update({ average_consultation_time: mins })
          .eq("id", 1);

        if (this.channel) {
          this.channel.send({
            type: "broadcast",
            event: "consultationTimeUpdated",
            payload: { minutes: mins }
          });
        }

        this.dispatch("consultationTimeUpdated", { minutes: mins });
        await this.fetchAndPublishState();
      } catch (err) {
        console.error("[SupabaseQueue] Failed to update average consultation time settings:", err);
      }
    }

    if (event === "emergencyRequestSubmitted") {
      const payload = data as { tokenNumber: string; reason: string };
      if (!payload || !payload.tokenNumber || !payload.reason) return;
      const { tokenNumber, reason } = payload;

      try {
        const { error } = await supabase
          .from("emergency_requests")
          .insert({
            token_number: tokenNumber,
            reason: reason,
            status: "pending",
            created_at: new Date().toISOString()
          });

        if (error) {
          console.error("[SupabaseQueue] Error creating emergency request:", error);
          return;
        }

        if (this.channel) {
          this.channel.send({
            type: "broadcast",
            event: "emergencyRequestSubmitted",
            payload: { tokenNumber, reason }
          });
        }

        this.dispatch("emergencyRequestSubmitted", { tokenNumber, reason });
        await this.fetchAndPublishState();
      } catch (err) {
        console.error("[SupabaseQueue] Failed to submit emergency request:", err);
      }
    }

    if (event === "emergencyRequestReviewed") {
      const payload = data as { requestId: string; tokenNumber: string; status: "approved" | "rejected" };
      if (!payload || !payload.requestId || !payload.tokenNumber || !payload.status) return;
      const { requestId, tokenNumber, status } = payload;

      try {
        const reviewedAt = new Date().toISOString();

        // 1. Update emergency request status
        const { error: requestError } = await supabase
          .from("emergency_requests")
          .update({
            status,
            reviewed_at: reviewedAt
          })
          .eq("id", requestId);

        if (requestError) {
          console.error("[SupabaseQueue] Error updating emergency request:", requestError);
          return;
        }

        // 2. If approved, mark patient as emergency in patients table
        if (status === "approved") {
          const { error: patientError } = await supabase
            .from("patients")
            .update({ is_emergency: true })
            .eq("token_number", tokenNumber)
            .eq("status", "waiting"); // Only waiting patients can be set to emergency

          if (patientError) {
            console.error("[SupabaseQueue] Error setting patient emergency status:", patientError);
          }
        }

        if (this.channel) {
          this.channel.send({
            type: "broadcast",
            event: "emergencyRequestReviewed",
            payload: { tokenNumber, status }
          });
        }

        this.dispatch("emergencyRequestReviewed", { tokenNumber, status });
        await this.fetchAndPublishState();
      } catch (err) {
        console.error("[SupabaseQueue] Failed to review emergency request:", err);
      }
    }

    if (event === "queueReset") {
      try {
        // Clear emergency requests and patients tables
        await supabase.from("emergency_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await supabase.from("patients").delete().neq("id", "00000000-0000-0000-0000-000000000000");

        await supabase
          .from("queue_settings")
          .update({
            current_token: null,
            last_token_index: 0
          })
          .eq("id", 1);

        if (this.channel) {
          this.channel.send({
            type: "broadcast",
            event: "queueReset"
          });
        }

        this.dispatch("queueReset", undefined);
        await this.fetchAndPublishState();
      } catch (err) {
        console.error("[SupabaseQueue] Failed to process queueReset event:", err);
      }
    }
  }
}

// Singleton queue manager instance
let globalQueueManager: SupabaseQueueManager | null = null;

if (typeof window !== "undefined" && !globalQueueManager) {
  globalQueueManager = new SupabaseQueueManager();
}

export function useRealtimeQueue() {
  const [queueManager] = useState<SupabaseQueueManager | null>(globalQueueManager);
  const [isConnected, setIsConnected] = useState(
    globalQueueManager ? globalQueueManager.isConnected() : false
  );

  useEffect(() => {
    if (!globalQueueManager) return;

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    globalQueueManager.on("connect", handleConnect);
    globalQueueManager.on("disconnect", handleDisconnect);

    return () => {
      if (globalQueueManager) {
        globalQueueManager.off("connect", handleConnect);
        globalQueueManager.off("disconnect", handleDisconnect);
      }
    };
  }, []);

  return { queueManager, isConnected };
}
