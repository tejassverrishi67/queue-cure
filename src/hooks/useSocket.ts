"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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

type Listener = (...args: any[]) => void;

class SupabaseSocketManager {
  private listeners: { [event: string]: Set<Listener> } = {};
  private isInitialized = false;
  private channel: any = null;
  private queueState: QueueState = {
    currentToken: null,
    averageConsultationTime: 5,
    waitingPatients: [],
    lastTokenIndex: 0
  };

  constructor() {
    this.init();
  }

  on(event: string, callback: Listener) {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }
    this.listeners[event].add(callback);

    // If we've already loaded the queueState, notify new listeners instantly on subscription
    if (event === "queueUpdated" && this.isInitialized) {
      callback(this.queueState);
    }
  }

  off(event: string, callback: Listener) {
    if (this.listeners[event]) {
      this.listeners[event].delete(callback);
    }
  }

  private dispatch(event: string, ...args: any[]) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        try {
          cb(...args);
        } catch (e) {
          console.error(`[SupabaseSocket] Error executing listener for event '${event}':`, e);
        }
      });
    }
  }

  private async init() {
    if (typeof window === "undefined" || !supabase) {
      if (!supabase) {
        console.warn("[SupabaseSocket] Supabase client is not available. Real-time updates and persistence are disabled.");
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
      .on("broadcast", { event: "patientAdded" }, ({ payload }: any) => {
        this.dispatch("patientAdded", payload);
      })
      .on("broadcast", { event: "tokenAdvanced" }, ({ payload }: any) => {
        this.dispatch("tokenAdvanced", payload);
      })
      .on("broadcast", { event: "queueReset" }, () => {
        this.dispatch("queueReset");
      })
      .on("broadcast", { event: "consultationTimeUpdated" }, ({ payload }: any) => {
        this.dispatch("consultationTimeUpdated", payload);
      });

    // Wire up database change listeners to automatically refetch state on updates
    this.channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "patients" },
        () => this.fetchAndPublishState()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_settings" },
        () => this.fetchAndPublishState()
      );

    // Subscribe to the channel
    this.channel.subscribe((status: string) => {
      console.log(`[SupabaseSocket] Realtime subscription status: ${status}`);
      if (status === "SUBSCRIBED") {
        this.dispatch("connect");
      } else {
        this.dispatch("disconnect");
      }
    });
  }

  async fetchAndPublishState() {
    if (!supabase) return;

    try {
      // Retrieve settings, upserting default configuration if row id = 1 is missing
      let { data: settings, error: settingsError } = await supabase
        .from("queue_settings")
        .select("*")
        .eq("id", 1)
        .single();

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
          console.error("[SupabaseSocket] Error initializing default queue_settings:", initError);
        } else {
          settings = newSettings;
        }
      }

      // Fetch all patients from the DB sorted by creation order
      const { data: patients, error: patientsError } = await supabase
        .from("patients")
        .select("*")
        .order("created_at", { ascending: true });

      if (patientsError) {
        console.error("[SupabaseSocket] Error fetching patients queue:", patientsError);
        return;
      }

      // Construct matching Socket.IO QueueState structure
      this.queueState = {
        currentToken: settings?.current_token || null,
        averageConsultationTime: settings?.average_consultation_time ?? 5,
        waitingPatients: (patients || []).map(p => ({
          id: p.id,
          name: p.name,
          tokenNumber: p.token_number,
          createdAt: p.created_at,
          calledAt: p.called_at || undefined,
          status: p.status as "waiting" | "called"
        })),
        lastTokenIndex: settings?.last_token_index ?? 0
      };

      this.dispatch("queueUpdated", this.queueState);
    } catch (err) {
      console.error("[SupabaseSocket] Failed to fetch and broadcast queue state:", err);
    }
  }

  async emit(event: string, data?: any) {
    if (!supabase) {
      console.warn(`[SupabaseSocket] Supabase client is not available. Cannot emit event: ${event}`);
      return;
    }

    if (event === "requestQueue") {
      this.fetchAndPublishState();
      return;
    }

    if (event === "addPatient") {
      if (!data || !data.name) return;
      const name = data.name.trim();

      try {
        // 1. Get current settings state
        const { data: settings } = await supabase
          .from("queue_settings")
          .select("last_token_index")
          .eq("id", 1)
          .single();

        const nextIndex = (settings?.last_token_index ?? 0) + 1;
        const newToken = `A${String(nextIndex).padStart(3, "0")}`;

        // 2. Update settings table
        await supabase
          .from("queue_settings")
          .update({ last_token_index: nextIndex })
          .eq("id", 1);

        // 3. Insert patient
        const { error: insertError } = await supabase
          .from("patients")
          .insert({
            name,
            token_number: newToken,
            status: "waiting",
            created_at: new Date().toISOString()
          });

        if (insertError) {
          console.error("[SupabaseSocket] Error registering patient:", insertError);
          return;
        }

        // 4. Broadcast notification event to other clients
        if (this.channel) {
          this.channel.send({
            type: "broadcast",
            event: "patientAdded",
            payload: { name, tokenNumber: newToken }
          });
        }

        // Trigger local toast alerts immediately
        this.dispatch("patientAdded", { name, tokenNumber: newToken });
        
        // Refetch DB state
        await this.fetchAndPublishState();
      } catch (err) {
        console.error("[SupabaseSocket] Failed to process addPatient event:", err);
      }
    }

    if (event === "callNext") {
      try {
        // 1. Find the first waiting patient in check-in order
        const { data: nextPatient, error } = await supabase
          .from("patients")
          .select("*")
          .eq("status", "waiting")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("[SupabaseSocket] Error searching next waiting patient:", error);
          return;
        }

        if (nextPatient) {
          const calledAt = new Date().toISOString();
          const currentToken = nextPatient.token_number;

          // 2. Mark status as called
          await supabase
            .from("patients")
            .update({ status: "called", called_at: calledAt })
            .eq("id", nextPatient.id);

          // 3. Set current token in global queue configuration
          await supabase
            .from("queue_settings")
            .update({ current_token: currentToken })
            .eq("id", 1);

          // 4. Broadcast token caller event
          if (this.channel) {
            this.channel.send({
              type: "broadcast",
              event: "tokenAdvanced",
              payload: { currentToken, patientName: nextPatient.name }
            });
          }

          // Trigger local event instantly
          this.dispatch("tokenAdvanced", { currentToken, patientName: nextPatient.name });

          // Refetch DB state
          await this.fetchAndPublishState();
        }
      } catch (err) {
        console.error("[SupabaseSocket] Failed to process callNext event:", err);
      }
    }

    if (event === "updateAverageConsultationTime") {
      if (!data || typeof data.minutes === "undefined") return;
      const mins = parseInt(data.minutes, 10);
      if (isNaN(mins) || mins < 1) return;

      try {
        // 1. Update DB config
        await supabase
          .from("queue_settings")
          .update({ average_consultation_time: mins })
          .eq("id", 1);

        // 2. Broadcast change
        if (this.channel) {
          this.channel.send({
            type: "broadcast",
            event: "consultationTimeUpdated",
            payload: { minutes: mins }
          });
        }

        // Dispatch local event
        this.dispatch("consultationTimeUpdated", { minutes: mins });

        // Refetch DB state
        await this.fetchAndPublishState();
      } catch (err) {
        console.error("[SupabaseSocket] Failed to update average consultation time settings:", err);
      }
    }

    if (event === "resetQueue") {
      try {
        // 1. Delete all patient rows
        await supabase.from("patients").delete().neq("id", "00000000-0000-0000-0000-000000000000");

        // 2. Reset queue config back to initial setup
        await supabase
          .from("queue_settings")
          .update({
            current_token: null,
            last_token_index: 0
          })
          .eq("id", 1);

        // 3. Broadcast queue cleared signal
        if (this.channel) {
          this.channel.send({
            type: "broadcast",
            event: "queueReset"
          });
        }

        // Dispatch local event
        this.dispatch("queueReset");

        // Refetch DB state
        await this.fetchAndPublishState();
      } catch (err) {
        console.error("[SupabaseSocket] Failed to process resetQueue event:", err);
      }
    }
  }
}

// Module-level singleton instance of our custom socket manager
let globalSocketManager: SupabaseSocketManager | null = null;

if (typeof window !== "undefined" && !globalSocketManager) {
  globalSocketManager = new SupabaseSocketManager();
}

export function useSocket() {
  const [socket] = useState<any>(globalSocketManager);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!globalSocketManager) return;

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    globalSocketManager.on("connect", handleConnect);
    globalSocketManager.on("disconnect", handleDisconnect);

    // Default to true if module is loaded on client side
    setIsConnected(true);

    return () => {
      if (globalSocketManager) {
        globalSocketManager.off("connect", handleConnect);
        globalSocketManager.off("disconnect", handleDisconnect);
      }
    };
  }, []);

  return { socket, isConnected };
}
