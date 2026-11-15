import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = path.resolve(process.env.DB_PATH || path.join(root, "data", "bella-boutique.db"));
const primaryAdminUsername = "admin";
mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
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
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    address TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'cashier', 'seller')),
    branch_id INTEGER REFERENCES branches(id),
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    member_number TEXT NOT NULL UNIQUE,
    is_member INTEGER NOT NULL DEFAULT 0,
    privacy_accepted INTEGER NOT NULL DEFAULT 0,
    promo_consent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    distributor TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
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
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    branch_id INTEGER NOT NULL REFERENCES branches(id),
    user_id INTEGER REFERENCES users(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    type TEXT NOT NULL CHECK (type IN ('entry', 'sale', 'return', 'adjustment')),
    quantity INTEGER NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    customer_id INTEGER REFERENCES customers(id),
    subtotal REAL NOT NULL,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer')),
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY,
    sale_id INTEGER NOT NULL REFERENCES sales(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price REAL NOT NULL,
    subtotal REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS returns (
    id INTEGER PRIMARY KEY,
    sale_id INTEGER NOT NULL REFERENCES sales(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    branch_id INTEGER NOT NULL REFERENCES branches(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    quantity INTEGER NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS cash_sessions (
    id INTEGER PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    opening_cash REAL NOT NULL CHECK (opening_cash >= 0),
    closing_cash REAL,
    expected_cash REAL,
    opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS one_open_cash_session_per_branch
    ON cash_sessions(branch_id) WHERE closed_at IS NULL;
  CREATE TABLE IF NOT EXISTS cash_movements (
    id INTEGER PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES cash_sessions(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount REAL NOT NULL CHECK (amount > 0),
    note TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS exchanges (
    id INTEGER PRIMARY KEY,
    original_sale_id INTEGER NOT NULL REFERENCES sales(id),
    replacement_sale_id INTEGER NOT NULL REFERENCES sales(id),
    returned_product_id INTEGER NOT NULL REFERENCES products(id),
    replacement_product_id INTEGER NOT NULL REFERENCES products(id),
    returned_quantity INTEGER NOT NULL,
    replacement_quantity INTEGER NOT NULL,
    credit_amount REAL NOT NULL,
    replacement_amount REAL NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'transfer')),
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn("customers", "membership_number", "TEXT NOT NULL DEFAULT ''");
ensureColumn("suppliers", "supplier_number", "TEXT NOT NULL DEFAULT ''");
ensureColumn("sales", "cancelled_at", "TEXT");
ensureColumn("sales", "cancellation_reason", "TEXT");
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS customers_membership_number
    ON customers(membership_number) WHERE membership_number != '';
  CREATE UNIQUE INDEX IF NOT EXISTS suppliers_supplier_number
    ON suppliers(supplier_number) WHERE supplier_number != '';
`);

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(password, salt, 64).toString("hex") };
}

const seed = db.transaction(() => {
  const addBranch = db.prepare("INSERT OR IGNORE INTO branches (id, name, address) VALUES (?, ?, ?)");
  addBranch.run(1, "Bella Boutique · Centro", "Sucursal Centro");
  addBranch.run(2, "Bella Boutique · Norte", "Sucursal Norte");

  const addUser = db.prepare("INSERT OR IGNORE INTO users (name, username, salt, password_hash, role, branch_id) VALUES (?, ?, ?, ?, ?, ?)");
  for (const [name, username, password, role, branchId] of [
    ["Administración", "admin", "Bella2026!", "admin", 1],
    ["Caja Centro", "caja", "Bella2026!", "cashier", 1],
    ["Ventas Norte", "ventas", "Bella2026!", "seller", 2],
    ["Ventas Centro", "ventas-centro", "Bella2026!", "seller", 1],
    ["Caja Norte", "caja-norte", "Bella2026!", "cashier", 2],
    ["Ventas Norte 2", "ventas-norte2", "Bella2026!", "seller", 2],
  ]) {
    const credentials = hashPassword(password);
    addUser.run(name, username, credentials.salt, credentials.hash, role, branchId);
  }

  const addProduct = db.prepare(`
    INSERT OR IGNORE INTO products (name, brand, category, barcode, size, color, cost, price, stock_min, lingerie)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const product of [
    ["Vestido Aurora", "Bella Studio", "Vestidos", "7501000000011", "M", "Rosa palo", 680, 1490, 5, 0],
    ["Blazer Siena", "Bella Studio", "Sacos", "7501000000012", "S", "Marfil", 890, 1890, 5, 0],
    ["Blusa Camille", "Maison Femme", "Blusas", "7501000000013", "L", "Champagne", 420, 950, 5, 0],
    ["Pantalón Olivia", "Bella Studio", "Pantalones", "7501000000014", "M", "Negro", 610, 1290, 5, 0],
    ["Falda Celeste", "Lumière", "Faldas", "7501000000015", "S", "Lavanda", 530, 1150, 5, 0],
    ["Top Amélie", "Maison Femme", "Blusas", "7501000000016", "M", "Rosa palo", 340, 790, 5, 0],
    ["Vestido Noa", "Lumière", "Vestidos", "7501000000017", "L", "Verde salvia", 760, 1690, 5, 0],
    ["Conjunto Lingerie", "Maison Femme", "Lencería", "7501000000018", "M", "Vino", 390, 890, 5, 1],
  ]) addProduct.run(...product);

  const addStock = db.prepare("INSERT OR IGNORE INTO inventory (product_id, branch_id, quantity) VALUES (?, ?, ?)");
  for (const product of db.prepare("SELECT id, barcode FROM products").all()) {
    addStock.run(product.id, 1, product.barcode.endsWith("11") ? 3 : 12);
    addStock.run(product.id, 2, product.barcode.endsWith("14") ? 2 : 8);
  }
  const addCustomer = db.prepare(`
    INSERT OR IGNORE INTO customers (name, phone, email, member_number, is_member, privacy_accepted, promo_consent)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `);
  addCustomer.run("Mariana López", "722 555 0142", "mariana@example.com", "BB-10021", 1, 1);
  addCustomer.run("Sofía Ramírez", "722 555 0188", "sofia@example.com", "BB-10022", 0, 0);
  db.prepare("INSERT OR IGNORE INTO suppliers (id, name, distributor, phone, email, address) VALUES (1, ?, ?, ?, ?, ?)")
    .run("Moda & Estilo", "Distribuidora Moda", "722 555 0110", "pedidos@modaestilo.mx", "Toluca, Estado de México");
  db.prepare("UPDATE suppliers SET supplier_number = 'PROV-' || printf('%05d', id) WHERE supplier_number = ''").run();
  db.prepare("UPDATE customers SET membership_number = 'MEM-' || printf('%05d', id) WHERE is_member = 1 AND membership_number = ''").run();
});
seed();

function createDailyBackup() {
  const directory = path.join(path.dirname(dbPath), "backups");
  const filename = `${new Date().toISOString().slice(0, 10)}.sqlite`;
  const backupPath = path.join(directory, filename);
  if (existsSync(backupPath)) return;
  try {
    mkdirSync(directory, { recursive: true });
    db.exec("PRAGMA wal_checkpoint(PASSIVE)");
    db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
    console.log(`Respaldo SQLite creado: ${backupPath}`);
  } catch (error) {
    console.error("No se pudo crear el respaldo diario de SQLite:", error);
  }
}

createDailyBackup();
const backupTimer = setInterval(createDailyBackup, 60 * 60 * 1000);
backupTimer.unref();

const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
const cookieName = "bella_session";
const roleName = { admin: "Administración", cashier: "Cajero", seller: "Vendedor" };
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function response(res, status, value, headers = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(value));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 100_000) {
        reject(new HttpError(413, "La solicitud es demasiado grande."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new HttpError(400, "El contenido de la solicitud no es válido."));
      }
    });
    req.on("error", reject);
  });
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", sessionSecret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function authenticate(req, optional = false) {
  const token = req.headers.cookie?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!token) {
    if (optional) return null;
    throw new HttpError(401, "Inicia sesión para continuar.");
  }
  const [body, signature] = token.split(".");
  if (!body || !signature) throw new HttpError(401, "Sesión no válida.");
  const expected = createHmac("sha256", sessionSecret).update(body).digest("base64url");
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new HttpError(401, "Sesión no válida.");
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    throw new HttpError(401, "Sesión no válida.");
  }
  if (!Number.isFinite(payload.exp) || payload.exp < Date.now()) throw new HttpError(401, "Tu sesión expiró. Inicia sesión de nuevo.");
  const user = db.prepare("SELECT id, name, username, role, branch_id AS branchId FROM users WHERE id = ? AND active = 1").get(payload.id);
  if (!user) throw new HttpError(401, "La cuenta ya no está activa.");
  return user;
}

