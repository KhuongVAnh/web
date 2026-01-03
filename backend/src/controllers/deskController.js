import { prisma } from "../index.js"
import { publishConfig } from "../services/mqtt-client.js"
import { isDeskOccupied, getDeskState, setDeskUnoccupied } from "../services/desk-state.js"
import dotenv from "dotenv"

dotenv.config()

const ESP32_DISABLE_DISTANCE_CM = Number.parseFloat(process.env.ESP32_DISABLE_DISTANCE_CM || "4")
const ESP32_ENABLE_DISTANCE_CM = Number.parseFloat(process.env.ESP32_ENABLE_DISTANCE_CM || "30")

/**
 * getAllDesks - Lấy danh sách tất cả các bàn học
 * 
 * @description Lấy danh sách tất cả bàn học kèm thông tin phòng, sắp xếp theo roomId, row, position
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * 
 * @returns {Object} 200 - Success response với array of desks
 * @returns {Object} 500 - Error response nếu có lỗi server
 * 
 * @example
 * // Response
 * [
 *   {
 *     "id": 1,
 *     "roomId": 1,
 *     "row": 1,
 *     "position": 1,
 *     "occupancyStatus": true,
 *     "lightStatus": true,
 *     "room": { ... }
 *   },
 *   ...
 * ]
 */
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

    // Calculate occupancy status real-time from EnergyRecord
    // A desk is occupied if it has an EnergyRecord with endTime = null
    const desksWithStatus = await Promise.all(
      desks.map(async (desk) => {
        const latestRecord = await prisma.energyRecord.findFirst({
          where: { deskId: desk.id },
          orderBy: { startTime: "desc" },
        })

        const isOccupied = latestRecord?.endTime === null || isDeskOccupied(desk.id)

        return {
          ...desk,
          isOccupied, // Use isOccupied instead of occupancyStatus
        }
      })
    )

    res.json(desksWithStatus)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * getDeskById - Lấy thông tin chi tiết của một bàn học
 * 
 * @description Lấy thông tin chi tiết bàn học theo ID, bao gồm sensor readings và energy records
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {String} req.params.id - Desk ID
 * 
 * @param {Object} res - Express response object
 * 
 * @returns {Object} 200 - Success response với desk object và currentUsageMinutes
 * @returns {Object} 404 - Error response nếu không tìm thấy desk
 * @returns {Object} 500 - Error response nếu có lỗi server
 * 
 * @example
 * // Response
 * {
 *   "id": 1,
 *   "roomId": 1,
 *   "row": 1,
 *   "position": 1,
 *   "occupancyStatus": true,
 *   "currentUsageMinutes": 45,
 *   "sensorReadings": [...],
 *   "energyRecords": [...]
 * }
 */
