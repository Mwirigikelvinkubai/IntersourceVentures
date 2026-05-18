/**
 * INTERSOURCE VENTURES LIMITED
 * M-Pesa Daraja STK Push – Express Backend
 * ─────────────────────────────────────────
 * Endpoints:
 *   POST /api/mpesa/stkpush   → initiates payment prompt on customer phone
 *   POST /api/mpesa/callback  → receives confirmation from Safaricom
 *   GET  /api/mpesa/status/:checkoutRequestId → polls payment status
 *   GET  /api/health          → server health check
 */

require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(express.json({ limit: "10mb" })); // allow base64 images
app.use(cors()); // allow requests from the HTML frontend

// ── Serve the website HTML as the root ──────────────────────
app.use(express.static(path.join(__dirname, "public")));

// ── Pretty admin route → /admin loads admin.html ────────────
app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// ── In-memory payment store (replace with a DB in production) ──
const payments = {};

// ─────────────────────────────────────────────────────────────
//  PRODUCT STORE (JSON file)
// ─────────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PRODUCTS_FILE)) {
    const seed = [
      { id: 1, name: "Vitamin C 1000mg · 60 tabs", category: "supplements", price: 850, oldPrice: 1100, rating: 4.8, reviews: 128, badge: "sale", img: "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?auto=format&fit=crop&w=600&q=80" },
      { id: 2, name: "Multivitamin Daily · 90 tabs", category: "supplements", price: 1450, rating: 4.7, reviews: 95, badge: "hot", img: "https://images.unsplash.com/photo-1550572017-edd951b55104?auto=format&fit=crop&w=600&q=80" },
      { id: 3, name: "Omega-3 Fish Oil · 120 caps", category: "supplements", price: 1850, rating: 4.6, reviews: 64, badge: "new", img: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80" },
      { id: 4, name: "Infant Formula Stage 1 · 400g", category: "baby-food", price: 1250, rating: 4.5, reviews: 210, img: "https://images.unsplash.com/photo-1591197172062-c718f82aba20?auto=format&fit=crop&w=600&q=80" },
      { id: 5, name: "Baby Cereal Wheat · 250g", category: "baby-food", price: 480, rating: 4.9, reviews: 312, badge: "new", img: "https://images.unsplash.com/photo-1604908815746-acef4e9e8c2a?auto=format&fit=crop&w=600&q=80" },
      { id: 6, name: "Baby Wipes Sensitive · 80s × 3", category: "baby-care", price: 650, oldPrice: 850, rating: 4.7, reviews: 156, badge: "sale", img: "https://images.unsplash.com/photo-1583394293214-28a4b4eef8c0?auto=format&fit=crop&w=600&q=80" },
      { id: 7, name: "Baby Lotion Gentle · 500ml", category: "baby-care", price: 720, rating: 4.4, reviews: 88, img: "https://images.unsplash.com/photo-1612442058822-fe73fa10ec74?auto=format&fit=crop&w=600&q=80" },
      { id: 8, name: "Premium Diapers Size 3 · 60s", category: "diapers", price: 1280, oldPrice: 1600, rating: 4.6, reviews: 144, badge: "hot", img: "https://images.unsplash.com/photo-1607344645866-009c320b63e0?auto=format&fit=crop&w=600&q=80" },
      { id: 9, name: "Newborn Diapers Size 1 · 80s", category: "diapers", price: 1450, rating: 4.8, reviews: 67, img: "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=600&q=80" },
      { id: 10, name: "Maternal Iron + Folate · 60 tabs", category: "mom-care", price: 950, rating: 4.5, reviews: 91, badge: "new", img: "https://images.unsplash.com/photo-1626716493137-b67fe9501e76?auto=format&fit=crop&w=600&q=80" },
      { id: 11, name: "Pregnancy Multivitamin · 30 tabs", category: "mom-care", price: 1650, oldPrice: 2100, rating: 4.7, reviews: 208, badge: "sale", img: "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=600&q=80" },
      { id: 12, name: "Baby Bath Wash 2-in-1 · 400ml", category: "baby-care", price: 520, rating: 4.4, reviews: 54, img: "https://images.unsplash.com/photo-1556228852-6d35a585d4cd?auto=format&fit=crop&w=600&q=80" },
    ];
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(seed, null, 2));
    console.log("[products] seeded data/products.json with 12 sample products");
  }
}
function readProducts() {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf-8"));
  } catch {
    return [];
  }
}
function writeProducts(list) {
  ensureDataFile();
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(list, null, 2));
}
function nextId(list) {
  return list.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0) + 1;
}

