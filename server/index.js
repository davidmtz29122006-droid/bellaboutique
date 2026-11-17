import express from "express";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = path.resolve(process.env.DATA_DIRECTORY || path.join(here, "..", "data"));
const databasePath = path.resolve(process.env.DB_PATH || path.join(dataDirectory, "bella-boutique.db"));
mkdirSync(path.dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
db.transaction = (callback) => (...args) => {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = callback(...args);
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
};

db.exec(`
  CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    address TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    surname TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    username TEXT NOT NULL UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'cashier', 'seller')),
    branch_id INTEGER REFERENCES branches(id),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    surname TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    member_number TEXT NOT NULL UNIQUE,
    is_member INTEGER NOT NULL DEFAULT 0,
    privacy_accepted INTEGER NOT NULL DEFAULT 0,
    promo_consent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    distributor TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS discounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    percentage REAL NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
    conditions TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    description TEXT NOT NULL DEFAULT '',
    barcode TEXT NOT NULL UNIQUE,
    size TEXT NOT NULL DEFAULT 'Unitalla',
    color TEXT NOT NULL DEFAULT 'Marfil',
    cost REAL NOT NULL DEFAULT 0 CHECK (cost >= 0),
    price REAL NOT NULL CHECK (price >= 0),
    stock_min INTEGER NOT NULL DEFAULT 5 CHECK (stock_min >= 0),
    lingerie INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS inventory (
    product_id INTEGER NOT NULL REFERENCES products(id),
    branch_id INTEGER NOT NULL REFERENCES branches(id),
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (product_id, branch_id)
  );
  CREATE TABLE IF NOT EXISTS inventory_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    branch_id INTEGER NOT NULL REFERENCES branches(id),
    user_id INTEGER REFERENCES users(id),
    type TEXT NOT NULL CHECK (type IN ('entry', 'sale', 'return', 'adjustment')),
    quantity INTEGER NOT NULL,
    supplier_id INTEGER REFERENCES suppliers(id),
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL REFERENCES branches(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    customer_id INTEGER REFERENCES customers(id),
    discount_id INTEGER REFERENCES discounts(id),
    subtotal REAL NOT NULL,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer')),
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled', 'returned')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id),
    amount REAL NOT NULL CHECK (amount >= 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer')),
    reference TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled', 'refunded'))
  );
  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price REAL NOT NULL,
    subtotal REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    branch_id INTEGER NOT NULL REFERENCES branches(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    quantity INTEGER NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS product_discounts (
    product_id INTEGER NOT NULL REFERENCES products(id),
    discount_id INTEGER NOT NULL REFERENCES discounts(id),
    PRIMARY KEY (product_id, discount_id)
  );
`);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);
const migrateRelationalModel = db.transaction(() => {
  if (db.prepare("SELECT 1 FROM schema_migrations WHERE version = 1").get()) return;
  ensureColumn("users", "surname", "surname TEXT NOT NULL DEFAULT ''");
  ensureColumn("users", "email", "email TEXT NOT NULL DEFAULT ''");
  ensureColumn("customers", "surname", "surname TEXT NOT NULL DEFAULT ''");
  ensureColumn("customers", "address", "address TEXT NOT NULL DEFAULT ''");
  ensureColumn("products", "category_id", "category_id INTEGER REFERENCES categories(id)");
  ensureColumn("products", "supplier_id", "supplier_id INTEGER REFERENCES suppliers(id)");
  ensureColumn("sales", "discount_id", "discount_id INTEGER REFERENCES discounts(id)");
  ensureColumn("inventory_movements", "supplier_id", "supplier_id INTEGER REFERENCES suppliers(id)");
  ensureColumn("returns", "amount", "amount REAL NOT NULL DEFAULT 0");
  ensureColumn("returns", "status", "status TEXT NOT NULL DEFAULT 'approved'");
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON payments(sale_id);
    CREATE INDEX IF NOT EXISTS idx_product_discounts_discount_id ON product_discounts(discount_id);
  `);
  db.prepare("INSERT INTO schema_migrations (version, description) VALUES (1, ?)").run("Relational UML model");
});
migrateRelationalModel();

const passwordRecord = (password, salt = randomBytes(16).toString("hex")) => ({
  salt,
  hash: scryptSync(password, salt, 64).toString("hex"),
});

const seed = db.transaction(() => {
  const insertBranch = db.prepare("INSERT OR IGNORE INTO branches (name, address, phone) VALUES (?, ?, ?)");
  insertBranch.run("Bella Boutique · Centro", "Sucursal Centro", "");
  insertBranch.run("Bella Boutique · Norte", "Sucursal Norte", "");

  const insertUser = db.prepare("INSERT OR IGNORE INTO users (name, username, password_salt, password_hash, role, branch_id) VALUES (?, ?, ?, ?, ?, ?)");
  for (const [name, username, password, role, branchId] of [
    ["Administración", "admin", "Bella2026!", "admin", 1],
    ["Caja Centro", "caja", "Bella2026!", "cashier", 1],
    ["Ventas Norte", "ventas", "Bella2026!", "seller", 2],
  ]) {
    const credentials = passwordRecord(password);
    insertUser.run(name, username, credentials.salt, credentials.hash, role, branchId);
  }

  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products (name, brand, category, description, barcode, size, color, cost, price, stock_min, lingerie)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const products = [
    ["Vestido Aurora", "Bella Studio", "Vestidos", "Vestido midi plisado con caída ligera.", "7501000000011", "M", "Rosa palo", 680, 1490, 5, 0],
    ["Blazer Siena", "Bella Studio", "Sacos", "Corte sastre y silueta contemporánea.", "7501000000012", "S", "Marfil", 890, 1890, 5, 0],
    ["Blusa Camille", "Maison Femme", "Blusas", "Textura satinada y cuello delicado.", "7501000000013", "L", "Champagne", 420, 950, 5, 0],
    ["Pantalón Olivia", "Bella Studio", "Pantalones", "Tiro alto con pierna recta.", "7501000000014", "M", "Negro", 610, 1290, 5, 0],
    ["Falda Celeste", "Lumière", "Faldas", "Falda midi plisada en tela suave.", "7501000000015", "S", "Lavanda", 530, 1150, 5, 0],
    ["Top Amélie", "Maison Femme", "Blusas", "Top de tirantes con detalle bordado.", "7501000000016", "M", "Rosa palo", 340, 790, 5, 0],
    ["Vestido Noa", "Lumière", "Vestidos", "Vestido camisero con cinturón incluido.", "7501000000017", "L", "Verde salvia", 760, 1690, 5, 0],
    ["Cinturón", "Maison Femme", "Accesorios", "Cinturón versátil para complementar distintos estilos.", "7501000000018", "Unitalla", "Vino", 390, 890, 5, 0],
  ];
  for (const product of products) insertProduct.run(...product);

  const addStock = db.prepare("INSERT OR IGNORE INTO inventory (product_id, branch_id, quantity) VALUES (?, ?, ?)");
  const allProducts = db.prepare("SELECT id, barcode FROM products").all();
  for (const product of allProducts) {
    addStock.run(product.id, 1, product.barcode.endsWith("11") ? 3 : 12);
    addStock.run(product.id, 2, product.barcode.endsWith("14") ? 2 : 8);
  }

  const insertCustomer = db.prepare(`
    INSERT OR IGNORE INTO customers (name, phone, email, member_number, is_member, privacy_accepted, promo_consent)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `);
  insertCustomer.run("Mariana López", "722 555 0142", "mariana@example.com", "BB-10021", 1, 1);
  insertCustomer.run("Sofía Ramírez", "722 555 0188", "sofia@example.com", "BB-10022", 0, 0);

  db.prepare("INSERT OR IGNORE INTO suppliers (id, name, distributor, phone, email, address) VALUES (1, ?, ?, ?, ?, ?)")
    .run("Moda & Estilo", "Distribuidora Moda", "722 555 0110", "pedidos@modaestilo.mx", "Toluca, Estado de México");
});
seed();

const syncRelationalData = db.transaction(() => {
  db.exec(`
    INSERT OR IGNORE INTO categories (name)
    SELECT DISTINCT TRIM(category) FROM products WHERE TRIM(category) <> '';
    UPDATE products
    SET category_id = (SELECT id FROM categories WHERE categories.name = TRIM(products.category))
    WHERE category_id IS NULL;
  `);
  const insertDiscount = db.prepare(`
    INSERT OR IGNORE INTO discounts (code, name, percentage, conditions)
    VALUES (?, ?, ?, ?)
  `);
  insertDiscount.run("membership", "Membresía Bella", 20, "Cliente con membresía activa.");
  insertDiscount.run("annual_spend", "Cliente frecuente", 30, "Compras completadas superiores a $20,000 MXN en los últimos doce meses.");
  db.exec(`
    INSERT INTO payments (sale_id, amount, payment_method, created_at, status)
    SELECT s.id, s.total, s.payment_method, s.created_at,
      CASE WHEN s.status = 'cancelled' THEN 'cancelled' ELSE 'completed' END
    FROM sales s
    WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.sale_id = s.id);
  `);
});
syncRelationalData();

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
const cookieName = "bella_session";

function rejectSession(res, error) {
  res.setHeader("X-Session-Invalid", "true");
  return res.status(401).json({ error });
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", sessionSecret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function auth(required = true) {
  return (req, res, next) => {
    const token = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (!token) {
      if (!required) return next();
      return rejectSession(res, "Inicia sesión para continuar.");
    }
    const [body, signature] = token.split(".");
    if (!body || !signature) return rejectSession(res, "Sesión no válida.");
    const expected = createHmac("sha256", sessionSecret).update(body).digest("base64url");
    const receivedBytes = Buffer.from(signature);
    const expectedBytes = Buffer.from(expected);
    if (receivedBytes.length !== expectedBytes.length || !timingSafeEqual(receivedBytes, expectedBytes)) {
      return rejectSession(res, "Sesión no válida.");
    }
    let payload;
    try {
      payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    } catch {
      return rejectSession(res, "Sesión no válida.");
    }
    if (!Number.isFinite(payload.exp) || payload.exp <= Date.now()) return rejectSession(res, "Tu sesión expiró. Inicia sesión de nuevo.");
    const user = db.prepare("SELECT id, TRIM(name || ' ' || surname) AS name, surname, email, username, role, branch_id AS branchId FROM users WHERE id = ? AND active = 1").get(payload.id);
    if (!user) {
      res.setHeader("Set-Cookie", `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
      return rejectSession(res, "La cuenta ya no está activa.");
    }
    req.user = user;
    next();
  };
}

const requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Esta acción requiere permisos de administración." });
  next();
};
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Tu perfil no tiene permiso para consultar esta sección." });
  next();
};
app.use("/api", (req, res, next) => ["/login", "/health", "/branches", "/me", "/catalog"].includes(req.path) ? next() : auth()(req, res, next));

app.get("/api/health", (_req, res) => res.json({ status: "ok", database: "sqlite" }));
app.post("/api/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const user = db.prepare("SELECT * FROM users WHERE username = ? AND active = 1").get(username);
  if (!user) return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
  const attemptedHash = scryptSync(password, user.password_salt, 64);
  const storedHash = Buffer.from(user.password_hash, "hex");
  if (attemptedHash.length !== storedHash.length || !timingSafeEqual(attemptedHash, storedHash)) {
    return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
  }
  res.setHeader("Set-Cookie", `${cookieName}=${sign({ id: user.id, exp: Date.now() + 8 * 60 * 60 * 1000 })}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  res.json({ user: { id: user.id, name: `${user.name} ${user.surname}`.trim(), surname: user.surname, email: user.email, username: user.username, role: user.role, branchId: user.branch_id } });
});
app.post("/api/logout", auth(), (_req, res) => {
  res.setHeader("Set-Cookie", `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
  res.json({ ok: true });
});
app.get("/api/me", auth(false), (req, res) => res.json({ user: req.user || null }));
app.get("/api/project/document", requireAdmin, (_req, res, next) => {
  res.sendFile(path.resolve(here, "..", "documents", "Bella_Boutique_Documento_Corregido.pdf"), (error) => {
    if (error) next(error);
  });
});

