import mqtt from "mqtt"
import { prisma } from "../index.js"

const MQTT_BROKER = process.env.MQTT_BROKER || "5b91e3ce790f41e78062533f58758704.s1.eu.hivemq.cloud"
const MQTT_PORT = Number.parseInt(process.env.MQTT_PORT || "8883")
const MQTT_USERNAME = process.env.MQTT_USERNAME || "ESP32"
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "Vanh080105"
// Topic dạng esp32/abc/data (a=room, b=row, c=table) và esp32/abc/config
const MQTT_TOPIC_DATA_PATTERN = process.env.MQTT_TOPIC_DATA_PATTERN || "esp32/+/data"
const MQTT_TOPIC_CONFIG_PREFIX = process.env.MQTT_TOPIC_CONFIG_PREFIX || "esp32"
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
      console.log("[MQTT] Connected to broker")
      client.subscribe(MQTT_TOPIC_DATA_PATTERN, { qos: 1 }, (err) => {
        if (err) {
          console.error("[MQTT] Subscribe error:", err)
        } else {
          console.log(`[MQTT] Subscribed to data topics: ${MQTT_TOPIC_DATA_PATTERN}`)
        }
      })
      mqttClient = client
      resolve(client)
    })

    client.on("message", async (topic, message) => {
      try {
        const data = JSON.parse(message.toString())
        await handleSensorData(topic, data)
      } catch (error) {
        console.error("[MQTT] Error processing message:", error)
      }
    })

    client.on("error", (error) => {
      console.error("[MQTT] Connection error:", error)
      reject(error)
    })

    client.on("close", () => {
      console.log("[MQTT] Connection closed")
    })

    client.on("reconnect", () => {
      console.log("[MQTT] Reconnecting...")
    })
  })
}

function parseLocationFromTopic(topic) {
  // topic = esp32/abc/data (a=room, b=row, c=table)
  const match = topic.match(/^esp32\/(\d+)\/data$/)
  if (!match) return null
  const code = match[1]
  if (code.length < 3) return null
  const room = Number.parseInt(code[0])
  const row = Number.parseInt(code[1])
  const table = Number.parseInt(code[2])
  if (Number.isNaN(room) || Number.isNaN(row) || Number.isNaN(table)) return null
  return { room, row, table }
}

