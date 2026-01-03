import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { prisma } from "../index.js"

/**
 * Register - Đăng ký tài khoản mới
 * 
 * @description Tạo tài khoản user mới với username, email và password
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {String} req.body.username - Username (required, 3-20 characters)
 * @param {String} req.body.email - Email (required, valid email format)
 * @param {String} req.body.password - Password (required, min 6 characters, must contain uppercase, lowercase, number)
 * @param {String} [req.body.fullName] - Full name (optional)
 * 
 * @param {Object} res - Express response object
 * 
 * @returns {Object} 201 - Success response với user object và JWT token
 * @returns {Object} 400 - Error response nếu email/username đã tồn tại
 * @returns {Object} 500 - Error response nếu có lỗi server
 * 
 * @example
 * // Request
 * POST /api/auth/register
 * {
 *   "username": "user123",
 *   "email": "user@example.com",
 *   "password": "Password123",
 *   "fullName": "John Doe"
 * }
 * 
 * // Response
 * {
 *   "user": {
 *     "id": 1,
 *     "username": "user123",
 *     "email": "user@example.com",
 *     "role": "user",
 *     "fullName": "John Doe"
 *   },
 *   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * }
 */
export const register = async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    })

    if (existingUser) {
      return res.status(400).json({ message: "Email or username already exists" })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        fullName: fullName || username,
        role: "user",
      },
      select: { id: true, username: true, email: true, role: true, fullName: true },
    })

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || "secret")

    res.status(201).json({ user, token })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * Login - Đăng nhập và nhận JWT token
 * 
 * @description Xác thực username và password, trả về JWT token nếu thành công
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {String} req.body.username - Username (required)
 * @param {String} req.body.password - Password (required)
 * 
 * @param {Object} res - Express response object
 * 
 * @returns {Object} 200 - Success response với user object và JWT token
 * @returns {Object} 401 - Error response nếu username/password không đúng
 * @returns {Object} 500 - Error response nếu có lỗi server
 * 
 * @example
 * // Request
 * POST /api/auth/login
 * {
 *   "username": "user123",
 *   "password": "Password123"
 * }
 * 
 * // Response
 * {
 *   "user": {
 *     "id": 1,
 *     "username": "user123",
 *     "email": "user@example.com",
 *     "role": "user",
 *     "fullName": "John Doe"
 *   },
 *   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * }
 */
export const login = async (req, res) => {
  try {
    const { username, password } = req.body

    const user = await prisma.user.findUnique({
      where: { username },
    })

    if (!user) {
      return res.status(401).json({ message: "Invalid username or password" })
    }

    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid username or password" })
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || "secret")

    res.json({
      user: { id: user.id, username: user.username, email: user.email, role: user.role, fullName: user.fullName },
      token,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