app.get("/api/branches", (_req, res) => {
  res.json(db.prepare("SELECT id, name, address FROM branches WHERE active = 1 ORDER BY id").all());
});
app.get("/api/catalog", (req, res) => {
  const branchId = req.query.branchId === undefined ? null : Number(req.query.branchId);
  if (branchId !== null && (!Number.isInteger(branchId) || branchId < 1)) {
    return res.status(400).json({ error: "Selecciona una sucursal válida." });
  }
  const search = `%${String(req.query.search || "").trim()}%`;
  const rows = db.prepare(`
    SELECT p.id, p.name, p.brand, p.category, p.description, p.size, p.color, p.price,
      b.id AS branchId, b.name AS branchName, i.quantity
    FROM products p
    JOIN inventory i ON i.product_id = p.id
    JOIN branches b ON b.id = i.branch_id
    WHERE p.active = 1 AND b.active = 1
      AND (? IS NULL OR b.id = ?)
      AND (p.name LIKE ? OR p.brand LIKE ? OR p.category LIKE ? OR p.size LIKE ? OR p.color LIKE ?)
    ORDER BY p.name, b.id
  `).all(branchId, branchId, search, search, search, search, search);
  const products = new Map();
  for (const row of rows) {
    if (!products.has(row.id)) {
      products.set(row.id, {
        id: row.id,
        name: row.name,
        brand: row.brand,
        category: row.category,
        description: row.description,
        size: row.size,
        color: row.color,
        price: row.price,
        branches: [],
      });
    }
    products.get(row.id).branches.push({
      id: row.branchId,
      name: row.branchName,
      quantity: row.quantity,
    });
  }
  res.json([...products.values()]);
});
app.get("/api/dashboard", auth(), (req, res) => {
  const branchId = Number(req.query.branchId || req.user.branchId || 1);
  if (!Number.isInteger(branchId) || branchId < 1) return res.status(400).json({ error: "Selecciona una sucursal válida." });
  if (req.user.role !== "admin" && branchId !== req.user.branchId) return res.status(403).json({ error: "Solo puedes consultar las ventas de tu sucursal." });
  const canViewSales = ["admin", "cashier"].includes(req.user.role);
  const today = canViewSales ? db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total
    FROM sales WHERE branch_id = ? AND status = 'completed' AND date(created_at) = date('now')
  `).get(branchId) : null;
  const inventorySummary = db.prepare(`
    SELECT COUNT(DISTINCT p.id) AS products,
      COALESCE(SUM(i.quantity), 0) AS units,
      SUM(CASE WHEN i.quantity <= p.stock_min THEN 1 ELSE 0 END) AS lowStock
    FROM products p JOIN inventory i ON i.product_id = p.id
    WHERE i.branch_id = ? AND p.active = 1
  `).get(branchId);
  const month = canViewSales ? db.prepare(`
    SELECT COALESCE(SUM(total), 0) AS total FROM sales
    WHERE branch_id = ? AND status = 'completed' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
  `).get(branchId).total : null;
  const recent = canViewSales ? db.prepare(`
    SELECT s.id, s.total, s.payment_method AS paymentMethod, s.created_at AS createdAt,
      TRIM(c.name || ' ' || c.surname) AS customer,
      TRIM(u.name || ' ' || u.surname) AS seller
    FROM sales s LEFT JOIN customers c ON c.id = s.customer_id JOIN users u ON u.id = s.user_id
    WHERE s.branch_id = ? ORDER BY s.id DESC LIMIT 5
  `).all(branchId) : [];
  const lowStock = db.prepare(`
    SELECT p.id, p.name, p.size, p.color, i.quantity, p.stock_min AS stockMin
    FROM inventory i JOIN products p ON p.id = i.product_id
    WHERE i.branch_id = ? AND i.quantity <= p.stock_min AND p.active = 1
    ORDER BY i.quantity ASC LIMIT 6
  `).all(branchId);
  res.json({ today, month, inventory: inventorySummary, recent, lowStock });
});

app.get("/api/products", (req, res) => {
  const branchId = Number(req.query.branchId || 1);
  const search = `%${String(req.query.search || "").trim()}%`;
  const costColumn = req.user.role === "admin" ? "p.cost" : "NULL";
  const products = db.prepare(`
    SELECT p.id, p.name, p.brand, p.category, p.category_id AS categoryId, p.supplier_id AS supplierId,
      p.description, p.barcode, p.size, p.color,
      ${costColumn} AS cost, p.price, p.stock_min AS stockMin, p.lingerie, p.active,
      COALESCE((SELECT quantity FROM inventory WHERE product_id = p.id AND branch_id = ?), 0) AS stock,
      COALESCE((SELECT SUM(quantity) FROM inventory WHERE product_id = p.id), 0) AS totalStock
    FROM products p WHERE p.active = 1 AND
      (p.name LIKE ? OR p.brand LIKE ? OR p.category LIKE ? OR p.barcode LIKE ? OR p.size LIKE ? OR p.color LIKE ?)
    ORDER BY p.name
  `).all(branchId, search, search, search, search, search, search);
  res.json(products);
});
app.post("/api/products", auth(), requireAdmin, (req, res) => {
  const { name, category, barcode, size, color, price, cost = 0, brand = "", description = "", stock = 0, branchId, stockMin = 5, lingerie = false } = req.body || {};
  const supplierIdValue = req.body?.supplierId;
  const supplierId = supplierIdValue === undefined || supplierIdValue === null || supplierIdValue === "" ? null : Number(supplierIdValue);
  const categoryName = String(category || "").trim();
  if (!String(name || "").trim() || !String(category || "").trim() || !String(barcode || "").trim() || !Number.isFinite(Number(price)) || Number(price) < 0 || !Number.isInteger(Number(stock)) || Number(stock) < 0 || !Number.isInteger(Number(stockMin)) || Number(stockMin) < 0) {
    return res.status(400).json({ error: "Completa nombre, categoría, código de barras, precio y existencias válidas." });
  }
  if (supplierId !== null && (!Number.isInteger(supplierId) || !db.prepare("SELECT id FROM suppliers WHERE id = ?").get(supplierId))) {
    return res.status(400).json({ error: "Selecciona un proveedor válido." });
  }
  const addProduct = db.transaction(() => {
    db.prepare("INSERT INTO categories (name) VALUES (?) ON CONFLICT(name) DO UPDATE SET active = 1").run(categoryName);
    const categoryId = db.prepare("SELECT id FROM categories WHERE name = ?").get(categoryName).id;
    const result = db.prepare(`
      INSERT INTO products (name, brand, category, category_id, supplier_id, description, barcode, size, color, cost, price, stock_min, lingerie)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(String(name).trim(), brand, categoryName, categoryId, supplierId, description, String(barcode).trim(), size || "Unitalla", color || "Marfil", Number(cost) || 0, Number(price), Number(stockMin), lingerie ? 1 : 0);
    for (const branch of db.prepare("SELECT id FROM branches WHERE active = 1").all()) {
      const quantity = branch.id === Number(branchId || req.user.branchId) ? Number(stock) : 0;
      db.prepare("INSERT INTO inventory (product_id, branch_id, quantity) VALUES (?, ?, ?)").run(result.lastInsertRowid, branch.id, quantity);
    }
    if (Number(stock) > 0) {
      db.prepare("INSERT INTO inventory_movements (product_id, branch_id, user_id, type, quantity, note) VALUES (?, ?, ?, 'entry', ?, 'Existencia inicial')").run(result.lastInsertRowid, Number(branchId || req.user.branchId), req.user.id, Number(stock));
    }
    return result.lastInsertRowid;
  });
  try {
    res.status(201).json(db.prepare("SELECT * FROM products WHERE id = ?").get(addProduct()));
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "Ya existe un producto con ese código de barras." });
    throw error;
  }
});
app.delete("/api/products/:id", auth(), requireAdmin, (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isInteger(productId) || productId < 1) return res.status(400).json({ error: "Selecciona un producto válido." });
  const result = db.prepare("UPDATE products SET active = 0 WHERE id = ? AND active = 1").run(productId);
  if (!result.changes) return res.status(404).json({ error: "No se encontró un producto activo con ese identificador." });
  res.json({ ok: true });
});
app.post("/api/inventory/movements", auth(), requireAdmin, (req, res) => {
  const productId = Number(req.body?.productId);
  const branchId = Number(req.body?.branchId || req.user.branchId);
  const quantity = Number(req.body?.quantity);
  const type = req.body?.type;
  const supplierId = req.body?.supplierId ? Number(req.body.supplierId) : null;
  const note = String(req.body?.note || "").trim();
  if (!Number.isInteger(productId) || !Number.isInteger(branchId) || !Number.isInteger(quantity) || quantity <= 0 || !["entry", "adjustment"].includes(type)) {
    return res.status(400).json({ error: "Movimiento de inventario inválido." });
  }
  const updateStock = db.transaction(() => {
    const stock = db.prepare("SELECT quantity FROM inventory WHERE product_id = ? AND branch_id = ?").get(productId, branchId);
    if (!stock) throw Object.assign(new Error("Producto o sucursal no encontrados."), { status: 404 });
    if (supplierId && !db.prepare("SELECT id FROM suppliers WHERE id = ?").get(supplierId)) throw Object.assign(new Error("No se encontró ese proveedor."), { status: 400 });
    const next = type === "entry" ? stock.quantity + quantity : quantity;
    db.prepare("UPDATE inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND branch_id = ?").run(next, productId, branchId);
    db.prepare("INSERT INTO inventory_movements (product_id, branch_id, user_id, type, quantity, supplier_id, note) VALUES (?, ?, ?, ?, ?, ?, ?)").run(productId, branchId, req.user.id, type, type === "adjustment" ? next - stock.quantity : quantity, supplierId, note);
    return next;
  });
  res.json({ quantity: updateStock() });
});

