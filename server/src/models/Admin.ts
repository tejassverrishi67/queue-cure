import mongoose, { Schema, Document } from "mongoose";

export interface IAdmin extends Document {
  username: string;
  password: string; // Plaintext for now, security updates to follow in post-migration stability phase
}

const AdminSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true }
});

export default mongoose.models.Admin || mongoose.model<IAdmin>("Admin", AdminSchema);