function requireRole(user, roles) {
  if (!roles.includes(user.role)) throw new HttpError(403, "Tu perfil no tiene permiso para esta acción.");
}

function isPrimaryAdmin(user) {
  return user.username === primaryAdminUsername;
}

function isUniqueConstraint(error) {
  return error.code === "SQLITE_CONSTRAINT_UNIQUE" || error.errcode === 2067;
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new HttpError(400, `${label} debe ser un entero positivo.`);
  return number;
}

function validBranch(value) {
  const id = positiveInteger(value, "La sucursal");
  if (!db.prepare("SELECT id FROM branches WHERE id = ? AND active = 1").get(id)) throw new HttpError(400, "Selecciona una sucursal válida.");
  return id;
}

function productsFor(branchId, search = "", includeCost = false) {
  const term = `%${search.trim()}%`;
  const rows = db.prepare(`
    SELECT p.id, p.name, p.brand, p.category, p.barcode, p.size, p.color,
      p.cost, p.price, p.stock_min AS stockMin, p.lingerie,
      COALESCE((SELECT quantity FROM inventory WHERE product_id = p.id AND branch_id = ?), 0) AS stock,
      COALESCE((SELECT SUM(quantity) FROM inventory WHERE product_id = p.id), 0) AS totalStock
    FROM products p
    WHERE p.active = 1 AND (p.name LIKE ? OR p.brand LIKE ? OR p.category LIKE ? OR
      p.barcode LIKE ? OR p.size LIKE ? OR p.color LIKE ?)
    ORDER BY p.name
  `).all(branchId, term, term, term, term, term, term);
  return includeCost ? rows : rows.map(({ cost, ...product }) => product);
}

function publicCatalog(search = "") {
  const branches = db.prepare("SELECT id, name FROM branches WHERE active = 1 ORDER BY id").all();
  const firstBranchId = branches[0]?.id || 1;
  const products = productsFor(firstBranchId, search).map(({ id, name, brand, category, size, color, price }) => {
    const stockByBranch = db.prepare(`
      SELECT b.id AS branchId, COALESCE(i.quantity, 0) AS quantity
      FROM branches b LEFT JOIN inventory i ON i.branch_id = b.id AND i.product_id = ?
      WHERE b.active = 1 ORDER BY b.id
    `).all(id);
    return { id, name, brand, category, size, color, price, stockByBranch };
  });
  return { branches, products };
}

function cashSummary(sessionId) {
  const session = db.prepare(`
    SELECT cs.id, cs.branch_id AS branchId, cs.user_id AS userId, cs.opening_cash AS openingCash,
      cs.opened_at AS openedAt, u.name AS openedBy
    FROM cash_sessions cs JOIN users u ON u.id = cs.user_id
    WHERE cs.id = ? AND cs.closed_at IS NULL
  `).get(sessionId);
  if (!session) return null;
  const sales = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) AS cash,
      COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END), 0) AS card,
      COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN total ELSE 0 END), 0) AS transfer
    FROM sales
    WHERE branch_id = ? AND status = 'completed' AND created_at >= ?
  `).get(session.branchId, session.openedAt);
  const refunds = db.prepare(`
    SELECT COALESCE(SUM(r.amount), 0) AS total FROM returns r
    JOIN sales s ON s.id = r.sale_id
    WHERE r.branch_id = ? AND s.payment_method = 'cash' AND r.created_at >= ?
  `).get(session.branchId, session.openedAt).total;
  const movements = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
    FROM cash_movements WHERE session_id = ?
  `).get(session.id);
  const cancelled = db.prepare(`
    SELECT COALESCE(SUM(total), 0) AS total FROM sales
    WHERE branch_id = ? AND status = 'cancelled' AND cancelled_at >= ?
  `).get(session.branchId, session.openedAt).total;
  const expectedCash = Math.round((session.openingCash + sales.cash + movements.income - movements.expense - refunds) * 100) / 100;
  return { ...session, sales, refunds, cancelled, movements, expectedCash };
}