app.get("/api/customers", (req, res) => {
  const search = `%${String(req.query.search || "").trim()}%`;
  res.json(db.prepare(`
    SELECT c.id, TRIM(c.name || ' ' || c.surname) AS name, c.surname, c.address, c.phone, c.email,
      c.member_number AS memberNumber, c.is_member AS isMember,
      c.privacy_accepted AS privacyAccepted, c.promo_consent AS promoConsent,
      COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.total ELSE 0 END), 0) AS lifetimeSpend,
      COALESCE((SELECT SUM(s2.total) FROM sales s2
        WHERE s2.customer_id = c.id AND s2.status = 'completed'
          AND s2.created_at >= datetime('now', '-1 year')), 0) AS annualSpend
    FROM customers c LEFT JOIN sales s ON s.customer_id = c.id
    WHERE TRIM(c.name || ' ' || c.surname) LIKE ? OR c.phone LIKE ? OR c.email LIKE ?
      OR c.member_number LIKE ? OR c.address LIKE ?
    GROUP BY c.id ORDER BY c.name
  `).all(search, search, search, search, search));
});
app.post("/api/customers", auth(), (req, res) => {
  const { name, surname = "", address = "", phone = "", email = "", isMember = false, privacyAccepted = false, promoConsent = false } = req.body || {};
  if (!String(name || "").trim() || !privacyAccepted) return res.status(400).json({ error: "El nombre y la aceptación de privacidad son obligatorios." });
  const memberNumber = `BB-${Date.now().toString().slice(-8)}${randomBytes(1).toString("hex").toUpperCase()}`;
  try {
    const result = db.prepare(`
      INSERT INTO customers (name, surname, address, phone, email, member_number, is_member, privacy_accepted, promo_consent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(String(name).trim(), String(surname).trim(), String(address).trim(), String(phone).trim(), String(email).trim(), memberNumber, isMember ? 1 : 0, 1, promoConsent ? 1 : 0);
    res.status(201).json(db.prepare(`
      SELECT id, TRIM(name || ' ' || surname) AS name, surname, address, phone, email,
        member_number AS memberNumber, is_member AS isMember
      FROM customers WHERE id = ?
    `).get(result.lastInsertRowid));
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "No se pudo generar un número de socio único. Intenta de nuevo." });
    throw error;
  }
});

app.get("/api/suppliers", requireAdmin, (_req, res) => {
  res.json(db.prepare("SELECT id, name, distributor, phone, email, address, created_at AS createdAt FROM suppliers ORDER BY name").all());
});
app.post("/api/suppliers", auth(), requireAdmin, (req, res) => {
  const { name, distributor = "", phone = "", email = "", address = "" } = req.body || {};
  if (!String(name || "").trim()) return res.status(400).json({ error: "El nombre del proveedor es obligatorio." });
  const result = db.prepare("INSERT INTO suppliers (name, distributor, phone, email, address) VALUES (?, ?, ?, ?, ?)")
    .run(String(name).trim(), distributor, phone, email, address);
  res.status(201).json(db.prepare("SELECT * FROM suppliers WHERE id = ?").get(result.lastInsertRowid));
});

app.get("/api/sales", requireRole("admin", "cashier"), (req, res) => {
  const branchId = Number(req.query.branchId || req.user.branchId);
  if (!Number.isInteger(branchId) || branchId < 1) return res.status(400).json({ error: "Selecciona una sucursal válida." });
  if (req.user.role !== "admin" && branchId !== req.user.branchId) return res.status(403).json({ error: "Solo puedes consultar las ventas de tu sucursal." });
  res.json(db.prepare(`
    SELECT s.id, s.subtotal, s.discount, s.total, s.payment_method AS paymentMethod,
      s.status, s.created_at AS createdAt,
      TRIM(c.name || ' ' || c.surname) AS customer,
      TRIM(u.name || ' ' || u.surname) AS seller,
      (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) AS itemCount
    FROM sales s LEFT JOIN customers c ON c.id = s.customer_id JOIN users u ON u.id = s.user_id
    WHERE s.branch_id = ? ORDER BY s.id DESC LIMIT 100
  `).all(branchId));
});
app.get("/api/sales/:id", requireAdmin, (req, res) => {
  const saleId = Number(req.params.id);
  const sale = db.prepare(`
    SELECT s.id, s.branch_id AS branchId, s.created_at AS createdAt, s.status,
      s.discount_id AS discountId, s.subtotal, s.discount, s.total,
      TRIM(c.name || ' ' || c.surname) AS customer
    FROM sales s LEFT JOIN customers c ON c.id = s.customer_id WHERE s.id = ?
  `).get(saleId);
  if (!sale) return res.status(404).json({ error: "No se encontró ese ticket." });
  sale.items = db.prepare(`
    SELECT p.id AS productId, p.name, p.lingerie, si.quantity,
      COALESCE((SELECT SUM(r.quantity) FROM returns r WHERE r.sale_id = si.sale_id AND r.product_id = si.product_id), 0) AS returned
    FROM sale_items si JOIN products p ON p.id = si.product_id
    WHERE si.sale_id = ?
  `).all(saleId);
  sale.payments = db.prepare(`
    SELECT id, amount, payment_method AS paymentMethod, reference, created_at AS createdAt, status
    FROM payments WHERE sale_id = ? ORDER BY id
  `).all(saleId);
  res.json(sale);
});
app.post("/api/sales", auth(), (req, res) => {
  const branchId = Number(req.body?.branchId || req.user.branchId || 1);
  if (req.user.role !== "admin" && branchId !== req.user.branchId) {
    return res.status(403).json({ error: "Solo administración puede registrar ventas en otra sucursal." });
  }
  const customerId = req.body?.customerId ? Number(req.body.customerId) : null;
  const paymentMethod = req.body?.paymentMethod;
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!["cash", "card", "transfer"].includes(paymentMethod) || !items.length) return res.status(400).json({ error: "Agrega productos y selecciona una forma de pago." });
  const checkout = db.transaction(() => {
    const customer = customerId ? db.prepare("SELECT *, TRIM(name || ' ' || surname) AS full_name FROM customers WHERE id = ?").get(customerId) : null;
    if (customerId && !customer) throw Object.assign(new Error("No se encontró el cliente seleccionado."), { status: 404 });
    let subtotal = 0;
    const normalizedItems = items.map((item) => {
      const product = db.prepare(`
        SELECT p.id, p.name, p.price, i.quantity AS stock
        FROM products p JOIN inventory i ON i.product_id = p.id
        WHERE p.id = ? AND i.branch_id = ? AND p.active = 1
      `).get(Number(item.productId), branchId);
      const quantity = Number(item.quantity);
      if (!product || !Number.isInteger(quantity) || quantity < 1) throw Object.assign(new Error("Revisa los productos y cantidades de la venta."), { status: 400 });
      if (product.stock < quantity) throw Object.assign(new Error(`Existencias insuficientes de ${product.name}; disponibles: ${product.stock}.`), { status: 409 });
      subtotal += product.price * quantity;
      return { ...product, quantity };
    });
    let discountRule = null;
    if (customer) {
      const annualSpend = db.prepare(`
        SELECT COALESCE(SUM(total), 0) AS total FROM sales
        WHERE customer_id = ? AND status = 'completed' AND created_at >= datetime('now', '-1 year')
      `).get(customer.id).total;
      const getDiscount = db.prepare("SELECT id, percentage FROM discounts WHERE code = ? AND active = 1");
      if (annualSpend > 20000) discountRule = getDiscount.get("annual_spend") || null;
      else if (customer.is_member) discountRule = getDiscount.get("membership") || null;
    }
    const discountRate = discountRule ? discountRule.percentage / 100 : 0;
    const discount = Math.round(subtotal * discountRate * 100) / 100;
    const total = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
    const sale = db.prepare(`
      INSERT INTO sales (branch_id, user_id, customer_id, discount_id, subtotal, discount, total, payment_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(branchId, req.user.id, customer?.id || null, discountRule?.id || null, subtotal, discount, total, paymentMethod);
    db.prepare("INSERT INTO payments (sale_id, amount, payment_method) VALUES (?, ?, ?)").run(sale.lastInsertRowid, total, paymentMethod);
    const insertItem = db.prepare("INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)");
    for (const item of normalizedItems) {
      insertItem.run(sale.lastInsertRowid, item.id, item.quantity, item.price, item.price * item.quantity);
      db.prepare("UPDATE inventory SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND branch_id = ?").run(item.quantity, item.id, branchId);
      db.prepare("INSERT INTO inventory_movements (product_id, branch_id, user_id, type, quantity, note) VALUES (?, ?, ?, 'sale', ?, ?)").run(item.id, branchId, req.user.id, -item.quantity, `Venta #${sale.lastInsertRowid}`);
    }
    return {
      id: sale.lastInsertRowid, subtotal, discount, discountRate, total, paymentMethod,
      items: normalizedItems.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity, price: item.price })),
      customer: customer?.full_name || null, seller: req.user.name, createdAt: new Date().toISOString(),
    };
  });
  res.status(201).json(checkout());
});
app.post("/api/sales/:id/cancel", auth(), (req, res) => {
  if (!["admin", "cashier"].includes(req.user.role)) return res.status(403).json({ error: "Tu perfil no puede cancelar ventas." });
  const saleId = Number(req.params.id);
  const reason = String(req.body?.reason || "").trim();
  if (!Number.isInteger(saleId) || saleId < 1 || reason.length < 3) return res.status(400).json({ error: "Indica un motivo válido para cancelar la venta." });
  const cancelSale = db.transaction(() => {
    const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(saleId);
    if (!sale || sale.status !== "completed") throw Object.assign(new Error("La venta no existe o ya fue cancelada."), { status: 404 });
    if (req.user.role !== "admin" && sale.branch_id !== req.user.branchId) throw Object.assign(new Error("Solo puedes cancelar ventas de tu sucursal."), { status: 403 });
    const hasReturns = db.prepare("SELECT 1 AS found FROM returns WHERE sale_id = ? LIMIT 1").get(saleId);
    if (hasReturns) throw Object.assign(new Error("No se puede cancelar una venta que ya tiene devoluciones registradas."), { status: 400 });
    const items = db.prepare("SELECT product_id, quantity FROM sale_items WHERE sale_id = ?").all(saleId);
    for (const item of items) {
      db.prepare("UPDATE inventory SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND branch_id = ?").run(item.quantity, item.product_id, sale.branch_id);
      db.prepare("INSERT INTO inventory_movements (product_id, branch_id, user_id, type, quantity, note) VALUES (?, ?, ?, 'adjustment', ?, ?)").run(item.product_id, sale.branch_id, req.user.id, item.quantity, `Cancelación venta #${saleId}: ${reason}`);
    }
    db.prepare("UPDATE sales SET status = 'cancelled' WHERE id = ?").run(saleId);
    db.prepare("UPDATE payments SET status = 'cancelled' WHERE sale_id = ? AND status = 'completed'").run(saleId);
    return { ok: true };
  });
  res.json(cancelSale());
});

