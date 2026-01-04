import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { PrismaClient } from "@prisma/client"
import authRoutes from "./routes/auth.js"
import deskRoutes from "./routes/desks.js"
import roomRoutes from "./routes/rooms.js"
import adminRoutes from "./routes/admin.js"
import sensorRoutes from "./routes/sensors.js"
import { initMqtt } from "./services/mqtt-client.js"
import { startMockDataService } from "./services/mock-data.js"

dotenv.config()

const app = express()
const prisma = new PrismaClient()

// Initialize MQTT connection
initMqtt().catch((err) => {
  console.error("Failed to initialize MQTT:", err)
})

// Start mock data service for DHT only (desk occupancy is fixed)
// ESP32 desk (identified by esp32DeviceId) will change via MQTT
startMockDataService(10000) // Generate DHT data every 10 seconds

// Middleware
app.use(cors())
app.use(express.json())

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "Backend is running", timestamp: new Date().toISOString() })
})

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/desks", deskRoutes)
app.use("/api/rooms", roomRoutes)
app.use("/api/sensors", sensorRoutes)
app.use("/api/admin", adminRoutes)

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    status: err.status || 500,
  })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
  console.log(`📡 MQTT: ${process.env.MQTT_BROKER || "Not configured"}`)
})

export { app, prisma }

