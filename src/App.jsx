import { useCallback, useEffect, useState } from "react";
import {
  Archive, ArrowRight, ArrowUpRight, BadgePercent, Banknote, Bell, BookOpen, Boxes,
  Check, ChevronDown, CircleHelp, Clock3, CreditCard, FileText, Flower2,
  Heart, LayoutDashboard, LogOut, Menu, Package, Plus, Printer, Search, Settings2,
  ShoppingBag, ShoppingCart, SlidersHorizontal, Sparkles, Store, Truck, UserRound,
  Users, WalletCards, X,
} from "lucide-react";
import ProjectDocumentation from "./ProjectDocumentation.jsx";

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const money = (value) => currency.format(Number(value || 0));
const roleNames = { admin: "Administración", cashier: "Cajero", seller: "Vendedor" };
const rolePages = {
  admin: ["Punto de venta", "Productos", "Inventario", "Ventas", "Clientes", "Proveedores", "Equipo", "Reportes", "Proyecto"],
  cashier: ["Punto de venta", "Ventas", "Clientes", "Reportes"],
  seller: ["Punto de venta", "Productos", "Inventario", "Clientes"],
};
const accessModules = [
  { page: "Punto de venta", label: "Punto de venta", description: "Registrar una venta", icon: ShoppingCart, color: "rose" },
  { page: "Productos", label: "Productos", description: "Consultar el catálogo", icon: Package, color: "peach" },
  { page: "Inventario", label: "Inventario", description: "Revisar existencias", icon: Boxes, color: "lavender" },
  { page: "Ventas", label: "Ventas", description: "Consultar tickets", icon: ShoppingBag, color: "rose" },
  { page: "Clientes", label: "Clientes", description: "Atender a las clientas", icon: Users, color: "lavender" },
  { page: "Proveedores", label: "Proveedores", description: "Administrar proveedores", icon: Truck, color: "peach" },
  { page: "Equipo", label: "Equipo", description: "Administrar usuarios", icon: UserRound, color: "sage" },
  { page: "Reportes", label: "Reportes", description: "Revisar resultados", icon: FileText, color: "sage" },
  { page: "Proyecto", label: "Proyecto", description: "Ver la documentación", icon: BookOpen, color: "lavender" },
  { href: "/catalogo", label: "Catálogo digital", description: "Ver prendas disponibles", icon: Store, color: "peach" },
];

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    credentials: "same-origin",
  });
  const data = await response.json().catch(() => ({}));
  if (response.headers.get("X-Session-Invalid") === "true") {
    window.dispatchEvent(new Event("bella:session-expired"));
  }
  if (!response.ok) throw new Error(data.error || "No se pudo completar la operación.");
  return data;
}

function App() {
  const [user, setUser] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(1);
  const [page, setPage] = useState("Inicio");
  const [mobileNav, setMobileNav] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
      setPage("Inicio");
    };
    window.addEventListener("bella:session-expired", handleSessionExpired);
    request("/api/branches").then(setBranches).catch(() => setBranches([]));
    request("/api/me").then(({ user: current }) => {
      if (!current) return;
      setUser(current);
      if (current.branchId) setBranchId(current.branchId);
    }).catch(() => {});
    return () => window.removeEventListener("bella:session-expired", handleSessionExpired);
  }, []);

  const notify = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }, []);

  async function login(event) {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await request("/api/login", { method: "POST", body: JSON.stringify({ username: form.get("username"), password: form.get("password") }) });
      setUser(result.user);
      setPage("Inicio");
      if (result.user.branchId) setBranchId(result.user.branchId);
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setLoginBusy(false);
    }
  }

  async function logout() {
    try {
      await request("/api/logout", { method: "POST" });
      setUser(null);
      setPage("Inicio");
    } catch (error) {
      notify(error.message);
    }
  }

  const refresh = () => setRefreshKey((key) => key + 1);
  const notifySaved = (message) => { refresh(); notify(message); };
  const navigate = (target) => {
    if (target !== "Inicio" && !rolePages[user?.role]?.includes(target)) return;
    setPage(target);
    setMobileNav(false);
  };
  const currentBranchId = user?.role === "admin" ? branchId : user?.branchId || branchId;
  const activeBranch = branches.find((branch) => branch.id === Number(currentBranchId));

  if (!user) return <Login onSubmit={login} error={loginError} busy={loginBusy} />;
  const visiblePages = rolePages[user.role] || [];
  const activePage = page !== "Inicio" && !visiblePages.includes(page) ? "Inicio" : page;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage("Inicio"); }}>
          <span className="brand-mark"><Flower2 size={24} strokeWidth={1.5} /></span>
          <span className="brand-copy"><strong>Bella</strong><small>BOUTIQUE</small></span>
        </a>
        <div className="workspace-label">ESPACIO DE TRABAJO</div>
        <nav className="main-nav">
          <NavButton icon={LayoutDashboard} label="Inicio" active={activePage === "Inicio"} onClick={navigate} />
          {visiblePages.includes("Punto de venta") && <NavButton icon={ShoppingCart} label="Punto de venta" active={activePage === "Punto de venta"} onClick={navigate} />}
          <div className="nav-divider" />
          <span className="nav-section">TIENDA</span>
          {visiblePages.includes("Productos") && <NavButton icon={Package} label="Productos" active={activePage === "Productos"} onClick={navigate} />}
          {visiblePages.includes("Inventario") && <NavButton icon={Boxes} label="Inventario" active={activePage === "Inventario"} onClick={navigate} />}
          {visiblePages.includes("Ventas") && <NavButton icon={ShoppingBag} label="Ventas" active={activePage === "Ventas"} onClick={navigate} />}
          {visiblePages.includes("Clientes") && <NavButton icon={Users} label="Clientes" active={activePage === "Clientes"} onClick={navigate} />}
          {visiblePages.includes("Proveedores") && <NavButton icon={Truck} label="Proveedores" active={activePage === "Proveedores"} onClick={navigate} />}
          {visiblePages.includes("Equipo") && <NavButton icon={UserRound} label="Equipo" active={activePage === "Equipo"} onClick={navigate} />}
          <a className="nav-button" href="/catalogo"><Store size={18} strokeWidth={1.7} /><span>Catálogo digital</span></a>
          {(visiblePages.includes("Reportes") || visiblePages.includes("Proyecto")) && <>
            <div className="nav-divider" />
            <span className="nav-section">ANÁLISIS</span>
            {visiblePages.includes("Reportes") && <NavButton icon={FileText} label="Reportes" active={activePage === "Reportes"} onClick={navigate} />}
            {visiblePages.includes("Proyecto") && <NavButton icon={BookOpen} label="Proyecto" active={activePage === "Proyecto"} onClick={navigate} />}
          </>}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><span className="help-icon"><CircleHelp size={17} /></span><div><b>¿Necesitas ayuda?</b><small>Estamos para ayudarte</small></div><ArrowRight size={15} /></div>
          <div className="profile">
            <div className="avatar">{user.name?.slice(0, 1) || "B"}</div>
            <div className="profile-name"><b>{user.name}</b><small>{roleNames[user.role]}</small></div>
            <button className="icon-button profile-logout" title="Cerrar sesión" onClick={logout}><LogOut size={16} /></button>
          </div>
          <span className="version-note">BELLA POS · VERSIÓN 1.0</span>
        </div>
      </aside>
      {mobileNav && <button className="mobile-backdrop" aria-label="Cerrar menú" onClick={() => setMobileNav(false)} />}
      <main className="main-content">
        <header className="topbar">
          <button className="icon-button menu-toggle" aria-label="Abrir menú" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
          <div className="breadcrumb">Bella Boutique <span>/</span> <b>{activePage}</b></div>
          <div className="topbar-right">
            <div className="branch-select"><Store size={16} /><select value={branchId} onChange={(event) => setBranchId(Number(event.target.value))} aria-label="Sucursal">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name.replace("Bella Boutique · ", "")}</option>)}</select><ChevronDown size={14} /></div>
            <span className="topbar-separator" />
            <button className="icon-button notification-button" aria-label="Notificaciones"><Bell size={18} /><i /></button>
            <div className="topbar-avatar">{user.name?.slice(0, 1) || "B"}</div>
          </div>
        </header>
        <section className="page-content">
          {activePage === "Inicio" && <Dashboard branchId={currentBranchId} branchName={activeBranch?.name || "Bella Boutique"} userRole={user.role} onNavigate={navigate} refreshKey={refreshKey} />}
          {activePage === "Punto de venta" && <PointOfSale branchId={currentBranchId} user={user} onComplete={() => { refresh(); notify("¡Venta guardada y existencias actualizadas!"); }} />}
          {activePage === "Productos" && <Products branchId={branchId} user={user} refreshKey={refreshKey} onSaved={notifySaved} />}
          {activePage === "Inventario" && <Inventory branchId={branchId} user={user} refreshKey={refreshKey} onSaved={() => { refresh(); notify("Inventario actualizado correctamente."); }} />}
          {activePage === "Ventas" && <Sales branchId={currentBranchId} user={user} refreshKey={refreshKey} onSaved={notifySaved} />}
          {activePage === "Clientes" && <Customers refreshKey={refreshKey} onSaved={() => { refresh(); notify("Cliente registrado correctamente."); }} />}
          {activePage === "Proveedores" && <Suppliers user={user} refreshKey={refreshKey} onSaved={() => { refresh(); notify("Proveedor registrado correctamente."); }} />}
          {activePage === "Equipo" && <Team user={user} branches={branches} refreshKey={refreshKey} onSaved={(message) => { refresh(); notify(message || "Cuenta de equipo creada correctamente."); }} />}
          {activePage === "Reportes" && <Reports branchId={currentBranchId} refreshKey={refreshKey} />}
          {activePage === "Proyecto" && <ProjectDocumentation />}
        </section>
      </main>
      {toast && <div className="toast"><span className="toast-check"><Check size={15} /></span>{toast}</div>}
    </div>
  );
}

