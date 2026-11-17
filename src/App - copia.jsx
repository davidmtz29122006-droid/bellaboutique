import { useCallback, useEffect, useState } from "react";

const money = (amount) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(amount || 0));
const roles = { admin: "Administración", cashier: "Cajero", seller: "Vendedor" };
const primaryAdminUsername = "admin";
const navItems = [
  ["Inicio", "⌂", "RESUMEN"],
  ["Punto de venta", "＋", "OPERACIÓN"],
  ["Caja", "$", "OPERACIÓN"],
  ["Productos", "◈", "TIENDA"],
  ["Inventario", "▤", "TIENDA"],
  ["Ventas", "◷", "TIENDA"],
  ["Clientes", "♡", "TIENDA"],
  ["Proveedores", "↗", "ADMINISTRACIÓN"],
  ["Equipo", "♙", "ADMINISTRACIÓN"],
  ["Reportes", "▥", "ANÁLISIS"],
  ["Catálogo", "✿", "CATÁLOGO"],
];
const rolePages = {
  admin: navItems.map(([label]) => label),
  cashier: ["Inicio", "Punto de venta", "Caja", "Productos", "Inventario", "Ventas", "Clientes", "Equipo", "Catálogo"],
  seller: ["Inicio", "Punto de venta", "Productos", "Inventario", "Equipo", "Catálogo"],
};

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo completar la solicitud.");
  return data;
}

function Icon({ children, className = "" }) {
  return <span aria-hidden="true" className={`icon ${className}`}>{children}</span>;
}

function Button({ children, variant = "primary", ...props }) {
  return <button className={`button button-${variant} ${props.className || ""}`} {...props}>{children}</button>;
}

function Heading({ kicker, title, description, action }) {
  return <div className="page-heading"><div><div className="kicker">{kicker}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function Dialog({ title, subtitle, close, children }) {
  return <div className="dialog-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section className="dialog"><div className="dialog-head"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="close-button" onClick={close} aria-label="Cerrar">×</button></div>{children}</section></div>;
}

function Field({ label, children, className = "" }) {
  return <label className={`field ${className}`}><span>{label}</span>{children}</label>;
}

function Notice({ error, success, onClose }) {
  if (!error && !success) return null;
  return <div className={`notice ${error ? "notice-error" : "notice-success"}`} role={error ? "alert" : "status"}>{error || success}{success && <button onClick={onClose}>Cerrar</button>}</div>;
}

function Empty({ title, text }) {
  return <div className="empty"><span>✿</span><strong>{title}</strong><p>{text}</p></div>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(1);
  const [page, setPage] = useState("Inicio");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (window.location.pathname === "/catalogo") return;
    api("/api/branches").then(setBranches).catch(() => setBranches([]));
    api("/api/me").then(({ user: current }) => {
      if (!current) return;
      setUser(current);
      if (current.branchId) setBranchId(current.branchId);
    }).catch(() => {});
  }, []);

  const notify = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }, []);
  const refresh = () => setRevision((value) => value + 1);
  const saved = (message) => { refresh(); notify(message); };
  const navigate = (next) => {
    if (user && !rolePages[user.role]?.includes(next)) return;
    setPage(next);
    setMobileMenu(false);
  };
  const activeBranchId = user?.role === "admin" ? branchId : user?.branchId || branchId;
  const branch = branches.find((item) => item.id === Number(activeBranchId));

  async function login(event) {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError("");
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const { user: account } = await api("/api/login", { method: "POST", body: JSON.stringify(form) });
      setUser(account);
      if (account.branchId) setBranchId(account.branchId);
    } catch (error) { setLoginError(error.message); }
    finally { setLoginBusy(false); }
  }

  async function logout() {
    try { await api("/api/logout", { method: "POST" }); setUser(null); setPage("Inicio"); }
    catch (error) { notify(error.message); }
  }

  if (window.location.pathname === "/catalogo") return <CatalogPage />;
  if (!user) return <Login error={loginError} busy={loginBusy} onSubmit={login} />;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
      <a className="brand" href="#" onClick={(event) => { event.preventDefault(); navigate("Inicio"); }}><span className="brand-flower">✿</span><span><b>Bella</b><small>BOUTIQUE</small></span></a>
      <div className="side-label">ESPACIO DE TRABAJO</div>
      <nav>{navItems.filter(([label]) => rolePages[user.role]?.includes(label)).map(([label, icon, section], index, visibleItems) => <div key={label}>
        {(index === 0 || visibleItems[index - 1][2] !== section) && index !== 0 && <div className="nav-section">{section}</div>}
        <button className={`nav-link ${page === label ? "nav-selected" : ""}`} onClick={() => navigate(label)}><span className="nav-icon">{icon}</span>{label}{page === label && <i />}</button>
      </div>)}</nav>
      <div className="sidebar-bottom">
        <div className="help-card"><span>?</span><div><b>¿Necesitas ayuda?</b><small>Estamos para ayudarte</small></div></div>
        <div className="account-row"><div className="avatar">{user.name[0]}</div><div><b>{user.name}</b><small>{roles[user.role]}</small></div><button title="Cerrar sesión" onClick={logout}>↗</button></div>
        <small className="version">BELLA POS · VERSIÓN 1.0</small>
      </div>
    </aside>
    {mobileMenu && <button className="mobile-scrim" aria-label="Cerrar menú" onClick={() => setMobileMenu(false)} />}
    <main className="main">
      <header className="topbar"><button className="mobile-menu-button" onClick={() => setMobileMenu(true)} aria-label="Abrir menú">☰</button><div className="crumb">Bella Boutique <span>/</span> <b>{page}</b></div>
        <div className="topbar-actions"><label className="branch-picker">⌖ <select aria-label="Sucursal" value={branchId} onChange={(event) => setBranchId(Number(event.target.value))} disabled={user.role !== "admin"}>{branches.map((item) => <option key={item.id} value={item.id}>{item.name.replace("Bella Boutique · ", "")}</option>)}</select></label><span className="top-divider" /><span className="top-avatar">{user.name[0]}</span></div>
      </header>
      <div className="content">
        {page === "Inicio" && <Dashboard branchId={activeBranchId} branch={branch?.name || "Bella Boutique"} user={user} go={navigate} revision={revision} />}
        {page === "Punto de venta" && <PointOfSale branchId={activeBranchId} user={user} onComplete={() => saved("Venta guardada y existencias actualizadas.")} />}
        {page === "Caja" && <Cash branchId={activeBranchId} user={user} revision={revision} onSaved={saved} />}
        {page === "Productos" && <Products branchId={activeBranchId} user={user} revision={revision} onSaved={() => saved("Catálogo actualizado.")} />}
        {page === "Inventario" && <Inventory branchId={activeBranchId} user={user} revision={revision} onSaved={() => saved("Inventario actualizado.")} />}
        {page === "Ventas" && <Sales branchId={activeBranchId} user={user} revision={revision} onSaved={saved} />}
        {page === "Clientes" && <Customers user={user} revision={revision} onSaved={() => saved("Clienta registrada correctamente.")} />}
        {page === "Proveedores" && <Suppliers branchId={activeBranchId} user={user} revision={revision} onSaved={() => saved("Proveedor o surtido registrado correctamente.")} />}
        {page === "Equipo" && <Team user={user} branches={branches} revision={revision} onSaved={(message) => saved(message)} />}
        {page === "Reportes" && <Reports branchId={activeBranchId} revision={revision} />}
        {page === "Catálogo" && <CatalogPage />}
      </div>
    </main>
    {toast && <div className="toast"><span>✓</span>{toast}</div>}
  </div>;
}

