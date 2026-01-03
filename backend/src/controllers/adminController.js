import { prisma } from "../index.js"
import { publishConfig } from "../services/mqtt-client.js"
import dotenv from "dotenv"

dotenv.config()

const ESP32_DISABLE_DISTANCE_CM = Number.parseFloat(process.env.ESP32_DISABLE_DISTANCE_CM || "4")

/**
 * getStats - Lấy thống kê tổng quan hệ thống
 * 
 * @description Tính toán và trả về các thống kê tổng quan: tổng số bàn, số bàn đang sử dụng, tỷ lệ occupancy, tổng năng lượng tiêu thụ
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - User object từ auth middleware (chỉ admin)
 * 
 * @param {Object} res - Express response object
 * 
 * @returns {Object} 200 - Success response với stats object
 * @returns {Object} 500 - Error response nếu có lỗi server
 * 
 * @example
 * // Response
 * {
 *   "totalDesks": 100,
 *   "occupiedDesks": 30,
 *   "totalRooms": 5,
 *   "occupancyRate": "30.00",
 *   "totalEnergyWh": "1234.56"
 * }
 */
export const getStats = async (req, res) => {
  try {
    const totalDesks = await prisma.desk.count()
    const occupiedDesks = await prisma.desk.count({ where: { occupancyStatus: true } })
    const totalRooms = await prisma.studyRoom.count()

    const desks = await prisma.desk.findMany({
      select: { energyConsumedWh: true },
    })

    const totalEnergy = desks.reduce((sum, d) => sum + d.energyConsumedWh, 0)

    res.json({
      totalDesks,
      occupiedDesks,
      totalRooms,
      occupancyRate: totalDesks > 0 ? ((occupiedDesks / totalDesks) * 100).toFixed(2) : 0,
      totalEnergyWh: totalEnergy.toFixed(2),
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * getEnergyReport - Lấy báo cáo năng lượng tích lũy theo phòng
 * 
 * @description Lấy báo cáo năng lượng tiêu thụ tích lũy (tất cả thời gian) theo từng phòng và từng bàn
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - User object từ auth middleware (chỉ admin)
 * 
 * @param {Object} res - Express response object
 * 
 * @returns {Object} 200 - Success response với array of room reports
 * @returns {Object} 500 - Error response nếu có lỗi server
 * 
 * @example
 * // Response
 * [
 *   {
 *     "roomId": 1,
 *     "roomNumber": 1,
 *     "roomName": "Phòng 1",
 *     "totalEnergyWh": 1234.56,
 *     "totalUsageMinutes": 7890,
 *     "desks": [
 *       {
 *         "id": 1,
 *         "row": 1,
 *         "position": 1,
 *         "energyWh": 234.56,
 *         "usageMinutes": 1234,
 *         "lampPowerW": 10.0
 *       },
 *       ...
 *     ]
 *   },
 *   ...
 * ]
 */
export const getEnergyReport = async (req, res) => {
  try {
    const rooms = await prisma.studyRoom.findMany({
      include: {
        desks: {
          select: {
            id: true,
            row: true,
            position: true,
            energyConsumedWh: true,
            totalUsageMinutes: true,
            lampPowerW: true,
          },
        },
      },
      orderBy: { roomNumber: "asc" },
    })

    const report = rooms.map((room) => {
      const roomEnergy = room.desks.reduce((sum, d) => sum + d.energyConsumedWh, 0)
      const roomUsage = room.desks.reduce((sum, d) => sum + d.totalUsageMinutes, 0)
      
      return {
        roomId: room.id,
        roomNumber: room.roomNumber,
        roomName: room.name,
        totalEnergyWh: roomEnergy,
        totalUsageMinutes: roomUsage,
        desks: room.desks.map((desk) => ({
          id: desk.id,
          row: desk.row,
          position: desk.position,
          energyWh: desk.energyConsumedWh,
          usageMinutes: desk.totalUsageMinutes,
          lampPowerW: desk.lampPowerW,
        })),
      }
    })

    res.json(report)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * updateESP32Config - Cập nhật cấu hình ESP32
 * 
 * @description Cập nhật cấu hình ESP32 (sampling frequencies, distance threshold, duration) và gửi đến ESP32 qua MQTT
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {Number} [req.body.fs1] - Sampling frequency cho HC-SR04 (distance sensor)
 * @param {Number} [req.body.fs2] - Sampling frequency cho BH1750 (light sensor)
 * @param {Number} [req.body.fs3] - Sampling frequency cho DHT sensor
 * @param {Number} [req.body.distanceCm] - Ngưỡng khoảng cách để phát hiện occupancy (cm)
 * @param {Number} [req.body.duration] - Thời gian truyền dữ liệu (milliseconds)
 * @param {Object} req.user - User object từ auth middleware (chỉ admin)
 * 
 * @param {Object} res - Express response object
 * 
 * @returns {Object} 200 - Success response với ESP32 config object
 * @returns {Object} 404 - Error response nếu không tìm thấy ESP32 desk
 * @returns {Object} 500 - Error response nếu có lỗi server
 * 
 * @example
 * // Request
 * POST /api/admin/esp32/config
 * {
 *   "fs1": 3,
 *   "fs2": 2,
 *   "fs3": 1,
 *   "distanceCm": 30,
 *   "duration": 4000
 * }
 * 
 * // Response
 * {
 *   "id": 1,
 *   "deviceId": "ESP32-1",
 *   "fs1": 3,
 *   "fs2": 2,
 *   "fs3": 1,
 *   "distanceCm": 30,
 *   "duration": 4000,
 *   "lastSync": "2025-01-01T00:00:00.000Z"
 * }
 */
export const updateESP32Config = async (req, res) => {
  try {
    const { fs1, fs2, fs3, distanceCm, duration } = req.body

    // Find ESP32 desk (table 1 of room 1)
    const esp32Desk = await prisma.desk.findFirst({
      where: {
        roomId: 1,
        row: 1,
        position: 1,
      },
    })

    if (!esp32Desk) {
      return res.status(404).json({ message: "ESP32 desk not found" })
    }

    // Update or create ESP32 config
    const deviceId = esp32Desk.esp32DeviceId || `ESP32-${esp32Desk.id}`
    
    const config = await prisma.eSP32Config.upsert({
      where: { deviceId },
      update: {
        fs1: fs1 || 3,
        fs2: fs2 || 2,
        fs3: fs3 || 1,
        distanceCm: distanceCm || 30,
        duration: duration || 4000,
        lastSync: new Date(),
      },
      create: {
        deviceId,
        fs1: fs1 || 3,
        fs2: fs2 || 2,
        fs3: fs3 || 1,
        distanceCm: distanceCm || 30,
        duration: duration || 4000,
        lastSync: new Date(),
      },
    })

    // Update desk distance sensitivity if provided
    if (distanceCm !== undefined) {
      await prisma.desk.update({
        where: { id: esp32Desk.id },
        data: { 
          distanceSensitivity: distanceCm,
          // If setting to ESP32_DISABLE_DISTANCE_CM (disabled), also turn off light and occupancy
          ...(distanceCm === ESP32_DISABLE_DISTANCE_CM ? {
            lightStatus: false,
            occupancyStatus: false,
            occupancyStartTime: null,
          } : {}),
        },
      })
    }

    // Publish config to MQTT
    await publishConfig({
      fs1: config.fs1,
      fs2: config.fs2,
      fs3: config.fs3,
      distanceCm: config.distanceCm,
      duration: config.duration,
    })

    res.json(config)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * bulkUpdateDesks - Cập nhật hàng loạt cấu hình bàn học
 * 
 * @description Cập nhật cấu hình (lampPowerW, distanceSensitivity) cho nhiều bàn học cùng lúc
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {Array} req.body.updates - Array of update objects
 * @param {Number} req.body.updates[].deskId - Desk ID
 * @param {Number} [req.body.updates[].lampPowerW] - Công suất đèn (Watt)
 * @param {Number} [req.body.updates[].distanceSensitivity] - Ngưỡng khoảng cách (cm)
 * @param {Object} req.user - User object từ auth middleware (chỉ admin)
 * 
 * @param {Object} res - Express response object
 * 
 * @returns {Object} 200 - Success response với số lượng bàn đã cập nhật và danh sách desks
 * @returns {Object} 500 - Error response nếu có lỗi server
 * 
 * @example
 * // Request
 * POST /api/admin/desks/bulk-update
 * {
 *   "updates": [
 *     { "deskId": 1, "lampPowerW": 15.0 },
 *     { "deskId": 2, "distanceSensitivity": 25.0 },
 *     { "deskId": 3, "lampPowerW": 12.0, "distanceSensitivity": 30.0 }
 *   ]
 * }
 * 
 * // Response
 * {
 *   "updated": 3,
 *   "desks": [...]
 * }
 */
export const bulkUpdateDesks = async (req, res) => {
  try {
    const { updates } = req.body // Array of { deskId, lampPowerW, distanceSensitivity }

    const results = []
    for (const update of updates) {
      const { deskId, lampPowerW, distanceSensitivity } = update
      const updateData = {}

      if (lampPowerW !== undefined) {
        updateData.lampPowerW = Number.parseFloat(lampPowerW)
      }
      if (distanceSensitivity !== undefined) {
        updateData.distanceSensitivity = Number.parseFloat(distanceSensitivity)
      }

      if (Object.keys(updateData).length > 0) {
        const desk = await prisma.desk.update({
          where: { id: Number.parseInt(deskId) },
          data: updateData,
        })
        results.push(desk)
      }
    }

    res.json({ updated: results.length, desks: results })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * getMonthRange - Helper function để lấy start và end DateTime của một tháng
 * 
 * @description Tính toán ngày bắt đầu và kết thúc của tháng để query energy records
 * 
 * @param {Number} month - Tháng (1-12)
 * @param {Number} year - Năm
 * 
 * @returns {Object} Object chứa startDate và endDate
 * @returns {Date} startDate - Ngày đầu tháng (00:00:00)
 * @returns {Date} endDate - Ngày cuối tháng (23:59:59)
 * 
 * @example
 * getMonthRange(1, 2025)
 * // Returns: { startDate: 2025-01-01T00:00:00.000Z, endDate: 2025-01-31T23:59:59.999Z }
 */
function getMonthRange(month, year) {
  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0)
  const endDate = new Date(year, month, 0, 23, 59, 59, 999)
  return { startDate, endDate }
}

/**
 * calculateMonthlyStats - Helper function để tính tổng năng lượng và thời gian từ energy records
 * 
 * @description Tính tổng năng lượng (Wh) và tổng thời gian sử dụng (minutes) từ danh sách energy records
 * 
 * @param {Array} records - Array of energy records
 * @param {Number} records[].energyWh - Năng lượng tiêu thụ (Wh)
 * @param {Number} records[].durationMinutes - Thời gian sử dụng (minutes)
 * 
 * @returns {Object} Object chứa totalEnergyWh và totalUsageMinutes
 * @returns {Number} totalEnergyWh - Tổng năng lượng tiêu thụ (Wh)
 * @returns {Number} totalUsageMinutes - Tổng thời gian sử dụng (minutes)
 */
function calculateMonthlyStats(records) {
  const totalEnergyWh = records.reduce((sum, r) => sum + r.energyWh, 0)
  const totalUsageMinutes = records.reduce((sum, r) => sum + r.durationMinutes, 0)
  return { totalEnergyWh, totalUsageMinutes }
}

/**
 * aggregateEnergyByRoom - Helper function để nhóm energy records theo phòng
 * 
 * @description Nhóm energy records theo phòng và bàn, tính tổng năng lượng và thời gian cho mỗi phòng/bàn
 * 
 * @param {Array} energyRecords - Array of energy records
 * @param {Number} month - Tháng (1-12)
 * @param {Number} year - Năm
 * 
 * @returns {Object} Object chứa month, year, summary, byRoom, và total
 * @returns {Number} month - Tháng
 * @returns {Number} year - Năm
 * @returns {Object} summary - Tổng năng lượng và thời gian
 * @returns {Array} byRoom - Array of room data với energy và usage
 * @returns {Object} total - Tổng năng lượng và thời gian toàn bộ
 */
async function aggregateEnergyByRoom(energyRecords, month, year) {
  // Get all desks with their rooms
  const deskIds = [...new Set(energyRecords.map((r) => r.deskId))]
  const desks = await prisma.desk.findMany({
    where: { id: { in: deskIds } },
    include: { room: true },
  })

  // Create map: deskId -> desk
  const deskMap = new Map(desks.map((d) => [d.id, d]))

  // Group by room
  const roomMap = new Map()

  for (const record of energyRecords) {
    const desk = deskMap.get(record.deskId)
    if (!desk) continue

    const roomId = desk.roomId
    if (!roomMap.has(roomId)) {
      roomMap.set(roomId, {
        roomId: desk.room.id,
        roomNumber: desk.room.roomNumber,
        roomName: desk.room.name,
        totalEnergyWh: 0,
        totalUsageMinutes: 0,
        desks: new Map(),
      })
    }

    const roomData = roomMap.get(roomId)
    roomData.totalEnergyWh += record.energyWh
    roomData.totalUsageMinutes += record.durationMinutes

    // Group by desk
    if (!roomData.desks.has(record.deskId)) {
      roomData.desks.set(record.deskId, {
        id: record.deskId,
        row: desk.row,
        position: desk.position,
        energyWh: 0,
        usageMinutes: 0,
        lampPowerW: desk.lampPowerW,
      })
    }

    const deskData = roomData.desks.get(record.deskId)
    deskData.energyWh += record.energyWh
    deskData.usageMinutes += record.durationMinutes
  }

  // Convert to array format
  const byRoom = Array.from(roomMap.values()).map((room) => ({
    roomId: room.roomId,
    roomNumber: room.roomNumber,
    roomName: room.roomName,
    totalEnergyWh: Number.parseFloat(room.totalEnergyWh.toFixed(2)),
    totalUsageMinutes: room.totalUsageMinutes,
    desks: Array.from(room.desks.values()).map((desk) => ({
      id: desk.id,
      row: desk.row,
      position: desk.position,
      energyWh: Number.parseFloat(desk.energyWh.toFixed(2)),
      usageMinutes: desk.usageMinutes,
      lampPowerW: desk.lampPowerW,
    })),
  }))

  // Calculate total
  const total = calculateMonthlyStats(energyRecords)

  return {
    month,
    year,
    summary: {
      totalEnergyWh: Number.parseFloat(total.totalEnergyWh.toFixed(2)),
      totalUsageMinutes: total.totalUsageMinutes,
    },
    byRoom: byRoom.sort((a, b) => a.roomNumber - b.roomNumber),
    total: {
      totalEnergyWh: Number.parseFloat(total.totalEnergyWh.toFixed(2)),
      totalUsageMinutes: total.totalUsageMinutes,
    },
  }
}

/**
 * getMonthlyEnergyReport - Lấy báo cáo năng lượng theo tháng
 * 
 * @description Lấy báo cáo năng lượng tiêu thụ theo tháng cụ thể, có thể so sánh với nhiều tháng khác
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {String} [req.query.month] - Tháng (1-12), default: tháng hiện tại
 * @param {String} [req.query.year] - Năm, default: năm hiện tại
 * @param {String} [req.query.compareMonths] - JSON string array of {month, year} để so sánh
 * @param {Object} req.user - User object từ auth middleware (chỉ admin)
 * 
 * @param {Object} res - Express response object
 * 
 * @returns {Object} 200 - Success response với selectedMonth và compareMonths data
 * @returns {Object} 400 - Error response nếu month/year không hợp lệ
 * @returns {Object} 500 - Error response nếu có lỗi server
 * 
 * @example
 * // Request
 * GET /api/admin/energy-report/monthly?month=1&year=2025&compareMonths=[{"month":12,"year":2024}]
 * 
 * // Response
 * {
 *   "selectedMonth": {
 *     "month": 1,
 *     "year": 2025,
 *     "summary": { "totalEnergyWh": 1234.56, "totalUsageMinutes": 7890 },
 *     "byRoom": [...],
 *     "total": { "totalEnergyWh": 1234.56, "totalUsageMinutes": 7890 }
 *   },
 *   "compareMonths": [
 *     {
 *       "month": 12,
 *       "year": 2024,
 *       ...
 *     }
 *   ]
 * }
 */
export const getMonthlyEnergyReport = async (req, res) => {
  try {
    const { month, year, compareMonths } = req.query

    // Default to current month if not provided
    const currentDate = new Date()
    const selectedMonth = month ? Number.parseInt(month) : currentDate.getMonth() + 1
    const selectedYear = year ? Number.parseInt(year) : currentDate.getFullYear()

    // Validate month and year
    if (selectedMonth < 1 || selectedMonth > 12) {
      return res.status(400).json({ message: "Invalid month (1-12)" })
    }
    if (selectedYear < 2020 || selectedYear > 2100) {
      return res.status(400).json({ message: "Invalid year" })
    }

    // Get month range
    const { startDate, endDate } = getMonthRange(selectedMonth, selectedYear)

    // Query energy records for selected month
    const energyRecords = await prisma.energyRecord.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        desk: {
          include: {
            room: true,
          },
        },
      },
    })

    // Aggregate by room
    const selectedMonthData = await aggregateEnergyByRoom(energyRecords, selectedMonth, selectedYear)

    // Handle compare months if provided
    let compareMonthsData = []
    if (compareMonths) {
      try {
        const compareMonthsArray = JSON.parse(compareMonths)
        if (Array.isArray(compareMonthsArray)) {
          for (const compareMonth of compareMonthsArray) {
            const { month: cm, year: cy } = compareMonth
            if (cm && cy) {
              const { startDate: cs, endDate: ce } = getMonthRange(cm, cy)
              const compareRecords = await prisma.energyRecord.findMany({
                where: {
                  createdAt: {
                    gte: cs,
                    lte: ce,
                  },
                },
              })
              const compareData = await aggregateEnergyByRoom(compareRecords, cm, cy)
              compareMonthsData.push(compareData)
            }
          }
        }
      } catch (e) {
        console.error("Error parsing compareMonths:", e)
      }
    }

    res.json({
      selectedMonth: selectedMonthData,
      compareMonths: compareMonthsData,
    })
  } catch (error) {
    console.error("Error in getMonthlyEnergyReport:", error)
    res.status(500).json({ message: error.message })
  }
}