export const getDeskById = async (req, res) => {
  try {
    const desk = await prisma.desk.findUnique({
      where: { id: Number.parseInt(req.params.id) },
      include: {
        room: true,
        energyRecords: { orderBy: { startTime: "desc" }, take: 10 },
      },
    })

    if (!desk) {
      return res.status(404).json({ message: "Desk not found" })
    }

    // Calculate occupancy status and current usage time from EnergyRecord
    const latestRecord = await prisma.energyRecord.findFirst({
      where: { deskId: desk.id },
      orderBy: { startTime: "desc" },
    })

    const isOccupied = latestRecord?.endTime === null || isDeskOccupied(desk.id)
    let currentUsageMinutes = 0

    if (isOccupied) {
      if (latestRecord?.endTime === null && latestRecord?.startTime) {
        // Calculate from EnergyRecord
        currentUsageMinutes = Math.floor((new Date() - latestRecord.startTime) / 60000)
      } else {
        // Calculate from in-memory state
        const state = getDeskState(desk.id)
        if (state?.startTime) {
          currentUsageMinutes = Math.floor((new Date() - state.startTime) / 60000)
        }
      }
    }

    res.json({
      ...desk,
      isOccupied, // Use isOccupied instead of occupancyStatus
      currentUsageMinutes,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * toggleLight - Bật/tắt đèn bàn học
 * 
 * @description Bật hoặc tắt đèn bàn học. Nếu là ESP32 desk, cũng cập nhật occupancy status và gửi config qua MQTT
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {String} req.params.id - Desk ID
 * @param {Object} req.user - User object từ auth middleware (chỉ admin)
 * 
 * @param {Object} res - Express response object
 * 
 * @returns {Object} 200 - Success response với updated desk object
 * @returns {Object} 404 - Error response nếu không tìm thấy desk
 * @returns {Object} 500 - Error response nếu có lỗi server
 * 
 * @example
 * // Request
 * PATCH /api/desks/1/toggle-light
 * 
 * // Response
 * {
 *   "id": 1,
 *   "lightStatus": true,
 *   "occupancyStatus": true,
 *   ...
 * }
 */
export const toggleLight = async (req, res) => {
  try {
    const desk = await prisma.desk.findUnique({
      where: { id: Number.parseInt(req.params.id) },
    })

    if (!desk) {
      return res.status(404).json({ message: "Desk not found" })
    }

    const isESP32Desk = desk.roomId === 1 && desk.row === 1 && desk.position === 1
    const newLightStatus = !desk.lightStatus

    // Update desk status
    const updateData = { lightStatus: newLightStatus }

    // If this is ESP32 desk, also update occupancy and send MQTT config
    if (isESP32Desk) {
      if (!newLightStatus) {
        // Tắt bàn: distanceCm = ESP32_DISABLE_DISTANCE_CM (tắt hoạt động phần cứng)
        // End current session if exists
        const now = new Date()
        
        // Check if there's an active session (from EnergyRecord or in-memory state)
        const latestRecord = await prisma.energyRecord.findFirst({
          where: { deskId: desk.id },
          orderBy: { startTime: "desc" },
        })

        const hasActiveSession = latestRecord?.endTime === null || isDeskOccupied(desk.id)

        if (hasActiveSession) {
          let startTime = null
          
          // Get start time from EnergyRecord or in-memory state
          if (latestRecord?.endTime === null && latestRecord?.startTime) {
            startTime = latestRecord.startTime
          } else {
            const state = getDeskState(desk.id)
            if (state?.startTime) {
              startTime = state.startTime
            }
          }

          if (startTime) {
            const usageMinutes = Math.floor((now - startTime) / 60000)
            const deviceId = desk.esp32DeviceId || `ESP32-${desk.id}`
            const esp32Config = await prisma.eSP32Config.findFirst({
              where: { deviceId },
            })
            const minimumDuration = esp32Config?.minimumSessionDurationMinutes || 5

            // Only save if session >= minimum duration
            if (usageMinutes >= minimumDuration) {
              const energyWh = (desk.lampPowerW * usageMinutes) / 60

              // Update existing record or create new one
              if (latestRecord?.endTime === null) {
                await prisma.energyRecord.update({
                  where: { id: latestRecord.id },
                  data: {
                    endTime: now,
                    durationMinutes: usageMinutes,
                    energyWh: energyWh,
                  },
                })
              } else {
                await prisma.energyRecord.create({
                  data: {
                    deskId: desk.id,
                    powerW: desk.lampPowerW,
                    durationMinutes: usageMinutes,
                    energyWh: energyWh,
                    startTime: startTime,
                    endTime: now,
                  },
                })
              }
            }

            // Clear in-memory state
            setDeskUnoccupied(desk.id)
          }
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

/**
 * updateDeskConfig - Cập nhật cấu hình bàn học
 * 
 * @description Cập nhật công suất đèn (lampPowerW) và độ nhạy cảm biến (distanceSensitivity) của bàn học
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {String} req.params.id - Desk ID
 * @param {Object} req.body - Request body
 * @param {Number} [req.body.lampPowerW] - Công suất đèn (Watt)
 * @param {Number} [req.body.distanceSensitivity] - Ngưỡng khoảng cách để phát hiện occupancy (cm)
 * @param {Object} req.user - User object từ auth middleware (chỉ admin)
 * 
 * @param {Object} res - Express response object
 * 
 * @returns {Object} 200 - Success response với updated desk object
 * @returns {Object} 500 - Error response nếu có lỗi server
 * 
 * @example
 * // Request
 * PATCH /api/desks/1/config
 * {
 *   "lampPowerW": 15.0,
 *   "distanceSensitivity": 25.0
 * }
 * 
 * // Response
 * {
 *   "id": 1,
 *   "lampPowerW": 15.0,
 *   "distanceSensitivity": 25.0,
 *   ...
 * }
 */
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

/**
 * getDeskEnergy - Lấy thông tin tiêu thụ năng lượng của bàn học
 * 
 * @description Lấy tổng năng lượng tiêu thụ, tổng thời gian sử dụng và danh sách energy records
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {String} req.params.id - Desk ID
 * 
 * @param {Object} res - Express response object
 * 
 * @returns {Object} 200 - Success response với energy data
 * @returns {Object} 404 - Error response nếu không tìm thấy desk
 * @returns {Object} 500 - Error response nếu có lỗi server
 * 
 * @example
 * // Response
 * {
 *   "totalEnergyWh": 1234.56,
 *   "totalUsageMinutes": 7890,
 *   "records": [
 *     {
 *       "id": 1,
 *       "powerW": 10.0,
 *       "durationMinutes": 60,
 *       "energyWh": 10.0,
 *       "createdAt": "2025-01-01T00:00:00.000Z"
 *     },
 *     ...
 *   ]
 * }
 */
export const getDeskEnergy = async (req, res) => {
  try {
    const desk = await prisma.desk.findUnique({
      where: { id: Number.parseInt(req.params.id) },
      include: {
        energyRecords: {
          orderBy: { startTime: "desc" },
          take: 100,
        },
      },
    })

    if (!desk) {
      return res.status(404).json({ message: "Desk not found" })
    }

    // Tính toán tổng từ energyRecords
    const totalEnergyWh = desk.energyRecords.reduce((sum, record) => sum + record.energyWh, 0)
    const totalUsageMinutes = desk.energyRecords.reduce((sum, record) => sum + record.durationMinutes, 0)

    res.json({
      totalEnergyWh,
      totalUsageMinutes,
      records: desk.energyRecords,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