function Login({ onSubmit, error, busy }) {
  return <main className="login-page"><section className="login-card"><a className="brand login-brand" href="#"><span className="brand-flower">✿</span><span><b>Bella</b><small>BOUTIQUE</small></span></a><div className="kicker">SISTEMA DE PUNTO DE VENTA</div><h1>Bienvenida<br /><em>de vuelta.</em></h1><p>Entra a tu espacio para que cada detalle de tu tienda esté en su lugar.</p><form onSubmit={onSubmit}><Field label="USUARIO"><input name="username" required autoComplete="username" placeholder="Tu usuario" /></Field><Field label="CONTRASEÑA"><input name="password" type="password" required autoComplete="current-password" placeholder="Tu contraseña" /></Field>{error && <Notice error={error} />}<Button disabled={busy}>{busy ? "Ingresando..." : "Iniciar sesión"} <span>→</span></Button></form><div className="demo-access"><span>✧ Acceso de prueba</span><b>admin</b><span>·</span><b>Bella2026!</b></div><a className="catalog-link" href="/catalogo">Consultar catálogo digital →</a><small className="login-footer">© Bella Boutique · Elegancia que se siente</small></section><aside className="login-art"><div className="art-glow" /><div className="fashion-shape"><span>BB</span></div><div className="art-caption"><small>UNA NUEVA TEMPORADA</small><strong>Elegancia<br />que se siente.</strong><span>Tu tienda, en cada detalle.</span></div></aside></main>;
}

