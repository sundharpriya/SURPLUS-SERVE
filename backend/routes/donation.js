import express from "express";
import multer from "multer";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

const router = express.Router();

// ------------------------------------------------
// 🌿 Multer Setup (uploads outside backend)
// ------------------------------------------------
const uploadPath = path.join(__dirname, "../../uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// Serve uploaded images publicly
router.use("/uploads", express.static(uploadPath));

// ------------------------------------------------
// 🌿 Add Donation (with optional image)
// ------------------------------------------------
router.post("/add", upload.single("photo"), (req, res) => {
  const db = req.db;
  const { donor_id, item_name, quantity, description, address, city, pincode } = req.body;
  const photo = req.file ? `/uploads/${req.file.filename}` : null;

  if (!donor_id || !item_name || !quantity || !address || !city || !pincode)
    return res.status(400).json({ error: "All fields are required" });

  const sql = `
    INSERT INTO donations (donor_id, item_name, quantity, description, photo, address, city, pincode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [donor_id, item_name, quantity, description, photo, address, city, pincode], (err) => {
    if (err) {
      console.error("❌ Database error:", err);
      return res.status(400).json({ error: "Database error while adding donation" });
    }
    res.json({ message: "✅ Donation added successfully!" });
  });
});

// ------------------------------------------------
// 🌿 Get Donations by Donor (show NGO details if accepted)
// ------------------------------------------------
router.get("/donor/:donor_id", (req, res) => {
  const db = req.db;
  const { donor_id } = req.params;

  const sql = `
    SELECT d.*, 
           n.name AS ngo_name, 
           n.email AS ngo_email, 
           n.phone AS ngo_phone
    FROM donations d
    LEFT JOIN ngos n ON d.ngo_id = n.id
    WHERE d.donor_id = ?
    ORDER BY d.created_at DESC
  `;

  db.query(sql, [donor_id], (err, result) => {
    if (err) {
      console.error("❌ Error fetching donations:", err);
      return res.status(400).json({ error: "Error fetching donations" });
    }
    res.json(result);
  });
});

// ------------------------------------------------
// 🌿 Get Nearby Donations (for NGOs)
// Only show donations with status = 'Pending'
// ------------------------------------------------
router.get("/nearby/:pincode", (req, res) => {
  const db = req.db;
  const { pincode } = req.params;
  const sql = `
    SELECT d.*, donors.name AS donor_name
    FROM donations d
    JOIN donors ON donors.id = d.donor_id
    WHERE d.pincode = ? AND d.status = 'Pending'
  `;
  db.query(sql, [pincode], (err, result) => {
    if (err) {
      console.error("❌ Error fetching nearby donations:", err);
      return res.status(400).json({ error: "Error fetching nearby donations" });
    }
    res.json(result);
  });
});

// ------------------------------------------------
// 🌿 Accept Donation (by NGO)
// Once accepted, status becomes 'Accepted' and ngo_id is saved
// ------------------------------------------------
router.post("/accept", express.json(), (req, res) => {
  const db = req.db;
  const { donation_id, ngo_id } = req.body;

  if (!donation_id || !ngo_id)
    return res.status(400).json({ error: "Donation ID and NGO ID are required" });

  const sql = `UPDATE donations SET ngo_id = ?, status = 'Accepted' WHERE id = ? AND status = 'Pending'`;
  db.query(sql, [ngo_id, donation_id], (err, result) => {
    if (err) {
      console.error("❌ Error updating donation:", err);
      return res.status(400).json({ error: "Failed to accept donation" });
    }

    // if no rows were affected, it means another NGO already accepted
    if (result.affectedRows === 0) {
      return res.status(400).json({ error: "Donation already accepted by another NGO" });
    }

    res.json({ message: "✅ Donation accepted successfully!" });
  });
});

// ------------------------------------------------
// 🌿 Get Accepted Donations for NGO
// ------------------------------------------------
router.get("/ngo/:ngo_id", (req, res) => {
  const db = req.db;
  const { ngo_id } = req.params;

  const sql = `
    SELECT d.*, donors.name AS donor_name, donors.email AS donor_email, donors.phone AS donor_phone
    FROM donations d 
    JOIN donors ON donors.id = d.donor_id 
    WHERE d.ngo_id = ? AND d.status = 'Accepted'
    ORDER BY d.created_at DESC
  `;
  db.query(sql, [ngo_id], (err, result) => {
    if (err) {
      console.error("❌ Error fetching accepted donations:", err);
      return res.status(400).json({ error: "Error fetching accepted donations" });
    }
    res.json(result);
  });
});

export default router;
