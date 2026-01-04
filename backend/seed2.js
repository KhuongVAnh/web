import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
    console.log("🌱 Starting database seed...")

    // Clear existing data (đúng thứ tự để tránh FK error)
    await prisma.sensorReading.deleteMany()
    await prisma.dHT.deleteMany()
    await prisma.energyRecord.deleteMany()
    await prisma.eSP32Config.deleteMany()
    await prisma.desk.deleteMany()
    await prisma.studyRoom.deleteMany()
    await prisma.user.deleteMany()

    console.log("✅ Cleared existing data")

    // =========================
    // Create users
    // =========================
    const hashedPassword = await bcrypt.hash("12345678", 10)

    await prisma.user.create({
        data: {
            username: "user",
            email: "user@library.edu.vn",
            password: hashedPassword,
            fullName: "Sinh Viên",
            role: "user",
        },
    })

    await prisma.user.create({
        data: {
            username: "admin",
            email: "admin@library.edu.vn",
            password: hashedPassword,
            fullName: "Quản Trị Viên",
            role: "admin",
        },
    })

    console.log("✅ Created users")

    // =========================
    // Create study rooms
    // =========================
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

    // =========================
    // Create desks (ALL EMPTY)
    // =========================
    for (const room of rooms) {
        for (let row = 1; row <= 4; row++) {
            for (let position = 1; position <= 5; position++) {
                const isESP32Desk =
                    room.roomNumber === 1 && row === 1 && position === 1

                await prisma.desk.create({
                    data: {
                        roomId: room.id,
                        row,
                        position,
                        seats: 2,
                        lampPowerW: 10.0,

                        // 🔴 TẤT CẢ BÀN BAN ĐẦU TRỐNG
                        occupancyStatus: false,
                        lightStatus: false,
                        occupancyStartTime: null,

                        // Cấu hình cảm biến
                        distanceSensitivity: 30.0,

                        // Chỉ gắn ESP32 cho 1 bàn demo
                        esp32DeviceId: isESP32Desk
                            ? `ESP32-${room.id}-${row}-${position}`
                            : null,

                        // Giá trị sensor khi KHÔNG có người
                        lastSensorReading: 300, // khoảng cách xa
                        sensorReadingTime: new Date(),
                    },
                })
            }
        }
    }

    console.log(
        "✅ Created desks (4 rows x 5 tables per room = 100 desks, ALL EMPTY)"
    )

    // =========================
    // Initial DHT for each room
    // =========================
    for (const room of rooms) {
        await prisma.dHT.create({
            data: {
                roomId: room.id,
                temperature: 22 + Math.random() * 3,
                humidity: 60 + Math.random() * 10,
            },
        })
    }

    console.log("✅ Created initial DHT readings")

    console.log("\n🎉 Database seeded successfully!")
    console.log("\n📌 Login Credentials:")
    console.log("   👤 User:  user / 12345678")
    console.log("   👨‍💼 Admin: admin / 12345678")
    console.log("\n📡 ESP32 attached to:")
    console.log("   👉 Room 1 - Row 1 - Table 1")
    console.log("   ⚠️  All desks start EMPTY, only ESP32 desk will change via MQTT")
}

main()
    .catch((e) => {
        console.error("❌ Error seeding database:", e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
