import mongoose, { Schema, Document } from "mongoose";

export interface IPatient extends Document {
  name: string;
  tokenNumber: string;
  createdAt: Date;
  calledAt?: Date;
  consultationStartedAt?: Date;
  status: "waiting" | "called";
  isEmergency: boolean;
}

const PatientSchema: Schema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  tokenNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
  createdAt: { type: Date, default: Date.now },
  calledAt: { type: Date },
  consultationStartedAt: { type: Date },
  status: { type: String, enum: ["waiting", "called"], default: "waiting" },
  isEmergency: { type: Boolean, default: false }
});

// Primary index to optimize FIFO sorting, priority sorting, and called status sorting
PatientSchema.index({ status: 1, isEmergency: -1, createdAt: 1 });
PatientSchema.index({ tokenNumber: 1 });

export default mongoose.models.Patient || mongoose.model<IPatient>("Patient", PatientSchema);