function Login({ onSubmit, error, busy }) {
  return (
    <main className="login-page">
      <div className="login-decoration decor-one" /><div className="login-decoration decor-two" />
      <section className="login-card">
        <a className="brand login-brand" href="#"><span className="brand-mark"><Flower2 size={25} strokeWidth={1.5} /></span><span className="brand-copy"><strong>Bella</strong><small>BOUTIQUE</small></span></a>
        <div className="login-eyebrow"><span /> SISTEMA DE PUNTO DE VENTA</div>
        <h1>Bienvenida de<br /><em>vuelta.</em></h1>
        <p className="login-subtitle">Entra a tu espacio para que cada detalle de tu tienda esté en su lugar.</p>
        <form onSubmit={onSubmit} className="login-form">
          <label>Usuario<input name="username" autoComplete="username" placeholder="Tu usuario" required autoFocus /></label>
          <label>Contraseña<input type="password" name="password" autoComplete="current-password" placeholder="Tu contraseña" required /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="button button-primary login-submit" disabled={busy}>{busy ? "Ingresando..." : "Iniciar sesión"} <ArrowRight size={17} /></button>
        </form>
        <div className="login-demo"><Sparkles size={15} /><span>Acceso de prueba</span><b>admin</b><i>·</i><span>contraseña</span><b>Bella2026!</b></div>
        <a className="login-catalog-link" href="/catalogo"><Store size={15} /> Explorar catálogo digital</a>
        <div className="login-footer"><span>© Bella Boutique</span><span>Hecho con cariño <Heart size={12} /></span></div>
      </section>
      <aside className="login-visual"><div className="visual-caption"><span>UNA NUEVA TEMPORADA</span><strong>Elegancia que<br />se siente.</strong><i>Descubre una experiencia de compra hecha para ti.</i></div><div className="visual-stamp"><Flower2 size={21} /><span>ESTILO<br />BELLA</span></div></aside>
    </main>
  );
}

function NavButton({ icon: Icon, label, active, onClick }) {
  return <button className={`nav-button ${active ? "nav-active" : ""}`} onClick={() => onClick(label)}><Icon size={18} strokeWidth={active ? 2 : 1.7} /><span>{label}</span>{active && <span className="nav-active-dot" />}</button>;
}

