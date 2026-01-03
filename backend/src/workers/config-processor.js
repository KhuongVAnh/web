/**
 * Config Update Processor Worker
 * 
 * LÝ THUYẾT:
 * Config processor xử lý các config updates từ admin hoặc ESP32.
 * Config updates có thể là: sampling frequencies, distance threshold, duration, etc.
 * 
 * TẠI SAO CẦN WORKER RIÊNG:
 * 1. Priority handling: Config updates cần xử lý nhanh
 * 2. Separate queue: Có thể set priority queue cho config
 * 3. Different logic: Config updates khác sensor data processing
 * 
 * TẠI SAO CẦN FILE NÀY:
 * - Xử lý config updates từ admin
 * - Sync config với ESP32 (nếu cần)
 * - Update database
 */

import { consumeQueue } from "../services/amqp-client.js"
import { prisma } from "../index.js"
import { publishConfig } from "../services/mqtt-client.js"

/**
 * Xử lý config updates
 * 
 * TẠI SAO CẦN HÀM NÀY:
 * - Nhận config updates từ admin hoặc ESP32
 * - Update database
 * - Sync với ESP32 qua MQTT (nếu cần)
 * 
 * BUSINESS LOGIC:
 * 1. Validate config data
 * 2. Update ESP32Config trong database
 * 3. Publish config đến ESP32 qua MQTT (nếu cần)
 */
async function processConfigData(message) {
  try {
    const { deviceId, config } = message

    console.log(`[Config Processor] ⚙️ Processing config update for device: ${deviceId}`)

    // Validate config
    if (!config) {
      console.warn(`[Config Processor] ⚠️ Invalid config data for device: ${deviceId}`)
      return
    }

    // Tìm ESP32 desk
    const desk = await prisma.desk.findFirst({
      where: {
        esp32DeviceId: deviceId,
      },
    })

    if (!desk) {
      console.error(`[Config Processor] ❌ Desk with deviceId ${deviceId} not found`)
      return
    }

    // Update hoặc create ESP32 config
    // TẠI SAO CẦN UPSERT:
    // - Nếu config chưa tồn tại, tạo mới
    // - Nếu đã tồn tại, update
    const esp32Config = await prisma.eSP32Config.upsert({
      where: { deviceId },
      update: {
        fs1: config.fs1 || 3,
        fs2: config.fs2 || 2,
        fs3: config.fs3 || 1,
        distanceCm: config.distanceCm || 30,
        duration: config.duration || 4000,
        lastSync: new Date(),
      },
      create: {
        deviceId,
        fs1: config.fs1 || 3,
        fs2: config.fs2 || 2,
        fs3: config.fs3 || 1,
        distanceCm: config.distanceCm || 30,
        duration: config.duration || 4000,
        lastSync: new Date(),
      },
    })

    console.log(`[Config Processor] ✅ Config updated for device: ${deviceId}`)

    // Publish config đến ESP32 qua MQTT (nếu cần)
    // TẠI SAO CẦN PUBLISH:
    // - ESP32 cần nhận config để áp dụng
    // - Sync config giữa backend và ESP32
    if (config.syncToDevice !== false) {
      // Default: sync to device
      try {
        await publishConfig({
          fs1: esp32Config.fs1,
          fs2: esp32Config.fs2,
          fs3: esp32Config.fs3,
          distanceCm: esp32Config.distanceCm,
          duration: esp32Config.duration,
        })
        console.log(`[Config Processor] ✅ Config synced to ESP32 device: ${deviceId}`)
      } catch (error) {
        console.error(`[Config Processor] ❌ Error syncing config to ESP32:`, error)
        // Không throw error vì config đã được lưu vào database
      }
    }
  } catch (error) {
    console.error("[Config Processor] ❌ Error processing config:", error)
    throw error // Re-throw để worker có thể nack message
  }
}

/**
 * Khởi động config processor worker
 * 
 * TẠI SAO CẦN HÀM NÀY:
 * - Đăng ký consumer từ queue "sensor.config.queue"
 * - Xử lý messages với processConfigData function
 */
export async function startConfigProcessor() {
  try {
    console.log("[Config Processor] 🚀 Starting config processor worker...")

    await consumeQueue("sensor.config.queue", processConfigData)

    console.log("[Config Processor] ✅ Config processor worker started")
  } catch (error) {
    console.error("[Config Processor] ❌ Failed to start worker:", error)
    throw error
  }
}

