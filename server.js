/**
 * INTERSOURCE VENTURES LIMITED
 * Storefront + Admin – Express Backend
 * ─────────────────────────────────────────
 * Endpoints:
 *   GET    /api/products             → public product catalogue
 *   POST   /api/admin/login          → admin password check
 *   POST   /api/admin/products       → admin create product
 *   PUT    /api/admin/products/:id   → admin update product
 *   DELETE /api/admin/products/:id   → admin delete product
 *   GET    /api/site                 → public site config (categories, badges, featured)
 *   PUT    /api/admin/site           → admin update site config
 *   GET    /api/health               → server health check
 */

require("dotenv").config();
const express = require("express");
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
    { slug: "new",  label: "NEW",  color: "#00B4D8" },
    { slug: "sale", label: "SALE", color: "#FF7A18" },
    { slug: "hot",  label: "HOT",  color: "#EF4444" },
  ],
  featured: {
    image: "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?auto=format&fit=crop&w=800&q=80",
    tag: "Featured · Supplements",
    name: "Vitamin C 1000mg · 60s",
    price: 850,
  },
  about: {
    image: "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?auto=format&fit=crop&w=800&q=80",
    years: "5+",
    caption: "Years of trust in Kenya",
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
      about: { ...DEFAULT_SITE.about, ...(data.about || {}) },
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
        color: /^#[0-9a-f]{3,8}$/i.test(b.color || "") ? b.color : "#00B4D8",
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
  if (req.body.about && typeof req.body.about === "object") {
    next.about = {
      image: String(req.body.about.image || "").trim(),
      years: String(req.body.about.years || "").trim().slice(0, 12),
      caption: String(req.body.about.caption || "").trim().slice(0, 120),
    };
  }

  writeSite(next);
  res.json({ success: true, site: next });
});

// ─────────────────────────────────────────────────────────────
//  GET /api/health
// ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
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
  console.log(`║  URL   : http://localhost:${PORT}${" ".repeat(Math.max(0, 19 - String(PORT).length))}║`);
  console.log(`║  Admin : http://localhost:${PORT}/admin${" ".repeat(Math.max(0, 13 - String(PORT).length))}║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);
});
