import React, { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import Tiendas from "./components/Tiendas";
import Productos from "./components/Productos";
import Visitas from "./components/Visitas";
import logoEasy from "./assets/logoEasy.png";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isOnline, setIsOnline] = useState(window.navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard />;
      case "tiendas":
        return <Tiendas />;
      case "productos":
        return <Productos />;
      case "visitas":
        return <Visitas />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app-container">
      {/* BANNER SIN CONEXIÓN (OFFLINE-FIRST) */}
      {!isOnline && (
        <div className="offline-banner" style={{ position: "fixed", top: 0, left: 0, right: 0, backgroundColor: "var(--color-warning)", color: "var(--color-primary)", textAlign: "center", padding: "8px", fontWeight: "bold", zIndex: 1000, fontSize: "0.85rem" }}>
          ⚠️ Modo Offline Activo. Los datos se guardan localmente y se sincronizarán al recuperar la señal.
        </div>
      )}

      {/* BARRA DE NAVEGACIÓN LATERAL (SIDEBAR) */}
      <aside className="sidebar" style={{ paddingTop: !isOnline ? "40px" : "24px" }}>
        <div>
          <div className="logo-section">
            <img src={logoEasy} alt="Easy Tech Logo" className="logo-img" />
            <div className="logo-text">
              EasyTech<span>Supply</span>
            </div>
            <span 
              className="status-dot" 
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: isOnline ? "#00E676" : "#FFC107",
                display: "inline-block",
                boxShadow: isOnline ? "0 0 6px #00E676" : "0 0 6px #FFC107"
              }}
              title={isOnline ? "Sincronizado (Online)" : "Modo Offline"}
            />
          </div>
          
          <ul className="nav-links">
            <li>
              <button 
                className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
                onClick={() => setActiveTab("dashboard")}
                style={{ width: "100%", border: "none", background: "none", textAlign: "left" }}
              >
                <span>📊</span> <span>Dashboard</span>
              </button>
            </li>
            <li>
              <button 
                className={`nav-item ${activeTab === "tiendas" ? "active" : ""}`}
                onClick={() => setActiveTab("tiendas")}
                style={{ width: "100%", border: "none", background: "none", textAlign: "left" }}
              >
                <span>🏪</span> <span>Tiendas</span>
              </button>
            </li>
            <li>
              <button 
                className={`nav-item ${activeTab === "productos" ? "active" : ""}`}
                onClick={() => setActiveTab("productos")}
                style={{ width: "100%", border: "none", background: "none", textAlign: "left" }}
              >
                <span>📦</span> <span>Productos</span>
              </button>
            </li>
            <li>
              <button 
                className={`nav-item ${activeTab === "visitas" ? "active" : ""}`}
                onClick={() => setActiveTab("visitas")}
                style={{ width: "100%", border: "none", background: "none", textAlign: "left" }}
              >
                <span>📝</span> <span>Registrar Visita</span>
              </button>
            </li>
          </ul>
        </div>

        <div className="sidebar-footer">
          <div>Easy Tech Consignaciones v1.0</div>
          <div style={{ fontSize: "0.7rem", marginTop: "3px", color: isOnline ? "var(--color-accent)" : "var(--color-warning)" }}>
            {isOnline ? "● Sincronizado" : "○ Modo Offline"}
          </div>
        </div>
      </aside>

      {/* ÁREA DE CONTENIDO PRINCIPAL */}
      <main className="main-content" style={{ marginTop: !isOnline ? "35px" : "0px" }}>
        {renderContent()}
      </main>
    </div>
  );
}
