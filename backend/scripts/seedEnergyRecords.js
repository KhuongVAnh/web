import { PrismaClient } from "@prisma/client"
import dotenv from "dotenv"

dotenv.config()

const prisma = new PrismaClient()

const TARGET_YEAR = 2025
const TARGET_MONTH = 12 // December
const DAYS_IN_MONTH = 30 // populate first 30 days

const desksToSeed = [
  { roomNumber: 1, row: 1, position: 1 },
  { roomNumber: 2, row: 1, position: 2 },
]

function getMonthRange(month, year) {
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
  return { startDate, endDate }
}

async function seedDeskEnergy(deskMeta) {
  const desk = await prisma.desk.findFirst({
    where: {
      row: deskMeta.row,
      position: deskMeta.position,
      room: { roomNumber: deskMeta.roomNumber },
    },
    include: { room: true },
  })

  if (!desk) {
    console.warn(`⚠️ Desk not found: room ${deskMeta.roomNumber}, row ${deskMeta.row}, table ${deskMeta.position}`)
    return
  }

  const { startDate, endDate } = getMonthRange(TARGET_MONTH, TARGET_YEAR)

  // Clear old data for this month to avoid duplicates
  await prisma.energyRecord.deleteMany({
    where: {
      deskId: desk.id,
      createdAt: { gte: startDate, lte: endDate },
    },
  })

  const powerW = desk.lampPowerW || 10
  const records = []

  for (let day = 1; day <= DAYS_IN_MONTH; day++) {
    const durationMinutes = 60 + Math.floor(Math.random() * 121) // 60-180 minutes
    const energyWh = Number((powerW * (durationMinutes / 60)).toFixed(2))
    records.push({
      deskId: desk.id,
      powerW,
      durationMinutes,
      energyWh,
      room: desk.room.roomNumber,
      row: desk.row,
      table: desk.position,
      createdAt: new Date(Date.UTC(TARGET_YEAR, TARGET_MONTH - 1, day, 10, 0, 0)),
    })
  }

  if (records.length > 0) {
    await prisma.energyRecord.createMany({ data: records })
    console.log(
      `✅ Seeded ${records.length} energy records for room ${desk.room.roomNumber} - row ${desk.row} - table ${desk.position} (${desk.id})`
    )
  }
}

async function main() {
  try {
    for (const deskMeta of desksToSeed) {
      await seedDeskEnergy(deskMeta)
    }
  } catch (error) {
    console.error("❌ Error seeding energy records:", error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