function PageHeader({ eyebrow, title, description, action }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function Dashboard({ branchId, branchName, userRole, onNavigate, refreshKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const canSeeSales = userRole === "admin" || userRole === "cashier";
  const availableModules = accessModules.filter(({ page: target, href }) => href || rolePages[userRole]?.includes(target));
  useEffect(() => {
    request(`/api/dashboard?branchId=${branchId}`).then((result) => { setData(result); setError(""); }).catch((reason) => setError(reason.message));
  }, [branchId, refreshKey]);
  const date = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  return <>
    <PageHeader eyebrow={date} title={<>Hola, <em>qué gusto verte.</em></>} description={`Este es el resumen de ${branchName}. Aquí tienes lo más importante de hoy.`} action={<button className="button button-primary" onClick={() => onNavigate("Punto de venta")}><Plus size={17} /> Nueva venta</button>} />
    {error && <ErrorBanner message={error} />}
    <div className="welcome-strip"><div className="welcome-icon"><Sparkles size={19} /></div><div><b>Un día bonito para vender</b><span>Tu tienda está lista. Aquí tienes todo bajo control.</span></div><span className="strip-decoration">✳</span></div>
    <div className="section-heading"><div><h2>Resumen de hoy</h2><p>Un vistazo a cómo va tu tienda.</p></div><span className="live-badge"><i /> Actualizado ahora</span></div>
    <div className={`stats-grid ${canSeeSales ? "" : "stats-two"}`}>
      {canSeeSales && <StatCard title="Ventas de hoy" value={money(data?.today?.total)} note={`${data?.today?.count || 0} tickets registrados`} icon={WalletCards} color="rose" trend="Hoy" />}
      {canSeeSales && <StatCard title="Ventas del mes" value={money(data?.month)} note="Acumulado mensual" icon={ArrowUpRight} color="peach" trend="Este mes" />}
      <StatCard title="Piezas en tienda" value={data?.inventory.units ?? "—"} note={`${data?.inventory.products || 0} modelos disponibles`} icon={Package} color="lavender" trend="Inventario" />
      <StatCard title="Por reponer" value={data?.inventory.lowStock ?? "—"} note="Modelos con pocas existencias" icon={Bell} color="sage" trend="Atención" />
    </div>
    <div className={`dashboard-grid ${canSeeSales ? "" : "inventory-only"}`}>
      {canSeeSales && <section className="panel recent-panel"><div className="panel-header"><div><h3>Actividad reciente</h3><p>Los últimos movimientos de tu tienda</p></div><button className="text-button" onClick={() => onNavigate("Ventas")}>Ver todas <ArrowRight size={15} /></button></div>
        {data?.recent?.length ? <div className="recent-list">{data.recent.map((sale) => <div className="recent-row" key={sale.id}><div className="sale-icon"><ShoppingBag size={17} /></div><div className="recent-info"><b>{sale.customer || "Venta de mostrador"}</b><small>Ticket #{String(sale.id).padStart(5, "0")} · {sale.seller}</small></div><div className="recent-amount"><b>{money(sale.total)}</b><small>{paymentName(sale.paymentMethod)}</small></div><span className="status-pill">Completada</span></div>)}</div> : <EmptyState icon={ShoppingBag} title="Aún no hay ventas" text="Cuando registres una venta, aparecerá aquí." />}
      </section>}
      <section className="panel low-panel"><div className="panel-header"><div><h3>Stock por revisar</h3><p>Modelos que necesitan atención</p></div>{rolePages[userRole]?.includes("Inventario") && <button className="round-arrow" title="Ver inventario" onClick={() => onNavigate("Inventario")}><ArrowRight size={17} /></button>}</div>
        {data?.lowStock?.length ? <div className="low-list">{data.lowStock.map((product) => <div className="low-row" key={product.id}><div className="low-product-icon"><Package size={16} /></div><div className="low-product-name"><b>{product.name}</b><small>{product.size} · {product.color}</small></div><span className={product.quantity === 0 ? "stock-count stock-empty" : "stock-count"}>{product.quantity} pza</span></div>)}</div> : <div className="stock-good"><span><Check size={17} /></span><div><b>Todo en orden</b><small>Tu inventario está bien surtido.</small></div></div>}
      </section>
    </div>
    <section className="quick-actions"><div><h3>Accesos de tu perfil</h3><p>Herramientas disponibles para {roleNames[userRole] || "tu cuenta"}.</p></div><div className="quick-action-grid">{availableModules.map((module) => <QuickAction key={module.page || module.href} {...module} onClick={module.page ? () => onNavigate(module.page) : undefined} />)}</div></section>
  </>;
}

function StatCard({ title, value, note, icon: Icon, color, trend }) {
  return <article className="stat-card"><div className="stat-top"><span className={`stat-icon ${color}`}><Icon size={19} /></span><span className="stat-period">{trend}<ChevronDown size={12} /></span></div><div className="stat-value">{value}</div><div className="stat-title">{title}</div><div className="stat-note">{note}</div></article>;
}

function QuickAction({ icon: Icon, color, label, description, href, onClick }) {
  const content = <><span className={`quick-icon ${color}`}><Icon size={18} /></span><span className="quick-action-copy"><b>{label}</b><small>{description}</small></span><ArrowRight size={15} className="quick-arrow" /></>;
  return href ? <a className="quick-action" href={href}>{content}</a> : <button className="quick-action" onClick={onClick}>{content}</button>;
}

function Products({ branchId, user, refreshKey, onSaved }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(() => request(`/api/products?branchId=${branchId}&search=${encodeURIComponent(search)}`).then(setProducts).catch((reason) => setError(reason.message)), [branchId, search]);
  useEffect(() => { load(); }, [load, refreshKey]);
  async function submit(event) {
    event.preventDefault();
    setSaving(true); setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const values = Object.fromEntries(form.entries());
    try {
      await request("/api/products", { method: "POST", body: JSON.stringify({ ...values, price: Number(values.price), cost: Number(values.cost), stock: Number(values.stock), stockMin: Number(values.stockMin), branchId, lingerie: values.category === "Lencería" }) });
      setOpen(false); setNotice("Producto registrado y guardado en la base de datos."); formElement.reset(); await load(); onSaved("Producto registrado correctamente.");
    } catch (reason) { setError(reason.message); }
    finally { setSaving(false); }
  }
  async function retire(product) {
    if (!window.confirm(`¿Retirar "${product.name}" del catálogo? Se conservarán sus tickets históricos.`)) return;
    setError("");
    try {
      await request(`/api/products/${product.id}`, { method: "DELETE" });
      await load();
      onSaved("Producto retirado del catálogo. Sus tickets históricos se conservaron.");
    } catch (reason) { setError(reason.message); }
  }
  return <>
    <PageHeader eyebrow="TU CATÁLOGO" title={<>Piezas con <em>personalidad.</em></>} description="Cada prenda, cada talla y cada color, organizados en un solo lugar." action={user.role === "admin" ? <button className="button button-primary" onClick={() => setOpen(true)}><Plus size={17} /> Agregar producto</button> : null} />
    {error && <ErrorBanner message={error} />}{notice && <SuccessBanner message={notice} onClose={() => setNotice("")} />}
    <div className="toolbar"><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, talla, color o código..." /><kbd>⌘ K</kbd></label><button className="button button-outline" onClick={() => setSearch("")}><SlidersHorizontal size={16} /> Limpiar</button></div>
    <div className="catalog-meta"><span><b>{products.length}</b> estilos disponibles</span><div className="category-pills"><span className="category-pill active-pill">Todos</span><span className="category-pill">Vestidos</span><span className="category-pill">Blusas</span><span className="category-pill">Sacos</span></div><span className="catalog-branch"><Store size={14} /> Esta sucursal</span></div>
    <div className="product-grid">{products.map((product, index) => <article className="product-card" key={product.id}><div className={`product-art art-${index % 6}`}><span className="product-category">{product.category}</span>{user.role === "admin" ? <button className="product-heart product-retire" title={`Retirar ${product.name} del catálogo`} aria-label={`Retirar ${product.name} del catálogo`} onClick={() => retire(product)}><Archive size={15} /></button> : <span className="product-heart"><Heart size={16} /></span>}<ProductIllustration index={index} /><span className="art-brand">{product.brand || "BELLA STUDIO"}</span></div><div className="product-detail"><div><h3>{product.name}</h3><span>{product.brand || "Colección Bella"}</span></div><strong>{money(product.price)}</strong></div><div className="product-tags"><span>{product.size}</span><span className="swatch" style={{ backgroundColor: colorHex(product.color) }} />{product.color}<span className={`product-stock ${product.stock <= product.stockMin ? "stock-warn" : ""}`}>{product.stock} pza{product.stock !== 1 ? "s" : ""}</span></div><div className="product-barcode"><span>{product.barcode}</span><span className="barcode-bars">▥</span></div></article>)}</div>
    {products.length === 0 && <EmptyState icon={Package} title="No encontramos ese estilo" text="Prueba con otro nombre, código o color." />}
    {open && <Modal title="Agregar una prenda" subtitle="Registra sus detalles para tenerla en tu catálogo." onClose={() => setOpen(false)}><form className="form-grid" onSubmit={submit}><Field label="Nombre de la prenda"><input name="name" required placeholder="Ej. Vestido Aurora" /></Field><Field label="Marca"><input name="brand" placeholder="Bella Studio" /></Field><Field label="Categoría"><select name="category" required><option value="">Selecciona...</option>{["Vestidos", "Blusas", "Sacos", "Pantalones", "Faldas", "Lencería", "Accesorios"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Código de barras"><input name="barcode" required placeholder="Escanea o escribe el código" /></Field><Field label="Talla"><input name="size" required placeholder="Ej. M" /></Field><Field label="Color"><input name="color" required placeholder="Ej. Rosa palo" /></Field><Field label="Costo"><input type="number" name="cost" min="0" step="0.01" defaultValue="0" /></Field><Field label="Precio de venta"><input type="number" name="price" min="0" step="0.01" required placeholder="0.00" /></Field><Field label="Existencias iniciales"><input type="number" name="stock" min="0" step="1" defaultValue="0" /></Field><Field label="Alerta cuando queden"><input type="number" name="stockMin" min="0" step="1" defaultValue="5" /></Field><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setOpen(false)}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? "Guardando..." : "Guardar prenda"}</button></div></form></Modal>}
  </>;
}

function Inventory({ branchId, user, refreshKey, onSaved }) {
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [movement, setMovement] = useState(null);
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => request(`/api/products?branchId=${branchId}&search=${encodeURIComponent(search)}`).then(setProducts).catch((reason) => setError(reason.message)), [branchId, search]);
  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => {
    Promise.all([request("/api/branches"), user.role === "admin" ? request("/api/suppliers") : Promise.resolve([])])
      .then(([branchList, supplierList]) => { setBranches(branchList); setSuppliers(supplierList); })
      .catch((reason) => setError(reason.message));
  }, [user.role]);
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await request("/api/inventory/movements", { method: "POST", body: JSON.stringify({ productId: movement.product.id, branchId: Number(values.branchId), type: values.type, quantity: Number(values.quantity), supplierId: Number(values.supplierId) || null, note: values.note }) });
      setMovement(null); setNotice("Movimiento registrado en el inventario."); await load(); onSaved();
    } catch (reason) { setError(reason.message); }
    finally { setSaving(false); }
  }
  return <>
    <PageHeader eyebrow="CONTROL DE EXISTENCIAS" title={<>Inventario <em>en equilibrio.</em></>} description={user.role === "admin" ? "Consulta el stock por tienda y registra entradas o ajustes de mercancía." : "Consulta las existencias de cada prenda en las sucursales."} />
    {error && <ErrorBanner message={error} />}{notice && <SuccessBanner message={notice} onClose={() => setNotice("")} />}
    <div className="toolbar"><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto, talla o código..." /></label><span className="soft-tag"><Store size={14} /> Existencias de la sucursal seleccionada</span></div>
    <div className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>PRODUCTO</th><th>CÓDIGO</th><th>TALLA · COLOR</th><th>ESTA SUCURSAL</th><th>OTRA SUCURSAL</th><th>ESTADO</th>{user.role === "admin" && <th>ACCIÓN</th>}</tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><div className="table-product"><span className={`mini-product art-${product.id % 6}`}><Package size={17} /></span><span><b>{product.name}</b><small>{product.category}</small></span></div></td><td className="muted-cell">{product.barcode}</td><td>{product.size} · {product.color}</td><td><b className={product.stock <= product.stockMin ? "number-alert" : ""}>{product.stock}</b> pzas</td><td><b>{Math.max(product.totalStock - product.stock, 0)}</b> pzas</td><td><span className={`inventory-status ${product.stock <= product.stockMin ? "inventory-low" : "inventory-ok"}`}><i />{product.stock <= product.stockMin ? "Por reponer" : "Disponible"}</span></td>{user.role === "admin" && <td><button className="small-action" onClick={() => setMovement({ product, type: "entry" })}>Registrar entrada</button></td>}</tr>)}</tbody></table></div></div>
    {movement && <Modal title={movement.type === "entry" ? "Entrada de mercancía" : "Ajustar inventario"} subtitle={`${movement.product.name} · ${movement.product.size} · ${movement.product.color}`} onClose={() => setMovement(null)}><form className="form-grid" onSubmit={submit}><Field label="Sucursal"><select name="branchId" defaultValue={branchId}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></Field><Field label="Tipo de movimiento"><select name="type" defaultValue="entry"><option value="entry">Entrada de mercancía</option><option value="adjustment">Ajuste a cantidad final</option></select></Field><Field label="Cantidad"><input name="quantity" type="number" min="1" step="1" required autoFocus /></Field><Field label="Proveedor"><select name="supplierId" defaultValue=""><option value="">Sin proveedor</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field><Field className="field-wide" label="Nota"><input name="note" placeholder="Ej. Compra de temporada" /></Field><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setMovement(null)}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? "Guardando..." : "Guardar movimiento"}</button></div></form></Modal>}
  </>;
}

