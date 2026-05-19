/* =========================================================
   INTERSOURCE VENTURES — Admin dashboard
   - Password-gated (sessionStorage holds the password after login)
   - Calls /api/products and /api/admin/products[/:id]
   ========================================================= */

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const KEY = "intersource_admin_pw";

let products = [];
let site = { categories: [], badges: [], featured: { image: "", tag: "", name: "", price: 0 } };
let searchTerm = "";
let productModal, confirmModal, categoryModal, badgeModal, deletePendingId = null;
let deletePendingKind = "product"; // "product" | "category" | "badge"
let featuredImgValue = "";

// ─── AUTH ──────────────────────────────────────────────────
function getPassword() {
  return sessionStorage.getItem(KEY) || "";
}
function setPassword(p) {
  sessionStorage.setItem(KEY, p);
}
function clearPassword() {
  sessionStorage.removeItem(KEY);
}

async function tryLogin(password) {
  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  return res.ok;
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove("d-none");
}
function hideError(el) {
  el.classList.add("d-none");
}

// ─── DATA ──────────────────────────────────────────────────
async function fetchProducts() {
  const res = await fetch("/api/products");
  products = await res.json();
  renderTable();
  renderStats();
}

async function fetchSite() {
  const res = await fetch("/api/site");
  const data = await res.json();
  site = data;
  renderCategoriesTable();
  renderBadgesTable();
  renderProductSelectors();
  renderFeaturedForm();
}

async function saveSite(partial) {
  const res = await fetch("/api/admin/site", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-admin-password": getPassword() },
    body: JSON.stringify(partial),
  });
  if (!res.ok) throw new Error((await res.json()).message || "Save failed");
  return res.json();
}

