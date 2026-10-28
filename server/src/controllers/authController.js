import { User } from "../models/User.js";
import bcrypt from "bcryptjs";
import "dotenv/config";
import jwt from "jsonwebtoken";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
};

export async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name != "string" ||
      typeof email != "string" ||
      typeof password != "string"
    ) {
      return res
        .status(400)
        .json({ message: "Please fill in required format" });
    }
    if (
      name.length == 0 ||
      email.length == 0 ||
      password.length == 0 ||
      password.length < 8
    ) {
      return res
        .status(400)
        .json({ message: "Please Fill all the fields properly" });
    }
    if (!email.includes("@")) {
      return res.status(400).json({ message: "Enter a valid email" });
    }

    const passwordHash = await bycrypt.hash(password, 10);

    const user = await User.create({ name, email, passwordHash });

    return res.status(201).json({
      id: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
    });
  } catch (error) {
    if (error.code == 11000) {
      return res.status(409).json({
        message: "User already Exists.",
      });
    }
    throw error;
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string") {
      return res
        .status(400)
        .json({ message: "Please provide email, password in valid format" });
    }

    const mail = email.trim().toLowerCase();

    const user = await User.findOne({ email: mail }).select("+passwordHash");

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const payload = { userId: user.id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res
      .cookie("token", token, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .status(200)
      .json({ message: "Login Successful" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error during login" });
  }
}

export async function me(req, res) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized: No user found" });
    }
    return res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (err) {
    console.log(err.message);
    res.status(401).json({ message: "Sorry" });
  }
}

export async function logout(req, res) {
  res.clearCookie("token", {
    cookieOptions
  });
  return res.status(200).json({ message: "Logged out" });
}
