import { Router } from "express"
import { getAllRooms, getRoomById, getRoomTemperature } from "../controllers/roomController.js"

const router = Router()

/**
 * GET /api/rooms
 * @description Lấy danh sách tất cả các phòng học
 * @access Public
 */
router.get("/", getAllRooms)

/**
 * GET /api/rooms/:id
 * @description Lấy thông tin chi tiết của một phòng học theo ID
 * @access Public
 * @param {Number} id - Room ID
 */
router.get("/:id", getRoomById)

/**
 * GET /api/rooms/:id/temperature
 * @description Lấy nhiệt độ và độ ẩm hiện tại của phòng
 * @access Public
 * @param {Number} id - Room ID
 */
router.get("/:id/temperature", getRoomTemperature)

export default router