function PointOfSale({ branchId, user, onComplete }) {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);
  useEffect(() => { request(`/api/products?branchId=${branchId}&search=${encodeURIComponent(search)}`).then(setProducts).catch((reason) => setError(reason.message)); }, [branchId, search]);
  useEffect(() => { request("/api/customers").then(setCustomers).catch((reason) => setError(reason.message)); }, []);
  const subtotal = cart.reduce((sum, row) => sum + Number(row.price) * row.quantity, 0);
  const selectedCustomer = customers.find((item) => item.id === Number(customerId));
  const discountRate = selectedCustomer?.annualSpend > 20000 ? 0.3 : selectedCustomer?.isMember ? 0.2 : 0;
  const discount = subtotal * discountRate;
  const total = subtotal - discount;
  function add(product) {
    if (product.stock < 1) return;
    setCart((rows) => {
      const existing = rows.find((row) => row.id === product.id);
      if (existing) return rows.map((row) => row.id === product.id ? { ...row, quantity: Math.min(row.quantity + 1, product.stock) } : row);
      return [...rows, { ...product, quantity: 1 }];
    });
  }
  async function checkout() {
    if (!cart.length) return;
    setBusy(true); setError("");
    try {
      const sale = await request("/api/sales", { method: "POST", body: JSON.stringify({ branchId, customerId: customerId || null, paymentMethod, items: cart.map(({ id, quantity }) => ({ productId: id, quantity })) }) });
      setReceipt(sale); setCart([]); setCustomerId(""); onComplete();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  function printReceipt() { window.print(); }
  async function handleScan(event) {
    if (event.key !== "Enter") return;
    const barcode = event.currentTarget.value.trim();
    event.preventDefault();
    if (!barcode) return;
    try {
      const matches = await request(`/api/products?branchId=${branchId}&search=${encodeURIComponent(barcode)}`);
      const exactMatch = matches.find((product) => product.barcode === barcode);
      if (!exactMatch) return setError("No encontramos un producto con ese código de barras.");
      add(exactMatch);
      setError("");
      setSearch("");
    } catch (reason) {
      setError(reason.message);
    }
  }
  return <>
    <PageHeader eyebrow="CAJA · NUEVA VENTA" title={<>Un detalle más para <em>recordar.</em></>} description="Busca las prendas de tu clienta y prepara su compra." action={<span className="cashier-chip"><span className="cashier-avatar">{user.name.slice(0, 1)}</span>{user.name}</span>} />
    {error && <ErrorBanner message={error} />}
    <div className="pos-layout">
      <section className="panel pos-products"><div className="pos-heading"><div><h3>Elige las prendas</h3><p>Escanea un código o busca en tu catálogo.</p></div><span className="count-chip">{products.length} estilos</span></div><label className="search-field pos-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={handleScan} placeholder="Nombre, color o código de barras..." autoFocus /></label><div className="pos-product-list">{products.map((product, index) => <button key={product.id} className={`pos-product ${product.stock < 1 ? "pos-product-disabled" : ""}`} disabled={product.stock < 1} onClick={() => add(product)}><span className={`pos-product-art art-${index % 6}`}><ProductIllustration index={index} /></span><span className="pos-product-info"><b>{product.name}</b><small>{product.size} · {product.color} · {product.stock} pzas</small></span><strong>{money(product.price)}</strong><Plus size={17} className="pos-add" /></button>)}</div></section>
      <section className="panel cart-panel"><div className="cart-header"><div><div className="eyebrow">RESUMEN DE COMPRA</div><h3>Tu selección</h3></div><span className="count-chip">{cart.reduce((sum, item) => sum + item.quantity, 0)} piezas</span></div>
        <label className="field-label customer-select-label">CLIENTA <select className="customer-select" value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Venta de mostrador</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.isMember ? " · Socia" : ""}</option>)}</select></label>
        <div className="cart-items">{cart.length ? cart.map((item) => <div className="cart-item" key={item.id}><div className={`cart-thumb art-${item.id % 6}`}><ProductIllustration index={item.id} /></div><div className="cart-product"><b>{item.name}</b><small>{item.size} · {item.color}</small><div className="quantity-control"><button aria-label="Restar" onClick={() => setCart((rows) => rows.map((row) => row.id === item.id ? { ...row, quantity: row.quantity - 1 } : row).filter((row) => row.quantity > 0))}>−</button><span>{item.quantity}</span><button aria-label="Sumar" onClick={() => add(item)}>+</button></div></div><strong>{money(item.price * item.quantity)}</strong><button className="remove-item" aria-label="Quitar producto" onClick={() => setCart((rows) => rows.filter((row) => row.id !== item.id))}><X size={15} /></button></div>) : <div className="cart-empty"><span><ShoppingBag size={23} /></span><b>Tu selección está vacía</b><small>Agrega una prenda para comenzar la venta.</small></div>}</div>
        <div className="cart-totals"><div><span>Subtotal</span><b>{money(subtotal)}</b></div>{discount > 0 && <div className="discount-line"><span><BadgePercent size={15} /> Descuento {Math.round(discountRate * 100)}%</span><b>− {money(discount)}</b></div>}<div className="cart-total"><span>Total</span><strong>{money(total)}</strong></div></div>
        <div className="payment-label">MÉTODO DE PAGO</div><div className="payment-options"><PaymentOption value="cash" current={paymentMethod} onChange={setPaymentMethod} icon={Banknote} label="Efectivo" /><PaymentOption value="card" current={paymentMethod} onChange={setPaymentMethod} icon={CreditCard} label="Tarjeta" /><PaymentOption value="transfer" current={paymentMethod} onChange={setPaymentMethod} icon={ArrowUpRight} label="Transfer." /></div>
        <button className="button button-primary checkout-button" disabled={!cart.length || busy} onClick={checkout}>{busy ? "Procesando venta..." : "Cobrar " + money(total)} <ArrowRight size={17} /></button><p className="secure-note"><Check size={13} /> Venta guardada de forma segura</p>
      </section>
    </div>
    {receipt && <Modal title="¡Una venta preciosa!" subtitle={`Ticket #${String(receipt.id).padStart(5, "0")} · ${new Date(receipt.createdAt).toLocaleString("es-MX")}`} onClose={() => setReceipt(null)}><div className="receipt"><div className="receipt-brand"><Flower2 size={21} /><b>BELLA BOUTIQUE</b></div><span>Gracias por elegirnos, {receipt.customer || "bella"}.</span><div className="receipt-items">{receipt.items.map((item) => <div key={item.id}><span>{item.quantity} × {item.name}</span><b>{money(item.price * item.quantity)}</b></div>)}</div><div className="receipt-total"><span>Total pagado</span><b>{money(receipt.total)}</b></div><small>Método: {paymentName(receipt.paymentMethod)}{receipt.discount > 0 ? ` · Descuento: ${money(receipt.discount)}` : ""}</small></div><div className="modal-actions"><button className="button button-outline" onClick={() => setReceipt(null)}>Cerrar</button><button className="button button-primary" onClick={printReceipt}><Printer size={16} /> Imprimir ticket</button></div></Modal>}
  </>;
}

