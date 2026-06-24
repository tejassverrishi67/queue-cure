import mongoose, { Schema, Document } from "mongoose";

export interface IEmergencyRequest extends Document {
  tokenNumber: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  reviewedAt?: Date;
}

const EmergencyRequestSchema: Schema = new Schema({
  tokenNumber: { type: String, required: true, uppercase: true, trim: true },
  reason: { type: String, required: true, maxlength: 250 },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date }
});

EmergencyRequestSchema.index({ tokenNumber: 1, status: 1 });
EmergencyRequestSchema.index({ createdAt: 1 });

export default mongoose.models.EmergencyRequest || mongoose.model<IEmergencyRequest>("EmergencyRequest", EmergencyRequestSchema);
