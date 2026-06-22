/* eslint-disable */
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = process.env.PORT || 3000;

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Path to local persistence file
const DB_FILE = path.join(__dirname, "queue-db.json");

// Helper to load state from JSON file
function loadState() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading queue-db.json:", err);
  }
  return {
    currentToken: null,
    averageConsultationTime: 5, // Default to 5 minutes
    waitingPatients: [], // All patients (both waiting and called)
    lastTokenIndex: 0
  };
}

let queueState = loadState();

// Helper to save state to JSON file
function saveState() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(queueState, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing queue-db.json:", err);
  }
}

// Token helper
function formatToken(index) {
  return `A${String(index).padStart(3, "0")}`;
}

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  // Attach Socket.IO to the HTTP server
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);
    
    // Immediately send the current state to the connecting client
    socket.emit("queueUpdated", queueState);

    // Event: Request Queue (handshake)
    socket.on("requestQueue", () => {
      console.log(`[Socket] State requested by client: ${socket.id}`);
      socket.emit("queueUpdated", queueState);
    });

    // Event: Add Patient
    socket.on("addPatient", (data) => {
      if (!data || !data.name) return;
      
      queueState.lastTokenIndex += 1;
      const newToken = formatToken(queueState.lastTokenIndex);
      
      const newPatient = {
        id: Date.now().toString() + "-" + Math.random().toString(36).substring(2, 9),
        name: data.name.trim(),
        tokenNumber: newToken,
        createdAt: new Date().toISOString(),
        status: "waiting"
      };

      queueState.waitingPatients.push(newPatient);
      saveState();
      
      console.log(`[Socket] Patient added: ${newPatient.name} with token ${newToken}`);
      io.emit("patientAdded", { name: newPatient.name, tokenNumber: newToken });
      io.emit("queueUpdated", queueState);
    });

    // Event: Call Next Patient
    socket.on("callNext", () => {
      // Find the first patient in waitingPatients with status === "waiting"
      const nextPatient = queueState.waitingPatients.find(p => p.status === "waiting");
      
      if (nextPatient) {
        nextPatient.status = "called";
        nextPatient.calledAt = new Date().toISOString();
        queueState.currentToken = nextPatient.tokenNumber;
        saveState();
        
        console.log(`[Socket] Called token: ${nextPatient.tokenNumber} (${nextPatient.name})`);
        io.emit("tokenAdvanced", { 
          currentToken: queueState.currentToken,
          patientName: nextPatient.name 
        });
        io.emit("queueUpdated", queueState);
      } else {
        console.log(`[Socket] Call Next triggered, but no waiting patients available.`);
      }
    });

    // Event: Update Average Consultation Time
    socket.on("updateAverageConsultationTime", (data) => {
      if (!data || typeof data.minutes === "undefined") return;
      
      const mins = parseInt(data.minutes, 10);
      if (!isNaN(mins) && mins >= 1) {
        queueState.averageConsultationTime = mins;
        saveState();
        
        console.log(`[Socket] Average consultation time updated to: ${mins} mins`);
        io.emit("consultationTimeUpdated", { minutes: mins });
        io.emit("queueUpdated", queueState);
      }
    });

    // Event: Reset Queue (helper command)
    socket.on("resetQueue", () => {
      queueState = {
        currentToken: null,
        averageConsultationTime: 5,
        waitingPatients: [],
        lastTokenIndex: 0
      };
      saveState();
      
      console.log("[Socket] Queue reset successfully");
      io.emit("queueReset");
      io.emit("queueUpdated", queueState);
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  httpServer.once("error", (err) => {
    console.error("Server error:", err);
    process.exit(1);
  });

  httpServer.listen(port, () => {
    console.log(`> Queue Cure Server running on http://${hostname}:${port}`);
  });
});
