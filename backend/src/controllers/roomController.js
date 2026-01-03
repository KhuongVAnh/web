import { prisma } from "../index.js"

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
        dhtReadings: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { roomNumber: "asc" },
    })

    // Add latest temperature and humidity to each room
    const roomsWithData = rooms.map((room) => {
      const latestDHT = room.dhtReadings[0]
      return {
        ...room,
        currentTemperature: latestDHT?.temperature || 22.0,
        currentHumidity: latestDHT?.humidity || 60.0,
      }
    })

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
        dhtReadings: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    })

    if (!room) {
      return res.status(404).json({ message: "Room not found" })
    }

    // Calculate room statistics
    const occupiedDesks = room.desks.filter((d) => d.occupancyStatus).length
    const totalEnergy = room.desks.reduce((sum, d) => sum + d.energyConsumedWh, 0)
    const latestDHT = room.dhtReadings[0]

    res.json({
      ...room,
      occupiedDesks,
      totalDesks: room.desks.length,
      totalEnergyWh: totalEnergy,
      currentTemperature: latestDHT?.temperature || 22.0,
      currentHumidity: latestDHT?.humidity || 60.0,
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
    const dht = await prisma.dHT.findFirst({
      where: { roomId },
      orderBy: { createdAt: "desc" },
    })

    res.json({
      temperature: dht?.temperature || 22.0,
      humidity: dht?.humidity || 60.0,
      timestamp: dht?.createdAt || new Date(),
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