// ─────────────────────────────────────────────────────────────
//  SITE SETTINGS STORE (categories, badges, hero featured)
// ─────────────────────────────────────────────────────────────
const SITE_FILE = path.join(DATA_DIR, "site.json");

const DEFAULT_SITE = {
  categories: [
    { slug: "supplements", label: "Supplements", icon: "bi-capsule" },
    { slug: "baby-food",   label: "Baby Food",   icon: "bi-cup-straw" },
    { slug: "baby-care",   label: "Baby Care",   icon: "bi-droplet-half" },
    { slug: "diapers",     label: "Diapers",     icon: "bi-stack" },
    { slug: "mom-care",    label: "Mom Care",    icon: "bi-heart-pulse-fill" },
  ],
  badges: [
    { slug: "new",  label: "NEW",  color: "#0a8f4a" },
    { slug: "sale", label: "SALE", color: "#ff7a18" },
    { slug: "hot",  label: "HOT",  color: "#ef4444" },
  ],
  featured: {
    image: "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?auto=format&fit=crop&w=800&q=80",
    tag: "Featured · Supplements",
    name: "Vitamin C 1000mg · 60s",
    price: 850,
  },
};

function ensureSiteFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SITE_FILE)) {
    fs.writeFileSync(SITE_FILE, JSON.stringify(DEFAULT_SITE, null, 2));
    console.log("[site] seeded data/site.json with defaults");
  }
}
function readSite() {
  ensureSiteFile();
  try {
    const data = JSON.parse(fs.readFileSync(SITE_FILE, "utf-8"));
    // Fill in any missing top-level keys with defaults
    return {
      categories: Array.isArray(data.categories) ? data.categories : DEFAULT_SITE.categories,
      badges: Array.isArray(data.badges) ? data.badges : DEFAULT_SITE.badges,
      featured: { ...DEFAULT_SITE.featured, ...(data.featured || {}) },
    };
  } catch {
    return { ...DEFAULT_SITE };
  }
}
function writeSite(obj) {
  ensureSiteFile();
  fs.writeFileSync(SITE_FILE, JSON.stringify(obj, null, 2));
}

// ─────────────────────────────────────────────────────────────
//  ADMIN AUTH (very simple — password sent via header)
//  ⚠ For real production replace with sessions/JWT + HTTPS.
// ─────────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_PASSWORD || "intersource2025";
  const provided = req.header("x-admin-password");
  if (!provided || provided !== expected) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  next();
}

// Login check — returns 200 if password is valid
app.post("/api/admin/login", (req, res) => {
  const expected = process.env.ADMIN_PASSWORD || "intersource2025";
  if (req.body?.password === expected) {
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, message: "Wrong password" });
});

// ─────────────────────────────────────────────────────────────
//  PRODUCT ENDPOINTS
// ─────────────────────────────────────────────────────────────
// Public — list all products
app.get("/api/products", (_req, res) => {
  res.json(readProducts());
});

// Admin — create
app.post("/api/admin/products", requireAdmin, (req, res) => {
  const list = readProducts();
  const product = { id: nextId(list), ...req.body };
  list.push(product);
  writeProducts(list);
  res.json({ success: true, product });
});

// Admin — update
app.put("/api/admin/products/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const list = readProducts();
  const idx = list.findIndex((p) => Number(p.id) === id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Not found" });
  list[idx] = { ...list[idx], ...req.body, id };
  writeProducts(list);
  res.json({ success: true, product: list[idx] });
});

// Admin — delete
app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const list = readProducts().filter((p) => Number(p.id) !== id);
  writeProducts(list);
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────
//  SITE-SETTINGS ENDPOINTS  (categories, badges, featured)
// ─────────────────────────────────────────────────────────────
// Public — read everything the storefront needs
app.get("/api/site", (_req, res) => {
  res.json(readSite());
});

