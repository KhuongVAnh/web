/**
 * Authentication Validators
 * 
 * @description Validation rules cho authentication endpoints sử dụng express-validator
 */
import { body } from "express-validator"

/**
 * Validation rules cho register endpoint
 * 
 * @returns {Array} Array of validation rules
 */
export const signupSchema = [
  body("username")
    .notEmpty()
    .withMessage("Username is required")
    .isLength({ min: 3, max: 20 })
    .withMessage("Username must be between 3 and 20 characters"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("Password must contain at least one uppercase letter, one lowercase letter, and one number"),
]

/**
 * Validation rules cho login endpoint
 * 
 * @returns {Array} Array of validation rules
 */
export const signinSchema = [
  body("username").notEmpty().withMessage("Username is required"),
  body("password").notEmpty().withMessage("Password is required"),
]

