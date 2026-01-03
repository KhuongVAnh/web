import { prisma } from "../index.js"
import { getDHT } from "../services/dht-cache.js"

/**
 * getDeskSensorData - Lấy dữ liệu sensor mới nhất của một bàn học
 * 
 * @description Lấy thông tin sensor readings và energy records mới nhất của bàn học
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {String} req.params.deskId - Desk ID
 * 
 * @param {Object} res - Express response object
 * 
 * @returns {Object} 200 - Success response với desk object kèm sensor data
 * @returns {Object} 404 - Error response nếu không tìm thấy desk
 * @returns {Object} 500 - Error response nếu có lỗi server
 * 
 * @example
 * // Response
 * {
 *   "id": 1,
 *   "occupancyStatus": true,
 *   "lastSensorReading": 25.5,
 *   "sensorReadings": [
 *     {
 *       "id": 1,
 *       "distanceCm": 25.5,
 *       "occupied": true,
 *       "createdAt": "2025-01-01T00:00:00.000Z"
 *     }
 *   ],
 *   "energyRecords": [...]
 * }
 */
export const getDeskSensorData = async (req, res) => {
  try {
    const deskId = Number.parseInt(req.params.deskId)
    
    const desk = await prisma.desk.findUnique({
      where: { id: deskId },
      include: {
        energyRecords: { orderBy: { startTime: "desc" }, take: 10 },
      },
    })

    if (!desk) {
      return res.status(404).json({ message: "Desk not found" })
    }

    res.json(desk)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * getRoomDHT - Lấy dữ liệu DHT mới nhất của một phòng
 * 
 * @description Lấy reading DHT (temperature và humidity) mới nhất của phòng
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {String} req.params.roomId - Room ID
 * 
 * @param {Object} res - Express response object
 * 
 * @returns {Object} 200 - Success response với DHT data hoặc default values
 * @returns {Object} 500 - Error response nếu có lỗi server
 * 
 * @example
 * // Response
 * {
 *   "temperature": 22.5,
 *   "humidity": 65.0
 * }
 * 
 * // Hoặc nếu không có data
 * {
 *   "temperature": 0,
 *   "humidity": 0
 * }
 */
export const getRoomDHT = async (req, res) => {
  try {
    const roomId = Number.parseInt(req.params.roomId)
    
    // Get DHT data from cache (only Room 1 has ESP32 data)
    const dhtData = getDHT(roomId)

    if (!dhtData) {
      // No data available (not Room 1 or no ESP32 data received yet)
      return res.json({ temperature: null, humidity: null })
    }

    res.json({
      temperature: dhtData.temperature,
      humidity: dhtData.humidity,
      timestamp: dhtData.timestamp,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