function Dashboard({ branchId, branch, user, go, revision }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api(`/api/dashboard?branchId=${branchId}`).then(setData).catch((e) => setError(e.message)); }, [branchId, revision]);
  const today = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return <>
    <Heading kicker={today} title={<>Hola, <em>qué gusto verte.</em></>} description={`Este es el resumen de ${branch}. Aquí tienes lo más importante de hoy.`} action={<Button onClick={() => go("Punto de venta")}>＋ Nueva venta</Button>} />
    <Notice error={error} />
    <div className="welcome-banner"><span>✧</span><div><b>Un día bonito para vender</b><small>Tu tienda está lista. Aquí tienes todo bajo control.</small></div><i>✿</i></div>
    <div className="section-title"><div><h2>Resumen de hoy</h2><p>Un vistazo a cómo va tu tienda.</p></div><span className="live">● Actualizado ahora</span></div>
    <div className="stats">
      <Stat label="Ventas de hoy" value={money(data?.today.total)} detail={`${data?.today.count || 0} tickets registrados`} icon="$" color="pink" />
      <Stat label="Ventas del mes" value={money(data?.month)} detail="Acumulado mensual" icon="↗" color="peach" />
      <Stat label="Piezas en tienda" value={data?.inventory.units ?? "—"} detail={`${data?.inventory.products || 0} modelos disponibles`} icon="◈" color="lavender" />
      <Stat label="Por reponer" value={data?.inventory.lowStock ?? "—"} detail="Modelos con pocas existencias" icon="!" color="sage" />
    </div>
    <div className="dashboard-panels"><section className="panel"><div className="panel-title"><div><h3>Actividad reciente</h3><p>Los últimos movimientos de tu tienda</p></div><button className="text-button" onClick={() => go("Ventas")}>Ver todas →</button></div>{data?.recent.length ? data.recent.map((sale) => <div className="activity-row" key={sale.id}><span className="activity-icon">◇</span><div><b>{sale.customer || "Venta de mostrador"}</b><small>Ticket #{String(sale.id).padStart(5, "0")} · {sale.seller}</small></div><strong>{money(sale.total)}</strong></div>) : <Empty title="Aún no hay ventas" text="Tus tickets aparecerán aquí." />}</section>
      <section className="panel"><div className="panel-title"><div><h3>Stock por revisar</h3><p>Modelos que necesitan atención</p></div><button className="round-button" onClick={() => go("Inventario")}>→</button></div>{data?.lowStock.length ? data.lowStock.map((item) => <div className="low-stock-row" key={item.id}><span>◈</span><div><b>{item.name}</b><small>{item.size} · {item.color}</small></div><strong>{item.quantity} pza</strong></div>) : <Empty title="Todo en orden" text="Tu inventario está bien surtido." />}</section></div>
    <div className="section-title quick-title"><div><h2>Atajos para ti</h2><p>Las tareas de cada día, más cerca.</p></div></div>
    <div className="quick-grid">{[["＋", "Nueva venta", "Punto de venta"], ["$", "Abrir caja", "Caja"], ["◈", "Agregar producto", "Productos"], ["♡", "Registrar clienta", "Clientes"], ["▥", "Ver reportes", "Reportes"]].filter(([, , target]) => rolePages[user.role]?.includes(target)).map(([icon, text, target]) => <button key={target} onClick={() => go(target)}><span>{icon}</span><b>{text}</b><i>→</i></button>)}</div>
  </>;
}

function Stat({ label, value, detail, icon, color }) {
  return <article className="stat-card"><div className={`stat-icon ${color}`}>{icon}</div><span className="stat-label">{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function Products({ branchId, user, revision, onSaved }) {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api(`/api/products?branchId=${branchId}&search=${encodeURIComponent(query)}`).then(setItems).catch((e) => setError(e.message)), [branchId, query]);
  useEffect(() => { load(); }, [load, revision]);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const payload = { ...form, price: Number(form.price), cost: Number(form.cost), stock: Number(form.stock || 0), stockMin: Number(form.stockMin), branchId };
      await api(editing ? `/api/products/${editing.id}` : "/api/products", { method: editing ? "PUT" : "POST", body: JSON.stringify(payload) });
      setOpen(false); setEditing(null); await load(); onSaved();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function archive(product) {
    if (!window.confirm(`¿Retirar "${product.name}" del catálogo? Sus tickets se conservarán.`)) return;
    try { await api(`/api/products/${product.id}`, { method: "DELETE" }); await load(); onSaved(); }
    catch (e) { setError(e.message); }
  }
  return <>
    <Heading kicker="TU CATÁLOGO" title={<>Piezas con <em>personalidad.</em></>} description="Cada prenda, talla y color, organizados en un solo lugar." action={user.role === "admin" && <Button onClick={() => { setEditing(null); setOpen(true); }}>＋ Agregar producto</Button>} />
    <Notice error={error} />
    <div className="toolbar"><input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, talla, color o código..." /><span className="soft-chip">{items.length} estilos disponibles</span></div>
    <div className="product-grid">{items.map((item, index) => <article className="catalog-card" key={item.id}><div className={`catalog-art tone-${index % 6}`}><span>{item.category}</span><b>BB</b>{user.role === "admin" && <div className="catalog-manage-actions"><button title="Editar producto" onClick={() => { setEditing(item); setOpen(true); }}>✎</button><button title="Retirar producto" onClick={() => archive(item)}>×</button></div>}</div><div className="catalog-copy"><div><b>{item.name}</b><small>{item.brand}</small></div><strong>{money(item.price)}</strong></div><div className="product-meta"><span>{item.size} · {item.color}</span><span className={item.stock < item.stockMin ? "warning-text" : ""}>{item.stock} pzas</span></div><small className="barcode">{item.barcode}</small></article>)}</div>
    {items.length === 0 && <Empty title="No encontramos ese estilo" text="Prueba con otro nombre, código o color." />}
    {open && <Dialog title={editing ? "Editar producto" : "Agregar una prenda"} subtitle={editing ? "Actualiza el catálogo sin alterar existencias." : "Registra sus detalles para agregarla al catálogo."} close={() => { setOpen(false); setEditing(null); }}><form className="form-grid" onSubmit={submit}><Field label="Nombre"><input name="name" defaultValue={editing?.name || ""} required /></Field><Field label="Marca"><input name="brand" defaultValue={editing?.brand || ""} /></Field><Field label="Categoría"><select name="category" defaultValue={editing?.category || ""} required><option value="">Selecciona...</option>{["Vestidos", "Blusas", "Sacos", "Pantalones", "Faldas", "Lencería", "Accesorios"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Código de barras"><input name="barcode" defaultValue={editing?.barcode || ""} required /></Field><Field label="Talla"><input name="size" defaultValue={editing?.size || "Unitalla"} required /></Field><Field label="Color"><input name="color" defaultValue={editing?.color || "Marfil"} required /></Field><Field label="Costo"><input name="cost" type="number" min="0" step=".01" defaultValue={editing?.cost ?? 0} /></Field><Field label="Precio"><input name="price" type="number" min="0" step=".01" defaultValue={editing?.price ?? ""} required /></Field>{editing ? <p className="field-wide">Existencias actuales: {editing.stock} piezas. Para ajustarlas usa Inventario.</p> : <Field label="Existencias iniciales"><input name="stock" type="number" min="0" defaultValue="0" /></Field>}<Field label="Alerta de stock"><input name="stockMin" type="number" min="0" defaultValue={editing?.stockMin ?? 5} /></Field><DialogActions close={() => { setOpen(false); setEditing(null); }} busy={busy} label={editing ? "Guardar cambios" : "Guardar producto"} /></form></Dialog>}
  </>;
}

function Inventory({ branchId, user, revision, onSaved }) {
  const [items, setItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api(`/api/products?branchId=${branchId}&search=${encodeURIComponent(query)}`).then(setItems).catch((e) => setError(e.message)), [branchId, query]);
  useEffect(() => { load(); }, [load, revision]);
  useEffect(() => {
    const requests = user.role === "admin" ? [api("/api/branches"), api("/api/suppliers")] : [api("/api/branches")];
    Promise.all(requests).then(([b, s = []]) => { setBranches(b); setSuppliers(s); }).catch((e) => setError(e.message));
  }, [user.role]);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await api("/api/inventory/movements", { method: "POST", body: JSON.stringify({ productId: selected.id, branchId: Number(form.branchId), quantity: Number(form.quantity), type: form.type, supplierId: Number(form.supplierId) || null, note: form.note }) });
      setSelected(null); await load(); onSaved();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <>
    <Heading kicker="CONTROL DE EXISTENCIAS" title={<>Inventario <em>en equilibrio.</em></>} description="Consulta existencias por tienda y registra entradas o ajustes." />
    <Notice error={error} />
    <div className="toolbar"><input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto, talla o código..." /><span className="soft-chip">Consulta entre sucursales</span></div>
    <div className="panel table-wrap"><table><thead><tr><th>PRENDA</th><th>CÓDIGO</th><th>TALLA · COLOR</th><th>ESTA SUCURSAL</th><th>OTRA SUCURSAL</th><th>ESTADO</th><th></th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><b>{item.name}</b><small>{item.category}</small></td><td>{item.barcode}</td><td>{item.size} · {item.color}</td><td><b>{item.stock}</b> pzas</td><td>{item.totalStock - item.stock} pzas</td><td><span className={`stock-badge ${item.stock < item.stockMin ? "stock-warning" : ""}`}>{item.stock < item.stockMin ? "Por reponer" : "Disponible"}</span></td><td>{user.role === "admin" && <button className="small-button" onClick={() => setSelected(item)}>Movimiento</button>}</td></tr>)}</tbody></table></div>
    {selected && <Dialog title="Movimiento de inventario" subtitle={`${selected.name} · ${selected.size} · ${selected.color}`} close={() => setSelected(null)}><form className="form-grid" onSubmit={submit}><Field label="Sucursal"><select name="branchId" defaultValue={branchId}>{branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Movimiento"><select name="type"><option value="entry">Entrada</option><option value="adjustment">Ajustar cantidad final</option></select></Field><Field label="Piezas / existencias finales"><input name="quantity" type="number" min="0" required /></Field><Field label="Proveedor"><select name="supplierId"><option value="">Sin proveedor</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Nota" className="field-wide"><input name="note" placeholder="Compra de temporada" /></Field><DialogActions close={() => setSelected(null)} busy={busy} label="Guardar movimiento" /></form></Dialog>}
  </>;
}

function PointOfSale({ branchId, user, onComplete }) {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cashOpen, setCashOpen] = useState(null);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);
  useEffect(() => { api(`/api/products?branchId=${branchId}&search=${encodeURIComponent(query)}`).then(setProducts).catch((e) => setError(e.message)); }, [branchId, query]);
  useEffect(() => { api("/api/customers").then(setCustomers).catch((e) => setError(e.message)); }, []);
  useEffect(() => { api(`/api/cash/status?branchId=${branchId}`).then(({ open }) => setCashOpen(open)).catch((e) => setError(e.message)); }, [branchId]);
  const customer = customers.find((item) => item.id === Number(customerId));
  const rate = customer?.annualSpend > 20000 ? 0.3 : customer?.isMember ? 0.2 : 0;
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = Math.round(subtotal * rate * 100) / 100;
  const total = subtotal - discount;
  function add(item) {
    if (!item.stock) return;
    setCart((list) => {
      const old = list.find((entry) => entry.id === item.id);
      if (old) return list.map((entry) => entry.id === item.id ? { ...entry, quantity: Math.min(entry.quantity + 1, item.stock) } : entry);
      return [...list, { ...item, quantity: 1 }];
    });
  }
  async function scan(event) {
    if (event.key !== "Enter" || !event.currentTarget.value.trim()) return;
    event.preventDefault();
    const code = event.currentTarget.value.trim();
    try {
      const matches = await api(`/api/products?branchId=${branchId}&search=${encodeURIComponent(code)}`);
      const item = matches.find((entry) => entry.barcode === code);
      if (!item) return setError("No encontramos un producto con ese código.");
      add(item); setQuery(""); setError("");
    } catch (e) { setError(e.message); }
  }
  async function checkout() {
    setBusy(true); setError("");
    try {
      const sale = await api("/api/sales", { method: "POST", body: JSON.stringify({ branchId, customerId: customerId || null, paymentMethod, items: cart.map((item) => ({ productId: item.id, quantity: item.quantity })) }) });
      setReceipt(sale); setCart([]); setCustomerId(""); onComplete();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <>
    <Heading kicker="CAJA · NUEVA VENTA" title={<>Un detalle para <em>recordar.</em></>} description="Busca las prendas o escanea sus códigos para preparar la compra." action={<span className={`soft-chip ${cashOpen === false ? "warning-text" : ""}`}>{user.name} · {cashOpen === null ? "consultando caja" : cashOpen ? "caja abierta" : "caja cerrada"}</span>} />
    <Notice error={error || (cashOpen === false ? "La caja de esta sucursal está cerrada. Solicita a administración o caja que la abra antes de cobrar." : "")} />
    <div className="pos-grid"><section className="panel pos-catalog"><div className="panel-title"><div><h3>Elige las prendas</h3><p>{products.length} estilos disponibles en esta tienda</p></div></div><input className="search" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={scan} placeholder="Buscar o escanear código de barras..." />{products.map((item, index) => <button className="pos-product" key={item.id} disabled={!item.stock} onClick={() => add(item)}><span className={`product-swatch swatch-${index % 6}`}>BB</span><span><b>{item.name}</b><small>{item.size} · {item.color} · {item.stock} pzas</small></span><strong>{money(item.price)}</strong><i>＋</i></button>)}</section>
      <section className="panel cart-panel"><div className="panel-title"><div><div className="kicker">RESUMEN DE COMPRA</div><h3>Tu selección</h3></div><span className="soft-chip">{cart.reduce((sum, item) => sum + item.quantity, 0)} piezas</span></div><Field label="CLIENTA"><select value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">Venta de mostrador</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isMember ? " · Socia" : ""}</option>)}</select></Field><div className="cart-items">{cart.map((item) => <div className="cart-item" key={item.id}><div><b>{item.name}</b><small>{money(item.price)} c/u</small><div className="quantity"><button onClick={() => setCart((list) => list.map((row) => row.id === item.id ? { ...row, quantity: row.quantity - 1 } : row).filter((row) => row.quantity > 0))}>−</button>{item.quantity}<button onClick={() => add(item)}>+</button></div></div><strong>{money(item.price * item.quantity)}</strong><button className="remove-button" onClick={() => setCart((list) => list.filter((row) => row.id !== item.id))}>×</button></div>)}{cart.length === 0 && <Empty title="Tu selección está vacía" text="Agrega una prenda para comenzar." />}</div><div className="totals"><span>Subtotal <b>{money(subtotal)}</b></span>{discount > 0 && <span>Descuento {Math.round(rate * 100)}% <b>− {money(discount)}</b></span>}<strong>Total <b>{money(total)}</b></strong></div><div className="payment-title">MÉTODO DE PAGO</div><div className="payment-choices">{[["cash", "Efectivo"], ["card", "Tarjeta"], ["transfer", "Transferencia"]].map(([value, label]) => <button key={value} className={paymentMethod === value ? "payment-active" : ""} onClick={() => setPaymentMethod(value)}>{label}</button>)}</div><Button disabled={!cart.length || busy || cashOpen !== true} className="checkout" onClick={checkout}>{busy ? "Procesando..." : `Cobrar ${money(total)}`} →</Button></section></div>
    {receipt && <Dialog title={`Ticket #${String(receipt.id).padStart(5, "0")}`} subtitle={`Gracias por elegirnos, ${receipt.customer || "bella"}.`} close={() => setReceipt(null)}><div className="receipt">{receipt.items.map((item) => <div key={item.id}><span>{item.quantity} × {item.name}</span><b>{money(item.price * item.quantity)}</b></div>)}<strong>Total pagado <b>{money(receipt.total)}</b></strong><small>Método: {paymentLabel(receipt.paymentMethod)}{receipt.discount ? ` · Descuento ${money(receipt.discount)}` : ""}</small></div><DialogActions close={() => setReceipt(null)} label="Imprimir ticket" print /></Dialog>}
  </>;
}

function Cash({ branchId, user, revision, onSaved }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api(`/api/cash?branchId=${branchId}`).then(setData).catch((e) => setError(e.message)), [branchId]);
  useEffect(() => { load(); }, [load, revision]);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      if (dialog === "open") await api("/api/cash/open", { method: "POST", body: JSON.stringify({ branchId, openingCash: Number(values.openingCash) }) });
      if (dialog === "movement") await api("/api/cash/movements", { method: "POST", body: JSON.stringify({ ...values, sessionId: data.session.id, amount: Number(values.amount) }) });
      if (dialog === "close") {
        const result = await api("/api/cash/close", { method: "POST", body: JSON.stringify({ sessionId: data.session.id, closingCash: Number(values.closingCash) }) });
        setDialog("");
        await load();
        onSaved(`Corte guardado. Efectivo esperado: ${money(result.expectedCash)} · diferencia: ${money(result.difference)}.`);
        return;
      }
      setDialog(""); await load(); onSaved(dialog === "open" ? "Caja abierta." : "Movimiento de caja registrado.");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  const session = data?.session;
  return <>
    <Heading kicker="CONTROL Y SEGUIMIENTO" title={<>Caja <em>en orden.</em></>} description="Abre turno, registra entradas o retiros y realiza el corte de efectivo." action={data === null ? <span className="soft-chip">Consultando caja...</span> : session ? <span className="soft-chip">Caja abierta · {session.openedBy}</span> : <Button onClick={() => setDialog("open")}>＋ Abrir caja</Button>} />
    <Notice error={error} />
    {data === null ? <div className="panel access-note"><b>Consultando el turno</b><p>Un momento, por favor.</p></div> : session ? <>
      <div className="stats">
        <Stat label="Fondo inicial" value={money(session.openingCash)} detail={`Desde ${new Date(`${session.openedAt.replace(" ", "T")}Z`).toLocaleString("es-MX")}`} icon="$" color="pink" />
        <Stat label="Efectivo esperado" value={money(session.expectedCash)} detail="Efectivo + ingresos − retiros − devoluciones" icon="↗" color="peach" />
        <Stat label="Tarjeta" value={money(session.sales.card)} detail="Ventas completadas" icon="▣" color="lavender" />
        <Stat label="Transferencias" value={money(session.sales.transfer)} detail="Ventas completadas" icon="⇄" color="sage" />
      </div>
      <div className="cash-actions"><Button variant="outline" onClick={() => setDialog("movement")}>Registrar ingreso o retiro</Button><Button onClick={() => setDialog("close")}>Realizar corte</Button></div>
      <div className="section-title"><div><h2>Movimientos de caja</h2><p>Cancelaciones: {money(session.cancelled)} · Devoluciones en efectivo: {money(session.refunds)}</p></div><span className="soft-chip">Ventas en efectivo · {money(session.sales.cash)}</span></div>
      <div className="panel table-wrap"><table><thead><tr><th>FECHA</th><th>TIPO</th><th>RESPONSABLE</th><th>MOTIVO</th><th>IMPORTE</th></tr></thead><tbody>{data.movements.map((item) => <tr key={item.id}><td>{new Date(`${item.createdAt.replace(" ", "T")}Z`).toLocaleString("es-MX")}</td><td>{item.type === "income" ? "Ingreso" : "Retiro"}</td><td>{item.user}</td><td>{item.note}</td><td><b>{money(item.amount)}</b></td></tr>)}</tbody></table>{data.movements.length === 0 && <Empty title="Sin movimientos manuales" text="Aquí aparecerán los ingresos y retiros de esta caja." />}</div>
    </> : <div className="panel access-note"><b>No hay una caja abierta en esta sucursal</b><p>Abre la caja con el fondo inicial para comenzar el turno.</p></div>}
    {data?.recentSessions.length > 0 && <div className="panel table-wrap cash-history"><div className="panel-title"><div><h3>Turnos recientes</h3><p>Aperturas y cortes anteriores de esta sucursal.</p></div></div><table><thead><tr><th>APERTURA</th><th>RESPONSABLE</th><th>FONDO</th><th>ESPERADO</th><th>CONTADO</th><th>CIERRE</th></tr></thead><tbody>{data.recentSessions.map((item) => <tr key={item.id}><td>{new Date(`${item.openedAt.replace(" ", "T")}Z`).toLocaleString("es-MX")}</td><td>{item.openedBy}</td><td>{money(item.openingCash)}</td><td>{item.expectedCash === null ? "—" : money(item.expectedCash)}</td><td>{item.closingCash === null ? "—" : money(item.closingCash)}</td><td>{item.closedAt ? new Date(`${item.closedAt.replace(" ", "T")}Z`).toLocaleString("es-MX") : "Abierta"}</td></tr>)}</tbody></table></div>}
    {dialog === "open" && <Dialog title="Abrir caja" subtitle="Registra el efectivo con el que inicia el turno." close={() => setDialog("")}><form className="form-grid" onSubmit={submit}><Field label="Fondo inicial"><input name="openingCash" type="number" min="0" step=".01" defaultValue="0" required /></Field><DialogActions close={() => setDialog("")} busy={busy} label="Abrir caja" /></form></Dialog>}
    {dialog === "movement" && <Dialog title="Movimiento de caja" subtitle="Registra un ingreso o retiro manual con su motivo." close={() => setDialog("")}><form className="form-grid" onSubmit={submit}><Field label="Tipo"><select name="type"><option value="income">Ingreso</option><option value="expense">Retiro</option></select></Field><Field label="Importe"><input name="amount" type="number" min=".01" step=".01" required /></Field><Field label="Motivo" className="field-wide"><input name="note" required /></Field><DialogActions close={() => setDialog("")} busy={busy} label="Guardar movimiento" /></form></Dialog>}
    {dialog === "close" && <Dialog title="Corte de caja" subtitle={`Efectivo esperado: ${money(session?.expectedCash)}. Cuenta el efectivo disponible y registra el total.`} close={() => setDialog("")}><form className="form-grid" onSubmit={submit}><Field label="Efectivo contado" className="field-wide"><input name="closingCash" type="number" min="0" step=".01" required /></Field><DialogActions close={() => setDialog("")} busy={busy} label="Cerrar caja" /></form></Dialog>}
  </>;
}

function CatalogPage() {
  const [data, setData] = useState({ branches: [], products: [] });
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(() => api(`/api/catalog?search=${encodeURIComponent(query)}`).then(setData).catch((e) => setError(e.message)), [query]);
  useEffect(() => { load(); }, [load]);
  return <main className="catalog-page">
    <header className="catalog-header"><a className="brand" href="/"><span className="brand-flower">✿</span><span><b>Bella</b><small>BOUTIQUE</small></span></a><span className="kicker">CATÁLOGO DIGITAL</span><a className="small-button" href="/">Acceso al sistema</a></header>
    <section className="catalog-intro"><div className="kicker">TEMPORADA BELLA</div><h1>Elegancia que <em>se siente.</em></h1><p>Explora prendas, tallas, colores y existencias en nuestras sucursales.</p><input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por prenda, talla, color o categoría..." /></section>
    {error && <Notice error={error} />}
    <section className="catalog-public-grid">{data.products.map((item, index) => <article className="catalog-card" key={item.id}><div className={`catalog-art tone-${index % 6}`}><span>{item.category}</span><b>BB</b></div><div className="catalog-copy"><div><b>{item.name}</b><small>{item.brand}</small></div><strong>{money(item.price)}</strong></div><div className="product-meta"><span>{item.size} · {item.color}</span></div><div className="catalog-branch-stock">{item.stockByBranch.map((stock) => <span key={stock.branchId}>{data.branches.find((branch) => branch.id === stock.branchId)?.name.replace("Bella Boutique · ", "") || "Sucursal"}<b>{stock.quantity} pzas</b></span>)}</div></article>)}</section>
    {!data.products.length && !error && <Empty title="No encontramos prendas" text="Prueba con otro nombre, talla o color." />}
    <footer className="catalog-footer">Bella Boutique · Inventario actualizado en línea</footer>
  </main>;
}

function Sales({ branchId, user, revision, onSaved }) {
  const [sales, setSales] = useState([]);
  const [error, setError] = useState("");
  const [active, setActive] = useState(null);
  const [detail, setDetail] = useState(null);
  const [replacementItems, setReplacementItems] = useState([]);
  const [mode, setMode] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api(`/api/sales?branchId=${branchId}`).then(setSales).catch((e) => setError(e.message)); }, [branchId, revision]);
  async function openReturn(sale, action) {
    setActive(sale); setMode(action); setDetail(null); setError("");
    try {
      const ticket = await api(`/api/sales/${sale.id}`);
      setDetail(ticket);
      if (action === "exchange") setReplacementItems(await api(`/api/products?branchId=${branchId}`));
    } catch (e) { setError(e.message); }
  }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      if (mode === "cancel") await api(`/api/sales/${active.id}/cancel`, { method: "POST", body: JSON.stringify({ reason: values.reason }) });
      else if (mode === "exchange") {
        const result = await api("/api/exchanges", { method: "POST", body: JSON.stringify({ saleId: active.id, returnedProductId: Number(values.returnedProductId), replacementProductId: Number(values.replacementProductId), quantity: Number(values.quantity), reason: values.reason, tagsIntact: values.tagsIntact === "on", unused: values.unused === "on", paymentMethod: values.paymentMethod }) });
        const difference = result.difference > 0 ? `Diferencia por cobrar: ${money(result.difference)}.` : result.difference < 0 ? `Saldo a favor: ${money(-result.difference)}.` : "Cambio sin diferencia de precio.";
        setActive(null);
        onSaved(difference);
        return;
      } else await api("/api/returns", { method: "POST", body: JSON.stringify({ saleId: active.id, productId: Number(values.productId), quantity: Number(values.quantity), reason: values.reason, tagsIntact: values.tagsIntact === "on", unused: values.unused === "on" }) });
      setActive(null);
      onSaved(mode === "cancel" ? "Venta cancelada y existencias reintegradas." : "Devolución autorizada.");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <>
    <Heading kicker="HISTORIAL DE VENTAS" title={<>Cada venta cuenta <em>una historia.</em></>} description="Consulta tickets, métodos de pago y movimientos de caja." />
    <Notice error={error} />
    <div className="panel table-wrap"><table><thead><tr><th>TICKET</th><th>FECHA</th><th>CLIENTA</th><th>ATENDIÓ</th><th>MÉTODO</th><th>IMPORTE</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td><b>#{String(sale.id).padStart(5, "0")}</b><small>{sale.itemCount} modelos</small></td><td>{new Date(`${sale.createdAt.replace(" ", "T")}Z`).toLocaleString("es-MX")}</td><td>{sale.customer || "Mostrador"}</td><td>{sale.seller}</td><td>{paymentLabel(sale.paymentMethod)}</td><td><b>{money(sale.total)}</b></td><td><span className={`stock-badge ${sale.status === "cancelled" ? "stock-warning" : ""}`}>{sale.status === "completed" ? "Completada" : "Cancelada"}</span></td><td className="action-cell">{user.role === "admin" && <><button className="small-button" disabled={sale.status !== "completed"} onClick={() => openReturn(sale, "return")}>Devolver</button><button className="small-button" disabled={sale.status !== "completed"} onClick={() => openReturn(sale, "exchange")}>Cambiar</button></>}{<button className="small-button" disabled={sale.status !== "completed"} onClick={() => { setActive(sale); setMode("cancel"); }}>Cancelar</button>}</td></tr>)}</tbody></table>{sales.length === 0 && <Empty title="Aún no hay tickets" text="Registra tu primera venta en punto de venta." />}</div>
    {active && <Dialog title={mode === "cancel" ? `Cancelar ticket #${active.id}` : mode === "exchange" ? `Cambio · ticket #${active.id}` : `Devolución · ticket #${active.id}`} subtitle={mode === "cancel" ? "Las existencias volverán al inventario." : "Solo prendas sin uso, con etiqueta y dentro de 15 días."} close={() => setActive(null)}>{error && <Notice error={error} />}{mode !== "cancel" && !detail ? <Empty title="Cargando ticket" text="" /> : <form className="form-grid" onSubmit={submit}>{mode === "cancel" ? <Field label="Motivo" className="field-wide"><input name="reason" minLength="3" required /></Field> : <><Field label={mode === "exchange" ? "Prenda que entrega" : "Prenda"} className="field-wide"><select name={mode === "exchange" ? "returnedProductId" : "productId"} required defaultValue=""><option value="" disabled>Selecciona una prenda</option>{detail.items.map((item) => <option key={item.productId} value={item.productId} disabled={item.lingerie || item.quantity <= item.returned}>{item.name} · {item.quantity - item.returned} disponibles</option>)}</select></Field>{mode === "exchange" && <><Field label="Prenda de cambio" className="field-wide"><select name="replacementProductId" required defaultValue=""><option value="" disabled>Selecciona la nueva prenda</option>{replacementItems.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.size} · {item.color} · {money(item.price)} · {item.stock} pzas</option>)}</select></Field></>}<Field label="Cantidad"><input name="quantity" type="number" min="1" defaultValue="1" required /></Field>{mode === "exchange" && <Field label="Método para cobrar diferencia"><select name="paymentMethod"><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="transfer">Transferencia</option></select></Field>}<Field label="Motivo"><input name="reason" required /></Field><div className="check-options"><label><input type="checkbox" name="tagsIntact" required /> Etiquetas intactas</label><label><input type="checkbox" name="unused" required /> Prenda sin uso</label></div></>}<DialogActions close={() => setActive(null)} busy={busy} label={mode === "cancel" ? "Confirmar cancelación" : mode === "exchange" ? "Registrar cambio" : "Autorizar devolución"} /></form>}</Dialog>}
  </>;
}