async function createProduct(payload) {
  const res = await fetch("/api/admin/products", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-password": getPassword() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json()).message || "Save failed");
  return res.json();
}

async function updateProduct(id, payload) {
  const res = await fetch("/api/admin/products/" + id, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-admin-password": getPassword() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json()).message || "Update failed");
  return res.json();
}

async function deleteProduct(id) {
  const res = await fetch("/api/admin/products/" + id, {
    method: "DELETE",
    headers: { "x-admin-password": getPassword() },
  });
  if (!res.ok) throw new Error((await res.json()).message || "Delete failed");
  return res.json();
}

// ─── RENDER ────────────────────────────────────────────────
function renderStats() {
  $("#statTotal").textContent = products.length;
  $("#statSale").textContent = products.filter(p => p.badge === "sale").length;
  $("#statCats").textContent = new Set(products.map(p => p.category)).size;
  const avg = products.length
    ? Math.round(products.reduce((s, p) => s + (Number(p.price) || 0), 0) / products.length)
    : 0;
  $("#statAvg").textContent = avg.toLocaleString("en-KE");
}

function renderTable() {
  const tbody = $("#productTbody");
  const empty = $("#emptyState");

  const filtered = products.filter(p =>
    !searchTerm ||
    (p.name || "").toLowerCase().includes(searchTerm) ||
    (p.category || "").toLowerCase().includes(searchTerm)
  );

  if (filtered.length === 0) {
    tbody.innerHTML = "";
    empty.classList.remove("d-none");
    return;
  }
  empty.classList.add("d-none");

  tbody.innerHTML = filtered.map(p => `
    <tr>
      <td>
        ${p.img
          ? `<img src="${escapeHtml(p.img)}" alt="" onerror="this.style.opacity='0.3';this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%23ccc%22><path d=%22M19 5v14H5V5h14m0-2H5C3.89 3 3 3.9 3 5v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4.86 8.86l-3 3.87L9 13.14 6 17h12l-3.86-5.14z%22/></svg>';" />`
          : `<div style="width:50px;height:50px;background:#f1f5f9;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#94a3b8"><i class="bi bi-image"></i></div>`}
      </td>
      <td>
        <strong>${escapeHtml(p.name || "")}</strong>
        <div class="small text-muted">★ ${p.rating || "—"} · ${p.reviews || 0} reviews</div>
      </td>
      <td><span class="badge-cat">${escapeHtml(p.category || "")}</span></td>
      <td>
        <strong class="text-success">KES ${Number(p.price || 0).toLocaleString("en-KE")}</strong>
        ${p.oldPrice ? `<div class="small text-muted text-decoration-line-through">KES ${Number(p.oldPrice).toLocaleString("en-KE")}</div>` : ""}
      </td>
      <td>${p.badge ? `<span class="badge-tag ${p.badge}">${p.badge}</span>` : `<span class="text-muted small">—</span>`}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" onclick="editProduct(${p.id})">
          <i class="bi bi-pencil-square"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="askDelete(${p.id})">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join("");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}

// ─── CATEGORIES TABLE ──────────────────────────────────────
function renderCategoriesTable() {
  const tbody = $("#categoryTbody");
  if (!tbody) return;
  if (!site.categories.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No categories yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = site.categories.map(c => `
    <tr>
      <td><span class="cat-icon-cell"><i class="bi ${escapeHtml(c.icon || "bi-tag")}"></i></span></td>
      <td><strong>${escapeHtml(c.label)}</strong></td>
      <td><code class="small text-muted">${escapeHtml(c.slug)}</code></td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" onclick="editCategory('${escapeHtml(c.slug)}')"><i class="bi bi-pencil-square"></i></button>
        <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="askDeleteCategory('${escapeHtml(c.slug)}')"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join("");
}

// ─── BADGES TABLE ──────────────────────────────────────────
function renderBadgesTable() {
  const tbody = $("#badgeTbody");
  if (!tbody) return;
  if (!site.badges.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No badges yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = site.badges.map(b => `
    <tr>
      <td><span class="badge-preview-pill" style="background:${escapeHtml(b.color)}">${escapeHtml(b.label)}</span></td>
      <td><strong>${escapeHtml(b.label)}</strong></td>
      <td><code class="small text-muted">${escapeHtml(b.slug)}</code></td>
      <td><span class="badge-swatch" style="background:${escapeHtml(b.color)}"></span><code class="small">${escapeHtml(b.color)}</code></td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" onclick="editBadge('${escapeHtml(b.slug)}')"><i class="bi bi-pencil-square"></i></button>
        <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="askDeleteBadge('${escapeHtml(b.slug)}')"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join("");
}

// ─── PRODUCT MODAL: populate dropdowns from site ───────────
function renderProductSelectors() {
  const catSel = $("#productCategory");
  const badgeSel = $("#productBadge");
  if (catSel) {
    const current = catSel.value;
    catSel.innerHTML = `<option value="">Choose…</option>` +
      site.categories.map(c => `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.label)}</option>`).join("");
    catSel.value = current;
  }
  if (badgeSel) {
    const current = badgeSel.value;
    badgeSel.innerHTML = `<option value="">None</option>` +
      site.badges.map(b => `<option value="${escapeHtml(b.slug)}">${escapeHtml(b.label)}</option>`).join("");
    badgeSel.value = current;
  }
}

// ─── FEATURED FORM ─────────────────────────────────────────
function renderFeaturedForm() {
  const f = site.featured || {};
  $("#featTag").value = f.tag || "";
  $("#featName").value = f.name || "";
  $("#featPrice").value = f.price || 0;
  featuredImgValue = f.image || "";
  const preview = $("#featImgPreview");
  if (featuredImgValue) {
    preview.src = featuredImgValue;
    preview.style.display = "block";
  } else {
    preview.style.display = "none";
  }
  const isRemote = /^https?:\/\//i.test(featuredImgValue);
  if (isRemote) {
    $("#featImgModeUrl").checked = true;
    $("#featImgUrl").value = featuredImgValue;
    $("#featUploadPane").classList.add("d-none");
    $("#featUrlPane").classList.remove("d-none");
  } else {
    $("#featImgModeUpload").checked = true;
    $("#featImgUrl").value = "";
    $("#featUploadPane").classList.remove("d-none");
    $("#featUrlPane").classList.add("d-none");
  }
}

// ─── CATEGORY CRUD ─────────────────────────────────────────
function openNewCategory() {
  $("#catModalTitle").textContent = "Add Category";
  $("#catEditSlug").value = "";
  $("#catLabel").value = "";
  $("#catSlug").value = "";
  $("#catIcon").value = "bi-tag";
  hideError($("#catError"));
  categoryModal.show();
}
function editCategory(slug) {
  const c = site.categories.find(x => x.slug === slug);
  if (!c) return;
  $("#catModalTitle").textContent = "Edit Category";
  $("#catEditSlug").value = c.slug;
  $("#catLabel").value = c.label;
  $("#catSlug").value = c.slug;
  $("#catIcon").value = c.icon || "bi-tag";
  hideError($("#catError"));
  categoryModal.show();
}
function askDeleteCategory(slug) {
  deletePendingKind = "category";
  deletePendingId = slug;
  confirmModal.show();
}

// ─── BADGE CRUD ────────────────────────────────────────────
function openNewBadge() {
  $("#badgeModalTitle").textContent = "Add Badge";
  $("#badgeEditSlug").value = "";
  $("#badgeLabel").value = "";
  $("#badgeSlug").value = "";
  $("#badgeColor").value = "#00B4D8";
  $("#badgeColorHex").value = "#00B4D8";
  $("#badgePreview").style.background = "#00B4D8";
  $("#badgePreview").textContent = "PREVIEW";
  hideError($("#badgeError"));
  badgeModal.show();
}
function editBadge(slug) {
  const b = site.badges.find(x => x.slug === slug);
  if (!b) return;
  $("#badgeModalTitle").textContent = "Edit Badge";
  $("#badgeEditSlug").value = b.slug;
  $("#badgeLabel").value = b.label;
  $("#badgeSlug").value = b.slug;
  $("#badgeColor").value = b.color;
  $("#badgeColorHex").value = b.color;
  $("#badgePreview").style.background = b.color;
  $("#badgePreview").textContent = b.label;
  hideError($("#badgeError"));
  badgeModal.show();
}
function askDeleteBadge(slug) {
  deletePendingKind = "badge";
  deletePendingId = slug;
  confirmModal.show();
}

// expose for inline handlers
window.editCategory = editCategory;
window.askDeleteCategory = askDeleteCategory;
window.editBadge = editBadge;
window.askDeleteBadge = askDeleteBadge;

// ─── IMAGE HANDLING ────────────────────────────────────────
// Holds the active image source for the product being edited.
// May be a remote URL or a base64 data URL (from file upload).
let currentImgValue = "";

function setImage(src) {
  currentImgValue = src || "";
  const preview = $("#imgPreview");
  const clearBtn = $("#clearImgBtn");
  if (currentImgValue) {
    preview.src = currentImgValue;
    preview.style.display = "block";
    clearBtn.classList.remove("d-none");
  } else {
    preview.removeAttribute("src");
    preview.style.display = "none";
    clearBtn.classList.add("d-none");
  }
}

function setImgMode(mode) {
  $("#uploadPane").classList.toggle("d-none", mode !== "upload");
  $("#urlPane").classList.toggle("d-none", mode !== "url");
}

// Downsize an image file to max 600px on the longest side and
// return a base64 data URL (JPEG, ~85% quality).
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode image"));
      img.onload = () => {
        const MAX = 600;
        let w = img.width, h = img.height;
        if (w > h && w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        else if (h >= w && h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        // Use PNG if the file is small or has alpha; otherwise JPEG for size
        const isPng = file.type === "image/png" && file.size < 250 * 1024;
        resolve(canvas.toDataURL(isPng ? "image/png" : "image/jpeg", 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ─── MODAL HANDLERS ────────────────────────────────────────
function openNewProduct() {
  $("#modalTitle").textContent = "Add Product";
  $("#productForm").reset();
  $("#productId").value = "";
  setImage("");
  $("#imgModeUpload").checked = true;
  setImgMode("upload");
  hideError($("#formError"));
}

function editProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  $("#modalTitle").textContent = "Edit Product";
  $("#productId").value = p.id;
  $("#productName").value = p.name || "";
  $("#productCategory").value = p.category || "";
  $("#productPrice").value = p.price || "";
  $("#productOldPrice").value = p.oldPrice || "";
  $("#productBadge").value = p.badge || "";
  $("#productRating").value = p.rating || "";
  $("#productReviews").value = p.reviews || "";

  setImage(p.img || "");

  // Default mode: URL if it's a remote http(s) URL, otherwise upload
  const isRemote = /^https?:\/\//i.test(p.img || "");
  if (isRemote) {
    $("#imgModeUrl").checked = true;
    $("#productImg").value = p.img || "";
    setImgMode("url");
  } else {
    $("#imgModeUpload").checked = true;
    $("#productImg").value = "";
    setImgMode("upload");
  }

  hideError($("#formError"));
  productModal.show();
}

function askDelete(id) {
  deletePendingKind = "product";
  deletePendingId = id;
  confirmModal.show();
}

// Expose for inline onclick
window.editProduct = editProduct;
window.askDelete = askDelete;
window.openNewCategory = openNewCategory;
window.openNewBadge = openNewBadge;

// ─── INIT ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  productModal = new bootstrap.Modal($("#productModal"));
  confirmModal = new bootstrap.Modal($("#confirmModal"));
  categoryModal = new bootstrap.Modal($("#categoryModal"));
  badgeModal = new bootstrap.Modal($("#badgeModal"));

  // If session already authenticated, jump in
  if (getPassword()) {
    const ok = await tryLogin(getPassword());
    if (ok) showDashboard();
    else clearPassword();
  }

  // Login form
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError($("#loginError"));
    const pw = $("#passwordInput").value.trim();
    if (!pw) return;
    const ok = await tryLogin(pw);
    if (!ok) {
      showError($("#loginError"), "Incorrect password. Try again.");
      return;
    }
    setPassword(pw);
    showDashboard();
  });

  // Logout
  $("#logoutBtn").addEventListener("click", () => {
    clearPassword();
    location.reload();
  });

  // New product button
  $("#newProductBtn").addEventListener("click", openNewProduct);

  // Mode toggle (Upload / URL)
  $$('input[name="imgMode"]').forEach((r) => {
    r.addEventListener("change", () => setImgMode(r.value));
  });

  // URL pane: preview as user types
  $("#productImg").addEventListener("input", (e) => {
    setImage(e.target.value.trim());
  });

  // Upload pane: handle file picker
  $("#productImgFile").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showError($("#formError"), "Please pick an image file (JPG, PNG, WebP).");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setImage(dataUrl);
    } catch (err) {
      showError($("#formError"), err.message || "Could not load the image.");
    }
  });

  // Remove image
  $("#clearImgBtn").addEventListener("click", () => {
    setImage("");
    $("#productImg").value = "";
    $("#productImgFile").value = "";
  });

  // Save product
  $("#productForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError($("#formError"));

    const payload = {
      name: $("#productName").value.trim(),
      category: $("#productCategory").value,
      price: Number($("#productPrice").value) || 0,
      oldPrice: $("#productOldPrice").value ? Number($("#productOldPrice").value) : undefined,
      img: currentImgValue || undefined,
      badge: $("#productBadge").value || undefined,
      rating: $("#productRating").value ? Number($("#productRating").value) : undefined,
      reviews: $("#productReviews").value ? Number($("#productReviews").value) : undefined,
    };

    // Strip undefined fields
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    const id = $("#productId").value;
    try {
      $("#saveBtn").disabled = true;
      if (id) await updateProduct(Number(id), payload);
      else await createProduct(payload);
      productModal.hide();
      await fetchProducts();
    } catch (err) {
      showError($("#formError"), err.message || "Could not save product.");
    } finally {
      $("#saveBtn").disabled = false;
    }
  });

  // Confirm delete — works for products, categories, badges
  $("#confirmDeleteBtn").addEventListener("click", async () => {
    if (!deletePendingId) return;
    try {
      if (deletePendingKind === "product") {
        await deleteProduct(deletePendingId);
        await fetchProducts();
      } else if (deletePendingKind === "category") {
        const next = site.categories.filter(c => c.slug !== deletePendingId);
        await saveSite({ categories: next });
        await fetchSite();
      } else if (deletePendingKind === "badge") {
        const next = site.badges.filter(b => b.slug !== deletePendingId);
        await saveSite({ badges: next });
        await fetchSite();
      }
      confirmModal.hide();
      deletePendingId = null;
    } catch (err) {
      alert(err.message || "Could not delete.");
    }
  });

  // Search
  $("#searchProducts").addEventListener("input", (e) => {
    searchTerm = e.target.value.toLowerCase().trim();
    renderTable();
  });

  // ─── CATEGORY FORM ───────────────────────────────────────
  $("#addCategoryBtn").addEventListener("click", openNewCategory);
  $("#categoryForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError($("#catError"));
    const label = $("#catLabel").value.trim();
    const slug = $("#catSlug").value.trim().toLowerCase().replace(/\s+/g, "-");
    const icon = $("#catIcon").value.trim() || "bi-tag";
    const editSlug = $("#catEditSlug").value;
    if (!label || !slug) {
      showError($("#catError"), "Label and slug are required.");
      return;
    }
    const list = [...site.categories];
    if (editSlug) {
      const idx = list.findIndex(c => c.slug === editSlug);
      if (idx !== -1) list[idx] = { slug, label, icon };
    } else {
      if (list.some(c => c.slug === slug)) {
        showError($("#catError"), "A category with that slug already exists.");
        return;
      }
      list.push({ slug, label, icon });
    }
    try {
      await saveSite({ categories: list });
      categoryModal.hide();
      await fetchSite();
    } catch (err) {
      showError($("#catError"), err.message);
    }
  });

  // Auto-fill slug from label
  $("#catLabel").addEventListener("input", (e) => {
    if (!$("#catEditSlug").value && !$("#catSlug").dataset.touched) {
      $("#catSlug").value = e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    }
  });
  $("#catSlug").addEventListener("input", () => { $("#catSlug").dataset.touched = "1"; });

  // ─── BADGE FORM ──────────────────────────────────────────
  $("#addBadgeBtn").addEventListener("click", openNewBadge);

  function syncBadgePreview() {
    const color = $("#badgeColor").value;
    const label = $("#badgeLabel").value || "PREVIEW";
    $("#badgeColorHex").value = color;
    $("#badgePreview").style.background = color;
    $("#badgePreview").textContent = label;
  }
  $("#badgeColor").addEventListener("input", syncBadgePreview);
  $("#badgeColorHex").addEventListener("input", (e) => {
    if (/^#[0-9a-f]{3,8}$/i.test(e.target.value)) {
      $("#badgeColor").value = e.target.value;
      syncBadgePreview();
    }
  });
  $("#badgeLabel").addEventListener("input", syncBadgePreview);

  $("#badgeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError($("#badgeError"));
    const label = $("#badgeLabel").value.trim();
    const slug = $("#badgeSlug").value.trim().toLowerCase().replace(/\s+/g, "-");
    const color = $("#badgeColor").value;
    const editSlug = $("#badgeEditSlug").value;
    if (!label || !slug) {
      showError($("#badgeError"), "Label and slug are required.");
      return;
    }
    const list = [...site.badges];
    if (editSlug) {
      const idx = list.findIndex(b => b.slug === editSlug);
      if (idx !== -1) list[idx] = { slug, label, color };
    } else {
      if (list.some(b => b.slug === slug)) {
        showError($("#badgeError"), "A badge with that slug already exists.");
        return;
      }
      list.push({ slug, label, color });
    }
    try {
      await saveSite({ badges: list });
      badgeModal.hide();
      await fetchSite();
    } catch (err) {
      showError($("#badgeError"), err.message);
    }
  });

  // Auto-fill badge slug from label
  $("#badgeLabel").addEventListener("input", (e) => {
    if (!$("#badgeEditSlug").value && !$("#badgeSlug").dataset.touched) {
      $("#badgeSlug").value = e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    }
  });
  $("#badgeSlug").addEventListener("input", () => { $("#badgeSlug").dataset.touched = "1"; });

  // ─── FEATURED FORM ───────────────────────────────────────
  // Mode toggle
  $$('input[name="featImgMode"]').forEach(r => {
    r.addEventListener("change", () => {
      $("#featUploadPane").classList.toggle("d-none", r.value !== "upload");
      $("#featUrlPane").classList.toggle("d-none", r.value !== "url");
    });
  });
  // URL input updates preview
  $("#featImgUrl").addEventListener("input", (e) => {
    featuredImgValue = e.target.value.trim();
    const preview = $("#featImgPreview");
    preview.src = featuredImgValue;
    preview.style.display = featuredImgValue ? "block" : "none";
  });
  // File upload
  $("#featImgFile").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showError($("#featError"), "Please pick an image file.");
      return;
    }
    try {
      // Reuse fileToDataUrl but downsize to 800px for hero
      const dataUrl = await fileToDataUrlMax(file, 800);
      featuredImgValue = dataUrl;
      const preview = $("#featImgPreview");
      preview.src = dataUrl;
      preview.style.display = "block";
    } catch (err) {
      showError($("#featError"), err.message);
    }
  });
  $("#featuredForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError($("#featError"));
    $("#featSuccess").classList.add("d-none");
    const payload = {
      featured: {
        image: featuredImgValue || "",
        tag: $("#featTag").value.trim(),
        name: $("#featName").value.trim(),
        price: Number($("#featPrice").value) || 0,
      },
    };
    try {
      $("#saveFeaturedBtn").disabled = true;
      await saveSite(payload);
      await fetchSite();
      $("#featSuccess").classList.remove("d-none");
      setTimeout(() => $("#featSuccess").classList.add("d-none"), 4000);
    } catch (err) {
      showError($("#featError"), err.message);
    } finally {
      $("#saveFeaturedBtn").disabled = false;
    }
  });
});

// File → max NN px JPEG/PNG (for featured product hero image)
function fileToDataUrlMax(file, max = 600) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode image"));
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > h && w > max) { h = Math.round(h * max / w); w = max; }
        else if (h >= w && h > max) { w = Math.round(w * max / h); h = max; }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const isPng = file.type === "image/png" && file.size < 250 * 1024;
        resolve(canvas.toDataURL(isPng ? "image/png" : "image/jpeg", 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function showDashboard() {
  $("#loginView").classList.add("d-none");
  $("#dashboardView").classList.remove("d-none");
  fetchSite();
  fetchProducts();
}
