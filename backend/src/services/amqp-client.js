/**
 * AMQP Client Service
 * 
 * LÝ THUYẾT:
 * AMQP (Advanced Message Queuing Protocol) là giao thức message queuing chuẩn
 * cho phép các ứng dụng trao đổi message một cách đáng tin cậy và linh hoạt.
 * 
 * TẠI SAO CẦN AMQP CLIENT:
 * 1. Kết nối với RabbitMQ (CloudAMQP) để gửi/nhận messages
 * 2. Tạo exchanges và queues để routing messages
 * 3. Quản lý connection lifecycle (connect, reconnect, disconnect)
 * 4. Đảm bảo messages không bị mất khi backend crash (persistent queues)
 * 
 * KIẾN TRÚC:
 * Exchange (sensor.exchange) → Routing Key → Queue → Consumer
 * 
 * Exchange Types:
 * - topic: Routing dựa trên pattern matching (sensor.distance.room1.desk1)
 * - direct: Routing exact match
 * - fanout: Broadcast to all queues
 * - headers: Routing dựa trên message headers
 */

import amqp from "amqplib"
import connect from "amqp-connection-manager"
import dotenv from "dotenv"

dotenv.config()

// Lấy AMQP URL từ environment variable
// CloudAMQP cung cấp URL dạng: amqps://user:pass@host/vhost
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost:5672"
const EXCHANGE_NAME = process.env.RABBITMQ_EXCHANGE || "sensor.exchange"

// Connection manager giúp tự động reconnect khi mất kết nối
// Đây là lợi ích lớn của AMQP so với MQTT: tự động quản lý connection
let connection = null
let channel = null

/**
 * Khởi tạo kết nối AMQP
 * 
 * TẠI SAO CẦN HÀM NÀY:
 * - Thiết lập kết nối với RabbitMQ server
 * - Tạo channel để gửi/nhận messages (mỗi channel là một connection logic)
 * - Tạo exchange và queues với cấu hình persistent
 * - Setup bindings giữa exchange và queues
 * 
 * PERSISTENT QUEUES:
 * - durable: true → Queue tồn tại khi RabbitMQ restart
 * - persistent: true → Messages được lưu vào disk, không mất khi server crash
 */
