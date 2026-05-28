/* =========================================================
   INTERSOURCE VENTURES — Frontend logic
   - Product catalog (in-memory)
   - Cart system (localStorage)
   - WhatsApp checkout (no online payment processing)
   ========================================================= */

// ─── DATA ──────────────────────────────────────────────────
// Fetched from /api/products and /api/site at startup.
let PRODUCTS = [];
let SITE = {
  categories: [],
  badges: [],
  featured: { image: "", tag: "", name: "", price: 0 },
  about: { image: "", years: "", caption: "" },
};

const FALLBACK_PRODUCTS = [
  { id: 1, name: "Vitamin C 1000mg · 60 tabs", category: "supplements", price: 850, oldPrice: 1100, rating: 4.8, reviews: 128, badge: "sale",
    img: "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?auto=format&fit=crop&w=600&q=80" },
  { id: 2, name: "Infant Formula Stage 1 · 400g", category: "baby-food", price: 1250, rating: 4.5, reviews: 210,
    img: "https://images.unsplash.com/photo-1591197172062-c718f82aba20?auto=format&fit=crop&w=600&q=80" },
  { id: 3, name: "Baby Wipes Sensitive · 80s × 3", category: "baby-care", price: 650, oldPrice: 850, rating: 4.7, reviews: 156, badge: "sale",
    img: "https://images.unsplash.com/photo-1583394293214-28a4b4eef8c0?auto=format&fit=crop&w=600&q=80" },
  { id: 4, name: "Premium Diapers Size 3 · 60s", category: "diapers", price: 1280, oldPrice: 1600, rating: 4.6, reviews: 144, badge: "hot",
    img: "https://images.unsplash.com/photo-1607344645866-009c320b63e0?auto=format&fit=crop&w=600&q=80" },
];

async function loadProducts() {
  try {
    const res = await fetch("/api/products");
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();
    PRODUCTS = Array.isArray(data) && data.length ? data : FALLBACK_PRODUCTS;
  } catch (err) {
    console.warn("[products] using fallback list:", err);
    PRODUCTS = FALLBACK_PRODUCTS;
  }
}

async function loadSite() {
  try {
    const res = await fetch("/api/site");
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();
    if (data && Array.isArray(data.categories)) SITE.categories = data.categories;
    if (data && Array.isArray(data.badges)) SITE.badges = data.badges;
    if (data && data.featured) SITE.featured = data.featured;
    if (data && data.about) SITE.about = data.about;
  } catch (err) {
    console.warn("[site] using defaults:", err);
  }
}

// ─── RENDERING: About section image + overlay ─────────────
function renderAbout() {
  const a = SITE.about || {};
  const img = document.getElementById("aboutImg");
  if (img && a.image) img.src = a.image;
  const years = document.getElementById("aboutYears");
  if (years && a.years) years.textContent = a.years;
  const caption = document.getElementById("aboutCaption");
  if (caption && a.caption) caption.textContent = a.caption;
}

// ─── RENDERING: hero featured + categories ────────────────
function renderHeroFeatured() {
  const f = SITE.featured || {};
  const img = document.getElementById("heroFeaturedImg");
  if (img) img.src = f.image || "";
  const tag = document.getElementById("heroFeaturedTag");
  if (tag) tag.textContent = f.tag || "Featured";
  const name = document.getElementById("heroFeaturedName");
  if (name) name.textContent = f.name || "—";
  const price = document.getElementById("heroFeaturedPrice");
  if (price) price.textContent = f.price ? fmt(f.price) : "";
}

