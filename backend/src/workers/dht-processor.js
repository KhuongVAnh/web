/**
 * DHT Sensor Data Processor Worker
 * 
 * LÝ THUYẾT:
 * DHT (Digital Humidity and Temperature) sensor đo nhiệt độ và độ ẩm của phòng.
 * Khác với distance sensor (theo bàn), DHT sensor đo theo phòng.
 * 
 * TẠI SAO CẦN WORKER RIÊNG:
 * 1. Separation of concerns: DHT data khác distance data
 * 2. Independent processing: Có thể xử lý song song
 * 3. Different queue: Routing khác nhau (sensor.dht.{roomId} vs sensor.distance.{roomId}.{deskId})
 * 
 * TẠI SAO CẦN FILE NÀY:
 * - Xử lý DHT sensor data (temperature & humidity)
 * - Lưu vào database cho từng phòng
 * - Có thể dùng để điều chỉnh HVAC system trong tương lai
 */

import { consumeQueue, initAmqp } from "../services/amqp-client.js"
import { updateDHT } from "../services/dht-cache.js"

/**
 * Xử lý DHT sensor data
 * 
 * TẠI SAO CẦN HÀM NÀY:
 * - Nhận temperature và humidity readings từ ESP32
 * - Tính average values
 * - Lưu vào cache (in-memory) thay vì database
 * 
 * BUSINESS LOGIC:
 * 1. Tính average temperature và humidity từ readings
 * 2. Lưu vào cache với roomId (chỉ phòng 1 có dữ liệu từ ESP32)
 * 3. Có thể trigger alerts nếu temperature/humidity ngoài range
 */
async function processDhtData(content) {
  try {
    const { roomId, data } = content

    console.log(`[DHT Processor] 📊 Processing DHT data for Room ${roomId}`)

    // Validate data
    if (!data?.temperature || !data?.humidity || data.temperature.length === 0 || data.humidity.length === 0) {
      console.warn(`[DHT Processor] ⚠️ Invalid DHT data for Room ${roomId}`)
      return
    }

    // Tính average temperature và humidity
    // TẠI SAO CẦN AVERAGE:
    // - ESP32 gửi nhiều readings trong một lần
    // - Average giúp loại bỏ noise
    const avgTemp = data.temperature.reduce((sum, val) => sum + val, 0) / data.temperature.length
    const avgHumidity = data.humidity.reduce((sum, val) => sum + val, 0) / data.humidity.length

    // Validate values (temperature: -40 to 80°C, humidity: 0-100%)
    // TẠI SAO CẦN VALIDATE:
    // - Loại bỏ readings lỗi từ sensor
    // - Đảm bảo data quality
    if (avgTemp < -40 || avgTemp > 80 || avgHumidity < 0 || avgHumidity > 100) {
      console.warn(
        `[DHT Processor] ⚠️ Invalid DHT values for Room ${roomId}: Temp=${avgTemp.toFixed(1)}°C, Humidity=${avgHumidity.toFixed(1)}%`
      )
      return
    }

    // Lưu DHT reading vào cache (in-memory)
    // TẠI SAO CHỈ LƯU VÀO CACHE:
    // - Không cần tracking lịch sử nhiệt độ/độ ẩm
    // - Chỉ cần hiển thị giá trị hiện tại
    // - Chỉ phòng 1 có dữ liệu từ ESP32
    // TẠI SAO CHỈ XỬ LÝ ROOM 1:
    // - Theo yêu cầu, chỉ phòng 1 có cảm biến DHT thực
    // - Các phòng khác sẽ hiển thị "NA"
    if (roomId !== 1) {
      console.log(`[DHT Processor] ℹ️ Ignoring DHT data for Room ${roomId} (only Room 1 has real sensor)`)
      return
    }
    
    updateDHT(roomId, avgTemp, avgHumidity)

    console.log(
      `[DHT Processor] ✅ Room ${roomId}: ${avgTemp.toFixed(1)}°C, ${avgHumidity.toFixed(1)}% humidity (cached)`
    )

    // TODO: Có thể thêm logic để trigger alerts nếu temperature/humidity ngoài range
    // Ví dụ: Nếu temp > 30°C → gửi alert cho admin
  } catch (error) {
    console.error("[DHT Processor] ❌ Error processing DHT data:", error)
    throw error // Re-throw để worker có thể nack message
  }
}

/**
 * Khởi động DHT processor worker
 * 
 * TẠI SAO CẦN HÀM NÀY:
 * - Đăng ký consumer từ queue "sensor.dht.queue"
 * - Xử lý messages với processDhtData function
 */
export async function startDhtProcessor() {
  try {
    await initAmqp() // Ensure AMQP is initialized
    const queueName = "sensor.dht.queue"

    console.log(`[Worker: DHT] 🚀 Starting consumer for ${queueName}...`)

    await consumeQueue(queueName, async (content, message) => {
      await processDhtData(content)
      // consumeQueue tự động ack/nack dựa trên exception
    })

    console.log("[DHT Processor] ✅ DHT processor worker started")
  } catch (error) {
    console.error("[DHT Processor] ❌ Failed to start worker:", error)
    throw error
  }
}

