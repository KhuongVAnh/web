import { Router } from "express"
import { auth, rbac } from "../middlewares/validate.js"
import {
  getStats,
  getEnergyReport,
  getMonthlyEnergyReport,
  getDeskDailyEnergyReport,
  updateESP32Config,
  bulkUpdateDesks,
} from "../controllers/adminController.js"

const router = Router()

/**
 * GET /api/admin/stats
 * Overview stats (admin only)
 */
router.get("/stats", auth, rbac("admin"), getStats)

/**
 * GET /api/admin/energy-report
 * Total energy report by room (admin only)
 */
router.get("/energy-report", auth, rbac("admin"), getEnergyReport)

/**
 * GET /api/admin/energy-report/monthly
 * Monthly energy report (admin only)
 */
router.get("/energy-report/monthly", auth, rbac("admin"), getMonthlyEnergyReport)

/**
 * GET /api/admin/energy-report/daily
 * Daily energy report for a specific desk (admin only)
 */
router.get("/energy-report/daily", auth, rbac("admin"), getDeskDailyEnergyReport)

/**
 * POST /api/admin/esp32/config
 * Update ESP32 config (admin only)
 */
router.post("/esp32/config", auth, rbac("admin"), updateESP32Config)

/**
 * POST /api/admin/desks/bulk-update
 * Bulk update desks (admin only)
 */
router.post("/desks/bulk-update", auth, rbac("admin"), bulkUpdateDesks)

export default router