function renderCategories() {
  const grid = document.getElementById("categoryGrid");
  if (!grid) return;

  // Always start with an "All" tile
  const all = `
    <div class="col-6 col-md-4 col-lg-2" data-aos="fade-up">
      <button class="cat-card w-100 ${activeCategory === "all" ? "active" : ""}" data-filter="all">
        <i class="bi bi-grid-3x3-gap-fill"></i>
        <span>All</span>
      </button>
    </div>`;

  const cells = SITE.categories.map((c, i) => `
    <div class="col-6 col-md-4 col-lg-2" data-aos="fade-up" data-aos-delay="${(i + 1) * 50}">
      <button class="cat-card w-100 ${activeCategory === c.slug ? "active" : ""}" data-filter="${c.slug}">
        <i class="bi ${c.icon || "bi-tag"}"></i>
        <span>${escapeHtml(c.label)}</span>
      </button>
    </div>`).join("");

  grid.innerHTML = all + cells;

  // (re)attach click handlers
  grid.querySelectorAll(".cat-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      grid.querySelectorAll(".cat-card").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeCategory = btn.dataset.filter;
      visibleCount = 8;
      renderProducts();
      document.getElementById("products").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  if (window.AOS) AOS.refresh();
}

// Look up badge metadata; return null if no match
function badgeInfo(slug) {
  if (!slug) return null;
  return SITE.badges.find((b) => b.slug === slug) || null;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}

// ─── STATE ─────────────────────────────────────────────────
let activeCategory = "all";
let searchTerm = "";
let visibleCount = 8;
let cart = JSON.parse(localStorage.getItem("intersource_cart") || "[]");

// ─── HELPERS ───────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const fmt = (n) => "KES " + Number(n).toLocaleString("en-KE");
const saveCart = () => localStorage.setItem("intersource_cart", JSON.stringify(cart));

// ─── PRODUCT RENDERING ─────────────────────────────────────
function renderProducts() {
  const grid = $("#productGrid");
  const filtered = PRODUCTS.filter((p) => {
    const inCat = activeCategory === "all" || p.category === activeCategory;
    const inSearch = !searchTerm || p.name.toLowerCase().includes(searchTerm);
    return inCat && inSearch;
  });

  const slice = filtered.slice(0, visibleCount);
  if (slice.length === 0) {
    grid.innerHTML = `<div class="col-12 text-center py-5 text-muted">
      <i class="bi bi-emoji-frown display-4 d-block mb-3 opacity-50"></i>
      No products match your search.
    </div>`;
    $("#loadMoreBtn").style.display = "none";
    return;
  }

  grid.innerHTML = slice
    .map((p) => {
      const stars = "★".repeat(Math.round(p.rating || 0));
      const b = badgeInfo(p.badge);
      const badgeHtml = b
        ? `<span class="product-badge" style="background:${b.color};color:#fff">${escapeHtml(b.label)}</span>`
        : "";
      const catLabel = (SITE.categories.find((c) => c.slug === p.category) || {}).label || p.category;
      return `
      <div class="col-6 col-md-4 col-lg-3" data-aos="fade-up">
        <div class="product-card">
          <div class="product-img-wrap">
            <img src="${escapeHtml(p.img || "")}" alt="${escapeHtml(p.name || "")}" loading="lazy" />
            ${badgeHtml}
            <button class="product-fav" onclick="toggleFav(this)" aria-label="Favourite">
              <i class="bi bi-heart"></i>
            </button>
          </div>
          <div class="product-body">
            <div class="product-cat">${escapeHtml(catLabel || "")}</div>
            <div class="product-name">${escapeHtml(p.name || "")}</div>
            <div class="product-rating">
              ${stars} <span class="text-muted">(${p.reviews || 0})</span>
            </div>
            <div class="product-bottom">
              <div class="product-price">
                ${fmt(p.price)}
                ${p.oldPrice ? `<small>${fmt(p.oldPrice)}</small>` : ""}
              </div>
              <button class="btn-add-cart" onclick="addToCart(${p.id})">
                <i class="bi bi-plus-lg"></i> Add
              </button>
            </div>
          </div>
        </div>
      </div>`;
    })
    .join("");

  $("#loadMoreBtn").style.display = filtered.length > visibleCount ? "" : "none";
  if (window.AOS) AOS.refresh();
}

function toggleFav(btn) {
  btn.classList.toggle("active");
  const icon = btn.querySelector("i");
  icon.className = btn.classList.contains("active") ? "bi bi-heart-fill" : "bi bi-heart";
}

// ─── CART ──────────────────────────────────────────────────
function addToCart(id) {
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) return;
  const existing = cart.find((c) => c.id === id);
  if (existing) existing.qty += 1;
  else cart.push({ ...product, qty: 1 });
  saveCart();
  renderCart();
  showToast(`${product.name} added to cart`);
}

