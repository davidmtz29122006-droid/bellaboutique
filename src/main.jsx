import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import Catalog from "./Catalog.jsx";
import "./styles.css";

const isCatalog = window.location.pathname.replace(/\/+$/, "") === "/catalogo";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isCatalog ? <Catalog /> : <App />}
  </React.StrictMode>,
);
