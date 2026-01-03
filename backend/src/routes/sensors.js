import { Router } from "express"
import { getDeskSensorData, getRoomDHT } from "../controllers/sensorController.js"

const router = Router()

/**
 * GET /api/sensors/desk/:deskId
 * @description Lấy dữ liệu sensor mới nhất của một bàn học
 * @access Public
 * @param {Number} deskId - Desk ID
 */
router.get("/desk/:deskId", getDeskSensorData)

/**
 * GET /api/sensors/room/:roomId/dht
 * @description Lấy dữ liệu DHT (nhiệt độ/độ ẩm) mới nhất của một phòng
 * @access Public
 * @param {Number} roomId - Room ID
 */
router.get("/room/:roomId/dht", getRoomDHT)

export default router

