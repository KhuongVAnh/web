import { Router } from "express"
import { auth, rbac } from "../middlewares/validate.js"
import {
  getStats,
  getEnergyReport,
  getMonthlyEnergyReport,
  updateESP32Config,
  bulkUpdateDesks,
} from "../controllers/adminController.js"

const router = Router()

/**
 * GET /api/admin/stats
 * @description Lấy thống kê tổng quan hệ thống (chỉ admin)
 * @access Private (Admin only)
 */
router.get("/stats", auth, rbac("admin"), getStats)

/**
 * GET /api/admin/energy-report
 * @description Lấy báo cáo năng lượng tích lũy theo phòng (chỉ admin)
 * @access Private (Admin only)
 */
router.get("/energy-report", auth, rbac("admin"), getEnergyReport)

/**
 * GET /api/admin/energy-report/monthly
 * @description Lấy báo cáo năng lượng theo tháng (chỉ admin)
 * @access Private (Admin only)
 * @query {Number} month - Tháng (1-12)
 * @query {Number} year - Năm
 * @query {String} compareMonths - JSON array of {month, year} để so sánh
 */
router.get("/energy-report/monthly", auth, rbac("admin"), getMonthlyEnergyReport)

/**
 * POST /api/admin/esp32/config
 * @description Cập nhật cấu hình ESP32 (chỉ admin)
 * @access Private (Admin only)
 */
router.post("/esp32/config", auth, rbac("admin"), updateESP32Config)

/**
 * POST /api/admin/desks/bulk-update
 * @description Cập nhật hàng loạt cấu hình bàn học (chỉ admin)
 * @access Private (Admin only)
 */
router.post("/desks/bulk-update", auth, rbac("admin"), bulkUpdateDesks)

export default router

