import { Request, Response, NextFunction } from "express";
import Patient from "../models/Patient";
import QueueSettings from "../models/QueueSettings";
import { emitPatientAdded } from "../sockets/queueEvents";

export const getPatients = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Return all patients ordered by createdAt ASC, using .lean() for performance
    const patients = await Patient.find({}).sort({ createdAt: 1 }).lean();

    const formatted = patients.map((p) => ({
      id: p._id,
      name: p.name,
      tokenNumber: p.tokenNumber,
      status: p.status,
      isEmergency: p.isEmergency,
      createdAt: p.createdAt,
      calledAt: p.calledAt || null,
      consultationStartedAt: p.consultationStartedAt || null
    }));

    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const registerPatient = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const name = req.body.name?.trim();
    if (!name) {
      return res.status(400).json({ success: false, error: "Patient name is required." });
    }

    if (name.length > 100) {
      return res.status(400).json({ success: false, error: "Patient name must not exceed 100 characters." });
    }

    // Atomic increment of QueueSettings.lastTokenIndex and totalRegistered
    const settings = await QueueSettings.findOneAndUpdate(
      { configId: 1 },
      { $inc: { lastTokenIndex: 1, totalRegistered: 1 } },
      { new: true, upsert: true }
    );

    // Format token e.g. A001, A002
    const tokenNumber = `A${String(settings.lastTokenIndex).padStart(3, "0")}`;

    const newPatient = await Patient.create({
      name,
      tokenNumber,
      status: "waiting",
      isEmergency: false,
      createdAt: new Date()
    });

    // Emit Socket.IO event and publish state
    await emitPatientAdded(newPatient.name, newPatient.tokenNumber);

    return res.status(201).json({
      success: true,
      patient: {
        id: newPatient.id,
        name: newPatient.name,
        tokenNumber: newPatient.tokenNumber,
        status: newPatient.status,
        isEmergency: newPatient.isEmergency,
        createdAt: newPatient.createdAt,
        calledAt: newPatient.calledAt || null
      }
    });
  } catch (error) {
    next(error);
  }
};
