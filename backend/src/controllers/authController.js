import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { prisma } from "../index.js"

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

