import { prisma } from "../index.js"

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

