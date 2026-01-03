import { Router } from "express"
import { validate, auth } from "../middlewares/validate.js"
import { register, login } from "../controllers/authController.js"
import { signupSchema, signinSchema } from "../validators/auth.validator.js"

const router = Router()

/**
 * POST /api/auth/register
 * @description Đăng ký tài khoản mới
 * @access Public
 */
router.post("/register", validate(signupSchema), register)

/**
 * POST /api/auth/login
 * @description Đăng nhập và nhận JWT token
 * @access Public
 */
router.post("/login", validate(signinSchema), login)

export default router