function PaymentOption({ value, current, onChange, icon: Icon, label }) {
  return <button className={`payment-option ${current === value ? "payment-selected" : ""}`} onClick={() => onChange(value)}><Icon size={17} /><span>{label}</span></button>;
}

function Sales({ branchId, user, refreshKey, onSaved }) {
  const [sales, setSales] = useState([]);
  const [error, setError] = useState("");
  const [selectedSale, setSelectedSale] = useState(null);
  const [saleDetails, setSaleDetails] = useState(null);
  const [returnError, setReturnError] = useState("");
  const [cancelSale, setCancelSale] = useState(null);
  const [cancelError, setCancelError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { request(`/api/sales?branchId=${branchId}`).then(setSales).catch((reason) => setError(reason.message)); }, [branchId, refreshKey]);
  async function openReturn(sale) {
    setSelectedSale(sale);
    setSaleDetails(null);
    setReturnError("");
    try { setSaleDetails(await request(`/api/sales/${sale.id}`)); }
    catch (reason) { setReturnError(reason.message); }
  }
  async function submitReturn(event) {
    event.preventDefault();
    setSaving(true);
    setReturnError("");
    const values = new FormData(event.currentTarget);
    try {
      await request("/api/returns", { method: "POST", body: JSON.stringify({
        saleId: selectedSale.id,
        productId: Number(values.get("productId")),
        quantity: Number(values.get("quantity")),
        reason: values.get("reason"),
        tagsIntact: values.get("tagsIntact") === "on",
        unused: values.get("unused") === "on",
      }) });
      setSelectedSale(null);
      onSaved("Devolución autorizada y existencias reintegradas.");
    } catch (reason) { setReturnError(reason.message); }
    finally { setSaving(false); }
  }
  async function submitCancellation(event) {
    event.preventDefault();
    setSaving(true);
    setCancelError("");
    const reason = new FormData(event.currentTarget).get("reason");
    try {
      await request(`/api/sales/${cancelSale.id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
      setCancelSale(null);
      onSaved("Venta cancelada y existencias reintegradas.");
    } catch (failure) { setCancelError(failure.message); }
    finally { setSaving(false); }
  }
  const total = sales.filter((sale) => sale.status === "completed").reduce((sum, sale) => sum + sale.total, 0);
  return <>
    <PageHeader eyebrow="HISTORIAL DE VENTAS" title={<>Cada venta cuenta <em>una historia.</em></>} description="Consulta tus tickets, métodos de pago y el trabajo de tu equipo." action={<span className="soft-tag"><ShoppingBag size={14} /> {sales.length} tickets recientes</span>} />
    {error && <ErrorBanner message={error} />}
    <div className="stats-grid compact-stats"><StatCard title="Ventas visibles" value={sales.length} note="Últimas 100 transacciones" icon={ShoppingBag} color="rose" trend="Historial" /><StatCard title="Importe total" value={money(total)} note="Ventas completadas" icon={WalletCards} color="peach" trend="Acumulado" /></div>
    <div className="panel table-panel"><div className="table-heading"><div><h3>Tickets recientes</h3><p>La actividad de esta sucursal</p></div><span className="live-badge"><i /> En vivo</span></div><div className="table-scroll"><table><thead><tr><th>TICKET</th><th>FECHA Y HORA</th><th>CLIENTA</th><th>ATENDIÓ</th><th>MÉTODO</th><th>IMPORTE</th><th>ESTADO</th>{["admin", "cashier"].includes(user.role) && <th>ACCIÓN</th>}</tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td><b>#{String(sale.id).padStart(5, "0")}</b><small className="table-subline">{sale.itemCount} modelos</small></td><td>{new Date(sale.createdAt.replace(" ", "T") + (sale.createdAt.endsWith("Z") ? "" : "Z")).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</td><td>{sale.customer || "Venta de mostrador"}</td><td>{sale.seller}</td><td><span className="payment-label-pill">{paymentName(sale.paymentMethod)}</span></td><td><b>{money(sale.total)}</b></td><td><span className={`status-pill ${sale.status !== "completed" ? "status-cancelled" : ""}`}>{sale.status === "completed" ? "Completada" : sale.status}</span></td>{["admin", "cashier"].includes(user.role) && <td><div className="sale-actions">{user.role === "admin" && <button className="small-action" disabled={sale.status !== "completed"} onClick={() => openReturn(sale)}>Devolución</button>}<button className="small-action cancel-sale-action" disabled={sale.status !== "completed"} onClick={() => { setCancelSale(sale); setCancelError(""); }}>Cancelar</button></div></td>}</tr>)}</tbody></table></div>{sales.length === 0 && <EmptyState icon={ShoppingBag} title="Tus tickets aparecerán aquí" text="Registra una venta para comenzar tu historial." />}</div>
    {selectedSale && <Modal title={`Devolución · ticket #${String(selectedSale.id).padStart(5, "0")}`} subtitle="La prenda debe tener sus etiquetas y no haber sido usada. Plazo máximo: 15 días." onClose={() => setSelectedSale(null)}>{returnError && <ErrorBanner message={returnError} />}{saleDetails ? <form className="form-grid" onSubmit={submitReturn}><Field className="field-wide" label="Prenda"><select name="productId" required defaultValue=""><option value="" disabled>Selecciona una prenda</option>{saleDetails.items.map((item) => <option key={item.productId} value={item.productId} disabled={item.lingerie || item.quantity <= item.returned}>{item.name}{item.lingerie ? " · No admite devolución" : ` · ${item.quantity - item.returned} disponibles`}</option>)}</select></Field><Field label="Cantidad"><input name="quantity" type="number" min="1" step="1" defaultValue="1" required /></Field><Field label="Motivo"><input name="reason" required placeholder="Describe brevemente el motivo" /></Field><div className="check-field"><label><input type="checkbox" name="tagsIntact" required /> Conserva las etiquetas originales</label><label><input type="checkbox" name="unused" required /> La prenda no ha sido utilizada</label></div><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setSelectedSale(null)}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? "Procesando..." : "Autorizar devolución"}</button></div></form> : <div className="empty-state"><span><Clock3 size={20} /></span><b>Cargando ticket</b></div>}</Modal>}
    {cancelSale && <Modal title={`Cancelar ticket #${String(cancelSale.id).padStart(5, "0")}`} subtitle="La venta quedará en el historial y las piezas volverán al inventario." onClose={() => setCancelSale(null)}>{cancelError && <ErrorBanner message={cancelError} />}<form className="form-grid" onSubmit={submitCancellation}><Field className="field-wide" label="Motivo de cancelación"><input name="reason" minLength="3" required placeholder="Describe el motivo" autoFocus /></Field><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setCancelSale(null)}>Conservar venta</button><button className="button button-primary" disabled={saving}>{saving ? "Cancelando..." : "Confirmar cancelación"}</button></div></form></Modal>}
  </>;
}

function Customers({ refreshKey, onSaved }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => request(`/api/customers?search=${encodeURIComponent(search)}`).then(setCustomers).catch((reason) => setError(reason.message)), [search]);
  useEffect(() => { load(); }, [load, refreshKey]);
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    const values = new FormData(event.currentTarget);
    try {
      await request("/api/customers", { method: "POST", body: JSON.stringify({ name: values.get("name"), phone: values.get("phone"), email: values.get("email"), isMember: values.get("isMember") === "on", privacyAccepted: values.get("privacyAccepted") === "on", promoConsent: values.get("promoConsent") === "on" }) });
      setOpen(false); await load(); onSaved();
    } catch (reason) { setError(reason.message); }
    finally { setSaving(false); }
  }
  return <>
    <PageHeader eyebrow="RELACIONES BONITAS" title={<>Clientas que <em>vuelven.</em></>} description="Conoce a tus clientas, cuida sus preferencias y celebra su lealtad." action={<button className="button button-primary" onClick={() => setOpen(true)}><Plus size={17} /> Registrar clienta</button>} />
    {error && <ErrorBanner message={error} />}
    <div className="customer-intro"><div className="customer-intro-icon"><Heart size={21} /></div><div><b>Un trato especial, siempre</b><span>Las clientas con membresía reciben 20% de descuento en sus compras.</span></div><span className="member-badge"><Sparkles size={14} /> BENEFICIO SOCIA</span></div>
    <div className="toolbar"><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, teléfono o número de socia..." /></label><span className="soft-tag"><Users size={14} /> {customers.length} clientas</span></div>
    <div className="customer-grid">{customers.map((customer, index) => <article className="customer-card" key={customer.id}><div className={`customer-avatar customer-avatar-${index % 5}`}>{customer.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div className="customer-card-title"><div><h3>{customer.name}</h3><span>{customer.isMember ? <i className="member-dot" /> : null}{customer.isMember ? "Socia Bella" : "Clienta"}</span></div>{customer.isMember && <span className="member-discount">−20%</span>}</div><div className="customer-contact"><span><UserRound size={14} /> {customer.phone || "Sin teléfono"}</span><span><FileText size={14} /> {customer.email || "Sin correo"}</span></div><div className="customer-bottom"><span>N.º SOCIA <b>{customer.memberNumber}</b></span><span>COMPRAS <b>{money(customer.lifetimeSpend)}</b></span></div></article>)}</div>
    {customers.length === 0 && <EmptyState icon={Users} title="Comienza tu comunidad Bella" text="Registra a tu primera clienta y crea una experiencia inolvidable." />}
    {open && <Modal title="Registrar una clienta" subtitle="Solo pedimos los datos necesarios y cuidamos su privacidad." onClose={() => setOpen(false)}><form className="form-grid" onSubmit={submit}><Field label="Nombre completo"><input name="name" required placeholder="Ej. Ana García" /></Field><Field label="Teléfono"><input name="phone" type="tel" placeholder="722 555 0100" /></Field><Field label="Correo electrónico"><input name="email" type="email" placeholder="ana@correo.com" /></Field><div className="check-field"><label><input type="checkbox" name="isMember" /> Inscribir como socia Bella (20% de descuento)</label><label><input type="checkbox" name="privacyAccepted" required /> Acepta el aviso de privacidad (obligatorio)</label><label><input type="checkbox" name="promoConsent" /> Autoriza recibir promociones</label></div><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setOpen(false)}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? "Guardando..." : "Registrar clienta"}</button></div></form></Modal>}
  </>;
}

