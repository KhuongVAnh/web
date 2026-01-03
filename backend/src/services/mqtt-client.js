import mqtt from "mqtt"
import { prisma } from "../index.js"
import { setDeskOccupied, setDeskUnoccupied, isDeskOccupied } from "./desk-state.js"
import { updateDHT } from "./dht-cache.js"

const MQTT_BROKER = process.env.MQTT_BROKER || "5b91e3ce790f41e78062533f58758704.s1.eu.hivemq.cloud"
const MQTT_PORT = Number.parseInt(process.env.MQTT_PORT || "8883")
const MQTT_USERNAME = process.env.MQTT_USERNAME || "ESP32"
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "Vanh080105"
const MQTT_TOPIC_DATA = process.env.MQTT_TOPIC_DATA || "esp32/data"
const MQTT_TOPIC_CONFIG = process.env.MQTT_TOPIC_CONFIG || "esp32/config"
const ESP32_DISABLE_DISTANCE_CM = Number.parseFloat(process.env.ESP32_DISABLE_DISTANCE_CM || "4")

let mqttClient = null

export async function initMqtt() {
  if (mqttClient) return mqttClient

  return new Promise((resolve, reject) => {
    const client = mqtt.connect(`mqtts://${MQTT_BROKER}:${MQTT_PORT}`, {
      username: MQTT_USERNAME,
      password: MQTT_PASSWORD,
      clientId: `library-system-${Date.now()}`,
      reconnectPeriod: 1000,
    })

    client.on("connect", () => {
      console.log("[MQTT] ✅ Connected to broker")
      client.subscribe([MQTT_TOPIC_DATA, MQTT_TOPIC_CONFIG], (err) => {
        if (err) {
          console.error("[MQTT] ❌ Subscribe error:", err)
        } else {
          console.log(`[MQTT] 📡 Subscribed to ${MQTT_TOPIC_DATA} and ${MQTT_TOPIC_CONFIG}`)
        }
      })
      mqttClient = client
      resolve(client)
    })

    client.on("message", async (topic, message) => {
      try {
        if (topic === MQTT_TOPIC_DATA) {
          const data = JSON.parse(message.toString())
          await handleSensorData(data)
        }
      } catch (error) {
        console.error("[MQTT] ❌ Error processing message:", error)
      }
    })

    client.on("error", (error) => {
      console.error("[MQTT] ❌ Connection error:", error)
      reject(error)
    })

    client.on("close", () => {
      console.log("[MQTT] ⚠️ Connection closed")
    })

    client.on("reconnect", () => {
      console.log("[MQTT] 🔄 Reconnecting...")
    })
  })
}

async function handleSensorData(data) {
  try {
    // Find the desk with ESP32 (table 1 of room 1) - ONLY this desk changes
    const desk = await prisma.desk.findFirst({
      where: {
        roomId: 1,
        row: 1,
        position: 1,
      },
    })

    if (!desk) {
      console.error("[MQTT] ❌ ESP32 desk not found (Room 1, Row 1, Table 1)")
      return
    }

    console.log(`[MQTT] 📡 Received data for ESP32 desk (ID: ${desk.id})`)

    // Process distance sensor data
    if (data.distance && data.distance.data && data.distance.data.length > 0) {
      const distanceReadings = data.distance.data
      const avgDistance = distanceReadings.reduce((a, b) => a + b, 0) / distanceReadings.length
      
      // Get current ESP32 config to check if hardware is disabled
      const deviceId = desk.esp32DeviceId || `ESP32-${desk.id}`
      const esp32Config = await prisma.eSP32Config.findFirst({
        where: { deviceId },
      })
      
      // If hardware is disabled (distanceCm = ESP32_DISABLE_DISTANCE_CM), don't process sensor data
      if (esp32Config && esp32Config.distanceCm === ESP32_DISABLE_DISTANCE_CM) {
        console.log(`[MQTT] ⚠️  ESP32 desk is disabled (distanceCm = ${ESP32_DISABLE_DISTANCE_CM}), ignoring sensor data`)
        return
      }
      
      // Check if occupied based on threshold
      // Priority: ESP32 config > meta data > desk sensitivity > default 30
      const threshold = esp32Config?.distanceCm || data.meta?.distanceCm || desk.distanceSensitivity || 30
      const isOccupied = threshold > 0 && avgDistance < threshold && avgDistance > 0

      const now = new Date()
      const wasOccupied = isDeskOccupied(desk.id)

      if (isOccupied && !wasOccupied) {
        // Just became occupied
        setDeskOccupied(desk.id, now)
        await prisma.desk.update({
          where: { id: desk.id },
          data: {
            lightStatus: true, // Auto turn on light
          },
        })
        console.log(`[MQTT] ✅ Desk ${desk.id} became occupied`)
      } else if (!isOccupied && wasOccupied) {
        // Just became unoccupied
        const startTime = setDeskUnoccupied(desk.id)
        if (startTime) {
          const usageMinutes = Math.floor((now - startTime) / 60000)
          const minimumDuration = esp32Config?.minimumSessionDurationMinutes || 5

          // Only save if session >= minimum duration
          if (usageMinutes >= minimumDuration) {
            const energyWh = (desk.lampPowerW * usageMinutes) / 60

            // Save energy record with startTime and endTime
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
            console.log(`[MQTT] ✅ Desk ${desk.id} became unoccupied (used ${usageMinutes} min, ${energyWh.toFixed(2)} Wh) - Saved`)
          } else {
            console.log(`[MQTT] ⚠️ Desk ${desk.id} session too short (${usageMinutes} min < ${minimumDuration} min) - Not saved`)
          }
        }

        await prisma.desk.update({
          where: { id: desk.id },
          data: {
            lightStatus: false,
          },
        })
      }
    }

    // Process DHT sensor data (temperature & humidity)
    // Lưu vào cache thay vì database
    if (data.dht && data.dht.temperature && data.dht.temperature.length > 0) {
      const avgTemp = data.dht.temperature.reduce((a, b) => a + b, 0) / data.dht.temperature.length
      const avgHumidity = data.dht.humidity.reduce((a, b) => a + b, 0) / data.dht.humidity.length

      // Save DHT reading to cache (only Room 1 has ESP32 data)
      updateDHT(desk.roomId, avgTemp, avgHumidity)
      console.log(`[MQTT] 📊 Room ${desk.roomId}: ${avgTemp.toFixed(1)}°C, ${avgHumidity.toFixed(1)}% (cached)`)
    }
  } catch (error) {
    console.error("[MQTT] ❌ Error handling sensor data:", error)
  }
}

export async function publishConfig(config) {
  if (!mqttClient) {
    throw new Error("MQTT client not initialized")
  }

  const configMessage = {
    fs1: config.fs1 || 3,
    fs2: config.fs2 || 2,
    fs3: config.fs3 || 1,
    distanceCm: config.distanceCm || 30,
    duration: config.duration || 4000,
  }

  mqttClient.publish(
    MQTT_TOPIC_CONFIG, 
    JSON.stringify(configMessage), 
    { qos: 1 }, // QoS 1: at least once delivery
    (err) => {
      if (err) {
        console.error("[MQTT] ❌ Error publishing config:", err)
      } else {
        console.log("[MQTT] ✅ Published config:", configMessage)
      }
    }
  )
}

export function getMqttClient() {
  return mqttClient
}