function Customers({ user, revision, onSaved }) {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api(`/api/customers?search=${encodeURIComponent(query)}`).then(setItems).catch((e) => setError(e.message)), [query]);
  useEffect(() => { load(); }, [load, revision]);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    const f = new FormData(event.currentTarget);
    try {
      await api("/api/customers", { method: "POST", body: JSON.stringify({ name: f.get("name"), phone: f.get("phone"), email: f.get("email"), isMember: f.has("member"), privacyAccepted: f.has("privacy"), promoConsent: f.has("promotions") }) });
      setOpen(false); await load(); onSaved();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <>
    <Heading kicker="RELACIONES BONITAS" title={<>Clientas que <em>vuelven.</em></>} description="Cuida sus preferencias y celebra su lealtad." action={user.role !== "seller" && <Button onClick={() => setOpen(true)}>＋ Registrar clienta</Button>} />
    <Notice error={error} />
    <div className="welcome-banner"><span>♡</span><div><b>Un trato especial, siempre</b><small>Las socias Bella reciben 20% de descuento. Al superar $20,000 anuales, aplica 30%.</small></div></div>
    <div className="toolbar"><input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar nombre, teléfono o número de socia..." /><span className="soft-chip">{items.length} clientas</span></div>
    <div className="customer-grid">{items.map((item, index) => <article className="customer-card" key={item.id}><span className={`customer-avatar avatar-${index % 5}`}>{item.name.split(" ").map((word) => word[0]).slice(0, 2).join("")}</span><h3>{item.name}</h3><span>{item.isMember ? `Socia Bella · ${item.membershipNumber}` : "Clienta"}</span><p>{item.phone || "Sin teléfono"}<br />{item.email || "Sin correo"}</p><div className="customer-meta"><span>N.º SOCIA <b>{item.memberNumber}</b></span><span>COMPRAS <b>{money(item.lifetimeSpend)}</b></span></div></article>)}</div>
    {items.length === 0 && <Empty title="Comienza tu comunidad Bella" text="Registra a tu primera clienta." />}
    {open && <Dialog title="Registrar clienta" subtitle="La aceptación del aviso de privacidad es obligatoria." close={() => setOpen(false)}><form className="form-grid" onSubmit={submit}><Field label="Nombre completo"><input name="name" required /></Field><Field label="Teléfono"><input name="phone" type="tel" /></Field><Field label="Correo"><input name="email" type="email" /></Field><div className="check-options"><label><input type="checkbox" name="member" /> Inscribir como socia Bella</label><label><input type="checkbox" name="privacy" required /> Acepta el aviso de privacidad</label><label><input type="checkbox" name="promotions" /> Acepta recibir promociones</label></div><DialogActions close={() => setOpen(false)} busy={busy} label="Registrar clienta" /></form></Dialog>}
  </>;
}

