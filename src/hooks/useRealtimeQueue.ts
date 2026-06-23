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
  private emergencyChannel: RealtimeChannel | null = null;
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

    // 3. Setup the Emergency subscription channel separately for safety
    try {
      this.emergencyChannel = supabase.channel("emergency_events", {
        config: {
          broadcast: { self: false }
        }
      });

      this.emergencyChannel
        .on("broadcast", { event: "emergencyRequestSubmitted" }, ({ payload }: { payload: { tokenNumber: string; reason: string } }) => {
          this.dispatch("emergencyRequestSubmitted", payload);
        })
        .on("broadcast", { event: "emergencyRequestReviewed" }, ({ payload }: { payload: { tokenNumber: string; status: "approved" | "rejected" } }) => {
          this.dispatch("emergencyRequestReviewed", payload);
        });

      this.emergencyChannel
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "emergency_requests" },
          () => {
            this.fetchAndPublishState();
          }
        );

      this.emergencyChannel.subscribe((status: string) => {
        console.log(`[SupabaseQueue] Emergency subscription status: ${status}`);
      });
    } catch (err) {
      console.warn("[SupabaseQueue] Failed to setup emergency realtime channel:", err);
    }
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
      let emergencyRequests = [];
      try {
        const { data: reqs, error: emergencyError } = await supabase
          .from("emergency_requests")
          .select("*")
          .order("created_at", { ascending: true });

        if (emergencyError) {
          console.warn("[SupabaseQueue] Error fetching emergency requests:", emergencyError);
        } else {
          emergencyRequests = reqs || [];
        }
      } catch (err) {
        console.warn("[SupabaseQueue] Exception fetching emergency requests:", err);
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
      throw new Error("Database connection is offline. Please check your configuration.");
    }

    if (event === "queueUpdated") {
      await this.fetchAndPublishState();
      return;
    }

    if (event === "patientAdded") {
      const payload = data as { name: string };
      if (!payload || !payload.name) {
        throw new Error("Patient name is required.");
      }
      const name = payload.name.trim();
      if (!name) {
        throw new Error("Patient name cannot be empty or blank space.");
      }

      try {
        const { data: settings, error: settingsError } = await supabase
          .from("queue_settings")
          .select("last_token_index")
          .eq("id", 1)
          .single();

        if (settingsError) {
          console.error("[SupabaseQueue] Error retrieving token settings:", settingsError);
          throw new Error("Failed to retrieve queue settings from database.");
        }

        const nextIndex = (settings?.last_token_index ?? 0) + 1;
        const newToken = `A${String(nextIndex).padStart(3, "0")}`;

        const { error: updateError } = await supabase
          .from("queue_settings")
          .update({ last_token_index: nextIndex })
          .eq("id", 1);

        if (updateError) {
          console.error("[SupabaseQueue] Error incrementing token index:", updateError);
          throw new Error("Failed to generate a new token number.");
        }

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
          throw new Error(insertError.message || "Failed to register patient in database.");
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
        throw err;
      }
    }

    if (event === "tokenAdvanced") {
      try {
        let res;
        try {
          res = await supabase
            .from("patients")
            .select("*")
            .eq("status", "waiting")
            .order("is_emergency", { ascending: false })
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (res.error) {
            throw res.error;
          }
        } catch (dbErr) {
          console.warn("[SupabaseQueue] Emergency order query failed, falling back to FIFO:", dbErr);
          res = await supabase
            .from("patients")
            .select("*")
            .eq("status", "waiting")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
        }

        if (res.error) {
          console.error("[SupabaseQueue] Error searching next waiting patient:", res.error);
          throw new Error("Failed to query next patient in queue.");
        }

        const nextPatient = res.data;

        if (nextPatient) {
          const calledAt = new Date().toISOString();
          const currentToken = nextPatient.token_number;

          const { error: patientError } = await supabase
            .from("patients")
            .update({ status: "called", called_at: calledAt })
            .eq("id", nextPatient.id);

          if (patientError) {
            console.error("[SupabaseQueue] Error setting patient status to called:", patientError);
            throw new Error("Failed to advance patient status.");
          }

          const { error: settingsError } = await supabase
            .from("queue_settings")
            .update({ current_token: currentToken })
            .eq("id", 1);

          if (settingsError) {
            console.error("[SupabaseQueue] Error setting current token index:", settingsError);
            throw new Error("Failed to update active serving token settings.");
          }

          if (this.channel) {
            this.channel.send({
              type: "broadcast",
              event: "tokenAdvanced",
              payload: { currentToken, patientName: nextPatient.name }
            });
          }

          this.dispatch("tokenAdvanced", { currentToken, patientName: nextPatient.name });
          await this.fetchAndPublishState();
        } else {
          throw new Error("No patients are waiting in the queue.");
        }
      } catch (err) {
        console.error("[SupabaseQueue] Failed to process tokenAdvanced event:", err);
        throw err;
      }
    }

    if (event === "consultationTimeUpdated") {
      const payload = data as { minutes: number };
      if (!payload || typeof payload.minutes === "undefined") {
        throw new Error("Minutes value is required.");
      }
      const mins = parseInt(String(payload.minutes), 10);
      if (isNaN(mins) || mins < 1 || mins > 60) {
        throw new Error("Consultation time must be between 1 and 60 minutes.");
      }

      try {
        const { error } = await supabase
          .from("queue_settings")
          .update({ average_consultation_time: mins })
          .eq("id", 1);

        if (error) {
          console.error("[SupabaseQueue] Error setting average consultation time:", error);
          throw new Error("Failed to save consultation settings.");
        }

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
        throw err;
      }
    }

    if (event === "emergencyRequestSubmitted") {
      const payload = data as { tokenNumber: string; reason: string };
      if (!payload || !payload.tokenNumber || !payload.reason) {
        throw new Error("Token number and emergency reason are required.");
      }
      const tokenNumber = payload.tokenNumber.trim().toUpperCase();
      const reason = payload.reason.trim();

      if (!tokenNumber) {
        throw new Error("Patient token number cannot be empty.");
      }
      if (!reason) {
        throw new Error("Emergency reason cannot be empty.");
      }
      if (reason.length > 250) {
        throw new Error("Emergency reason must not exceed 250 characters.");
      }

      try {
        // 1. Check if a pending emergency request already exists for the same token
        const { data: existingRequests, error: checkError } = await supabase
          .from("emergency_requests")
          .select("id")
          .eq("token_number", tokenNumber)
          .eq("status", "pending")
          .limit(1);

        if (checkError) {
          console.error("[SupabaseQueue] Error checking for existing emergency request:", checkError);
          throw new Error("Failed to check for existing emergency requests.");
        }

        if (existingRequests && existingRequests.length > 0) {
          throw new Error("An emergency request is already awaiting review.");
        }

        // 2. Validate that patient actually exists and is waiting
        const { data: patient, error: patientError } = await supabase
          .from("patients")
          .select("status")
          .eq("token_number", tokenNumber)
          .maybeSingle();

        if (patientError) {
          console.error("[SupabaseQueue] Error verifying patient token:", patientError);
          throw new Error("Failed to verify patient token registration.");
        }

        if (!patient) {
          throw new Error("Token number is not registered in the active queue.");
        }

        if (patient.status !== "waiting") {
          throw new Error("This token has already been called.");
        }

        // 3. Insert the new emergency request row
        const { error: insertError } = await supabase
          .from("emergency_requests")
          .insert({
            token_number: tokenNumber,
            reason: reason,
            status: "pending",
            created_at: new Date().toISOString()
          });

        if (insertError) {
          console.error("[SupabaseQueue] Error creating emergency request:", insertError);
          throw new Error("Failed to submit emergency request.");
        }

        if (this.emergencyChannel) {
          this.emergencyChannel.send({
            type: "broadcast",
            event: "emergencyRequestSubmitted",
            payload: { tokenNumber, reason }
          });
        }

        this.dispatch("emergencyRequestSubmitted", { tokenNumber, reason });
        await this.fetchAndPublishState();
      } catch (err) {
        console.error("[SupabaseQueue] Failed to submit emergency request:", err);
        throw err;
      }
    }

    if (event === "emergencyRequestReviewed") {
      const payload = data as { requestId: string; tokenNumber: string; status: "approved" | "rejected" };
      if (!payload || !payload.requestId || !payload.tokenNumber || !payload.status) {
        throw new Error("Request details are missing.");
      }
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
          console.error("[SupabaseQueue] Error updating emergency request status:", requestError);
          throw new Error("Failed to update emergency request status.");
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
            throw new Error("Failed to apply emergency status to patient.");
          }
        }

        if (this.emergencyChannel) {
          this.emergencyChannel.send({
            type: "broadcast",
            event: "emergencyRequestReviewed",
            payload: { tokenNumber, status }
          });
        }

        this.dispatch("emergencyRequestReviewed", { tokenNumber, status });
        await this.fetchAndPublishState();
      } catch (err) {
        console.error("[SupabaseQueue] Failed to review emergency request:", err);
        throw err;
      }
    }

    if (event === "queueReset") {
      try {
        // Clear emergency requests table
        const { error: emergencyErr } = await supabase
          .from("emergency_requests")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");

        if (emergencyErr) {
          console.warn("[SupabaseQueue] Warning: Failed to clear emergency requests:", emergencyErr);
        }

        // Clear patients table
        const { error: patientsErr } = await supabase
          .from("patients")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");

        if (patientsErr) {
          console.error("[SupabaseQueue] Error clearing patients:", patientsErr);
          throw new Error("Failed to clear patients queue.");
        }

        const { error: settingsErr } = await supabase
          .from("queue_settings")
          .update({
            current_token: null,
            last_token_index: 0
          })
          .eq("id", 1);

        if (settingsErr) {
          console.error("[SupabaseQueue] Error resetting queue settings:", settingsErr);
          throw new Error("Failed to reset index settings.");
        }

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
        throw err;
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
