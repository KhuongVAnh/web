import { Router } from "express"
import { auth, rbac } from "../middlewares/validate.js"
import {
  getAllDesks,
  getDeskById,
  toggleLight,
  updateDeskConfig,
  getDeskEnergy,
} from "../controllers/deskController.js"

const router = Router()

/**
 * GET /api/desks
 * @description Lấy danh sách tất cả các bàn học
 * @access Public
 */
router.get("/", getAllDesks)

/**
 * GET /api/desks/:id
 * @description Lấy thông tin chi tiết của một bàn học theo ID
 * @access Public
 * @param {Number} id - Desk ID
 */
router.get("/:id", getDeskById)

/**
 * PATCH /api/desks/:id/toggle-light
 * @description Bật/tắt đèn bàn học (chỉ admin)
 * @access Private (Admin only)
 * @param {Number} id - Desk ID
 */
router.patch("/:id/toggle-light", auth, rbac("admin"), toggleLight)

/**
 * PATCH /api/desks/:id/config
 * @description Cập nhật cấu hình bàn học (chỉ admin)
 * @access Private (Admin only)
 * @param {Number} id - Desk ID
 */
router.patch("/:id/config", auth, rbac("admin"), updateDeskConfig)

/**
 * GET /api/desks/:id/energy
 * @description Lấy thông tin tiêu thụ năng lượng của bàn học
 * @access Public
 * @param {Number} id - Desk ID
 */
router.get("/:id/energy", getDeskEnergy)

export default router

