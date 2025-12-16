import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

const router = express.Router();

const db = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// ✅ REGISTER
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, confirmPassword, phone, city, pincode, type } = req.body;

    console.log("📩 Registration data received:", req.body); // 👈 add this

    if (!name || !email || !password || !confirmPassword || !phone || !city || !pincode || !type)
      return res.status(400).json({ error: "All fields are required" });

    if (password !== confirmPassword)
      return res.status(400).json({ error: "Passwords do not match" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const table = type === "donor" ? "donors" : "ngos";

    console.log("🔍 Checking existing user in:", table);

    const [existing] = await db.query(`SELECT id FROM ${table} WHERE email = ?`, [email]);
    console.log("Existing user:", existing);

    if (existing.length > 0)
      return res.status(400).json({ error: "Email already registered" });

    console.log("📝 Inserting new user...");
    await db.query(
      `INSERT INTO ${table} (name, email, password, phone, city, pincode) VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email, hashedPassword, phone, city, pincode]
    );

    res.json({ message: `${type.toUpperCase()} registered successfully!` });
  } catch (err) {
    console.error("❌ Registration error details:", err);
    res.status(500).json({ error: "Registration failed. Please check console logs." });
  }
});


// ✅ LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password, type } = req.body;
    if (!email || !password || !type)
      return res.status(400).json({ error: "All fields are required" });

    const table = type === "donor" ? "donors" : "ngos";
    const [results] = await db.query(`SELECT * FROM ${table} WHERE email = ?`, [email]);

    if (results.length === 0)
      return res.status(400).json({ error: "User not found" });

    const user = results[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign({ id: user.id, type }, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, userType: type },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// ✅ TOKEN VERIFY
router.get("/verify", (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

export default router;
