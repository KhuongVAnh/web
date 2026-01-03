/**
 * Distance Sensor Data Processor Worker
 * 
 * LÝ THUYẾT:
 * Worker pattern là một design pattern phổ biến trong message queuing systems.
 * Workers là các processes độc lập consume messages từ queue và xử lý chúng.
 * 
 * TẠI SAO CẦN WORKER:
 * 1. Tách biệt logic xử lý: Mỗi worker xử lý một loại data cụ thể
 * 2. Scalability: Có thể chạy nhiều workers để xử lý song song
 * 3. Fault tolerance: Nếu một worker crash, workers khác vẫn hoạt động
 * 4. Load balancing: RabbitMQ tự động phân phối messages cho workers
 * 
 * WORKER LIFECYCLE:
 * 1. Consume message từ queue
 * 2. Process message (xử lý business logic)
 * 3. Acknowledge message (ack) nếu thành công
 * 4. Negative acknowledge (nack) nếu lỗi, requeue để thử lại
 * 
 * TẠI SAO CẦN FILE NÀY:
 * - Xử lý distance sensor data từ ESP32
 * - Cập nhật occupancy status của bàn học
 * - Tính toán energy consumption
 * - Lưu vào database
 */

import { consumeQueue, initAmqp } from "../services/amqp-client.js"
import { prisma } from "../index.js"
import { setDeskOccupied, setDeskUnoccupied, isDeskOccupied } from "../services/desk-state.js"
import dotenv from "dotenv"

dotenv.config()

const ESP32_DISABLE_DISTANCE_CM = Number.parseFloat(process.env.ESP32_DISABLE_DISTANCE_CM || "4")
const ESP32_ENABLE_DISTANCE_CM = Number.parseFloat(process.env.ESP32_ENABLE_DISTANCE_CM || "30")

/**
 * Xử lý distance sensor data
 * 
 * TẠI SAO CẦN HÀM NÀY:
 * - Nhận distance readings từ ESP32
 * - Tính toán average distance
 * - Xác định occupancy status dựa trên threshold
 * - Cập nhật database
 * - Tính toán energy consumption khi bàn được sử dụng
 * 
 * BUSINESS LOGIC:
 * 1. Tính average distance từ readings
 * 2. So sánh với threshold để xác định occupied/unoccupied
 * 3. Nếu chuyển từ unoccupied → occupied: Bật đèn, lưu start time
 * 4. Nếu chuyển từ occupied → unoccupied: Tắt đèn, tính energy, lưu energy record
 */