async function handleSensorData(topic, data) {
  try {
    const topicLocation = parseLocationFromTopic(topic)
    const meta = data.meta || {}

    // Ưu tiên lấy từ topic; fallback meta để tương thích cũ
    const roomNumber = topicLocation?.room ?? meta.room
    const row = topicLocation?.row ?? meta.row
    const table = topicLocation?.table ?? meta.table

    if (!roomNumber || !row || !table) {
      console.error("[MQTT] Missing location: room, row, table required", { meta, topic })
      return
    }

    const room = await prisma.studyRoom.findFirst({
      where: { roomNumber: Number.parseInt(roomNumber) },
    })
    if (!room) {
      console.error(`[MQTT] Room ${roomNumber} not found`)
      return
    }

    const desk = await prisma.desk.findFirst({
      where: {
        roomId: room.id,
        row: Number.parseInt(row),
        position: Number.parseInt(table),
      },
    })

    if (!desk) {
      console.error(`[MQTT] Desk not found: Room ${roomNumber}, Row ${row}, Table ${table}`)
      return
    }

    // if (desk.disabled) {
    //   console.log(`[MQTT] Desk ${desk.id} is disabled; ignoring sensor data`)
    //   return
    // }

    console.log(`[MQTT] Data for Desk ${desk.id} (room ${roomNumber}, row ${row}, table ${table})`)

    // Distance data
    if (data.distance && data.distance.data && data.distance.data.length > 0) {
      const distanceReadings = data.distance.data
      const lastDistance = distanceReadings[distanceReadings.length - 1]

      const deviceId = desk.esp32DeviceId || `ESP32-${desk.id}`
      const esp32Config = await prisma.eSP32Config.findFirst({ where: { deviceId } })

      if (esp32Config && esp32Config.distanceCm === ESP32_DISABLE_DISTANCE_CM) {
        console.log(`[MQTT] Desk ${desk.id} disabled (distanceCm=${ESP32_DISABLE_DISTANCE_CM}), skip`)
        return
      }

      const threshold = esp32Config?.distanceCm || data.meta?.distanceCm || desk.distanceSensitivity || 30
      const isOccupied =
        threshold > 0 &&
        distanceReadings.some(value => value < threshold)

      const roomNum = Number.parseInt(roomNumber)
      const rowNum = Number.parseInt(row)
      const tableNum = Number.parseInt(table)

      await prisma.sensorReading.create({
        data: {
          deskId: desk.id,
          distanceCm: lastDistance,
          occupied: isOccupied,
          room: roomNum,
          row: rowNum,
          table: tableNum,
        },
      })

      const now = new Date()

      if (isOccupied && !desk.occupancyStatus) {
        await prisma.desk.update({
          where: { id: desk.id },
          data: {
            occupancyStatus: true,
            occupancyStartTime: now,
            lightStatus: true,
            lastSensorReading: lastDistance,
            sensorReadingTime: now,
          },
        })
        console.log(`[MQTT] Desk ${desk.id} became occupied`)

        // bật đèn
        const configMessage = {
          lightOn: true
        }

        const topic = `${MQTT_TOPIC_CONFIG_PREFIX}/${roomNum}${rowNum}${tableNum}/config`
        mqttClient.publish(topic, JSON.stringify(configMessage), { qos: 1 }, (err) => {
          if (err) {
            console.error("[MQTT] Error publishing config:", err)
          } else {
            console.log(`[MQTT] Published config to ${topic}:`, configMessage)
          }
        })

      } else if (!isOccupied && desk.occupancyStatus) {
        if (desk.occupancyStartTime) {
          const usageMinutes = Math.floor((now - desk.occupancyStartTime) / 60000)
          const totalUsage = desk.totalUsageMinutes + usageMinutes
          const energyWh = (desk.lampPowerW * usageMinutes) / 60
          const totalEnergy = desk.energyConsumedWh + energyWh

          await prisma.energyRecord.create({
            data: {
              deskId: desk.id,
              powerW: desk.lampPowerW,
              durationMinutes: usageMinutes,
              energyWh: energyWh,
              room: roomNum,
              row: rowNum,
              table: tableNum,
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
          console.log(`[MQTT] Desk ${desk.id} became unoccupied (used ${usageMinutes} min, ${energyWh.toFixed(2)} Wh)`)

          // tắt đèn
          const configMessage = {
            lightOn: false
          }

          const topic = `${MQTT_TOPIC_CONFIG_PREFIX}/${roomNum}${rowNum}${tableNum}/config`
          mqttClient.publish(topic, JSON.stringify(configMessage), { qos: 1 }, (err) => {
            if (err) {
              console.error("[MQTT] Error publishing config:", err)
            } else {
              console.log(`[MQTT] Published config to ${topic}:`, configMessage)
            }
          })

        }
      } else if (isOccupied) {
        await prisma.desk.update({
          where: { id: desk.id },
          data: {
            lastSensorReading: lastDistance,
            sensorReadingTime: now,
          },
        })
      }
    }

    // DHT data
    if (data.dht && data.dht.temperature && data.dht.temperature.length > 0) {
      const lastTemp = data.dht.temperature[data.dht.temperature.length - 1]
      const lastHumidity = data.dht.humidity[data.dht.humidity.length - 1]

      await prisma.dHT.create({
        data: {
          roomId: room.id,
          temperature: lastTemp,
          humidity: lastHumidity,
        },
      })
      console.log(`[MQTT] Room ${roomNumber}: ${lastTemp.toFixed(1)} C, ${lastHumidity.toFixed(1)}%`)
    }
  } catch (error) {
    console.error("[MQTT] Error handling sensor data:", error)
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

  // Publish per-desk topic if location available
  if (config.room !== undefined && config.row !== undefined && config.table !== undefined) {
    const room = Number.parseInt(config.room)
    const row = Number.parseInt(config.row)
    const table = Number.parseInt(config.table)
    const topic = `${MQTT_TOPIC_CONFIG_PREFIX}/${room}${row}${table}/config`
    mqttClient.publish(topic, JSON.stringify(configMessage), { qos: 1 }, (err) => {
      if (err) {
        console.error("[MQTT] Error publishing config:", err)
      } else {
        console.log(`[MQTT] Published config to ${topic}:`, configMessage)
      }
    })
  } else {
    // Fallback shared topic for backward compatibility
    const topic = `${MQTT_TOPIC_CONFIG_PREFIX}/config`
    mqttClient.publish(topic, JSON.stringify(configMessage), { qos: 1 }, (err) => {
      if (err) {
        console.error("[MQTT] Error publishing config (fallback):", err)
      } else {
        console.log(`[MQTT] Published config to fallback ${topic}:`, configMessage)
      }
    })
  }
}

export function getMqttClient() {
  return mqttClient
}
