import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { connectDB } from "./config/db";
import patientRoutes from "./routes/patientRoutes";
import queueRoutes from "./routes/queueRoutes";
import emergencyRoutes from "./routes/emergencyRoutes";
import authRoutes from "./routes/authRoutes";
import { errorHandler } from "./middleware/errorHandler";
import { initSocketServer } from "./sockets/socketServer";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/patients", patientRoutes);
app.use("/api/queue", queueRoutes);
app.use("/api/emergencies", emergencyRoutes);
app.use("/api/auth", authRoutes);

// Catch-all health check / route
app.get("/health", (req, res) => {
  res.json({ status: "OK", database: "connected" });
});

// Global Error Handler
app.use(errorHandler);

const httpServer = http.createServer(app);

// Connect to Database and start server
const startServer = async () => {
  try {
    console.log("[Server] Connecting to MongoDB...");
    await connectDB();
    console.log("[Server] Database connected successfully.");

    // Initialize Socket.IO server
    initSocketServer(httpServer);
    console.log("[Server] Socket.IO server initialized.");

    httpServer.listen(PORT, () => {
      console.log(`[Server] Express API and Socket.IO running on port ${PORT}`);
    });
  } catch (error) {
    console.error("[Server] Database connection failed. Failing fast.", error);
    process.exit(1);
  }
};

startServer();