app.post("/api/returns", auth(), requireAdmin, (req, res) => {
  const saleId = Number(req.body?.saleId);
  const productId = Number(req.body?.productId);
  const quantity = Number(req.body?.quantity);
  const reason = String(req.body?.reason || "").trim();
  const tagsIntact = req.body?.tagsIntact === true;
  const unused = req.body?.unused === true;
  const processReturn = db.transaction(() => {
    const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(saleId);
    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
    const sold = db.prepare("SELECT quantity, unit_price FROM sale_items WHERE sale_id = ? AND product_id = ?").get(saleId, productId);
    if (!sale || sale.status !== "completed" || !product || !sold || !Number.isInteger(quantity) || quantity < 1 || !reason) throw Object.assign(new Error("Venta, producto, cantidad o motivo de devolución no válidos."), { status: 400 });
    const elapsed = Date.now() - new Date(`${sale.created_at.replace(" ", "T")}Z`).getTime();
    if (elapsed > 15 * 24 * 60 * 60 * 1000 || elapsed < 0) throw Object.assign(new Error("No se aceptan cambios o devoluciones después de 15 días."), { status: 400 });
    if (product.lingerie) throw Object.assign(new Error("No se aceptan cambios o devoluciones de prendas de lencería."), { status: 400 });
    if (!tagsIntact || !unused) throw Object.assign(new Error("La prenda debe conservar sus etiquetas originales y no haber sido usada."), { status: 400 });
    const returnedSoFar = db.prepare("SELECT COALESCE(SUM(quantity), 0) AS quantity FROM returns WHERE sale_id = ? AND product_id = ?").get(saleId, productId).quantity;
    if (returnedSoFar + quantity > sold.quantity) throw Object.assign(new Error("La cantidad supera las piezas disponibles para devolución."), { status: 400 });
    const amount = sale.subtotal > 0
      ? Math.round(sold.unit_price * quantity * (sale.total / sale.subtotal) * 100) / 100
      : 0;
    db.prepare("INSERT INTO returns (sale_id, product_id, branch_id, user_id, quantity, amount, reason) VALUES (?, ?, ?, ?, ?, ?, ?)").run(saleId, productId, sale.branch_id, req.user.id, quantity, amount, reason);
    const refundedAmount = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM returns WHERE sale_id = ?").get(saleId).total;
    if (refundedAmount >= sale.total) db.prepare("UPDATE payments SET status = 'refunded' WHERE sale_id = ?").run(saleId);
    db.prepare("UPDATE inventory SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND branch_id = ?").run(quantity, productId, sale.branch_id);
    db.prepare("INSERT INTO inventory_movements (product_id, branch_id, user_id, type, quantity, note) VALUES (?, ?, ?, 'return', ?, ?)").run(productId, sale.branch_id, req.user.id, quantity, `Devolución venta #${saleId}`);
    return { ok: true };
  });
  res.json(processReturn());
});

