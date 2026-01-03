import jwt from "jsonwebtoken"
import { prisma } from "../index.js"

/**
 * authMiddleware - Authentication middleware (legacy, use auth from validate.js instead)
 * 
 * @description Middleware để xác thực JWT token và attach user vào request
 * @deprecated Sử dụng auth từ validate.js thay vì middleware này
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * 
 * @returns {void}
 */
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]

    if (!token) {
      return res.status(401).json({ message: "No token provided" })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret")
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, username: true, email: true, role: true, fullName: true },
    })

    if (!user) {
      return res.status(401).json({ message: "User not found" })
    }

    req.user = user
    next()
  } catch (error) {
    res.status(401).json({ message: "Invalid token" })
  }
}

export default authMiddleware