// Admin — replace any subset of {categories, badges, featured}
app.put("/api/admin/site", requireAdmin, (req, res) => {
  const current = readSite();
  const next = { ...current };

  if (Array.isArray(req.body.categories)) {
    // sanitize
    next.categories = req.body.categories
      .filter((c) => c && c.slug && c.label)
      .map((c) => ({
        slug: String(c.slug).trim().toLowerCase().replace(/\s+/g, "-"),
        label: String(c.label).trim(),
        icon: String(c.icon || "bi-tag").trim(),
      }));
  }
  if (Array.isArray(req.body.badges)) {
    next.badges = req.body.badges
      .filter((b) => b && b.slug && b.label)
      .map((b) => ({
        slug: String(b.slug).trim().toLowerCase().replace(/\s+/g, "-"),
        label: String(b.label).trim(),
        color: /^#[0-9a-f]{3,8}$/i.test(b.color || "") ? b.color : "#0a8f4a",
      }));
  }
  if (req.body.featured && typeof req.body.featured === "object") {
    next.featured = {
      image: String(req.body.featured.image || "").trim(),
      tag: String(req.body.featured.tag || "").trim(),
      name: String(req.body.featured.name || "").trim(),
      price: Number(req.body.featured.price) || 0,
    };
  }

  writeSite(next);
  res.json({ success: true, site: next });
});

// ── Daraja base URLs ─────────────────────────────────────────
const DARAJA_BASE =
  process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

// ─────────────────────────────────────────────────────────────
//  HELPER: Get OAuth access token from Safaricom
// ─────────────────────────────────────────────────────────────
async function getAccessToken() {
  const credentials = Buffer.from(
    `${process.env.CONSUMER_KEY}:${process.env.CONSUMER_SECRET}`
  ).toString("base64");

  const response = await axios.get(
    `${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    }
  );
  return response.data.access_token;
}

// ─────────────────────────────────────────────────────────────
//  HELPER: Generate Daraja password and timestamp
// ─────────────────────────────────────────────────────────────
function getDarajaPassword() {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-T:.Z]/g, "")
    .slice(0, 14);
  const rawPassword = `${process.env.SHORTCODE}${process.env.PASSKEY}${timestamp}`;
  const password = Buffer.from(rawPassword).toString("base64");
  return { password, timestamp };
}

// ─────────────────────────────────────────────────────────────
//  HELPER: Format phone to 254XXXXXXXXX
// ─────────────────────────────────────────────────────────────
function formatPhone(phone) {
  const cleaned = String(phone).replace(/\s+/g, "").replace(/^\+/, "");
  if (cleaned.startsWith("0")) return "254" + cleaned.slice(1);
  if (cleaned.startsWith("254")) return cleaned;
  return "254" + cleaned;
}

// ─────────────────────────────────────────────────────────────
//  POST /api/mpesa/stkpush
//  Body: { phone: "0710658549", amount: 1400, orderId: "IV-123456" }
// ─────────────────────────────────────────────────────────────
app.post("/api/mpesa/stkpush", async (req, res) => {
  const { phone, amount, orderId } = req.body;

  if (!phone || !amount) {
    return res.status(400).json({ success: false, message: "Phone and amount are required." });
  }

  const formattedPhone = formatPhone(phone);
  if (!/^2547\d{8}$|^2541\d{8}$/.test(formattedPhone)) {
    return res.status(400).json({ success: false, message: "Invalid Kenyan phone number." });
  }

  if (amount < 1) {
    return res.status(400).json({ success: false, message: "Amount must be at least KES 1." });
  }

  try {
    const accessToken = await getAccessToken();
    const { password, timestamp } = getDarajaPassword();

    const payload = {
      BusinessShortCode: process.env.SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(amount), // Daraja requires integer
      PartyA: formattedPhone,
      PartyB: process.env.SHORTCODE,
      PhoneNumber: formattedPhone,
      CallBackURL: process.env.CALLBACK_URL,
      AccountReference: process.env.ACCOUNT_REF,
      TransactionDesc: `${process.env.TRANSACTION_DESC} ${orderId || ""}`.trim(),
    };

    const response = await axios.post(
      `${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { CheckoutRequestID, ResponseCode, ResponseDescription } = response.data;

    if (ResponseCode === "0") {
      // Store pending payment
      payments[CheckoutRequestID] = {
        status: "pending",
        phone: formattedPhone,
        amount,
        orderId: orderId || null,
        createdAt: new Date().toISOString(),
      };

      console.log(`[STK PUSH] Initiated → ${formattedPhone} KES ${amount} | ${CheckoutRequestID}`);

      return res.json({
        success: true,
        checkoutRequestId: CheckoutRequestID,
        message: "Payment prompt sent to phone.",
      });
    } else {
      console.error("[STK PUSH] Failed:", ResponseDescription);
      return res.status(500).json({ success: false, message: ResponseDescription });
    }
  } catch (err) {
    const errMsg = err.response?.data?.errorMessage || err.message || "Unknown error";
    console.error("[STK PUSH] Error:", errMsg);
    return res.status(500).json({ success: false, message: errMsg });
  }
});