app.get("/api/reports", requireRole("admin", "cashier"), (req, res) => {
  const branchId = Number(req.query.branchId || req.user.branchId || 1);
  if (!Number.isInteger(branchId) || branchId < 1) return res.status(400).json({ error: "Selecciona una sucursal válida." });
  if (req.user.role !== "admin" && branchId !== req.user.branchId) return res.status(403).json({ error: "Solo puedes consultar los reportes de tu sucursal." });
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || "")) ? req.query.month : new Date().toISOString().slice(0, 7);
  const daily = db.prepare(`
    SELECT date(created_at) AS date, COUNT(*) AS sales, SUM(total) AS total,
      SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END) AS cash,
      SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END) AS card,
      SUM(CASE WHEN payment_method = 'transfer' THEN total ELSE 0 END) AS transfer
    FROM sales WHERE branch_id = ? AND status = 'completed' AND strftime('%Y-%m', created_at) = ?
    GROUP BY date(created_at) ORDER BY date DESC
  `).all(branchId, month);
  const refunds = db.prepare(`
    SELECT date(created_at) AS date, COUNT(*) AS count, SUM(amount) AS total
    FROM returns WHERE branch_id = ? AND strftime('%Y-%m', created_at) = ?
    GROUP BY date(created_at) ORDER BY date DESC
  `).all(branchId, month);
  const cancellations = db.prepare(`
    SELECT date(created_at) AS date, COUNT(*) AS count, SUM(total) AS total
    FROM sales WHERE branch_id = ? AND status = 'cancelled' AND strftime('%Y-%m', created_at) = ?
    GROUP BY date(created_at) ORDER BY date DESC
  `).all(branchId, month);
  const sellers = db.prepare(`
    SELECT TRIM(u.name || ' ' || u.surname) AS name, COUNT(s.id) AS sales, COALESCE(SUM(s.total), 0) AS total
    FROM users u LEFT JOIN sales s ON s.user_id = u.id AND s.branch_id = ?
      AND s.status = 'completed' AND strftime('%Y-%m', s.created_at) = ?
    GROUP BY u.id ORDER BY total DESC
  `).all(branchId, month);
  const inventory = db.prepare(`
    SELECT p.name, p.category, p.size, p.color, i.quantity, p.stock_min AS stockMin
    FROM products p JOIN inventory i ON i.product_id = p.id WHERE i.branch_id = ? AND p.active = 1
    ORDER BY p.name
  `).all(branchId);
  res.json({ month, daily, refunds, cancellations, sellers, inventory, users: db.prepare("SELECT COUNT(*) AS count FROM users WHERE active = 1").get().count });
});

