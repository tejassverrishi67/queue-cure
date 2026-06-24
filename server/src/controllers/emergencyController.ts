import { Request, Response, NextFunction } from "express";
import Patient from "../models/Patient";
import EmergencyRequest from "../models/EmergencyRequest";
import {
  emitEmergencyRequestSubmitted,
  emitEmergencyRequestReviewed
} from "../sockets/queueEvents";

export const getEmergencies = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const requests = await EmergencyRequest.find({}).sort({ createdAt: 1 });
    
    const formatted = requests.map(r => ({
      id: r.id,
      tokenNumber: r.tokenNumber,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt || null
    }));

    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const submitEmergency = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { tokenNumber, reason } = req.body;

    if (!tokenNumber || !reason) {
      return res.status(400).json({ success: false, error: "Token number and emergency reason are required." });
    }

    const tokenUpper = tokenNumber.trim().toUpperCase();
    const reasonTrimmed = reason.trim();

    if (!tokenUpper) {
      return res.status(400).json({ success: false, error: "Patient token number cannot be empty." });
    }
    if (!reasonTrimmed) {
      return res.status(400).json({ success: false, error: "Emergency reason cannot be empty." });
    }
    if (reasonTrimmed.length > 250) {
      return res.status(400).json({ success: false, error: "Emergency reason must not exceed 250 characters." });
    }

    // 1. Validate that patient actually exists and is waiting
    const patient = await Patient.findOne({ tokenNumber: tokenUpper });
    if (!patient) {
      return res.status(404).json({ success: false, error: "Token number is not registered in the active queue." });
    }

    if (patient.status !== "waiting") {
      return res.status(400).json({ success: false, error: "This token has already been called." });
    }

    // Hardening check: Prevent emergency submissions for patients already promoted to emergency
    if (patient.isEmergency) {
      return res.status(400).json({ success: false, error: "This patient is already marked as an emergency." });
    }

    // 2. Check if a pending emergency request already exists for the same token
    const existingRequest = await EmergencyRequest.findOne({
      tokenNumber: tokenUpper,
      status: "pending"
    });

    if (existingRequest) {
      return res.status(400).json({ success: false, error: "An emergency request is already awaiting review." });
    }

    // 3. Create the emergency request
    const newRequest = await EmergencyRequest.create({
      tokenNumber: tokenUpper,
      reason: reasonTrimmed,
      status: "pending",
      createdAt: new Date()
    });

    // Emit Socket.IO event and refresh state
    await emitEmergencyRequestSubmitted(newRequest.tokenNumber, newRequest.reason);

    return res.status(201).json({
      success: true,
      emergencyRequest: {
        id: newRequest.id,
        tokenNumber: newRequest.tokenNumber,
        reason: newRequest.reason,
        status: newRequest.status,
        createdAt: newRequest.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

export const reviewEmergency = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { requestId, tokenNumber, status } = req.body;

    if (!requestId || !tokenNumber || !status) {
      return res.status(400).json({ success: false, error: "requestId, tokenNumber, and status are required." });
    }

    if (status !== "approved" && status !== "rejected") {
      return res.status(400).json({ success: false, error: "Status must be 'approved' or 'rejected'." });
    }

    const reviewedAt = new Date();

    // 1. Update the request status and reviewedAt atomically ONLY if it is currently pending.
    // This blocks duplicate reviews (double-clicks or race conditions) completely.
    const emergencyReq = await EmergencyRequest.findOneAndUpdate(
      { _id: requestId, status: "pending" },
      { $set: { status, reviewedAt } },
      { new: true }
    );

    if (!emergencyReq) {
      const exists = await EmergencyRequest.findById(requestId);
      if (!exists) {
        return res.status(404).json({ success: false, error: "Emergency request not found." });
      } else {
        return res.status(400).json({ success: false, error: "This emergency request has already been reviewed." });
      }
    }

    // 2. If approved, mark patient as isEmergency = true in patients table atomically
    if (status === "approved") {
      const patient = await Patient.findOneAndUpdate(
        { tokenNumber: tokenNumber.toUpperCase(), status: "waiting" },
        { $set: { isEmergency: true } },
        { new: true }
      );

      if (!patient) {
        console.warn(`[Emergency Review] Patient with token ${tokenNumber} not found or not waiting.`);
      }
    }

    // Emit Socket.IO event and refresh state
    await emitEmergencyRequestReviewed(emergencyReq.tokenNumber, emergencyReq.status as "approved" | "rejected");

    return res.json({
      success: true,
      emergencyRequest: {
        id: emergencyReq.id,
        tokenNumber: emergencyReq.tokenNumber,
        reason: emergencyReq.reason,
        status: emergencyReq.status,
        createdAt: emergencyReq.createdAt,
        reviewedAt: emergencyReq.reviewedAt
      }
    });
  } catch (error) {
    next(error);
  }
};