export async function initAmqp() {
  if (connection) {
    console.log("[AMQP] ✅ Already connected")
    return { connection, channel }
  }

  try {
    console.log("[AMQP] 🔌 Connecting to CloudAMQP...")

    // amqp-connection-manager tự động quản lý reconnection
    // Khi mất kết nối, nó sẽ tự động reconnect với exponential backoff
    connection = connect.connect([RABBITMQ_URL], {
      reconnectTimeInSeconds: 5, // Retry sau 5 giây
    })

    // Event handlers cho connection lifecycle
    connection.on("connect", () => {
      console.log("[AMQP] ✅ Connected to CloudAMQP")
    })

    connection.on("disconnect", (err) => {
      console.error("[AMQP] ❌ Disconnected:", err?.message)
    })

    // Tạo channel từ connection
    // Channel là nơi thực hiện các operations (publish, consume, declare)
    channel = await connection.createChannel({
      setup: async (ch) => {
        // Setup function được gọi mỗi khi channel được tạo/recreated
        // Đảm bảo exchange và queues luôn tồn tại

        // TẠI SAO CẦN DECLARE EXCHANGE:
        // - Exchange là nơi nhận messages từ producers
        // - Type "topic" cho phép routing pattern matching (sensor.*.room1.*)
        // - durable: true → Exchange tồn tại khi RabbitMQ restart
        await ch.assertExchange(EXCHANGE_NAME, "topic", {
          durable: true, // Exchange tồn tại khi server restart
        })
        console.log(`[AMQP] ✅ Exchange "${EXCHANGE_NAME}" declared`)

        // TẠI SAO CẦN NHIỀU QUEUES:
        // - Mỗi queue phục vụ một mục đích khác nhau
        // - Cho phép xử lý song song với nhiều workers
        // - Load balancing tự động giữa các consumers

        // Queue cho distance sensor data
        // Routing key: sensor.distance.{roomId}.{deskId}
        await ch.assertQueue("sensor.distance.queue", {
          durable: true, // Queue tồn tại khi server restart
          arguments: {
            "x-message-ttl": 3600000, // Messages expire sau 1 giờ nếu không được xử lý
          },
        })
        await ch.bindQueue("sensor.distance.queue", EXCHANGE_NAME, "sensor.distance.*")
        console.log("[AMQP] ✅ Queue 'sensor.distance.queue' declared and bound")

        // Queue cho DHT sensor data (temperature & humidity)
        // Routing key: sensor.dht.{roomId}
        await ch.assertQueue("sensor.dht.queue", {
          durable: true,
        })
        await ch.bindQueue("sensor.dht.queue", EXCHANGE_NAME, "sensor.dht.*")
        console.log("[AMQP] ✅ Queue 'sensor.dht.queue' declared and bound")

        // Queue cho config updates
        // Routing key: sensor.config.{deviceId}
        await ch.assertQueue("sensor.config.queue", {
          durable: true,
        })
        await ch.bindQueue("sensor.config.queue", EXCHANGE_NAME, "sensor.config.*")
        console.log("[AMQP] ✅ Queue 'sensor.config.queue' declared and bound")

        // Queue cho raw data logging (backup tất cả data)
        // Routing key: sensor.raw.*
        await ch.assertQueue("sensor.raw.queue", {
          durable: true,
        })
        await ch.bindQueue("sensor.raw.queue", EXCHANGE_NAME, "sensor.raw.*")
        console.log("[AMQP] ✅ Queue 'sensor.raw.queue' declared and bound")

        // Dead Letter Queue (DLQ) - nơi chứa messages lỗi
        // TẠI SAO CẦN DLQ:
        // - Khi message bị reject nhiều lần (không xử lý được)
        // - Messages được chuyển vào DLQ để debug và xử lý sau
        await ch.assertQueue("sensor.dlq", {
          durable: true,
        })
        console.log("[AMQP] ✅ Dead Letter Queue 'sensor.dlq' declared")
      },
    })

    console.log("[AMQP] ✅ Channel created and setup complete")

    return { connection, channel }
  } catch (error) {
    console.error("[AMQP] ❌ Failed to initialize:", error)
    throw error
  }
}

/**
 * Publish message vào exchange
 * 
 * TẠI SAO CẦN HÀM NÀY:
 * - Gửi message vào exchange với routing key
 * - RabbitMQ sẽ route message đến queue phù hợp dựa trên binding
 * 
 * ROUTING KEY PATTERN:
 * - sensor.distance.1.1 → Queue: sensor.distance.queue
 * - sensor.dht.1 → Queue: sensor.dht.queue
 * - sensor.config.ESP32-1 → Queue: sensor.config.queue
 * 
 * PERSISTENT MESSAGES:
 * - persistent: true → Message được lưu vào disk
 * - Đảm bảo message không mất khi RabbitMQ crash
 */
export async function publishMessage(routingKey, message, options = {}) {
  if (!channel) {
    throw new Error("AMQP channel not initialized. Call initAmqp() first.")
  }

  try {
    // Convert message object thành Buffer (AMQP yêu cầu Buffer)
    const messageBuffer = Buffer.from(JSON.stringify(message))

    // Publish message vào exchange
    // TẠI SAO CẦN persistent: true:
    // - Message được lưu vào disk trước khi gửi
    // - Nếu RabbitMQ crash, message vẫn còn
    const published = channel.publish(
      EXCHANGE_NAME,
      routingKey,
      messageBuffer,
      {
        persistent: true, // Message persistent (lưu vào disk)
        ...options,
      }
    )

    if (published) {
      console.log(`[AMQP] ✅ Published to ${routingKey}`)
    } else {
      // Buffer đầy, cần đợi drain event
      console.warn(`[AMQP] ⚠️ Buffer full, waiting for drain...`)
      await new Promise((resolve) => channel.once("drain", resolve))
    }

    return published
  } catch (error) {
    console.error(`[AMQP] ❌ Error publishing to ${routingKey}:`, error)
    throw error
  }
}

