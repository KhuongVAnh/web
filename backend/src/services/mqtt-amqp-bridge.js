/**
 * MQTT to AMQP Bridge Service
 * 
 * LÝ THUYẾT:
 * Bridge là một service trung gian chuyển đổi messages từ MQTT sang AMQP.
 * 
 * TẠI SAO CẦN BRIDGE:
 * 1. ESP32 chỉ hỗ trợ MQTT (nhẹ, tiết kiệm băng thông)
 * 2. Backend cần AMQP để có routing linh hoạt và đảm bảo delivery
 * 3. Bridge kết hợp ưu điểm của cả hai: MQTT cho IoT, AMQP cho backend
 * 
 * KIẾN TRÚC:
 * ESP32 → MQTT Broker → Bridge → AMQP Exchange → Queues → Workers
 * 
 * FLOW:
 * 1. ESP32 publish lên MQTT topic "esp32/data"
 * 2. Bridge subscribe MQTT topic này
 * 3. Bridge transform message và publish vào AMQP exchange
 * 4. AMQP route message đến queue phù hợp dựa trên routing key
 * 5. Workers consume từ queues và xử lý
 * 
 * ROUTING KEY MAPPING:
 * - MQTT topic "esp32/data" với distance data → AMQP routing key "sensor.distance.{roomId}.{deskId}"
 * - MQTT topic "esp32/data" với DHT data → AMQP routing key "sensor.dht.{roomId}"
 * - MQTT topic "esp32/config" → AMQP routing key "sensor.config.{deviceId}"
 */

import mqtt from "mqtt"
import { publishMessage } from "./amqp-client.js"
import { prisma } from "../index.js"
import dotenv from "dotenv"

dotenv.config()

// MQTT Configuration (giữ nguyên từ mqtt-client.js)
const MQTT_BROKER = process.env.MQTT_BROKER || "5b91e3ce790f41e78062533f58758704.s1.eu.hivemq.cloud"
const MQTT_PORT = Number.parseInt(process.env.MQTT_PORT || "8883")
const MQTT_USERNAME = process.env.MQTT_USERNAME || "ESP32"
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "Vanh080105"
const MQTT_TOPIC_DATA = process.env.MQTT_TOPIC_DATA || "esp32/data"
const MQTT_TOPIC_CONFIG = process.env.MQTT_TOPIC_CONFIG || "esp32/config"

let mqttClient = null

/**
 * Khởi tạo MQTT client và subscribe topics
 * 
 * TẠI SAO CẦN HÀM NÀY:
 * - Kết nối với MQTT broker để nhận messages từ ESP32
 * - Subscribe các topics cần thiết
 * - Forward messages sang AMQP
 */
export async function initMqttAmqpBridge() {
  if (mqttClient) {
    console.log("[MQTT-AMQP Bridge] ✅ Already initialized")
    return mqttClient
  }

  return new Promise((resolve, reject) => {
    console.log("[MQTT-AMQP Bridge] 🔌 Connecting to MQTT broker...")

    // Kết nối MQTT broker
    // TẠI SAO CẦN MQTT CLIENT RIÊNG:
    // - Bridge cần một connection riêng để không ảnh hưởng đến mqtt-client.js hiện tại
    // - Có thể chạy song song với mqtt-client.js trong quá trình migration
    const client = mqtt.connect(`mqtts://${MQTT_BROKER}:${MQTT_PORT}`, {
      username: MQTT_USERNAME,
      password: MQTT_PASSWORD,
      clientId: `mqtt-amqp-bridge-${Date.now()}`,
      reconnectPeriod: 1000,
    })

    client.on("connect", () => {
      console.log("[MQTT-AMQP Bridge] ✅ Connected to MQTT broker")

      // Subscribe các topics cần bridge
      // TẠI SAO CẦN SUBSCRIBE:
      // - Nhận messages từ ESP32
      // - Forward sang AMQP để xử lý
      client.subscribe([MQTT_TOPIC_DATA, MQTT_TOPIC_CONFIG], (err) => {
        if (err) {
          console.error("[MQTT-AMQP Bridge] ❌ Subscribe error:", err)
          reject(err)
        } else {
          console.log(`[MQTT-AMQP Bridge] ✅ Subscribed to ${MQTT_TOPIC_DATA} and ${MQTT_TOPIC_CONFIG}`)
          mqttClient = client
          resolve(client)
        }
      })
    })

    // Xử lý messages từ MQTT và forward sang AMQP
    // TẠI SAO CẦN EVENT HANDLER NÀY:
    // - Nhận message từ ESP32 qua MQTT
    // - Transform và publish vào AMQP exchange
    // - AMQP sẽ route message đến queue phù hợp
    client.on("message", async (topic, message) => {
      try {
        const data = JSON.parse(message.toString())
        console.log(`[MQTT-AMQP Bridge] 📡 Received from MQTT topic: ${topic}`)

        // Forward message sang AMQP dựa trên topic và data type
        if (topic === MQTT_TOPIC_DATA) {
          await forwardSensorDataToAmqp(data)
        } else if (topic === MQTT_TOPIC_CONFIG) {
          await forwardConfigToAmqp(data)
        }
      } catch (error) {
        console.error("[MQTT-AMQP Bridge] ❌ Error processing message:", error)
      }
    })

    client.on("error", (error) => {
      console.error("[MQTT-AMQP Bridge] ❌ Connection error:", error)
      reject(error)
    })

    client.on("close", () => {
      console.log("[MQTT-AMQP Bridge] ⚠️ Connection closed")
    })

    client.on("reconnect", () => {
      console.log("[MQTT-AMQP Bridge] 🔄 Reconnecting...")
    })
  })
}

