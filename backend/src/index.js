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
import { initAmqp } from "./services/amqp-client.js"
import { initMqttAmqpBridge } from "./services/mqtt-amqp-bridge.js"
import { startDistanceProcessor } from "./workers/distance-processor.js"
import { startDhtProcessor } from "./workers/dht-processor.js"
import { startConfigProcessor } from "./workers/config-processor.js"

dotenv.config()

const app = express()
const prisma = new PrismaClient()

// Initialize MQTT connection (keep for backward compatibility)
// TẠI SAO VẪN CẦN MQTT CLIENT:
// - Có thể dùng để publish config đến ESP32
// - Backup nếu AMQP bridge có vấn đề
initMqtt().catch((err) => {
  console.error("Failed to initialize MQTT:", err)
})

// Initialize AMQP connection
// TẠI SAO CẦN INIT AMQP:
// - Kết nối với CloudAMQP (RabbitMQ)
// - Tạo exchanges và queues
// - Setup routing
initAmqp()
  .then(async () => {
    console.log("[AMQP] ✅ AMQP initialized successfully")

    // Initialize MQTT-AMQP Bridge
    // TẠI SAO CẦN BRIDGE:
    // - Chuyển messages từ MQTT sang AMQP
    // - ESP32 vẫn dùng MQTT (nhẹ), backend dùng AMQP (mạnh mẽ)
    await initMqttAmqpBridge()
    console.log("[MQTT-AMQP Bridge] ✅ Bridge initialized successfully")

    // Start workers to process messages from AMQP queues
    // TẠI SAO CẦN WORKERS:
    // - Xử lý messages từ queues
    // - Có thể chạy nhiều workers để scale
    // - Load balancing tự động
    await startDistanceProcessor()
    await startDhtProcessor()
    await startConfigProcessor()

    console.log("[Workers] ✅ All workers started successfully")
  })
  .catch((err) => {
    console.error("Failed to initialize AMQP:", err)
    // Không exit process, vẫn chạy với MQTT client cũ
  })

// Start mock data service for DHT only (desk occupancy is fixed)
// Only ESP32 desk (Room 1, Row 1, Table 1) will change via MQTT
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

