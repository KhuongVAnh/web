import mqtt from "mqtt"
import { prisma } from "../index.js"

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
    // Extract location from meta data (room, row, table)
    const meta = data.meta || {}
    const roomNumber = meta.room
    const row = meta.row
    const table = meta.table

    // Validate location data
    if (!roomNumber || !row || !table) {
      console.error("[MQTT] ❌ Missing location data in meta: room, row, table required")
      console.error("[MQTT] Received meta:", meta)
      return
    }

    // Find the room by roomNumber
    const room = await prisma.studyRoom.findFirst({
      where: { roomNumber: Number.parseInt(roomNumber) },
    })

    if (!room) {
      console.error(`[MQTT] ❌ Room ${roomNumber} not found`)
      return
    }

    // Find the desk by location (roomId, row, position)
    const desk = await prisma.desk.findFirst({
      where: {
        roomId: room.id,
        row: Number.parseInt(row),
        position: Number.parseInt(table), // position in schema = table in ESP32
      },
    })

    if (!desk) {
      console.error(`[MQTT] ❌ Desk not found: Room ${roomNumber}, Row ${row}, Table ${table}`)
      return
    }

    console.log(`[MQTT] 📡 Received data for ESP32 at Room ${roomNumber}, Row ${row}, Table ${table} (Desk ID: ${desk.id})`)

    // Process distance sensor data
    if (data.distance && data.distance.data && data.distance.data.length > 0) {
      const distanceReadings = data.distance.data
      // Lấy giá trị cuối cùng của mảng thay vì tính trung bình
      const lastDistance = distanceReadings[distanceReadings.length - 1]
      
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
      const isOccupied = threshold > 0 && lastDistance < threshold && lastDistance > 0

      // Save sensor reading with location info
      await prisma.sensorReading.create({
        data: {
          deskId: desk.id,
          distanceCm: lastDistance,
          occupied: isOccupied,
          room: roomNumber,
          row: Number.parseInt(row),
          table: Number.parseInt(table),
        },
      })

      // Update desk occupancy status
      const now = new Date()
      
      if (isOccupied && !desk.occupancyStatus) {
        // Just became occupied
        await prisma.desk.update({
          where: { id: desk.id },
          data: {
            occupancyStatus: true,
            occupancyStartTime: now,
            lightStatus: true, // Auto turn on light
            lastSensorReading: lastDistance,
            sensorReadingTime: now,
          },
        })
        console.log(`[MQTT] ✅ Desk ${desk.id} became occupied`)
      } else if (!isOccupied && desk.occupancyStatus) {
        // Just became unoccupied
        if (desk.occupancyStartTime) {
          const usageMinutes = Math.floor((now - desk.occupancyStartTime) / 60000)
          const totalUsage = desk.totalUsageMinutes + usageMinutes
          
          // Calculate energy consumed
          const energyWh = (desk.lampPowerW * usageMinutes) / 60
          const totalEnergy = desk.energyConsumedWh + energyWh
          
          // Save energy record with location info
          await prisma.energyRecord.create({
            data: {
              deskId: desk.id,
              powerW: desk.lampPowerW,
              durationMinutes: usageMinutes,
              energyWh: energyWh,
              room: roomNumber,
              row: Number.parseInt(row),
              table: Number.parseInt(table),
            },
          })
          
          await prisma.desk.update({
            where: { id: desk.id },
            data: {
              occupancyStatus: false,
              occupancyStartTime: null,
              lightStatus: false,
              totalUsageMinutes: totalUsage,
              energyConsumedWh: totalEnergy,
              lastSensorReading: lastDistance,
              sensorReadingTime: now,
            },
          })
          console.log(`[MQTT] ✅ Desk ${desk.id} became unoccupied (used ${usageMinutes} min, ${energyWh.toFixed(2)} Wh)`)
        }
      } else if (isOccupied) {
        // Still occupied, update sensor reading
        await prisma.desk.update({
          where: { id: desk.id },
          data: {
            lastSensorReading: lastDistance,
            sensorReadingTime: now,
          },
        })
      }
    }

    // Process DHT sensor data (temperature & humidity)
    if (data.dht && data.dht.temperature && data.dht.temperature.length > 0) {
      // Lấy giá trị cuối cùng của mảng thay vì tính trung bình
      const lastTemp = data.dht.temperature[data.dht.temperature.length - 1]
      const lastHumidity = data.dht.humidity[data.dht.humidity.length - 1]

      // Save DHT reading for the room (use room from meta, not desk.roomId)
      await prisma.dHT.create({
        data: {
          roomId: room.id,
          temperature: lastTemp,
          humidity: lastHumidity,
        },
      })
      console.log(`[MQTT] 📊 Room ${roomNumber}: ${lastTemp.toFixed(1)}°C, ${lastHumidity.toFixed(1)}%`)
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

  // Include location if provided
  if (config.room !== undefined) {
    configMessage.room = config.room
  }
  if (config.row !== undefined) {
    configMessage.row = config.row
  }
  if (config.table !== undefined) {
    configMessage.table = config.table
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