/**
 * Forward sensor data từ MQTT sang AMQP
 * 
 * TẠI SAO CẦN HÀM NÀY:
 * - Transform MQTT message thành AMQP routing keys
 * - Route distance data và DHT data đến queues khác nhau
 * - Thêm metadata (roomId, deskId) vào routing key
 * 
 * ROUTING STRATEGY:
 * - Distance data → routing key: "sensor.distance.{roomId}.{deskId}"
 * - DHT data → routing key: "sensor.dht.{roomId}"
 * - Raw data → routing key: "sensor.raw.{roomId}.{deskId}" (backup tất cả)
 */
async function forwardSensorDataToAmqp(data) {
  try {
    // Tìm ESP32 desk (Room 1, Row 1, Table 1)
    // TẠI SAO CẦN TÌM DESK:
    // - Cần roomId và deskId để tạo routing key
    // - Routing key giúp AMQP route message đến queue phù hợp
    const desk = await prisma.desk.findFirst({
      where: {
        roomId: 1,
        row: 1,
        position: 1,
      },
    })

    if (!desk) {
      console.error("[MQTT-AMQP Bridge] ❌ ESP32 desk not found")
      return
    }

    const roomId = desk.roomId
    const deskId = desk.id

    // Forward distance sensor data
    // TẠI SAO CẦN ROUTING KEY CỤ THỂ:
    // - "sensor.distance.1.1" → Queue: sensor.distance.queue
    // - Cho phép routing chính xác theo room và desk
    // - Dễ dàng thêm ESP32 mới (chỉ cần thay routing key)
    if (data.distance && data.distance.data && data.distance.data.length > 0) {
      const routingKey = `sensor.distance.${roomId}.${deskId}`
      await publishMessage(routingKey, {
        type: "distance",
        roomId,
        deskId,
        data: data.distance,
        meta: data.meta,
        timestamp: new Date().toISOString(),
      })
      console.log(`[MQTT-AMQP Bridge] ✅ Forwarded distance data to ${routingKey}`)
    }

    // Forward DHT sensor data
    // TẠI SAO DHT CHỈ CẦN roomId:
    // - DHT sensor đo nhiệt độ/phòng, không phải theo bàn
    // - Routing key: "sensor.dht.1" → Queue: sensor.dht.queue
    if (data.dht && data.dht.temperature && data.dht.temperature.length > 0) {
      const routingKey = `sensor.dht.${roomId}`
      await publishMessage(routingKey, {
        type: "dht",
        roomId,
        data: data.dht,
        timestamp: new Date().toISOString(),
      })
      console.log(`[MQTT-AMQP Bridge] ✅ Forwarded DHT data to ${routingKey}`)
    }

    // Forward raw data (backup tất cả data)
    // TẠI SAO CẦN RAW DATA QUEUE:
    // - Backup tất cả data để audit và debug
    // - Có thể dùng để replay data nếu cần
    const rawRoutingKey = `sensor.raw.${roomId}.${deskId}`
    await publishMessage(rawRoutingKey, {
      type: "raw",
      roomId,
      deskId,
      rawData: data,
      timestamp: new Date().toISOString(),
    })
    console.log(`[MQTT-AMQP Bridge] ✅ Forwarded raw data to ${rawRoutingKey}`)
  } catch (error) {
    console.error("[MQTT-AMQP Bridge] ❌ Error forwarding sensor data:", error)
  }
}

/**
 * Forward config updates từ MQTT sang AMQP
 * 
 * TẠI SAO CẦN HÀM NÀY:
 * - Config updates từ ESP32 cần được xử lý
 * - Route đến config queue để xử lý
 */
async function forwardConfigToAmqp(data) {
  try {
    // Tìm ESP32 desk để lấy deviceId
    const desk = await prisma.desk.findFirst({
      where: {
        roomId: 1,
        row: 1,
        position: 1,
      },
    })

    if (!desk) {
      console.error("[MQTT-AMQP Bridge] ❌ ESP32 desk not found")
      return
    }

    const deviceId = desk.esp32DeviceId || `ESP32-${desk.id}`
    const routingKey = `sensor.config.${deviceId}`

    await publishMessage(routingKey, {
      type: "config",
      deviceId,
      config: data,
      timestamp: new Date().toISOString(),
    })

    console.log(`[MQTT-AMQP Bridge] ✅ Forwarded config to ${routingKey}`)
  } catch (error) {
    console.error("[MQTT-AMQP Bridge] ❌ Error forwarding config:", error)
  }
}

/**
 * Đóng MQTT connection
 */
export async function closeMqttAmqpBridge() {
  if (mqttClient) {
    await mqttClient.end()
    mqttClient = null
    console.log("[MQTT-AMQP Bridge] ✅ Connection closed")
  }
}