function changeQty(id, delta) {
  const item = cart.find((c) => c.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter((c) => c.id !== id);
  saveCart();
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter((c) => c.id !== id);
  saveCart();
  renderCart();
}

function cartTotal() {
  return cart.reduce((sum, c) => sum + c.price * c.qty, 0);
}

function renderCart() {
  const count = cart.reduce((s, c) => s + c.qty, 0);
  $("#cartCount").textContent = count;

  const itemsEl = $("#cartItems");
  const emptyEl = $("#cartEmpty");
  const summaryEl = $("#cartSummary");

  if (cart.length === 0) {
    itemsEl.innerHTML = "";
    emptyEl.classList.remove("d-none");
    summaryEl.classList.add("d-none");
    return;
  }

  emptyEl.classList.add("d-none");
  summaryEl.classList.remove("d-none");

  itemsEl.innerHTML = cart
    .map(
      (c) => `
    <div class="cart-item">
      <img src="${c.img}" alt="${c.name}" />
      <div class="cart-item-meta">
        <div class="fw-semibold small">${c.name}</div>
        <div class="text-success fw-bold">${fmt(c.price)}</div>
        <div class="d-flex align-items-center gap-2 mt-2">
          <button class="cart-qty-btn" onclick="changeQty(${c.id},-1)">−</button>
          <span class="small fw-semibold">${c.qty}</span>
          <button class="cart-qty-btn" onclick="changeQty(${c.id},1)">+</button>
          <button class="cart-remove ms-auto" onclick="removeFromCart(${c.id})">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    </div>`
    )
    .join("");

  const total = cartTotal();
  $("#cartSubtotal").textContent = fmt(total);
  $("#cartTotal").textContent = fmt(total);
}

// ─── TOAST (lightweight) ───────────────────────────────────
function showToast(msg) {
  let t = $("#toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.style.cssText = `
      position:fixed;bottom:30px;left:50%;transform:translateX(-50%);
      background:#2A3A4E;color:#fff;padding:0.75rem 1.25rem;border-radius:999px;
      font-size:0.9rem;z-index:9999;box-shadow:0 10px 30px rgba(0,0,0,0.25);
      opacity:0;transition:opacity 0.3s,bottom 0.3s;pointer-events:none;
    `;
    document.body.appendChild(t);
  }
  t.innerHTML = `<i class="bi bi-check-circle-fill text-success me-2"></i>${msg}`;
  t.style.opacity = "1";
  t.style.bottom = "50px";
  clearTimeout(t._hide);
  t._hide = setTimeout(() => {
    t.style.opacity = "0";
    t.style.bottom = "30px";
  }, 2400);
}

// ─── WHATSAPP CHECKOUT ─────────────────────────────────────
// Builds an order summary and opens WhatsApp with it pre-filled.
const WHATSAPP_NUMBER = "254710658549";

function checkoutViaWhatsApp() {
  if (cart.length === 0) return;

  const lines = cart.map(
    (c) => `• ${c.name} × ${c.qty} — ${fmt(c.price * c.qty)}`
  );
  const total = cartTotal();
  const orderId = "IV-" + Date.now();

  const message =
    `Hi Intersource Ventures! I'd like to place an order:%0A%0A` +
    lines.join("%0A") +
    `%0A%0A*Total: ${fmt(total)}*` +
    `%0AOrder ref: ${orderId}` +
    `%0A%0APlease confirm availability and payment details.`;

  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, "_blank");
}

// expose for inline handlers in HTML
window.toggleFav = toggleFav;
window.addToCart = addToCart;
window.changeQty = changeQty;
window.removeFromCart = removeFromCart;

// ─── EVENT WIRING ──────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Year in footer
  $("#year").textContent = new Date().getFullYear();

  // AOS
  if (window.AOS) AOS.init({ duration: 700, once: true, offset: 60 });

  // Load site settings + products in parallel, then render
  await Promise.all([loadSite(), loadProducts()]);
  renderHeroFeatured();
  renderAbout();
  renderCategories();
  renderProducts();
  renderCart();

  // Search
  $("#searchInput").addEventListener("input", (e) => {
    searchTerm = e.target.value.toLowerCase().trim();
    visibleCount = 8;
    renderProducts();
  });

  // Load more
  $("#loadMoreBtn").addEventListener("click", () => {
    visibleCount += 8;
    renderProducts();
  });

  // Checkout via WhatsApp
  const checkoutBtn = $("#checkoutBtn");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", checkoutViaWhatsApp);
  }

  // Contact form (demo only — wire to real endpoint as needed)
  $("#contactForm").addEventListener("submit", (e) => {
    e.preventDefault();
    $("#contactToast").classList.remove("d-none");
    e.target.reset();
    setTimeout(() => $("#contactToast").classList.add("d-none"), 5000);
  });

  // Scroll-to-top button
  const top = $("#scrollTop");
  window.addEventListener("scroll", () => {
    top.classList.toggle("show", window.scrollY > 400);
  });
  top.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  // Smooth scroll for in-page nav
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const target = document.querySelector(a.getAttribute("href"));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        // collapse mobile menu if open
        const nav = document.getElementById("nav");
        if (nav && nav.classList.contains("show")) {
          new bootstrap.Collapse(nav).hide();
        }
      }
    });
  });
});