function dashboard(branchId) {
  const today = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total FROM sales
    WHERE branch_id = ? AND status = 'completed' AND date(created_at) = date('now')
  `).get(branchId);
  const month = db.prepare(`
    SELECT COALESCE(SUM(total), 0) AS total FROM sales
    WHERE branch_id = ? AND status = 'completed' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
  `).get(branchId).total;
  const inventory = db.prepare(`
    SELECT COUNT(DISTINCT p.id) AS products, COALESCE(SUM(i.quantity), 0) AS units,
      SUM(CASE WHEN i.quantity < p.stock_min THEN 1 ELSE 0 END) AS lowStock
    FROM products p JOIN inventory i ON i.product_id = p.id
    WHERE i.branch_id = ? AND p.active = 1
  `).get(branchId);
  const recent = db.prepare(`
    SELECT s.id, s.total, s.payment_method AS paymentMethod, s.created_at AS createdAt,
      c.name AS customer, u.name AS seller
    FROM sales s LEFT JOIN customers c ON c.id = s.customer_id JOIN users u ON u.id = s.user_id
    WHERE s.branch_id = ? ORDER BY s.id DESC LIMIT 5
  `).all(branchId);
  const lowStock = db.prepare(`
    SELECT p.id, p.name, p.size, p.color, i.quantity, p.stock_min AS stockMin
    FROM inventory i JOIN products p ON p.id = i.product_id
    WHERE i.branch_id = ? AND i.quantity < p.stock_min AND p.active = 1
    ORDER BY i.quantity ASC LIMIT 6
  `).all(branchId);
  return { today, month, inventory, recent, lowStock };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;
  try {
    if (pathname.startsWith("/api/")) {
      const body = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method || "") ? await readBody(req) : {};
      if (req.method === "GET" && pathname === "/api/health") return response(res, 200, { status: "ok", database: "sqlite" });
      if (req.method === "GET" && pathname === "/api/branches") {
        return response(res, 200, db.prepare("SELECT id, name, address FROM branches WHERE active = 1 ORDER BY id").all());
      }
      if (req.method === "GET" && pathname === "/api/catalog") {
        return response(res, 200, publicCatalog(url.searchParams.get("search") || ""));
      }
      if (req.method === "POST" && pathname === "/api/login") {
        const username = String(body.username || "").trim();
        const password = String(body.password || "");
        const user = db.prepare("SELECT * FROM users WHERE username = ? AND active = 1").get(username);
        if (!user) throw new HttpError(401, "Usuario o contraseña incorrectos.");
        const hash = scryptSync(password, user.salt, 64);
        const saved = Buffer.from(user.password_hash, "hex");
        if (hash.length !== saved.length || !timingSafeEqual(hash, saved)) throw new HttpError(401, "Usuario o contraseña incorrectos.");
        const cookie = `${cookieName}=${sign({ id: user.id, exp: Date.now() + 8 * 60 * 60 * 1000 })}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
        return response(res, 200, { user: { id: user.id, name: user.name, username: user.username, role: user.role, branchId: user.branch_id } }, { "set-cookie": cookie });
      }
      if (req.method === "GET" && pathname === "/api/me") {
        const user = authenticate(req, true);
        return response(res, 200, { user });
      }
      if (req.method === "POST" && pathname === "/api/logout") {
        authenticate(req);
        return response(res, 200, { ok: true }, { "set-cookie": `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0` });
      }

      const user = authenticate(req);
      if (req.method === "GET" && pathname === "/api/dashboard") {
        const branchId = validBranch(url.searchParams.get("branchId") || user.branchId);
        if (user.role !== "admin" && branchId !== user.branchId) throw new HttpError(403, "Solo puedes consultar tu sucursal.");
        return response(res, 200, dashboard(branchId));
      }
      if (req.method === "GET" && pathname === "/api/products") {
        const branchId = validBranch(url.searchParams.get("branchId") || user.branchId);
        if (user.role !== "admin" && branchId !== user.branchId) throw new HttpError(403, "Solo puedes consultar el inventario de tu sucursal; el catálogo muestra la disponibilidad de ambas.");
        return response(res, 200, productsFor(branchId, url.searchParams.get("search") || "", user.role === "admin"));
      }
      if (req.method === "POST" && pathname === "/api/products") {
        requireRole(user, ["admin"]);
        const name = String(body.name || "").trim();
        const category = String(body.category || "").trim();
        const barcode = String(body.barcode || "").trim();
        const price = Number(body.price);
        const cost = Number(body.cost || 0);
        const stock = Number(body.stock || 0);
        const stockMin = Number(body.stockMin ?? 5);
        const branchId = validBranch(body.branchId || user.branchId);
        if (!name || !category || !barcode || !Number.isFinite(price) || price < 0 ||
          !Number.isFinite(cost) || cost < 0 || !Number.isInteger(stock) || stock < 0 ||
          !Number.isInteger(stockMin) || stockMin < 0) {
          throw new HttpError(400, "Completa nombre, categoría, código, precio y existencias válidas.");
        }
        try {
          const add = db.transaction(() => {
            const result = db.prepare(`
              INSERT INTO products (name, brand, category, barcode, size, color, cost, price, stock_min, lingerie)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(name, String(body.brand || "").trim(), category, barcode, body.size || "Unitalla",
              body.color || "Marfil", cost, price, stockMin, category === "Lencería" ? 1 : 0);
            for (const branch of db.prepare("SELECT id FROM branches WHERE active = 1").all()) {
              const quantity = branch.id === branchId ? stock : 0;
              db.prepare("INSERT INTO inventory (product_id, branch_id, quantity) VALUES (?, ?, ?)").run(result.lastInsertRowid, branch.id, quantity);
            }
            if (stock > 0) db.prepare(`
              INSERT INTO inventory_movements (product_id, branch_id, user_id, type, quantity, note)
              VALUES (?, ?, ?, 'entry', ?, 'Existencia inicial')
            `).run(result.lastInsertRowid, branchId, user.id, stock);
            return result.lastInsertRowid;
          });
          return response(res, 201, { id: add() });
        } catch (error) {
          if (isUniqueConstraint(error)) throw new HttpError(409, "Ya existe ese código de barras.");
          throw error;
        }
      }
      const productUpdate = pathname.match(/^\/api\/products\/(\d+)$/);
      if (req.method === "PUT" && productUpdate) {
        requireRole(user, ["admin"]);
        const productId = positiveInteger(productUpdate[1], "El producto");
        const name = String(body.name || "").trim();
        const brand = String(body.brand || "").trim();
        const category = String(body.category || "").trim();
        const barcode = String(body.barcode || "").trim();
        const size = String(body.size || "").trim();
        const color = String(body.color || "").trim();
        const price = Number(body.price);
        const cost = Number(body.cost);
        const stockMin = Number(body.stockMin);
        if (!name || !category || !barcode || !size || !color || !Number.isFinite(price) || price < 0 ||
          !Number.isFinite(cost) || cost < 0 || !Number.isInteger(stockMin) || stockMin < 0) {
          throw new HttpError(400, "Completa los datos del producto y sus valores válidos.");
        }
        try {
          const result = db.prepare(`
            UPDATE products SET name = ?, brand = ?, category = ?, barcode = ?, size = ?, color = ?,
              cost = ?, price = ?, stock_min = ?, lingerie = ? WHERE id = ? AND active = 1
          `).run(name, brand, category, barcode, size, color, cost, price, stockMin, category === "Lencería" ? 1 : 0, productId);
          if (!result.changes) throw new HttpError(404, "No se encontró el producto.");
          return response(res, 200, { ok: true });
        } catch (error) {
          if (isUniqueConstraint(error)) throw new HttpError(409, "Ya existe ese código de barras.");
          throw error;
        }
      }
      const productArchive = pathname.match(/^\/api\/products\/(\d+)$/);
      if (req.method === "DELETE" && productArchive) {
        requireRole(user, ["admin"]);
        const result = db.prepare("UPDATE products SET active = 0 WHERE id = ? AND active = 1").run(Number(productArchive[1]));
        if (!result.changes) throw new HttpError(404, "No se encontró el producto.");
        return response(res, 200, { ok: true });
      }
      if (req.method === "POST" && pathname === "/api/inventory/movements") {
        requireRole(user, ["admin"]);
        const productId = positiveInteger(body.productId, "El producto");
        const branchId = validBranch(body.branchId || user.branchId);
        if (!["entry", "adjustment"].includes(body.type)) throw new HttpError(400, "Tipo de movimiento inválido.");
        const quantity = Number(body.quantity);
        if (!Number.isInteger(quantity) || quantity < 0 || (body.type === "entry" && quantity === 0)) {
          throw new HttpError(400, body.type === "entry" ? "La cantidad de entrada debe ser positiva." : "La existencia final debe ser un entero no negativo.");
        }
        const supplierId = body.supplierId ? positiveInteger(body.supplierId, "El proveedor") : null;
        const result = db.transaction(() => {
          const stock = db.prepare("SELECT quantity FROM inventory WHERE product_id = ? AND branch_id = ?").get(productId, branchId);
          if (!stock) throw new HttpError(404, "No se encontró el producto en esta sucursal.");
          if (supplierId && !db.prepare("SELECT id FROM suppliers WHERE id = ?").get(supplierId)) throw new HttpError(400, "No se encontró ese proveedor.");
          const next = body.type === "entry" ? stock.quantity + quantity : quantity;
          db.prepare("UPDATE inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND branch_id = ?").run(next, productId, branchId);
          db.prepare(`
            INSERT INTO inventory_movements (product_id, branch_id, user_id, supplier_id, type, quantity, note)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(productId, branchId, user.id, supplierId, body.type, body.type === "entry" ? quantity : next - stock.quantity, String(body.note || ""));
          return next;
        });
        return response(res, 200, { quantity: result() });
      }
      if (req.method === "GET" && pathname === "/api/customers") {
        requireRole(user, ["admin", "cashier", "seller"]);
        const term = `%${(url.searchParams.get("search") || "").trim()}%`;
        const searchFields = user.role === "seller"
          ? "c.name LIKE ? OR c.member_number LIKE ? OR c.membership_number LIKE ?"
          : "c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.member_number LIKE ? OR c.membership_number LIKE ?";
        const query = `
          SELECT c.id, c.name, c.phone, c.email, c.member_number AS memberNumber,
            c.membership_number AS membershipNumber,
            c.is_member AS isMember, c.privacy_accepted AS privacyAccepted,
            c.promo_consent AS promoConsent,
            COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.total ELSE 0 END), 0) AS lifetimeSpend,
            COALESCE((SELECT SUM(s2.total) FROM sales s2 WHERE s2.customer_id = c.id
              AND s2.status = 'completed' AND s2.created_at >= datetime('now', '-1 year')), 0) AS annualSpend
          FROM customers c LEFT JOIN sales s ON s.customer_id = c.id
          WHERE ${searchFields}
          GROUP BY c.id ORDER BY c.name
        `;
        const rows = db.prepare(query).all(...Array(user.role === "seller" ? 3 : 5).fill(term));
        if (user.role === "seller") {
          return response(res, 200, rows.map(({ id, name, memberNumber, membershipNumber, isMember, annualSpend }) => ({
            id, name, memberNumber, membershipNumber, isMember, annualSpend,
          })));
        }
        return response(res, 200, rows);
      }
      if (req.method === "POST" && pathname === "/api/customers") {
        requireRole(user, ["admin", "cashier"]);
        if (!String(body.name || "").trim() || body.privacyAccepted !== true) throw new HttpError(400, "El nombre y la aceptación del aviso de privacidad son obligatorios.");
        const addCustomer = db.transaction(() => {
          const result = db.prepare(`
            INSERT INTO customers (name, phone, email, member_number, membership_number, is_member, privacy_accepted, promo_consent)
            VALUES (?, ?, ?, '', '', ?, 1, ?)
          `).run(String(body.name).trim(), String(body.phone || "").trim(), String(body.email || "").trim(),
            body.isMember ? 1 : 0, body.promoConsent ? 1 : 0);
          const id = Number(result.lastInsertRowid);
          const memberNumber = `BB-${String(id).padStart(6, "0")}`;
          const membershipNumber = body.isMember ? `MEM-${String(id).padStart(6, "0")}` : "";
          db.prepare("UPDATE customers SET member_number = ?, membership_number = ? WHERE id = ?")
            .run(memberNumber, membershipNumber, id);
          return { id, memberNumber, membershipNumber };
        });
        return response(res, 201, addCustomer());
      }
      if (req.method === "GET" && pathname === "/api/suppliers") {
        requireRole(user, ["admin"]);
        return response(res, 200, db.prepare(`
          SELECT s.*, COALESCE(SUM(CASE WHEN m.type = 'entry' THEN m.quantity ELSE 0 END), 0) AS suppliedUnits,
            MAX(CASE WHEN m.type = 'entry' THEN date(m.created_at) END) AS lastSupplyDate
          FROM suppliers s LEFT JOIN inventory_movements m ON m.supplier_id = s.id
          GROUP BY s.id ORDER BY s.name
        `).all());
      }
      if (req.method === "POST" && pathname === "/api/suppliers") {
        requireRole(user, ["admin"]);
        const name = String(body.name || "").trim();
        if (!name) throw new HttpError(400, "El nombre del proveedor es obligatorio.");
        const addSupplier = db.transaction(() => {
          const result = db.prepare(`
            INSERT INTO suppliers (name, distributor, phone, email, address)
            VALUES (?, ?, ?, ?, ?)
          `).run(name, body.distributor || "", body.phone || "", body.email || "", body.address || "");
          const id = Number(result.lastInsertRowid);
          const supplierNumber = `PROV-${String(id).padStart(5, "0")}`;
          db.prepare("UPDATE suppliers SET supplier_number = ? WHERE id = ?").run(supplierNumber, id);
          return { id, supplierNumber };
        });
        return response(res, 201, addSupplier());
      }
      const supplierDeliveries = pathname.match(/^\/api\/suppliers\/(\d+)\/deliveries$/);
      if (req.method === "GET" && supplierDeliveries) {
        requireRole(user, ["admin"]);
        const supplierId = positiveInteger(supplierDeliveries[1], "El proveedor");
        if (!db.prepare("SELECT id FROM suppliers WHERE id = ?").get(supplierId)) throw new HttpError(404, "No se encontró ese proveedor.");
        const deliveries = db.prepare(`
          SELECT m.id, m.quantity, date(m.created_at) AS suppliedDate, m.note,
            p.name AS product, p.size, p.color, b.name AS branch, u.name AS receivedBy
          FROM inventory_movements m JOIN products p ON p.id = m.product_id
          JOIN branches b ON b.id = m.branch_id LEFT JOIN users u ON u.id = m.user_id
          WHERE m.supplier_id = ? AND m.type = 'entry' ORDER BY m.id DESC
        `).all(supplierId);
        return response(res, 200, deliveries);
      }
      if (req.method === "POST" && supplierDeliveries) {
        requireRole(user, ["admin"]);
        const supplierId = positiveInteger(supplierDeliveries[1], "El proveedor");
        const productId = positiveInteger(body.productId, "El producto");
        const branchId = validBranch(body.branchId);
        const quantity = positiveInteger(body.quantity, "La cantidad");
        const suppliedDate = String(body.suppliedDate || "");
        const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(suppliedDate) ? new Date(`${suppliedDate}T12:00:00Z`) : null;
        if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== suppliedDate) {
          throw new HttpError(400, "Indica una fecha de surtido válida.");
        }
        const recordDelivery = db.transaction(() => {
          if (!db.prepare("SELECT id FROM suppliers WHERE id = ?").get(supplierId)) throw new HttpError(404, "No se encontró ese proveedor.");
          const stock = db.prepare("SELECT quantity FROM inventory WHERE product_id = ? AND branch_id = ?")
            .get(productId, branchId);
          if (!stock) throw new HttpError(404, "No se encontró el producto en esta sucursal.");
          db.prepare("UPDATE inventory SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND branch_id = ?")
            .run(quantity, productId, branchId);
          const movement = db.prepare(`
            INSERT INTO inventory_movements (product_id, branch_id, user_id, supplier_id, type, quantity, note, created_at)
            VALUES (?, ?, ?, ?, 'entry', ?, ?, ?)
          `).run(productId, branchId, user.id, supplierId, quantity,
            String(body.note || "Surtido de proveedor").trim(), `${suppliedDate} 12:00:00`);
          return Number(movement.lastInsertRowid);
        });
        return response(res, 201, { id: recordDelivery() });
      }
      if (req.method === "GET" && pathname === "/api/sales") {
        requireRole(user, ["admin", "cashier"]);
        const branchId = validBranch(url.searchParams.get("branchId") || user.branchId);
        if (user.role !== "admin" && branchId !== user.branchId) throw new HttpError(403, "Solo puedes consultar las ventas de tu sucursal.");
        const rows = db.prepare(`
          SELECT s.id, s.subtotal, s.discount, s.total, s.payment_method AS paymentMethod,
            s.status, s.created_at AS createdAt, c.name AS customer, u.name AS seller,
            (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) AS itemCount
          FROM sales s LEFT JOIN customers c ON c.id = s.customer_id JOIN users u ON u.id = s.user_id
          WHERE s.branch_id = ? ORDER BY s.id DESC LIMIT 100
        `).all(branchId);
        return response(res, 200, rows);
      }
      const saleDetails = pathname.match(/^\/api\/sales\/(\d+)$/);
      if (req.method === "GET" && saleDetails) {
        requireRole(user, ["admin", "cashier"]);
        const saleId = Number(saleDetails[1]);
        const sale = db.prepare("SELECT id, branch_id AS branchId, created_at AS createdAt, status FROM sales WHERE id = ?").get(saleId);
        if (!sale) throw new HttpError(404, "No se encontró ese ticket.");
        if (user.role !== "admin" && sale.branchId !== user.branchId) throw new HttpError(403, "Solo puedes consultar tickets de tu sucursal.");
        sale.items = db.prepare(`
          SELECT p.id AS productId, p.name, p.lingerie, si.quantity,
            COALESCE((SELECT SUM(r.quantity) FROM returns r WHERE r.sale_id = si.sale_id AND r.product_id = si.product_id), 0) AS returned
          FROM sale_items si JOIN products p ON p.id = si.product_id WHERE si.sale_id = ?
        `).all(saleId);
        return response(res, 200, sale);
      }
      if (req.method === "POST" && pathname === "/api/sales") {
        const branchId = validBranch(body.branchId || user.branchId);
        if (user.role !== "admin" && branchId !== user.branchId) throw new HttpError(403, "Solo puedes registrar ventas en tu sucursal.");
        if (!db.prepare("SELECT id FROM cash_sessions WHERE branch_id = ? AND closed_at IS NULL").get(branchId)) {
          throw new HttpError(409, "Abre la caja de esta sucursal antes de registrar ventas.");
        }
        if (!["cash", "card", "transfer"].includes(body.paymentMethod) || !Array.isArray(body.items) || !body.items.length) {
          throw new HttpError(400, "Agrega productos y selecciona una forma de pago.");
        }
        const sale = db.transaction(() => {
          const customer = body.customerId ? db.prepare("SELECT * FROM customers WHERE id = ?").get(Number(body.customerId)) : null;
          if (body.customerId && !customer) throw new HttpError(404, "No se encontró a la clienta.");
          let subtotal = 0;
          const items = body.items.map((row) => {
            const productId = positiveInteger(row.productId, "El producto");
            const quantity = positiveInteger(row.quantity, "La cantidad");
            const product = db.prepare(`
              SELECT p.id, p.name, p.price, i.quantity AS stock FROM products p
              JOIN inventory i ON i.product_id = p.id WHERE p.id = ? AND i.branch_id = ? AND p.active = 1
            `).get(productId, branchId);
            if (!product) throw new HttpError(400, "No se encontró un producto disponible para la venta.");
            if (product.stock < quantity) throw new HttpError(409, `Existencias insuficientes de ${product.name}; disponibles: ${product.stock}.`);
            subtotal += product.price * quantity;
            return { ...product, quantity };
          });
          let discountRate = 0;
          if (customer) {
            const annualSpend = db.prepare(`
              SELECT COALESCE(SUM(total), 0) AS amount FROM sales WHERE customer_id = ?
              AND status = 'completed' AND created_at >= datetime('now', '-1 year')
            `).get(customer.id).amount;
            if (annualSpend > 20000) discountRate = 0.3;
            else if (customer.is_member) discountRate = 0.2;
          }
          const discount = Math.round(subtotal * discountRate * 100) / 100;
          const total = Math.round((subtotal - discount) * 100) / 100;
          const inserted = db.prepare(`
            INSERT INTO sales (branch_id, user_id, customer_id, subtotal, discount, total, payment_method)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(branchId, user.id, customer?.id || null, subtotal, discount, total, body.paymentMethod);
          for (const item of items) {
            db.prepare("INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)")
              .run(inserted.lastInsertRowid, item.id, item.quantity, item.price, item.price * item.quantity);
            db.prepare("UPDATE inventory SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND branch_id = ?")
              .run(item.quantity, item.id, branchId);
            db.prepare(`
              INSERT INTO inventory_movements (product_id, branch_id, user_id, type, quantity, note)
              VALUES (?, ?, ?, 'sale', ?, ?)
            `).run(item.id, branchId, user.id, -item.quantity, `Venta #${inserted.lastInsertRowid}`);
          }
          return {
            id: inserted.lastInsertRowid, subtotal, discount, discountRate, total,
            paymentMethod: body.paymentMethod, customer: customer?.name || null, seller: user.name,
            createdAt: new Date().toISOString(),
            items: items.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity, price: item.price })),
          };
        });
        return response(res, 201, sale());
      }
      const cancelSale = pathname.match(/^\/api\/sales\/(\d+)\/cancel$/);
      if (req.method === "POST" && cancelSale) {
        requireRole(user, ["admin", "cashier"]);
        const saleId = Number(cancelSale[1]);
        const reason = String(body.reason || "").trim();
        if (reason.length < 3) throw new HttpError(400, "Indica el motivo de la cancelación.");
        const cancelled = db.transaction(() => {
          const sale = db.prepare("SELECT * FROM sales WHERE id = ? AND status = 'completed'").get(saleId);
          if (!sale) throw new HttpError(404, "La venta no existe o ya fue cancelada.");
          if (user.role !== "admin" && sale.branch_id !== user.branchId) throw new HttpError(403, "Solo puedes cancelar ventas de tu sucursal.");
          if (!db.prepare("SELECT id FROM cash_sessions WHERE branch_id = ? AND closed_at IS NULL").get(sale.branch_id)) {
            throw new HttpError(409, "Abre la caja de esta sucursal antes de cancelar una venta.");
          }
          if (db.prepare("SELECT id FROM returns WHERE sale_id = ? LIMIT 1").get(saleId)) throw new HttpError(400, "No se puede cancelar un ticket con devoluciones.");
          for (const item of db.prepare("SELECT product_id, quantity FROM sale_items WHERE sale_id = ?").all(saleId)) {
            db.prepare("UPDATE inventory SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND branch_id = ?")
              .run(item.quantity, item.product_id, sale.branch_id);
            db.prepare(`
              INSERT INTO inventory_movements (product_id, branch_id, user_id, type, quantity, note)
              VALUES (?, ?, ?, 'adjustment', ?, ?)
            `).run(item.product_id, sale.branch_id, user.id, item.quantity, `Cancelación venta #${saleId}: ${reason}`);
          }
          db.prepare("UPDATE sales SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, cancellation_reason = ? WHERE id = ?")
            .run(reason, saleId);
          return { ok: true };
        });
        return response(res, 200, cancelled());
      }
      if (req.method === "POST" && pathname === "/api/returns") {
        requireRole(user, ["admin"]);
        const saleId = positiveInteger(body.saleId, "El ticket");
        const productId = positiveInteger(body.productId, "El producto");
        const quantity = positiveInteger(body.quantity, "La cantidad");
        const reason = String(body.reason || "").trim();
        if (!reason || body.tagsIntact !== true || body.unused !== true) {
          throw new HttpError(400, "Confirma que las etiquetas estén intactas y la prenda no haya sido usada; indica el motivo.");
        }
        const returned = db.transaction(() => {
          const sale = db.prepare("SELECT * FROM sales WHERE id = ? AND status = 'completed'").get(saleId);
          const product = db.prepare("SELECT id, lingerie FROM products WHERE id = ?").get(productId);
          const item = db.prepare("SELECT quantity, unit_price FROM sale_items WHERE sale_id = ? AND product_id = ?").get(saleId, productId);
          if (!sale || !product || !item) throw new HttpError(400, "Ticket o producto no válido.");
          if (Date.now() - new Date(`${sale.created_at.replace(" ", "T")}Z`).getTime() > 15 * 86400000) {
            throw new HttpError(400, "No se aceptan devoluciones después de 15 días.");
          }
          if (!db.prepare("SELECT id FROM cash_sessions WHERE branch_id = ? AND closed_at IS NULL").get(sale.branch_id)) {
            throw new HttpError(409, "Abre la caja de esta sucursal antes de procesar una devolución.");
          }
          if (product.lingerie) throw new HttpError(400, "No se aceptan devoluciones de prendas de lencería.");
          const previouslyReturned = db.prepare("SELECT COALESCE(SUM(quantity), 0) AS amount FROM returns WHERE sale_id = ? AND product_id = ?")
            .get(saleId, productId).amount;
          if (previouslyReturned + quantity > item.quantity) throw new HttpError(400, "La cantidad supera las piezas disponibles para devolución.");
          const amount = Math.round(item.unit_price * quantity * (sale.total / sale.subtotal) * 100) / 100;
          db.prepare("INSERT INTO returns (sale_id, product_id, branch_id, user_id, quantity, amount, reason) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .run(saleId, productId, sale.branch_id, user.id, quantity, amount, reason);
          db.prepare("UPDATE inventory SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND branch_id = ?")
            .run(quantity, productId, sale.branch_id);
          db.prepare(`
            INSERT INTO inventory_movements (product_id, branch_id, user_id, type, quantity, note)
            VALUES (?, ?, ?, 'return', ?, ?)
          `).run(productId, sale.branch_id, user.id, quantity, `Devolución venta #${saleId}`);
          return { ok: true };
        });
        return response(res, 200, returned());
      }
      if (req.method === "POST" && pathname === "/api/exchanges") {
        requireRole(user, ["admin"]);
        const saleId = positiveInteger(body.saleId, "El ticket");
        const returnedProductId = positiveInteger(body.returnedProductId, "La prenda devuelta");
        const replacementProductId = positiveInteger(body.replacementProductId, "La prenda de cambio");
        const quantity = positiveInteger(body.quantity, "La cantidad");
        const reason = String(body.reason || "").trim();
        if (!reason || body.tagsIntact !== true || body.unused !== true) {
          throw new HttpError(400, "Confirma las etiquetas intactas, que la prenda no fue usada y el motivo del cambio.");
        }
        if (!["cash", "card", "transfer"].includes(body.paymentMethod)) {
          throw new HttpError(400, "Selecciona un método de pago válido para cualquier diferencia.");
        }
        const exchange = db.transaction(() => {
          const sale = db.prepare("SELECT * FROM sales WHERE id = ? AND status = 'completed'").get(saleId);
          const returnedProduct = db.prepare("SELECT id, name, lingerie FROM products WHERE id = ?").get(returnedProductId);
          const originalItem = db.prepare("SELECT quantity, unit_price FROM sale_items WHERE sale_id = ? AND product_id = ?")
            .get(saleId, returnedProductId);
          if (!sale || !returnedProduct || !originalItem) throw new HttpError(400, "Ticket o productos no válidos.");
          const replacement = db.prepare(`
            SELECT p.id, p.name, p.price, i.quantity AS stock FROM products p
            JOIN inventory i ON i.product_id = p.id
            WHERE p.id = ? AND i.branch_id = ? AND p.active = 1
          `).get(replacementProductId, sale.branch_id);
          if (!replacement) throw new HttpError(400, "Ticket o productos no válidos.");
          if (user.role !== "admin" && sale.branch_id !== user.branchId) throw new HttpError(403, "Solo puedes cambiar tickets de tu sucursal.");
          if (!db.prepare("SELECT id FROM cash_sessions WHERE branch_id = ? AND closed_at IS NULL").get(sale.branch_id)) {
            throw new HttpError(409, "Abre la caja de esta sucursal antes de procesar un cambio.");
          }
          if (Date.now() - new Date(`${sale.created_at.replace(" ", "T")}Z`).getTime() > 15 * 86400000) {
            throw new HttpError(400, "No se aceptan cambios después de 15 días.");
          }
          if (returnedProduct.lingerie) throw new HttpError(400, "No se aceptan cambios de prendas de lencería.");
          if (returnedProductId === replacementProductId) throw new HttpError(400, "Selecciona una prenda distinta para realizar el cambio.");
          const previouslyReturned = db.prepare("SELECT COALESCE(SUM(quantity), 0) AS amount FROM returns WHERE sale_id = ? AND product_id = ?")
            .get(saleId, returnedProductId).amount;
          if (previouslyReturned + quantity > originalItem.quantity) throw new HttpError(400, "La cantidad supera las piezas disponibles para cambio.");
          if (replacement.stock < quantity) throw new HttpError(409, `Existencias insuficientes de ${replacement.name}; disponibles: ${replacement.stock}.`);
          const creditAmount = Math.round(originalItem.unit_price * quantity * (sale.total / sale.subtotal) * 100) / 100;
          const replacementAmount = Math.round(replacement.price * quantity * 100) / 100;
          const creditSale = db.prepare(`
            INSERT INTO returns (sale_id, product_id, branch_id, user_id, quantity, amount, reason)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(saleId, returnedProductId, sale.branch_id, user.id, quantity, creditAmount, `Cambio: ${reason}`);
          db.prepare("UPDATE inventory SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND branch_id = ?")
            .run(quantity, returnedProductId, sale.branch_id);
          db.prepare(`
            INSERT INTO inventory_movements (product_id, branch_id, user_id, type, quantity, note)
            VALUES (?, ?, ?, 'return', ?, ?)
          `).run(returnedProductId, sale.branch_id, user.id, quantity, `Cambio del ticket #${saleId}`);
          const replacementSale = db.prepare(`
            INSERT INTO sales (branch_id, user_id, customer_id, subtotal, discount, total, payment_method)
            VALUES (?, ?, ?, ?, 0, ?, ?)
          `).run(sale.branch_id, user.id, sale.customer_id, replacementAmount, replacementAmount, body.paymentMethod);
          db.prepare("INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)")
            .run(replacementSale.lastInsertRowid, replacement.id, quantity, replacement.price, replacementAmount);
          db.prepare("UPDATE inventory SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND branch_id = ?")
            .run(quantity, replacement.id, sale.branch_id);
          db.prepare(`
            INSERT INTO inventory_movements (product_id, branch_id, user_id, type, quantity, note)
            VALUES (?, ?, ?, 'sale', ?, ?)
          `).run(replacement.id, sale.branch_id, user.id, -quantity, `Cambio del ticket #${saleId}`);
          db.prepare(`
            INSERT INTO exchanges (original_sale_id, replacement_sale_id, returned_product_id,
              replacement_product_id, returned_quantity, replacement_quantity, credit_amount,
              replacement_amount, payment_method, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(saleId, replacementSale.lastInsertRowid, returnedProductId, replacement.id, quantity,
            quantity, creditAmount, replacementAmount, body.paymentMethod, user.id);
          return {
            id: Number(creditSale.lastInsertRowid),
            replacementSaleId: Number(replacementSale.lastInsertRowid),
            creditAmount,
            replacementAmount,
            difference: Math.round((replacementAmount - creditAmount) * 100) / 100,
          };
        });
        return response(res, 201, exchange());
      }
      if (req.method === "GET" && pathname === "/api/cash/status") {
        const branchId = validBranch(url.searchParams.get("branchId") || user.branchId);
        if (user.role !== "admin" && branchId !== user.branchId) throw new HttpError(403, "Solo puedes consultar la caja de tu sucursal.");
        const session = db.prepare("SELECT id FROM cash_sessions WHERE branch_id = ? AND closed_at IS NULL").get(branchId);
        return response(res, 200, { open: Boolean(session) });
      }
      if (req.method === "GET" && pathname === "/api/cash") {
        requireRole(user, ["admin", "cashier"]);
        const branchId = validBranch(url.searchParams.get("branchId") || user.branchId);
        if (user.role !== "admin" && branchId !== user.branchId) throw new HttpError(403, "Solo puedes consultar la caja de tu sucursal.");
        const session = db.prepare("SELECT id FROM cash_sessions WHERE branch_id = ? AND closed_at IS NULL").get(branchId);
        const recentSessions = db.prepare(`
          SELECT cs.id, cs.opening_cash AS openingCash, cs.closing_cash AS closingCash,
            cs.expected_cash AS expectedCash, cs.opened_at AS openedAt, cs.closed_at AS closedAt, u.name AS openedBy
          FROM cash_sessions cs JOIN users u ON u.id = cs.user_id
          WHERE cs.branch_id = ? ORDER BY cs.id DESC LIMIT 10
        `).all(branchId);
        const current = session ? cashSummary(session.id) : null;
        if (current && user.role !== "admin" && current.branchId !== user.branchId) throw new HttpError(403, "Solo puedes consultar la caja de tu sucursal.");
        const movements = current ? db.prepare(`
          SELECT m.id, m.type, m.amount, m.note, m.created_at AS createdAt, u.name AS user
          FROM cash_movements m JOIN users u ON u.id = m.user_id
          WHERE m.session_id = ? ORDER BY m.id DESC
        `).all(current.id) : [];
        return response(res, 200, { branchId, session: current, movements, recentSessions });
      }
      if (req.method === "POST" && pathname === "/api/cash/open") {
        requireRole(user, ["admin", "cashier"]);
        const branchId = validBranch(body.branchId || user.branchId);
        if (user.role !== "admin" && branchId !== user.branchId) throw new HttpError(403, "Solo puedes abrir caja en tu sucursal.");
        const openingCash = Number(body.openingCash);
        if (!Number.isFinite(openingCash) || openingCash < 0) throw new HttpError(400, "Indica un fondo inicial válido.");
        if (db.prepare("SELECT id FROM cash_sessions WHERE branch_id = ? AND closed_at IS NULL").get(branchId)) {
          throw new HttpError(409, "Ya existe una caja abierta en esta sucursal.");
        }
        const result = db.prepare("INSERT INTO cash_sessions (branch_id, user_id, opening_cash) VALUES (?, ?, ?)")
          .run(branchId, user.id, Math.round(openingCash * 100) / 100);
        return response(res, 201, { id: Number(result.lastInsertRowid) });
      }
      if (req.method === "POST" && pathname === "/api/cash/movements") {
        requireRole(user, ["admin", "cashier"]);
        const sessionId = positiveInteger(body.sessionId, "La caja");
        if (!["income", "expense"].includes(body.type)) throw new HttpError(400, "Selecciona ingreso o retiro.");
        const amount = Number(body.amount);
        const note = String(body.note || "").trim();
        if (!Number.isFinite(amount) || amount <= 0 || !note) throw new HttpError(400, "Indica un importe y un motivo válidos.");
        const session = db.prepare("SELECT branch_id AS branchId FROM cash_sessions WHERE id = ? AND closed_at IS NULL").get(sessionId);
        if (!session) throw new HttpError(404, "La caja no existe o ya está cerrada.");
        if (user.role !== "admin" && session.branchId !== user.branchId) throw new HttpError(403, "Solo puedes registrar movimientos en tu sucursal.");
        const result = db.prepare("INSERT INTO cash_movements (session_id, user_id, type, amount, note) VALUES (?, ?, ?, ?, ?)")
          .run(sessionId, user.id, body.type, Math.round(amount * 100) / 100, note);
        return response(res, 201, { id: Number(result.lastInsertRowid) });
      }
      if (req.method === "POST" && pathname === "/api/cash/close") {
        requireRole(user, ["admin", "cashier"]);
        const sessionId = positiveInteger(body.sessionId, "La caja");
        const closingCash = Number(body.closingCash);
        if (!Number.isFinite(closingCash) || closingCash < 0) throw new HttpError(400, "Indica el efectivo contado.");
        const closeSession = db.transaction(() => {
          const current = cashSummary(sessionId);
          if (!current) throw new HttpError(404, "La caja no existe o ya está cerrada.");
          if (user.role !== "admin" && current.branchId !== user.branchId) throw new HttpError(403, "Solo puedes cerrar la caja de tu sucursal.");
          const difference = Math.round((closingCash - current.expectedCash) * 100) / 100;
          db.prepare("UPDATE cash_sessions SET closing_cash = ?, expected_cash = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ?")
            .run(Math.round(closingCash * 100) / 100, current.expectedCash, sessionId);
          return { expectedCash: current.expectedCash, closingCash: Math.round(closingCash * 100) / 100, difference };
        });
        return response(res, 200, closeSession());
      }
      if (req.method === "GET" && pathname === "/api/reports") {
        requireRole(user, ["admin"]);
        const branchId = validBranch(url.searchParams.get("branchId") || user.branchId);
        if (user.role !== "admin" && branchId !== user.branchId) throw new HttpError(403, "Solo puedes consultar reportes de tu sucursal.");
        const month = /^\d{4}-\d{2}$/.test(url.searchParams.get("month") || "") ? url.searchParams.get("month") : new Date().toISOString().slice(0, 7);
        const daily = db.prepare(`
          SELECT date(created_at) AS date, COUNT(*) AS sales, SUM(total) AS total,
            SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END) AS cash,
            SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END) AS card,
            SUM(CASE WHEN payment_method = 'transfer' THEN total ELSE 0 END) AS transfer
          FROM sales WHERE branch_id = ? AND status = 'completed' AND strftime('%Y-%m', created_at) = ?
          GROUP BY date(created_at) ORDER BY date DESC
        `).all(branchId, month);
        const refunds = db.prepare(`
          SELECT date(created_at) AS date, COUNT(*) AS count, SUM(amount) AS total FROM returns
          WHERE branch_id = ? AND strftime('%Y-%m', created_at) = ? GROUP BY date(created_at)
        `).all(branchId, month);
        const cancellations = db.prepare(`
          SELECT date(cancelled_at) AS date, COUNT(*) AS count, SUM(total) AS total FROM sales
          WHERE branch_id = ? AND status = 'cancelled' AND strftime('%Y-%m', cancelled_at) = ? GROUP BY date(cancelled_at)
        `).all(branchId, month);
        const sellers = db.prepare(`
          SELECT u.name, COUNT(s.id) AS sales, COALESCE(SUM(s.total), 0) AS total
          FROM users u LEFT JOIN sales s ON s.user_id = u.id AND s.branch_id = ? AND s.status = 'completed'
            AND strftime('%Y-%m', s.created_at) = ?
          WHERE u.role = 'cashier' AND u.active = 1
          GROUP BY u.id ORDER BY total DESC
        `).all(branchId, month);
        const inventory = db.prepare(`
          SELECT p.id, p.name, p.category, p.size, p.color, p.stock_min AS stockMin, i.quantity
          FROM products p JOIN inventory i ON i.product_id = p.id WHERE i.branch_id = ? AND p.active = 1 ORDER BY p.name
        `).all(branchId);
        return response(res, 200, { month, daily, refunds, cancellations, sellers, inventory,
          users: db.prepare("SELECT COUNT(*) AS count FROM users WHERE active = 1").get().count });
      }
      if (req.method === "GET" && pathname === "/api/users") {
        requireRole(user, ["admin"]);
        return response(res, 200, db.prepare(`
          SELECT u.id, u.name, u.username, u.role, u.active, b.name AS branch
          FROM users u LEFT JOIN branches b ON b.id = u.branch_id ORDER BY u.id
        `).all());
      }
      if (req.method === "POST" && pathname === "/api/users") {
        requireRole(user, ["admin"]);
        if (!isPrimaryAdmin(user)) throw new HttpError(403, "Solo la cuenta principal puede agregar cuentas.");
        const name = String(body.name || "").trim();
        const username = String(body.username || "");
        const password = String(body.password || "");
        const role = body.role;
        const branchId = validBranch(body.branchId);
        if (!name || !/^[a-zA-Z0-9._-]{3,30}$/.test(username)) throw new HttpError(400, "Indica un nombre y un usuario válido (3–30 caracteres).");
        if (password.length < 10) throw new HttpError(400, "La contraseña debe tener al menos 10 caracteres.");
        if (!["admin", "cashier", "seller"].includes(role)) throw new HttpError(400, "Selecciona un perfil válido.");
        const credentials = hashPassword(password);
        try {
          db.prepare("INSERT INTO users (name, username, salt, password_hash, role, branch_id) VALUES (?, ?, ?, ?, ?, ?)")
            .run(name, username, credentials.salt, credentials.hash, role, branchId);
        } catch (error) {
          if (isUniqueConstraint(error)) throw new HttpError(409, "Ese nombre de usuario ya existe.");
          throw error;
        }
        return response(res, 201, { ok: true });
      }
      const userStatus = pathname.match(/^\/api\/users\/(\d+)\/active$/);
      if (req.method === "PATCH" && userStatus) {
        requireRole(user, ["admin"]);
        const targetId = positiveInteger(userStatus[1], "El usuario");
        if (typeof body.active !== "boolean") throw new HttpError(400, "Indica si la cuenta debe estar activa.");
        const target = db.prepare("SELECT id, username, role FROM users WHERE id = ?").get(targetId);
        if (!target) throw new HttpError(404, "No se encontró esa cuenta.");
        if (!body.active && isPrimaryAdmin(target)) throw new HttpError(409, "La cuenta principal no puede desactivarse.");
        if (!body.active && targetId === user.id) throw new HttpError(400, "No puedes desactivar tu propia cuenta.");
        if (!body.active && target.role === "admin" &&
          db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND active = 1").get().count <= 1) {
          throw new HttpError(409, "Debe quedar al menos una cuenta de administración activa.");
        }
        db.prepare("UPDATE users SET active = ? WHERE id = ?").run(body.active ? 1 : 0, targetId);
        return response(res, 200, { ok: true });
      }
      if (req.method === "POST" && pathname === "/api/password") {
        const currentPassword = String(body.currentPassword || "");
        const newPassword = String(body.newPassword || "");
        if (newPassword.length < 10) throw new HttpError(400, "La nueva contraseña debe tener al menos 10 caracteres.");
        const saved = db.prepare("SELECT salt, password_hash FROM users WHERE id = ?").get(user.id);
        const attempted = scryptSync(currentPassword, saved.salt, 64);
        const actual = Buffer.from(saved.password_hash, "hex");
        if (attempted.length !== actual.length || !timingSafeEqual(attempted, actual)) throw new HttpError(401, "La contraseña actual no es correcta.");
        const credentials = hashPassword(newPassword);
        db.prepare("UPDATE users SET salt = ?, password_hash = ? WHERE id = ?").run(credentials.salt, credentials.hash, user.id);
        return response(res, 200, { ok: true });
      }
      throw new HttpError(404, "No se encontró esta operación.");
    }

    if (!["GET", "HEAD"].includes(req.method || "")) return response(res, 405, { error: "Método no permitido." });
    const dist = path.join(root, "dist");
    const requestedPath = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
    const resolved = path.resolve(dist, requestedPath);
    const safePath = resolved.startsWith(`${dist}${path.sep}`) ? resolved : path.join(dist, "index.html");
    const filePath = existsSync(safePath) ? safePath : path.join(dist, "index.html");
    if (!existsSync(filePath)) return response(res, 404, { error: "Compila el sitio con npm run build o usa npm run dev." });
    const content = readFileSync(filePath);
    res.writeHead(200, { "content-type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch (error) {
    if (error instanceof HttpError) return response(res, error.status, { error: error.message });
    if (isUniqueConstraint(error)) return response(res, 409, { error: "El registro ya existe." });
    console.error(error);
    return response(res, 500, { error: "Ocurrió un error al guardar los datos." });
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () => console.log(`Bella Boutique API lista en http://localhost:${port}`));
