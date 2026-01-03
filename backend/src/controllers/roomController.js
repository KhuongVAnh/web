import { prisma } from "../index.js"
import { isDeskOccupied } from "../services/desk-state.js"
import { getDHT } from "../services/dht-cache.js"

/**
 * getAllRooms - Lấy danh sách tất cả các phòng học
 * 
 * @description Lấy danh sách tất cả phòng học kèm thông tin bàn học và nhiệt độ/độ ẩm hiện tại
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * 
 * @returns {Object} 200 - Success response với array of rooms
 * @returns {Object} 500 - Error response nếu có lỗi server
 * 
 * @example
 * // Response
 * [
 *   {
 *     "id": 1,
 *     "roomNumber": 1,
 *     "name": "Phòng 1",
 *     "currentTemperature": 22.5,
 *     "currentHumidity": 65.0,
 *     "desks": [...]
 *   },
 *   ...
 * ]
 */
export const getAllRooms = async (req, res) => {
  try {
    const rooms = await prisma.studyRoom.findMany({
      include: {
        desks: {
          orderBy: [
            { row: "asc" },
            { position: "asc" },
          ],
        },
      },
      orderBy: { roomNumber: "asc" },
    })

    // Calculate occupancy status for each desk and get DHT data from cache
    const roomsWithData = await Promise.all(
      rooms.map(async (room) => {
        // Get DHT data from cache (only Room 1 has ESP32 data)
        const dhtData = getDHT(room.id)
        const currentTemperature = dhtData?.temperature ?? null
        const currentHumidity = dhtData?.humidity ?? null

        // Calculate occupancy status for each desk from EnergyRecord
        const desksWithStatus = await Promise.all(
          room.desks.map(async (desk) => {
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

        return {
          ...room,
          desks: desksWithStatus,
          currentTemperature,
          currentHumidity,
        }
      })
    )

    res.json(roomsWithData)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * getRoomById - Lấy thông tin chi tiết của một phòng học
 * 
 * @description Lấy thông tin chi tiết phòng học theo ID, bao gồm danh sách bàn, thống kê occupancy và energy
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {String} req.params.id - Room ID
 * 
 * @param {Object} res - Express response object
 * 
 * @returns {Object} 200 - Success response với room object và statistics
 * @returns {Object} 404 - Error response nếu không tìm thấy room
 * @returns {Object} 500 - Error response nếu có lỗi server
 * 
 * @example
 * // Response
 * {
 *   "id": 1,
 *   "roomNumber": 1,
 *   "name": "Phòng 1",
 *   "occupiedDesks": 5,
 *   "totalDesks": 20,
 *   "totalEnergyWh": 1234.56,
 *   "currentTemperature": 22.5,
 *   "currentHumidity": 65.0,
 *   "desks": [...]
 * }
 */
export const getRoomById = async (req, res) => {
  try {
    const room = await prisma.studyRoom.findUnique({
      where: { id: Number.parseInt(req.params.id) },
      include: {
        desks: {
          orderBy: [
            { row: "asc" },
            { position: "asc" },
          ],
        },
      },
    })

    if (!room) {
      return res.status(404).json({ message: "Room not found" })
    }

    // Calculate occupancy status for each desk and room statistics
    const desksWithStatus = await Promise.all(
      room.desks.map(async (desk) => {
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

    const occupiedDesks = desksWithStatus.filter((d) => d.isOccupied).length

    // Calculate total energy from EnergyRecord (all time)
    const allEnergyRecords = await prisma.energyRecord.findMany({
      where: {
        deskId: { in: room.desks.map((d) => d.id) },
      },
      select: { energyWh: true },
    })
    const totalEnergy = allEnergyRecords.reduce((sum, r) => sum + r.energyWh, 0)

    // Get DHT data from cache (only Room 1 has ESP32 data)
    const dhtData = getDHT(room.id)
    const currentTemperature = dhtData?.temperature ?? null
    const currentHumidity = dhtData?.humidity ?? null

    res.json({
      ...room,
      desks: desksWithStatus,
      occupiedDesks,
      totalDesks: room.desks.length,
      totalEnergyWh: totalEnergy,
      currentTemperature,
      currentHumidity,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * getRoomTemperature - Lấy nhiệt độ và độ ẩm hiện tại của phòng
 * 
 * @description Lấy reading DHT mới nhất (temperature và humidity) của phòng
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {String} req.params.id - Room ID
 * 
 * @param {Object} res - Express response object
 * 
 * @returns {Object} 200 - Success response với temperature, humidity và timestamp
 * @returns {Object} 500 - Error response nếu có lỗi server
 * 
 * @example
 * // Response
 * {
 *   "temperature": 22.5,
 *   "humidity": 65.0,
 *   "timestamp": "2025-01-01T00:00:00.000Z"
 * }
 */
export const getRoomTemperature = async (req, res) => {
  try {
    const roomId = Number.parseInt(req.params.id)
    
    // Get DHT data from cache (only Room 1 has ESP32 data)
    const dhtData = getDHT(roomId)

    if (!dhtData) {
      // No data available (not Room 1 or no ESP32 data received yet)
      return res.json({
        temperature: null,
        humidity: null,
        timestamp: null,
      })
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

