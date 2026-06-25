import { Request, Response, NextFunction } from "express";
import Patient from "../models/Patient";
import QueueSettings, { IQueueSettings } from "../models/QueueSettings";
import EmergencyRequest from "../models/EmergencyRequest";
import {
  emitConsultationTimeUpdated,
  emitTokenAdvanced,
  emitQueueReset
} from "../sockets/queueEvents";

export const getSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const settings = await QueueSettings.findOne({ configId: 1 }).lean<IQueueSettings>();
    res.json({
      currentToken: settings?.currentToken || null,
      averageConsultationTime: settings?.averageConsultationTime ?? 5,
      lastTokenIndex: settings?.lastTokenIndex ?? 0,
      totalServed: settings?.totalServed ?? 0,
      totalRegistered: settings?.totalRegistered ?? 0
    });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { averageConsultationTime } = req.body;

    if (averageConsultationTime === undefined) {
      return res.status(400).json({ success: false, error: "averageConsultationTime is required." });
    }

    const value = parseInt(String(averageConsultationTime), 10);
    if (isNaN(value) || value < 1 || value > 120) {
      return res.status(400).json({ success: false, error: "Consultation time must be between 1 and 120 minutes." });
    }

    // Atomically find and update average consultation settings
    const settings = await QueueSettings.findOneAndUpdate(
      { configId: 1 },
      { $set: { averageConsultationTime: value } },
      { new: true, upsert: true }
    );

    // Emit Socket.IO event and refresh state
    await emitConsultationTimeUpdated(settings.averageConsultationTime);

    return res.json({
      success: true,
      settings: {
        currentToken: settings.currentToken || null,
        averageConsultationTime: settings.averageConsultationTime,
        lastTokenIndex: settings.lastTokenIndex
      }
    });
  } catch (error) {
    next(error);
  }
};

export const callNextPatient = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const now = new Date();

    // Atomically find the next waiting patient and mark them as called in a single query.
    // This prevents race conditions or double clicks calling the same patient multiple times.
    const nextPatient = await Patient.findOneAndUpdate(
      { status: "waiting" },
      { $set: { status: "called", calledAt: now, consultationStartedAt: now } },
      { sort: { isEmergency: -1, createdAt: 1 }, new: true }
    );

    if (!nextPatient) {
      return res.status(400).json({ success: false, error: "No patients are waiting in the queue." });
    }

    // Atomically update settings currentToken and increment totalServed
    await QueueSettings.findOneAndUpdate(
      { configId: 1 },
      {
        $set: { currentToken: nextPatient.tokenNumber },
        $inc: { totalServed: 1 }
      },
      { upsert: true }
    );

    // Emit Socket.IO event and refresh state
    await emitTokenAdvanced(nextPatient.tokenNumber, nextPatient.name);

    return res.json({
      success: true,
      calledToken: nextPatient.tokenNumber,
      patientName: nextPatient.name
    });
  } catch (error) {
    next(error);
  }
};

export const resetQueue = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Clear all patients
    await Patient.deleteMany({});

    // Clear all emergency requests
    await EmergencyRequest.deleteMany({});

    // Reset settings atomically (preserve averageConsultationTime, reset counters)
    await QueueSettings.findOneAndUpdate(
      { configId: 1 },
      { $set: { currentToken: null, lastTokenIndex: 0, totalServed: 0, totalRegistered: 0 } },
      { upsert: true }
    );

    // Emit Socket.IO event and refresh state
    await emitQueueReset();

    res.json({
      success: true
    });
  } catch (error) {
    next(error);
  }
};
