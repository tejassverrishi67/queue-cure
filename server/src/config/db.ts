import mongoose from "mongoose";
import dotenv from "dotenv";
import QueueSettings from "../models/QueueSettings";
import Admin from "../models/Admin";

// Load env vars if not loaded yet
dotenv.config();

export const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/queue-cure";
    
    console.log(`[MongoDB] Attempting connection to MongoDB...`);
    await mongoose.connect(mongoUri);
    console.log(`[MongoDB] Connected successfully to database: ${mongoose.connection.name}`);

    // Perform an atomic upsert to ensure QueueSettings defaults are populated on startup
    const settings = await QueueSettings.findOneAndUpdate(
      { configId: 1 },
      {
        $setOnInsert: {
          configId: 1,
          currentToken: null,
          lastTokenIndex: 0,
          averageConsultationTime: 5
        }
      },
      { upsert: true, new: true }
    );
    console.log(`[MongoDB] QueueSettings document verified. Current config:`, JSON.stringify(settings));

    // Seed default receptionist user if not exists
    const adminUser = await Admin.findOneAndUpdate(
      { username: "admin" },
      {
        $setOnInsert: {
          username: "admin",
          password: "admin"
        }
      },
      { upsert: true, new: true }
    );
    console.log(`[MongoDB] Receptionist administrator user verified: "${adminUser.username}"`);

  } catch (error) {
    console.error(`[MongoDB] Database connection or seeding failure:`, error);
    throw error;
  }
};