function Suppliers({ user, refreshKey, onSaved }) {
  const [suppliers, setSuppliers] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { request("/api/suppliers").then(setSuppliers).catch((reason) => setError(reason.message)); }, [refreshKey]);
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { await request("/api/suppliers", { method: "POST", body: JSON.stringify(values) }); setOpen(false); onSaved(); }
    catch (reason) { setError(reason.message); }
    finally { setSaving(false); }
  }
  return <>
    <PageHeader eyebrow="RED DE COLABORADORES" title={<>Proveedores de <em>confianza.</em></>} description="Mantén a la mano los datos de quienes hacen posible cada colección." action={<button className="button button-primary" disabled={user.role !== "admin"} onClick={() => setOpen(true)}><Plus size={17} /> Agregar proveedor</button>} />
    {error && <ErrorBanner message={error} />}
    <div className="supplier-grid">{suppliers.map((supplier, index) => <article className="supplier-card" key={supplier.id}><div className={`supplier-logo supplier-logo-${index % 4}`}><Truck size={21} /></div><span className="supplier-tag">PROVEEDOR #{String(supplier.id).padStart(3, "0")}</span><h3>{supplier.name}</h3><p>{supplier.distributor || "Distribuidora independiente"}</p><div className="supplier-line" /><div className="supplier-detail"><span>Teléfono</span><b>{supplier.phone || "No registrado"}</b></div><div className="supplier-detail"><span>Correo</span><b>{supplier.email || "No registrado"}</b></div><div className="supplier-detail"><span>Dirección</span><b>{supplier.address || "No registrada"}</b></div></article>)}</div>
    {suppliers.length === 0 && <EmptyState icon={Truck} title="Agrega tu primer proveedor" text="Aquí podrás consultar los datos de tus distribuidores." />}
    {open && <Modal title="Nuevo proveedor" subtitle="Guarda los datos para encontrarle cuando los necesites." onClose={() => setOpen(false)}><form className="form-grid" onSubmit={submit}><Field label="Nombre del proveedor"><input name="name" required placeholder="Ej. Moda & Estilo" /></Field><Field label="Distribuidora"><input name="distributor" placeholder="Nombre de la distribuidora" /></Field><Field label="Teléfono"><input name="phone" type="tel" placeholder="722 555 0100" /></Field><Field label="Correo"><input name="email" type="email" placeholder="pedidos@proveedor.mx" /></Field><Field className="field-wide" label="Dirección"><input name="address" placeholder="Ciudad, estado" /></Field><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setOpen(false)}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? "Guardando..." : "Guardar proveedor"}</button></div></form></Modal>}
  </>;
}

