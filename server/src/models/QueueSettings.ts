import mongoose, { Schema, Document } from "mongoose";

export interface IQueueSettings extends Document {
  configId: number;
  currentToken: string | null;
  lastTokenIndex: number;
  averageConsultationTime: number;
}

const QueueSettingsSchema: Schema = new Schema({
  configId: { type: Number, default: 1, unique: true },
  currentToken: { type: String, default: null },
  lastTokenIndex: { type: Number, default: 0 },
  averageConsultationTime: { type: Number, default: 5 }
});

export default mongoose.models.QueueSettings || mongoose.model<IQueueSettings>("QueueSettings", QueueSettingsSchema);
