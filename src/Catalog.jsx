import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Flower2, Package, Search, Store, X } from "lucide-react";

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const money = (value) => currency.format(Number(value || 0));
const productImages = {
  "Blazer Siena": "/blazer-siena.png",
  "Blusa Camille": "/blusa-camille.png",
  "Cinturón": "/cinturon.png",
  "Falda Celeste": "/falda-celeste.png",
  "Pantalón Olivia": "/pantalon-olivia.png",
  "Top Amélie": "/top-amelie.png",
  "Vestido Aurora": "/vestido-aurora.png",
  "Vestido Noa": "/vestido-noa.png",
};

async function loadJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo cargar el catálogo.");
  return data;
}

export default function Catalog() {
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [branchId, setBranchId] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedImage, setExpandedImage] = useState(null);
  const previewTriggerRef = useRef(null);
  const closePreviewButtonRef = useRef(null);

  useEffect(() => {
    loadJson("/api/branches")
      .then(setBranches)
      .catch((reason) => setError(reason.message));
  }, []);

  useEffect(() => {
    const query = new URLSearchParams({ search });
    if (branchId !== "all") query.set("branchId", branchId);
    let active = true;
    setLoading(true);
    loadJson(`/api/catalog?${query}`)
      .then((items) => { if (active) { setProducts(items); setError(""); } })
      .catch((reason) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [branchId, search]);

  useEffect(() => {
    if (!expandedImage) {
      previewTriggerRef.current?.focus();
      return undefined;
    }

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setExpandedImage(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    closePreviewButtonRef.current?.focus();
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [expandedImage]);

  const totalUnits = useMemo(
    () => products.reduce((sum, product) => sum + product.branches.reduce((branchSum, branch) => branchSum + branch.quantity, 0), 0),
    [products],
  );

  return (
    <div className="public-catalog">
      <header className="catalog-topbar">
        <a className="brand" href="/" aria-label="Volver al punto de venta">
          <span className="brand-mark"><Flower2 size={24} strokeWidth={1.5} /></span>
          <span className="brand-copy"><strong>Bella</strong><small>BOUTIQUE</small></span>
        </a>
        <a className="catalog-login-link" href="/"><ArrowLeft size={15} /> Acceso al sistema</a>
      </header>
      <main className="catalog-content">
        <div className="catalog-intro">
          <span className="eyebrow">CATÁLOGO DIGITAL · BELLA BOUTIQUE</span>
          <h1>Encuentra tu próximo <em>favorito.</em></h1>
          <p>Explora prendas, tallas, colores y existencias en nuestras sucursales.</p>
        </div>
        <div className="catalog-controls">
          <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar prenda, categoría, talla o color..." /></label>
          <label className="catalog-branch-picker"><Store size={16} /><select value={branchId} onChange={(event) => setBranchId(event.target.value)} aria-label="Filtrar por sucursal"><option value="all">Todas las sucursales</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name.replace("Bella Boutique · ", "")}</option>)}</select></label>
        </div>
        <div className="catalog-results-meta"><b>{products.length}</b> estilos <span>·</span> {totalUnits} piezas disponibles</div>
        {error && <div className="error-banner" role="alert">{error}</div>}
        {loading ? (
          <div className="catalog-empty"><span className="catalog-empty-icon"><Package size={22} /></span><b>Cargando prendas…</b></div>
        ) : products.length ? (
          <div className="public-product-grid">
            {products.map((product, index) => {
              const image = productImages[product.name];
              return (
                <article className="public-product-card" key={product.id}>
                  <div className={`public-product-art art-${index % 6}`}>
                    <span className="product-category">{product.category}</span>
                    {image ? (
                      <button
                        className="public-product-image-button"
                        type="button"
                        aria-label={`Ampliar imagen de ${product.name}`}
                        onClick={(event) => {
                          previewTriggerRef.current = event.currentTarget;
                          setExpandedImage({ src: image, alt: product.name });
                        }}
                      >
                        <img src={image} alt={product.name} />
                      </button>
                    ) : (
                      <>
                        <Flower2 size={52} strokeWidth={1.1} />
                        <small>{product.brand || "BELLA STUDIO"}</small>
                      </>
                    )}
                  </div>
                  <div className="public-product-info">
                    <div className="public-product-title"><div><h2>{product.name}</h2><span>{product.brand || "Colección Bella"}</span></div><b>{money(product.price)}</b></div>
                    <div className="public-product-variant"><span>Talla <b>{product.size}</b></span><span>Color <b>{product.color}</b></span></div>
                    <div className="public-availability-title">DISPONIBILIDAD POR SUCURSAL</div>
                    <div className="public-availability-list">{product.branches.map((branch) => (
                      <div className="public-availability-row" key={branch.id}>
                        <span><Store size={13} /> {branch.name.replace("Bella Boutique · ", "")}</span>
                        <b className={branch.quantity > 0 ? "available" : "unavailable"}>{branch.quantity > 0 ? `${branch.quantity} piezas` : "Agotado"}</b>
                      </div>
                    ))}</div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="catalog-empty"><span className="catalog-empty-icon"><Search size={22} /></span><b>No encontramos prendas</b><p>Prueba con otro nombre, talla o color.</p></div>
        )}
      </main>
      <footer className="catalog-footer">BELLA BOUTIQUE <span>·</span> Catálogo de prendas</footer>
      {expandedImage && (
        <div
          className="image-preview-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setExpandedImage(null);
          }}
        >
          <section className="image-preview" role="dialog" aria-modal="true" aria-label={`Imagen ampliada de ${expandedImage.alt}`}>
            <button
              className="image-preview-close"
              type="button"
              aria-label="Cerrar imagen ampliada"
              ref={closePreviewButtonRef}
              onClick={() => setExpandedImage(null)}
            >
              <X size={20} />
            </button>
            <img src={expandedImage.src} alt={expandedImage.alt} />
          </section>
        </div>
      )}
    </div>
  );
}
