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
import { sanitizeInput } from "./middleware/sanitize";
import { initSocketServer, getConnectionCount } from "./sockets/socketServer";
import mongoose from "mongoose";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Parse allowed CORS origins from environment or use defaults
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map(s => s.trim())
  : [
      "https://queue-cure-virid.vercel.app",
      "https://queue-cure-analytics.onrender.com",
      "http://localhost:3000",
      "http://localhost:8000"
    ];

// Middleware
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT"],
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use(sanitizeInput);

// Routes
app.use("/api/patients", patientRoutes);
app.use("/api/queue", queueRoutes);
app.use("/api/emergencies", emergencyRoutes);
app.use("/api/auth", authRoutes);

// Health check endpoint — reports actual database connection state
app.get("/health", (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? "connected" : dbState === 2 ? "connecting" : "disconnected";
  res.json({
    status: dbStatus === "connected" ? "OK" : "DEGRADED",
    database: dbStatus,
    activeConnections: getConnectionCount()
  });
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

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  console.log(`[Server] Received ${signal}. Shutting down gracefully...`);
  httpServer.close(() => {
    console.log("[Server] HTTP server closed.");
  });
  try {
    await mongoose.connection.close();
    console.log("[Server] MongoDB connection closed.");
  } catch (err) {
    console.error("[Server] Error closing MongoDB connection:", err);
  }
  process.exit(0);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

startServer();