function Suppliers({ user, revision, onSaved }) {
  const [items, setItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [deliverySupplier, setDeliverySupplier] = useState(null);
  const [historySupplier, setHistorySupplier] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [deliveryBranch, setDeliveryBranch] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api("/api/suppliers").then(setItems).catch((e) => setError(e.message)), []);
  useEffect(() => {
    Promise.all([api("/api/branches"), api(`/api/products?branchId=${deliveryBranch}`)])
      .then(([availableBranches, availableProducts]) => { setBranches(availableBranches); setProducts(availableProducts); })
      .catch((e) => setError(e.message));
  }, [deliveryBranch]);
  useEffect(() => { load(); }, [load, revision]);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { await api("/api/suppliers", { method: "POST", body: JSON.stringify(values) }); setOpen(false); await load(); onSaved(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function submitDelivery(event) {
    event.preventDefault(); setBusy(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await api(`/api/suppliers/${deliverySupplier.id}/deliveries`, { method: "POST", body: JSON.stringify({ ...values, branchId: Number(values.branchId), productId: Number(values.productId), quantity: Number(values.quantity) }) });
      setDeliverySupplier(null); await load(); onSaved();
    }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function showHistory(supplier) {
    setHistorySupplier(supplier); setDeliveries([]);
    try { setDeliveries(await api(`/api/suppliers/${supplier.id}/deliveries`)); }
    catch (e) { setError(e.message); }
  }
  return <>
    <Heading kicker="RED DE COLABORADORES" title={<>Proveedores de <em>confianza.</em></>} description="Ten a la mano sus datos y registra cada surtido de mercancía." action={<Button onClick={() => setOpen(true)}>＋ Agregar proveedor</Button>} />
    <Notice error={error} /><div className="supplier-grid">{items.map((item, index) => <article className="supplier-card" key={item.id}><span className={`supplier-icon tone-${index % 6}`}>↗</span><small>{item.supplier_number} · PROVEEDOR</small><h3>{item.name}</h3><p>{item.distributor || "Distribuidora independiente"}</p><hr /><span>Teléfono <b>{item.phone || "No registrado"}</b></span><span>Correo <b>{item.email || "No registrado"}</b></span><span>Dirección <b>{item.address || "No registrada"}</b></span><span>Último surtido <b>{item.lastSupplyDate || "Sin surtidos"}</b></span><span>Piezas suministradas <b>{item.suppliedUnits}</b></span><Button variant="outline" onClick={() => setDeliverySupplier(item)}>Registrar surtido</Button><Button variant="outline" onClick={() => showHistory(item)}>Historial de surtidos</Button></article>)}</div>
    {items.length === 0 && <Empty title="Agrega tu primer proveedor" text="Aquí consultarás la información de tus distribuidores." />}
    {open && <Dialog title="Nuevo proveedor" subtitle="Guarda los datos de contacto de tu distribuidor." close={() => setOpen(false)}><form className="form-grid" onSubmit={submit}><Field label="Nombre"><input name="name" required /></Field><Field label="Distribuidora"><input name="distributor" /></Field><Field label="Teléfono"><input name="phone" /></Field><Field label="Correo"><input name="email" type="email" /></Field><Field label="Dirección" className="field-wide"><input name="address" /></Field><p className="field-wide">El número de proveedor se asigna al guardar.</p><DialogActions close={() => setOpen(false)} busy={busy} label="Guardar proveedor" /></form></Dialog>}
    {deliverySupplier && <Dialog title={`Surtido · ${deliverySupplier.name}`} subtitle="Registra la fecha, la prenda, la sucursal y las piezas recibidas." close={() => setDeliverySupplier(null)}><form className="form-grid" onSubmit={submitDelivery}><Field label="Prenda" className="field-wide"><select name="productId" required defaultValue=""><option value="" disabled>Selecciona una prenda</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.size} · {item.color}</option>)}</select></Field><Field label="Sucursal"><select name="branchId" value={deliveryBranch} onChange={(event) => setDeliveryBranch(Number(event.target.value))}>{branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Piezas recibidas"><input name="quantity" type="number" min="1" required /></Field><Field label="Fecha de surtido"><input name="suppliedDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></Field><Field label="Nota"><input name="note" placeholder="Factura o referencia" /></Field><DialogActions close={() => setDeliverySupplier(null)} busy={busy} label="Registrar surtido" /></form></Dialog>}
    {historySupplier && <Dialog title={`Surtidos · ${historySupplier.name}`} subtitle="Historial de entradas de mercancía registradas para este proveedor." close={() => setHistorySupplier(null)}><div className="table-wrap"><table><thead><tr><th>FECHA</th><th>PRENDA</th><th>SUCURSAL</th><th>PIEZAS</th><th>RECIBIÓ</th></tr></thead><tbody>{deliveries.map((item) => <tr key={item.id}><td>{item.suppliedDate}</td><td>{item.product} · {item.size} · {item.color}<small>{item.note}</small></td><td>{item.branch}</td><td>{item.quantity}</td><td>{item.receivedBy}</td></tr>)}</tbody></table>{deliveries.length === 0 && <Empty title="Sin surtidos registrados" text="Registra el primer surtido para este proveedor." />}</div></Dialog>}
  </>;
}

function Team({ user, branches, revision, onSaved }) {
  const isPrimaryAdmin = user.username === primaryAdminUsername;
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (user.role === "admin") api("/api/users").then(setItems).catch((e) => setError(e.message)); }, [user.role, revision]);
  async function create(event) {
    event.preventDefault(); setBusy(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { await api("/api/users", { method: "POST", body: JSON.stringify({ ...values, branchId: Number(values.branchId) }) }); setOpen(false); onSaved("Cuenta creada."); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function toggleActive(account) {
    const active = !account.active;
    if (!active && !window.confirm(`¿Desactivar la cuenta de ${account.name}? No podrá iniciar sesión.`)) return;
    setError("");
    try {
      await api(`/api/users/${account.id}/active`, { method: "PATCH", body: JSON.stringify({ active }) });
      onSaved(active ? "Cuenta activada." : "Cuenta desactivada.");
    } catch (e) { setError(e.message); }
  }
  async function changePassword(event) {
    event.preventDefault(); setBusy(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { await api("/api/password", { method: "POST", body: JSON.stringify(values) }); setPasswordOpen(false); onSaved("Contraseña actualizada."); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <>
    <Heading kicker="EQUIPO BELLA" title={<>Un gran equipo, <em>un mismo estilo.</em></>} description="Administra las cuentas y cambia tu contraseña." action={<div className="heading-actions"><Button variant="outline" onClick={() => setPasswordOpen(true)}>Cambiar contraseña</Button>{isPrimaryAdmin && <Button onClick={() => setOpen(true)}>＋ Agregar cuenta</Button>}{user.role === "admin" && !isPrimaryAdmin && <span className="soft-chip">Solo la cuenta principal puede agregar cuentas.</span>}</div>} />
    <Notice error={error} />
    {user.role === "admin" ? <div className="panel table-wrap"><table><thead><tr><th>PERSONA</th><th>USUARIO</th><th>PERFIL</th><th>SUCURSAL</th><th>ESTADO</th><th></th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><b>{item.name}</b></td><td>{item.username}</td><td>{roles[item.role]}</td><td>{item.branch}</td><td><span className={`stock-badge ${item.active ? "" : "stock-warning"}`}>{item.active ? "Activa" : "Inactiva"}</span></td><td><button className="small-button" disabled={item.username === primaryAdminUsername || item.id === user.id} title={item.username === primaryAdminUsername ? "La cuenta principal no puede desactivarse" : undefined} onClick={() => toggleActive(item)}>{item.active ? "Desactivar" : "Activar"}</button></td></tr>)}</tbody></table></div> : <div className="panel access-note"><b>Administración de cuentas</b><p>Solo administración puede consultar y agregar usuarios.</p></div>}
    {open && <Dialog title="Agregar cuenta" subtitle="Elige un perfil y asigna una sucursal." close={() => setOpen(false)}><form className="form-grid" onSubmit={create}><Field label="Nombre"><input name="name" required /></Field><Field label="Usuario"><input name="username" pattern="[a-zA-Z0-9._-]{3,30}" required /></Field><Field label="Perfil"><select name="role"><option value="seller">Vendedor</option><option value="cashier">Cajero</option><option value="admin">Administración</option></select></Field><Field label="Sucursal"><select name="branchId">{branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Contraseña inicial (10+ caracteres)" className="field-wide"><input name="password" type="password" minLength="10" required /></Field><DialogActions close={() => setOpen(false)} busy={busy} label="Crear cuenta" /></form></Dialog>}
    {passwordOpen && <Dialog title="Cambiar contraseña" subtitle="La nueva contraseña debe tener al menos 10 caracteres." close={() => setPasswordOpen(false)}><form className="form-grid" onSubmit={changePassword}><Field label="Contraseña actual" className="field-wide"><input name="currentPassword" type="password" required /></Field><Field label="Nueva contraseña" className="field-wide"><input name="newPassword" type="password" minLength="10" required /></Field><DialogActions close={() => setPasswordOpen(false)} busy={busy} label="Actualizar contraseña" /></form></Dialog>}
  </>;
}

function Reports({ branchId, revision }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api(`/api/reports?branchId=${branchId}&month=${month}`).then(setData).catch((e) => setError(e.message)); }, [branchId, month, revision]);
  const dailyByDate = new Map((data?.daily || []).map((item) => [item.date, item]));
  const refundByDate = new Map((data?.refunds || []).map((item) => [item.date, item]));
  const cancelByDate = new Map((data?.cancellations || []).map((item) => [item.date, item]));
  const dates = [...new Set([...dailyByDate.keys(), ...refundByDate.keys(), ...cancelByDate.keys()])].sort((a, b) => b.localeCompare(a));
  const salesTotal = data?.daily.reduce((sum, item) => sum + item.total, 0) || 0;
  return <>
    <Heading kicker="NÚMEROS QUE CUENTAN" title={<>Tu tienda, en <em>perspectiva.</em></>} description="Ventas por día, equipo e inventario." action={<Field label="MES"><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>} />
    <Notice error={error} />
    <div className="stats">
      <Stat label="Ventas del mes" value={money(salesTotal)} detail={`${data?.daily.length || 0} días con ventas`} icon="↗" color="pink" />
      <Stat label="Tickets" value={data?.daily.reduce((sum, item) => sum + item.sales, 0) || 0} detail="Ventas completadas" icon="◷" color="peach" />
      <Stat label="Usuarios activos" value={data?.users ?? "—"} detail="En el sistema" icon="♙" color="lavender" />
      <Stat label="Productos" value={data?.inventory.length ?? "—"} detail="En esta sucursal" icon="◈" color="sage" />
    </div>
    <div className="reports-grid"><section className="panel table-wrap"><div className="panel-title"><div><h3>Ventas por día</h3><p>Pagos, cancelaciones y devoluciones</p></div></div><table><thead><tr><th>FECHA</th><th>TICKETS</th><th>EFECTIVO</th><th>TARJETA</th><th>TRANSFERENCIA</th><th>CANCELACIONES</th><th>DEVOLUCIONES</th><th>TOTAL</th></tr></thead><tbody>{dates.map((date) => <tr key={date}><td>{new Date(`${date}T12:00:00`).toLocaleDateString("es-MX")}</td><td>{dailyByDate.get(date)?.sales || 0}</td><td>{money(dailyByDate.get(date)?.cash)}</td><td>{money(dailyByDate.get(date)?.card)}</td><td>{money(dailyByDate.get(date)?.transfer)}</td><td>{money(cancelByDate.get(date)?.total)}</td><td>{money(refundByDate.get(date)?.total)}</td><td><b>{money(dailyByDate.get(date)?.total)}</b></td></tr>)}</tbody></table>{data && dates.length === 0 && <Empty title="Sin movimientos este mes" text="Cuando registres ventas, aparecerán aquí." />}</section><section className="panel seller-panel"><div className="panel-title"><div><h3>Ventas por cajero</h3><p>Rendimiento individual</p></div></div>{data?.sellers.map((item) => <div className="activity-row" key={item.name}><div><b>{item.name}</b><small>{item.sales} tickets</small></div><strong>{money(item.total)}</strong></div>)}</section></div>
    <div className="panel table-wrap report-inventory"><div className="panel-title"><div><h3>Inventario actual</h3><p>Existencias de la sucursal</p></div></div><table><thead><tr><th>PRENDA</th><th>CATEGORÍA</th><th>TALLA · COLOR</th><th>EXISTENCIAS</th><th>ESTADO</th></tr></thead><tbody>{data?.inventory.map((item) => <tr key={item.id}><td><b>{item.name}</b></td><td>{item.category}</td><td>{item.size} · {item.color}</td><td>{item.quantity}</td><td>{item.quantity < item.stockMin ? "Por reponer" : "Disponible"}</td></tr>)}</tbody></table></div>
  </>;
}

function DialogActions({ close, busy, label, print }) {
  return <div className="dialog-actions">{print && <Button type="button" variant="outline" onClick={() => window.print()}>Imprimir ticket</Button>}<Button type="button" variant="outline" onClick={close}>Cerrar</Button>{!print && <Button disabled={busy}>{busy ? "Guardando..." : label}</Button>}</div>;
}

function paymentLabel(method) {
  return ({ cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia" })[method] || method;
}