function Team({ user, branches, refreshKey, onSaved }) {
  const [team, setTeam] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  useEffect(() => {
    if (user.role === "admin") request("/api/users").then(setTeam).catch((reason) => setError(reason.message));
  }, [user.role, refreshKey]);
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await request("/api/users", { method: "POST", body: JSON.stringify({ ...values, branchId: Number(values.branchId) }) });
      setOpen(false);
      onSaved("Cuenta de equipo creada correctamente.");
    } catch (reason) { setError(reason.message); }
    finally { setSaving(false); }
  }
  async function changePassword(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await request("/api/password", { method: "POST", body: JSON.stringify(values) });
      setPasswordOpen(false);
      onSaved("Contraseña actualizada correctamente.");
    } catch (reason) { setError(reason.message); }
    finally { setSaving(false); }
  }
  async function toggleAccount(member) {
    if (member.id === user.id) {
      setError("No puedes desactivar la cuenta con la que iniciaste sesión.");
      return;
    }
    const active = !member.active;
    if (!active && !window.confirm(`¿Desactivar la cuenta de ${member.name}? Ya no podrá iniciar sesión ni usar sesiones abiertas.`)) return;
    setUpdatingUserId(member.id);
    setError("");
    try {
      await request(`/api/users/${member.id}/status`, { method: "POST", body: JSON.stringify({ active }) });
      onSaved(active ? "Cuenta reactivada correctamente." : "Cuenta desactivada; sus sesiones ya no tienen acceso.");
    } catch (reason) { setError(reason.message); }
    finally { setUpdatingUserId(null); }
  }
  return <>
    <PageHeader eyebrow="EQUIPO BELLA" title={<>Un gran equipo, <em>un mismo estilo.</em></>} description="Administra quién puede entrar al sistema y en qué sucursal trabaja." action={<div className="team-header-actions"><button className="button button-outline" onClick={() => setPasswordOpen(true)}>Cambiar contraseña</button>{user.role === "admin" && <button className="button button-primary" onClick={() => setOpen(true)}><Plus size={17} /> Agregar cuenta</button>}</div>} />
    {error && <ErrorBanner message={error} />}
    {user.role === "admin" ? <div className="panel table-panel"><div className="table-heading"><div><h3>Cuentas de acceso</h3><p>Desactiva una cuenta para bloquear el inicio de sesión y sus sesiones abiertas.</p></div><span className="soft-tag"><Users size={14} /> {team.length} cuentas</span></div><div className="table-scroll"><table><thead><tr><th>PERSONA</th><th>USUARIO</th><th>PERFIL</th><th>SUCURSAL</th><th>ESTADO</th><th>ACCESO</th></tr></thead><tbody>{team.map((member) => <tr key={member.id}><td><b>{member.name}</b></td><td>{member.username}</td><td>{roleNames[member.role]}</td><td>{member.branch || "Sin sucursal"}</td><td><span className={`inventory-status ${member.active ? "inventory-ok" : "account-inactive"}`}><i />{member.active ? "Activa" : "Desactivada"}</span></td><td>{member.id === user.id ? <span className="muted-cell">Cuenta actual</span> : <button className="small-action" disabled={updatingUserId === member.id} onClick={() => toggleAccount(member)}>{updatingUserId === member.id ? "Guardando..." : member.active ? "Desactivar" : "Reactivar"}</button>}</td></tr>)}</tbody></table></div></div> : <div className="panel team-permission"><span><Settings2 size={21} /></span><div><b>Administración de cuentas</b><p>Solo una cuenta de administración puede consultar o agregar usuarios.</p></div></div>}
    {open && <Modal title="Agregar cuenta al equipo" subtitle="Cada persona tendrá permisos acordes a su función." onClose={() => setOpen(false)}><form className="form-grid" onSubmit={submit}><Field label="Nombre completo"><input name="name" required placeholder="Ej. Laura Martínez" /></Field><Field label="Nombre de usuario"><input name="username" required minLength="3" maxLength="30" pattern="[a-zA-Z0-9._-]+" placeholder="laura.m" /></Field><Field label="Perfil"><select name="role" defaultValue="seller"><option value="admin">Administración</option><option value="cashier">Cajero</option><option value="seller">Vendedor</option></select></Field><Field label="Sucursal"><select name="branchId" defaultValue={branches[0]?.id}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></Field><Field className="field-wide" label="Contraseña inicial (mínimo 10 caracteres)"><input name="password" type="password" minLength="10" required autoComplete="new-password" /></Field><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setOpen(false)}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? "Guardando..." : "Crear cuenta"}</button></div></form></Modal>}
    {passwordOpen && <Modal title="Cambiar contraseña" subtitle="Usa una contraseña distinta de al menos 10 caracteres." onClose={() => setPasswordOpen(false)}><form className="form-grid" onSubmit={changePassword}><Field className="field-wide" label="Contraseña actual"><input name="currentPassword" type="password" required autoComplete="current-password" /></Field><Field className="field-wide" label="Nueva contraseña"><input name="newPassword" type="password" minLength="10" required autoComplete="new-password" /></Field><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setPasswordOpen(false)}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? "Guardando..." : "Actualizar contraseña"}</button></div></form></Modal>}
  </>;
}