// ─────────────────────────────────────────────────────────────
//  POST /api/mpesa/callback
//  Safaricom calls this URL after the customer pays or cancels
// ─────────────────────────────────────────────────────────────
app.post("/api/mpesa/callback", (req, res) => {
  const body = req.body?.Body?.stkCallback;

  if (!body) {
    console.warn("[CALLBACK] Received unexpected payload:", req.body);
    return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = body;

  console.log(`[CALLBACK] ${CheckoutRequestID} | ResultCode: ${ResultCode} | ${ResultDesc}`);

  if (ResultCode === 0) {
    // Payment successful – extract metadata
    const meta = {};
    (CallbackMetadata?.Item || []).forEach((item) => {
      meta[item.Name] = item.Value;
    });

    payments[CheckoutRequestID] = {
      status: "success",
      mpesaReceiptNumber: meta.MpesaReceiptNumber || null,
      amount: meta.Amount || null,
      phone: meta.PhoneNumber || null,
      transactionDate: meta.TransactionDate || null,
    };

    console.log(`[CALLBACK] PAID ✓ Receipt: ${meta.MpesaReceiptNumber} | KES ${meta.Amount}`);
  } else {
    // Payment cancelled or failed
    if (payments[CheckoutRequestID]) {
      payments[CheckoutRequestID].status = "failed";
      payments[CheckoutRequestID].reason = ResultDesc;
    } else {
      payments[CheckoutRequestID] = { status: "failed", reason: ResultDesc };
    }
    console.log(`[CALLBACK] FAILED ✗ ${ResultDesc}`);
  }

  // Always respond 200 to Safaricom
  return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

// ─────────────────────────────────────────────────────────────
//  GET /api/mpesa/status/:checkoutRequestId
//  Frontend polls this every 3 seconds to check payment result
// ─────────────────────────────────────────────────────────────
app.get("/api/mpesa/status/:checkoutRequestId", (req, res) => {
  const { checkoutRequestId } = req.params;
  const payment = payments[checkoutRequestId];

  if (!payment) {
    return res.json({ status: "pending" }); // not yet received from Safaricom
  }

  return res.json(payment);
});

// ─────────────────────────────────────────────────────────────
//  GET /api/health
// ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    environment: process.env.MPESA_ENV,
    shortcode: process.env.SHORTCODE,
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────
//  START SERVER
// ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║   Intersource Ventures – Server started      ║`);
  console.log(`╠══════════════════════════════════════════════╣`);
  console.log(`║  URL   : http://localhost:${PORT}               ║`);
  console.log(`║  Mode  : ${(process.env.MPESA_ENV || "sandbox").padEnd(35)}║`);
  console.log(`║  Paybill: ${(process.env.SHORTCODE || "").padEnd(34)}║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);
  console.log(`  ⚠  REMEMBER: Update CALLBACK_URL in .env with your ngrok URL`);
  console.log(`  Run: npx ngrok http ${PORT}\n`);
});
