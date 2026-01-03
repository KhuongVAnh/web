import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
import bcrypt from "bcryptjs"

async function main() {
  console.log("🌱 Starting database seed...")

  // Clear existing data
  await prisma.energyRecord.deleteMany()
  await prisma.eSP32Config.deleteMany()
  await prisma.desk.deleteMany()
  await prisma.studyRoom.deleteMany()
  await prisma.user.deleteMany()

  console.log("✅ Cleared existing data")

  // Create users
  const hashedPassword1 = await bcrypt.hash("12345678", 10)
  const hashedPassword2 = await bcrypt.hash("12345678", 10)

  // User account
  await prisma.user.create({
    data: {
      username: "user",
      email: "user@library.edu.vn",
      password: hashedPassword1,
      fullName: "Sinh Viên",
      role: "user",
    },
  })

  // Admin account
  await prisma.user.create({
    data: {
      username: "admin",
      email: "admin@library.edu.vn",
      password: hashedPassword2,
      fullName: "Quản Trị Viên",
      role: "admin",
    },
  })

  console.log("✅ Created users")

  // Create 5 study rooms
  const rooms = []
  for (let roomNum = 1; roomNum <= 5; roomNum++) {
    const room = await prisma.studyRoom.create({
      data: {
        roomNumber: roomNum,
        name: `Phòng ${roomNum}`,
      },
    })
    rooms.push(room)
  }

  console.log("✅ Created 5 study rooms")

  // Create desks: 4 rows x 5 tables per room, 2 seats per table
  for (const room of rooms) {
    for (let row = 1; row <= 4; row++) {
      for (let position = 1; position <= 5; position++) {
        const isESP32Desk = room.roomNumber === 1 && row === 1 && position === 1
        
        // Set fixed initial state for all desks
        // Only ESP32 desk will change via MQTT, others remain fixed
        const initialOccupied = !isESP32Desk && Math.random() < 0.3 // 30% chance for non-ESP32 desks
        
        await prisma.desk.create({
          data: {
            roomId: room.id,
            row,
            position,
            seats: 2,
            lampPowerW: 10.0,
            lightStatus: initialOccupied, // Light on if occupied
            distanceSensitivity: 30.0,
            esp32DeviceId: isESP32Desk ? `ESP32-${room.id}-${row}-${position}` : null,
            // Set initial sensor reading for fixed desks
            lastSensorReading: initialOccupied ? 15 + Math.random() * 10 : 200 + Math.random() * 100,
            sensorReadingTime: new Date(),
          },
        })
      }
    }
  }

  console.log("✅ Created desks (4 rows x 5 tables per room = 20 desks per room, 100 total)")

  // Create ESP32 config for ESP32 desk (Room 1, Row 1, Table 1)
  const esp32Desk = await prisma.desk.findFirst({
    where: {
      roomId: rooms[0].id,
      row: 1,
      position: 1,
    },
  })

  if (esp32Desk && esp32Desk.esp32DeviceId) {
    await prisma.eSP32Config.create({
      data: {
        deviceId: esp32Desk.esp32DeviceId,
        fs1: 3,
        fs2: 2,
        fs3: 1,
        distanceCm: 30.0,
        duration: 4000,
        minimumSessionDurationMinutes: 5,
      },
    })
    console.log("✅ Created ESP32 config")
  }

  console.log("\n🎉 Database seeded successfully!")
  console.log("\n📌 Login Credentials:")
  console.log("   👤 User:  username: user, password: 12345678")
  console.log("   👨‍💼 Admin: username: admin, password: 12345678")
  console.log("\n📡 ESP32 is attached to Room 1, Row 1, Table 1")
  console.log("   ⚠️  Other 99 desks have FIXED status and will NOT change during runtime")
  console.log("   📊 Only Room 1 has DHT data from ESP32, other rooms will show 'NA'")
  console.log("   ⏱️  Only sessions >= 5 minutes will be saved to EnergyRecord")
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