async function processDistanceData(content) {
  try {
    const { roomId, deskId, data, meta } = content

    console.log(`[Distance Processor] 📊 Processing distance data for Room ${roomId}, Desk ${deskId}`)

    // Tìm desk trong database
    // TẠI SAO CẦN TÌM DESK:
    // - Cần config (distanceSensitivity, lampPowerW)
    // - Cần ESP32 config để lấy minimumSessionDurationMinutes
    const desk = await prisma.desk.findUnique({
      where: { id: deskId },
      include: { room: true },
    })

    if (!desk) {
      console.error(`[Distance Processor] ❌ Desk ${deskId} not found`)
      return
    }

    // Tính average distance từ readings
    // TẠI SAO CẦN AVERAGE:
    // - ESP32 gửi nhiều readings trong một lần
    // - Average giúp loại bỏ noise và outliers
    const distanceReadings = data?.data || []
    if (distanceReadings.length === 0) {
      console.warn(`[Distance Processor] ⚠️ No distance readings in message`)
      return
    }

    const avgDistance =
      distanceReadings.reduce((sum, val) => sum + val, 0) / distanceReadings.length

    // Kiểm tra ESP32 config để xem có bị disable không
    // TẠI SAO CẦN CHECK:
    // - Admin có thể disable ESP32 bằng cách set distanceCm = 4
    // - Nếu disabled, không xử lý sensor data
    const deviceId = desk.esp32DeviceId || `ESP32-${desk.id}`
    const esp32Config = await prisma.eSP32Config.findFirst({
      where: { deviceId },
    })

    if (esp32Config && esp32Config.distanceCm === ESP32_DISABLE_DISTANCE_CM) {
      console.log(
        `[Distance Processor] ⚠️ ESP32 desk is disabled (distanceCm = ${ESP32_DISABLE_DISTANCE_CM}), ignoring sensor data`
      )
      return
    }

    // Xác định threshold để check occupancy
    // PRIORITY: ESP32 config > meta data > desk sensitivity > default
    // TẠI SAO CẦN PRIORITY:
    // - Admin có thể override threshold từ ESP32 config
    // - Meta data từ ESP32 có thể chứa threshold động
    // - Desk sensitivity là default cho từng bàn
    const threshold =
      esp32Config?.distanceCm || meta?.distanceCm || desk.distanceSensitivity || ESP32_ENABLE_DISTANCE_CM

    // Xác định occupancy status
    // LOGIC: Nếu distance < threshold và > 0 → occupied
    // TẠI SAO CẦN CHECK > 0:
    // - Distance = 0 có thể là lỗi sensor
    // - Distance < threshold nghĩa là có vật thể gần (người ngồi)
    const isOccupied = threshold > 0 && avgDistance < threshold && avgDistance > 0

    const now = new Date()
    const wasOccupied = isDeskOccupied(desk.id)

    // Xử lý state transition: unoccupied → occupied
    // TẠI SAO CẦN XỬ LÝ TRANSITION:
    // - Khi bàn được sử dụng, cần bật đèn tự động
    // - Lưu start time vào in-memory state để tính energy consumption sau
    if (isOccupied && !wasOccupied) {
      setDeskOccupied(desk.id, now)
      await prisma.desk.update({
        where: { id: desk.id },
        data: {
          lightStatus: true, // Auto turn on light
        },
      })
      console.log(`[Distance Processor] ✅ Desk ${desk.id} became occupied (distance: ${avgDistance.toFixed(2)} cm)`)
    }
    // Xử lý state transition: occupied → unoccupied
    // TẠI SAO CẦN XỬ LÝ TRANSITION:
    // - Khi bàn không còn được sử dụng, tắt đèn
    // - Tính toán energy consumption dựa trên thời gian sử dụng
    // - Chỉ lưu energy record nếu phiên >= minimumSessionDurationMinutes
    else if (!isOccupied && wasOccupied) {
      const startTime = setDeskUnoccupied(desk.id)
      if (startTime) {
        // Tính thời gian sử dụng (minutes)
        const usageMinutes = Math.floor((now - startTime) / 60000)

        // Lấy minimum session duration từ ESP32 config
        const minimumDuration = esp32Config?.minimumSessionDurationMinutes || 5

        // Chỉ lưu energy record nếu phiên >= minimum duration
        if (usageMinutes >= minimumDuration) {
          // Tính energy consumption (Wh)
          // FORMULA: Energy (Wh) = Power (W) × Time (hours)
          const energyWh = (desk.lampPowerW * usageMinutes) / 60

          // Lưu energy record với startTime và endTime
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

          console.log(
            `[Distance Processor] ✅ Desk ${desk.id} became unoccupied (used ${usageMinutes} min, ${energyWh.toFixed(2)} Wh) - Saved to EnergyRecord`
          )
        } else {
          console.log(
            `[Distance Processor] ⚠️ Desk ${desk.id} session too short (${usageMinutes} min < ${minimumDuration} min) - Not saved`
          )
        }
      }

      // Cập nhật desk status
      await prisma.desk.update({
        where: { id: desk.id },
        data: {
          lightStatus: false, // Auto turn off light
        },
      })
    }
  } catch (error) {
    console.error("[Distance Processor] ❌ Error processing distance data:", error)
    throw error // Re-throw để worker có thể nack message
  }
}

/**
 * Khởi động distance processor worker
 * 
 * TẠI SAO CẦN HÀM NÀY:
 * - Đăng ký consumer từ queue "sensor.distance.queue"
 * - Xử lý messages với processDistanceData function
 * - Quản lý acknowledgment
 */
export async function startDistanceProcessor() {
  try {
    await initAmqp() // Ensure AMQP is initialized
    const queueName = "sensor.distance.queue"

    console.log(`[Worker: Distance] 🚀 Starting consumer for ${queueName}...`)

    await consumeQueue(queueName, async (content, message) => {
      await processDistanceData(content)
      // consumeQueue tự động ack/nack dựa trên exception
    })

    console.log("[Distance Processor] ✅ Distance processor worker started")
  } catch (error) {
    console.error("[Distance Processor] ❌ Failed to start worker:", error)
    throw error
  }
}