function Reports({ branchId, refreshKey }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { request(`/api/reports?branchId=${branchId}&month=${month}`).then((result) => { setData(result); setError(""); }).catch((reason) => setError(reason.message)); }, [branchId, month, refreshKey]);
  const monthlySales = data?.daily.reduce((sum, day) => sum + day.total, 0) || 0;
  const refundsByDate = new Map((data?.refunds || []).map((refund) => [refund.date, refund]));
  const cancellationsByDate = new Map((data?.cancellations || []).map((item) => [item.date, item]));
  const salesByDate = new Map((data?.daily || []).map((day) => [day.date, day]));
  const reportDates = [...new Set([
    ...(data?.daily || []).map((day) => day.date),
    ...(data?.refunds || []).map((refund) => refund.date),
    ...(data?.cancellations || []).map((item) => item.date),
  ])].sort((a, b) => b.localeCompare(a));
  return <>
    <PageHeader eyebrow="NÚMEROS QUE CUENTAN" title={<>Tu tienda, en <em>perspectiva.</em></>} description="Consulta las ventas del mes, el rendimiento del equipo y las existencias." action={<label className="month-picker"><span>MES</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>} />
    {error && <ErrorBanner message={error} />}
    <div className="stats-grid compact-stats"><StatCard title="Venta del mes" value={money(monthlySales)} note={`${data?.daily.length || 0} días con ventas`} icon={ArrowUpRight} color="rose" trend={month} /><StatCard title="Tickets del mes" value={data?.daily.reduce((sum, day) => sum + day.sales, 0) || 0} note="Ventas completadas" icon={ShoppingBag} color="peach" trend={month} /><StatCard title="Usuarios activos" value={data?.users ?? "—"} note="En el sistema" icon={Users} color="lavender" trend="Equipo" /><StatCard title="Productos listados" value={data?.inventory.length ?? "—"} note="En esta sucursal" icon={Package} color="sage" trend="Catálogo" /></div>
    <div className="reports-grid"><section className="panel table-panel"><div className="table-heading"><div><h3>Ventas por día</h3><p>Desglose de pagos, cancelaciones y devoluciones</p></div><span className="report-icon"><FileText size={17} /></span></div><div className="table-scroll"><table><thead><tr><th>FECHA</th><th>TICKETS</th><th>EFECTIVO</th><th>TARJETA</th><th>TRANSFERENCIA</th><th>CANCELACIONES</th><th>DEVOLUCIONES</th><th>TOTAL</th></tr></thead><tbody>{reportDates.map((date) => { const day = salesByDate.get(date); return <tr key={date}><td>{new Date(`${date}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</td><td>{day?.sales || 0}</td><td>{money(day?.cash || 0)}</td><td>{money(day?.card || 0)}</td><td>{money(day?.transfer || 0)}</td><td>{money(cancellationsByDate.get(date)?.total || 0)}</td><td>{money(refundsByDate.get(date)?.total || 0)}</td><td><b>{money(day?.total || 0)}</b></td></tr>; })}</tbody></table></div>{data && reportDates.length === 0 && <EmptyState icon={FileText} title="Sin movimientos este mes" text="Las ventas y devoluciones aparecerán aquí." />}</section>
      <section className="panel seller-panel"><div className="table-heading"><div><h3>Ventas por equipo</h3><p>Rendimiento individual</p></div><span className="report-icon"><Users size={17} /></span></div>{data?.sellers.map((seller, index) => <div className="seller-row" key={seller.name}><span className={`seller-avatar seller-${index % 4}`}>{seller.name.slice(0, 1)}</span><div><b>{seller.name}</b><small>{seller.sales} tickets</small></div><strong>{money(seller.total)}</strong></div>)}</section></div>
    <section className="panel table-panel inventory-report"><div className="table-heading"><div><h3>Inventario actual</h3><p>Existencias en la sucursal seleccionada</p></div><span className="soft-tag"><Boxes size={14} /> {data?.inventory.length || 0} modelos</span></div><div className="table-scroll"><table><thead><tr><th>PRENDA</th><th>CATEGORÍA</th><th>TALLA · COLOR</th><th>EXISTENCIAS</th><th>ESTADO</th></tr></thead><tbody>{data?.inventory.map((product) => <tr key={product.name + product.size + product.color}><td><b>{product.name}</b></td><td>{product.category}</td><td>{product.size} · {product.color}</td><td><b>{product.quantity}</b> pzas</td><td><span className={`inventory-status ${product.quantity <= product.stockMin ? "inventory-low" : "inventory-ok"}`}><i />{product.quantity <= product.stockMin ? "Por reponer" : "Disponible"}</span></td></tr>)}</tbody></table></div></section>
  </>;
}

function ProductIllustration({ index = 0 }) {
  const icons = ["✳", "✦", "❋", "✳", "✦", "❋"];
  return <span className="product-illustration"><i>{icons[index % icons.length]}</i><span>BB</span></span>;
}

function colorHex(color) {
  const colors = { "Rosa palo": "#eebbc8", Marfil: "#f1e6d5", Champagne: "#dfc8a2", Negro: "#393338", Lavanda: "#c4b8db", "Verde salvia": "#a9b9a5", Vino: "#7f364e" };
  return colors[color] || "#e7c5c7";
}
function paymentName(value) { return ({ cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia" })[value] || value; }

function Field({ label, children, className = "" }) {
  return <label className={`field ${className}`}><span>{label}</span>{children}</label>;
}
function Modal({ title, subtitle, onClose, children }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal"><div className="modal-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button></div>{children}</section></div>;
}
function EmptyState({ icon: Icon, title, text }) {
  return <div className="empty-state"><span><Icon size={21} /></span><b>{title}</b><p>{text}</p></div>;
}
function ErrorBanner({ message }) {
  return <div className="error-banner"><CircleHelp size={16} />{message}</div>;
}
function SuccessBanner({ message, onClose }) {
  return <div className="success-banner"><Check size={16} />{message}<button onClick={onClose} aria-label="Cerrar"><X size={15} /></button></div>;
}

export default App;