app.get("/api/users", auth(), requireAdmin, (_req, res) => {
  res.json(db.prepare(`
    SELECT u.id, TRIM(u.name || ' ' || u.surname) AS name, u.surname, u.email,
      u.username, u.role, u.active, b.name AS branch
    FROM users u LEFT JOIN branches b ON b.id = u.branch_id ORDER BY u.id
  `).all());
});
app.post("/api/users", auth(), requireAdmin, (req, res) => {
  const { name, surname = "", email = "", username, password, role, branchId } = req.body || {};
  if (!String(name || "").trim() || !/^[a-zA-Z0-9._-]{3,30}$/.test(String(username || ""))) {
    return res.status(400).json({ error: "Indica un nombre y un usuario de 3 a 30 caracteres (letras, números, punto, guion o guion bajo)." });
  }
  if (String(password || "").length < 10) return res.status(400).json({ error: "La contraseña debe tener al menos 10 caracteres." });
  if (!["admin", "cashier", "seller"].includes(role)) return res.status(400).json({ error: "Selecciona un rol válido." });
  const branch = db.prepare("SELECT id FROM branches WHERE id = ? AND active = 1").get(Number(branchId));
  if (!branch) return res.status(400).json({ error: "Selecciona una sucursal válida." });
  const credentials = passwordRecord(password);
  try {
    const result = db.prepare(`
      INSERT INTO users (name, surname, email, username, password_salt, password_hash, role, branch_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(String(name).trim(), String(surname).trim(), String(email).trim(), username, credentials.salt, credentials.hash, role, branch.id);
    res.status(201).json(db.prepare(`
      SELECT u.id, TRIM(u.name || ' ' || u.surname) AS name, u.surname, u.email,
        u.username, u.role, u.active, b.name AS branch
      FROM users u LEFT JOIN branches b ON b.id = u.branch_id WHERE u.id = ?
    `).get(result.lastInsertRowid));
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "Ese nombre de usuario ya está registrado." });
    throw error;
  }
});
app.post("/api/users/:id/status", auth(), requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  const { active } = req.body || {};
  if (!Number.isInteger(userId) || userId < 1 || typeof active !== "boolean") {
    return res.status(400).json({ error: "Indica una cuenta y un estado válido." });
  }
  if (userId === req.user.id && !active) {
    return res.status(400).json({ error: "No puedes desactivar la cuenta con la que iniciaste sesión." });
  }
  const target = db.prepare("SELECT id, role, active FROM users WHERE id = ?").get(userId);
  if (!target) return res.status(404).json({ error: "No se encontró esa cuenta." });
  if (!active && target.role === "admin" && target.active) {
    const activeAdmins = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND active = 1").get().count;
    if (activeAdmins <= 1) return res.status(409).json({ error: "No puedes desactivar la última cuenta de administración activa." });
  }
  db.prepare("UPDATE users SET active = ? WHERE id = ?").run(active ? 1 : 0, userId);
  res.json({ ok: true, active });
});

app.post("/api/password", auth(), (req, res) => {
  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");
  if (newPassword.length < 10) return res.status(400).json({ error: "La nueva contraseña debe tener al menos 10 caracteres." });
  const user = db.prepare("SELECT password_salt, password_hash FROM users WHERE id = ?").get(req.user.id);
  const currentHash = scryptSync(currentPassword, user.password_salt, 64);
  const storedHash = Buffer.from(user.password_hash, "hex");
  if (currentHash.length !== storedHash.length || !timingSafeEqual(currentHash, storedHash)) return res.status(401).json({ error: "La contraseña actual no es correcta." });
  const credentials = passwordRecord(newPassword);
  db.prepare("UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?").run(credentials.salt, credentials.hash, req.user.id);
  res.json({ ok: true });
});

app.use("/api", (_req, res) => res.status(404).json({ error: "No se encontró la operación solicitada." }));
app.use((error, _req, res, _next) => {
  if (error.status) return res.status(error.status).json({ error: error.message });
  if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "El registro ya existe." });
  console.error(error);
  res.status(500).json({ error: "Ocurrió un error al guardar los datos. Intenta de nuevo." });
});

const webDirectory = path.resolve(here, "..", "dist");
if (existsSync(webDirectory)) {
  app.use(express.static(webDirectory));
  app.get("*splat", (_req, res) => res.sendFile(path.join(webDirectory, "index.html")));
}

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Bella Boutique API lista en http://localhost:${port}`));