/**
 * Consume messages từ queue
 * 
 * TẠI SAO CẦN HÀM NÀY:
 * - Đăng ký consumer để nhận messages từ queue
 * - Xử lý messages với callback function
 * - Quản lý acknowledgment (ack/nack)
 * 
 * ACKNOWLEDGMENT:
 * - ack: Xác nhận đã xử lý xong, message được xóa khỏi queue
 * - nack: Từ chối message, có thể requeue hoặc chuyển vào DLQ
 * 
 * PREFETCH:
 * - prefetch: 1 → Chỉ nhận 1 message chưa ack tại một thời điểm
 * - Đảm bảo load balancing giữa các workers
 */
export async function consumeQueue(queueName, onMessage, options = {}) {
  if (!channel) {
    throw new Error("AMQP channel not initialized. Call initAmqp() first.")
  }

  try {
    // Set prefetch để control số lượng unacknowledged messages
    // TẠI SAO CẦN PREFETCH:
    // - Giới hạn số messages một worker nhận cùng lúc
    // - Đảm bảo load balancing giữa nhiều workers
    await channel.prefetch(1)

    // Consume messages từ queue
    // TẠI SAO CẦN noAck: false:
    // - noAck: false → Cần gửi ack/nack sau khi xử lý
    // - Đảm bảo message không bị mất nếu worker crash
    await channel.consume(
      queueName,
      async (msg) => {
        if (!msg) {
          console.log(`[AMQP] ⚠️ Consumer cancelled for ${queueName}`)
          return
        }

        try {
          // Parse message content
          const content = JSON.parse(msg.content.toString())
          console.log(`[AMQP] 📨 Received message from ${queueName}:`, content)

          // Xử lý message với callback
          await onMessage(content, msg)

          // Acknowledge message sau khi xử lý thành công
          // TẠI SAO CẦN ACK:
          // - Xác nhận đã xử lý xong
          // - Message được xóa khỏi queue
          // - Nếu không ack, message sẽ được requeue
          channel.ack(msg)
        } catch (error) {
          console.error(`[AMQP] ❌ Error processing message from ${queueName}:`, error)

          // Negative acknowledgment với requeue
          // TẠI SAO CẦN NACK:
          // - Xử lý lỗi, message được requeue để thử lại
          // - Nếu requeue nhiều lần, có thể chuyển vào DLQ
          channel.nack(msg, false, true) // requeue = true
        }
      },
      {
        noAck: false, // Cần acknowledgment
        ...options,
      }
    )

    console.log(`[AMQP] ✅ Consuming from queue: ${queueName}`)
  } catch (error) {
    console.error(`[AMQP] ❌ Error consuming from ${queueName}:`, error)
    throw error
  }
}

/**
 * Đóng kết nối AMQP
 * 
 * TẠI SAO CẦN HÀM NÀY:
 * - Graceful shutdown khi ứng dụng tắt
 * - Đảm bảo tất cả messages được xử lý trước khi đóng
 */
export async function closeAmqp() {
  try {
    if (channel) {
      await channel.close()
      channel = null
    }
    if (connection) {
      await connection.close()
      connection = null
    }
    console.log("[AMQP] ✅ Connection closed")
  } catch (error) {
    console.error("[AMQP] ❌ Error closing connection:", error)
  }
}

/**
 * Lấy channel hiện tại (để sử dụng trực tiếp nếu cần)
 */
export function getChannel() {
  return channel
}

/**
 * Lấy connection hiện tại
 */
export function getConnection() {
  return connection
}

