import { prisma } from "../index.js"
import { publishConfig } from "../services/mqtt-client.js"
import dotenv from "dotenv"

dotenv.config()

const ESP32_DISABLE_DISTANCE_CM = Number.parseFloat(process.env.ESP32_DISABLE_DISTANCE_CM || "4")
const ESP32_ENABLE_DISTANCE_CM = Number.parseFloat(process.env.ESP32_ENABLE_DISTANCE_CM || "30")

export const getAllDesks = async (req, res) => {
  try {
    const desks = await prisma.desk.findMany({
      include: {
        room: true,
      },
      orderBy: [
        { roomId: "asc" },
        { row: "asc" },
        { position: "asc" },
      ],
    })
    res.json(desks)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getDeskById = async (req, res) => {
  try {
    const desk = await prisma.desk.findUnique({
      where: { id: Number.parseInt(req.params.id) },
      include: {
        room: true,
        sensorReadings: { orderBy: { createdAt: "desc" }, take: 10 },
        energyRecords: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    })

    if (!desk) {
      return res.status(404).json({ message: "Desk not found" })
    }

    // Calculate current usage time if occupied
    let currentUsageMinutes = 0
    if (desk.occupancyStatus && desk.occupancyStartTime) {
      currentUsageMinutes = Math.floor((new Date() - desk.occupancyStartTime) / 60000)
    }

    res.json({
      ...desk,
      currentUsageMinutes,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const toggleLight = async (req, res) => {
  try {
    const desk = await prisma.desk.findUnique({
      where: { id: Number.parseInt(req.params.id) },
    })

    if (!desk) {
      return res.status(404).json({ message: "Desk not found" })
    }

    const isESP32Desk = desk.esp32DeviceId !== null
    const newLightStatus = !desk.lightStatus

    // Update desk status
    const updateData = { lightStatus: newLightStatus }

    // If this is ESP32 desk, also update occupancy and send MQTT config
    if (isESP32Desk) {
      if (!newLightStatus) {
        // Tắt bàn: set occupancy = false, distanceCm = ESP32_DISABLE_DISTANCE_CM (tắt hoạt động phần cứng)
        updateData.occupancyStatus = false
        updateData.occupancyStartTime = null
        
        // Calculate energy if was occupied
        if (desk.occupancyStatus && desk.occupancyStartTime) {
          const now = new Date()
          const usageMinutes = Math.floor((now - desk.occupancyStartTime) / 60000)
          const totalUsage = desk.totalUsageMinutes + usageMinutes
          const energyWh = (desk.lampPowerW * usageMinutes) / 60
          const totalEnergy = desk.energyConsumedWh + energyWh

          // Save energy record
          await prisma.energyRecord.create({
            data: {
              deskId: desk.id,
              powerW: desk.lampPowerW,
              durationMinutes: usageMinutes,
              energyWh: energyWh,
            },
          })

          updateData.totalUsageMinutes = totalUsage
          updateData.energyConsumedWh = totalEnergy
        }

        // Send MQTT config to turn off hardware (distanceCm = 4)
        try {
          const deviceId = desk.esp32DeviceId || `ESP32-${desk.id}`
          let esp32Config = await prisma.eSP32Config.findFirst({
            where: { deviceId },
          })

          // Create config if doesn't exist
          if (!esp32Config) {
            esp32Config = await prisma.eSP32Config.create({
              data: {
                deviceId,
                fs1: 3,
                fs2: 2,
                fs3: 1,
                distanceCm: ESP32_DISABLE_DISTANCE_CM,
                duration: 4000,
              },
            })
          }

          await publishConfig({
            fs1: esp32Config.fs1,
            fs2: esp32Config.fs2,
            fs3: esp32Config.fs3,
            distanceCm: ESP32_DISABLE_DISTANCE_CM, // Tắt hoạt động phần cứng
            duration: esp32Config.duration,
          })

          // Update config in database
          await prisma.eSP32Config.update({
            where: { id: esp32Config.id },
            data: { distanceCm: ESP32_DISABLE_DISTANCE_CM, lastSync: new Date() },
          })

          // Update desk sensitivity
          updateData.distanceSensitivity = ESP32_DISABLE_DISTANCE_CM
          console.log(`[Toggle Light] 📡 Sent MQTT config: distanceCm = ${ESP32_DISABLE_DISTANCE_CM} (TẮT ESP32)`)
        } catch (mqttError) {
          console.error("[Toggle Light] ❌ Error sending MQTT config:", mqttError)
        }
      } else {
        // Bật bàn: set distanceCm = ESP32_ENABLE_DISTANCE_CM (bật hoạt động phần cứng)
        try {
          const deviceId = desk.esp32DeviceId || `ESP32-${desk.id}`
          let esp32Config = await prisma.eSP32Config.findFirst({
            where: { deviceId },
          })

          // Create config if doesn't exist
          if (!esp32Config) {
            esp32Config = await prisma.eSP32Config.create({
              data: {
                deviceId,
                fs1: 3,
                fs2: 2,
                fs3: 1,
                distanceCm: ESP32_ENABLE_DISTANCE_CM,
                duration: 4000,
              },
            })
          }

          await publishConfig({
            fs1: esp32Config.fs1,
            fs2: esp32Config.fs2,
            fs3: esp32Config.fs3,
            distanceCm: ESP32_ENABLE_DISTANCE_CM, // Bật hoạt động phần cứng
            duration: esp32Config.duration,
          })

          // Update config in database
          await prisma.eSP32Config.update({
            where: { id: esp32Config.id },
            data: { distanceCm: ESP32_ENABLE_DISTANCE_CM, lastSync: new Date() },
          })

          // Update desk sensitivity
          updateData.distanceSensitivity = ESP32_ENABLE_DISTANCE_CM
          console.log(`[Toggle Light] 📡 Sent MQTT config: distanceCm = ${ESP32_ENABLE_DISTANCE_CM} (BẬT ESP32)`)
        } catch (mqttError) {
          console.error("[Toggle Light] ❌ Error sending MQTT config:", mqttError)
        }
      }
    }

    const updatedDesk = await prisma.desk.update({
      where: { id: Number.parseInt(req.params.id) },
      data: updateData,
    })

    if (isESP32Desk) {
      console.log(`[Toggle Light] ${newLightStatus ? "✅ BẬT" : "❌ TẮT"} ESP32 bàn ${desk.row}-${desk.position}`)
      console.log(`[Toggle Light]   - occupancyStatus: ${updateData.occupancyStatus !== undefined ? updateData.occupancyStatus : desk.occupancyStatus}`)
      console.log(`[Toggle Light]   - lightStatus: ${newLightStatus}`)
      console.log(`[Toggle Light]   - distanceCm: ${updateData.distanceSensitivity !== undefined ? updateData.distanceSensitivity : desk.distanceSensitivity}`)
    } else {
      console.log(`[Toggle Light] ${newLightStatus ? "✅ Bật" : "❌ Tắt"} đèn bàn ${desk.row}-${desk.position}`)
    }

    res.json(updatedDesk)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const updateDeskConfig = async (req, res) => {
  try {
    const { lampPowerW, distanceSensitivity } = req.body
    const updateData = {}

    if (lampPowerW !== undefined) {
      updateData.lampPowerW = Number.parseFloat(lampPowerW)
    }
    if (distanceSensitivity !== undefined) {
      updateData.distanceSensitivity = Number.parseFloat(distanceSensitivity)
    }

    const desk = await prisma.desk.update({
      where: { id: Number.parseInt(req.params.id) },
      data: updateData,
    })

    res.json(desk)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getDeskEnergy = async (req, res) => {
  try {
    const desk = await prisma.desk.findUnique({
      where: { id: Number.parseInt(req.params.id) },
      include: {
        energyRecords: {
          orderBy: { createdAt: "desc" },
          take: 100,
        },
      },
    })

    if (!desk) {
      return res.status(404).json({ message: "Desk not found" })
    }

    res.json({
      totalEnergyWh: desk.energyConsumedWh,
      totalUsageMinutes: desk.totalUsageMinutes,
      records: desk.energyRecords,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

