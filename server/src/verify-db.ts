import { connectDB } from "./config/db";
import mongoose from "mongoose";
import dotenv from "dotenv";
import QueueSettings from "./models/QueueSettings";
import Admin from "./models/Admin";

dotenv.config();

const verify = async () => {
  let exitCode = 0;

  try {
    console.log("[Verification] Starting database connection check...");

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI environment variable is not defined.");
    }

    await connectDB();
    console.log("[Verification] MongoDB connection and seeding succeeded!");

    console.log("[Verification] Validating models database operations...");
    const settings = await QueueSettings.findOne({ configId: 1 });
    console.log("[Verification] Retrieved Settings:", JSON.stringify(settings));

    const adminUser = await Admin.findOne({ username: "admin" });
    console.log("[Verification] Retrieved Admin User:", JSON.stringify(adminUser));

    if (settings && adminUser) {
      console.log("[Verification] Mongoose model validation and database handshake passed successfully!");
    } else {
      throw new Error("Seeded default documents were not found in database.");
    }
  } catch (error) {
    console.error("[Verification] Database verification FAILED:", error);
    exitCode = 1;
  } finally {
    try {
      await mongoose.connection.close();
      console.log("[Verification] Database connection closed.");
    } catch (err) {
      console.error("[Verification] Error closing mongoose connection:", err);
    }
    process.exit(exitCode);
  }
};

verify();
