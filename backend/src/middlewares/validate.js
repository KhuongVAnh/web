/**
 * Validation Middleware
 * 
 * @description Middleware để validate request body sử dụng express-validator
 * @param {Array} validations - Mảng các validation rules từ express-validator
 * @returns {Function} Express middleware function
 */
import { validationResult } from "express-validator"

export const validate = (validations) => {
  return async (req, res, next) => {
    // Chạy tất cả validations
    await Promise.all(validations.map((validation) => validation.run(req)))

    // Kiểm tra kết quả validation
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    // Nếu không có lỗi, tiếp tục đến controller
    next()
  }
}

/**
 * Authentication Middleware
 * 
 * @description Middleware để xác thực JWT token và attach user vào request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {void}
 */
import jwt from "jsonwebtoken"
import { prisma } from "../index.js"

export const auth = async (req, res, next) => {
  try {
    // Lấy token từ Authorization header
    // Format: "Bearer <token>"
    const token = req.headers.authorization?.split(" ")[1]

    if (!token) {
      return res.status(401).json({ message: "No token provided" })
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret")

    // Tìm user trong database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, username: true, email: true, role: true, fullName: true },
    })

    if (!user) {
      return res.status(401).json({ message: "User not found" })
    }

    // Attach user vào request object
    req.user = user
    next()
  } catch (error) {
    res.status(401).json({ message: "Invalid token" })
  }
}

/**
 * Role-Based Access Control (RBAC) Middleware
 * 
 * @description Middleware để kiểm tra quyền truy cập dựa trên role
 * @param {String|Array} allowedRoles - Role hoặc mảng roles được phép truy cập
 * @returns {Function} Express middleware function
 * 
 * @example
 * // Chỉ admin mới được truy cập
 * router.get("/admin/stats", auth, rbac("admin"), getStats)
 * 
 * @example
 * // Admin hoặc user đều được truy cập
 * router.get("/data", auth, rbac(["admin", "user"]), getData)
 */
export const rbac = (allowedRoles) => {
  return (req, res, next) => {
    // Kiểm tra xem user đã được authenticate chưa
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" })
    }

    // Chuyển allowedRoles thành array nếu là string
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]

    // Kiểm tra xem user role có trong danh sách allowed roles không
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: Insufficient permissions" })
    }

    // Nếu có quyền, tiếp tục
    next()
  }
}

