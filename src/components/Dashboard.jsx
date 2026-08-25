import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { seedDatabase } from "../firebase/seed";
import Reportes from "./Reportes";

export default function Dashboard() {
  const [stats, setStats] = useState({
    ventasTotales: 0,
    tiendasActivas: 0,
    totalProductos: 0,
    piezasEnCalle: 0,
    valorEnCalle: 0
  });
  const [tiendas, setTiendas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [visitas, setVisitas] = useState([]);
  const [isDbEmpty, setIsDbEmpty] = useState(false);
  const [seedingLoading, setSeedingLoading] = useState(false);
  const [seedingMessage, setSeedingMessage] = useState("");
  const [showReporte, setShowReporte] = useState(false);

  useEffect(() => {
    // Escuchar Tiendas
    const unsubTiendas = onSnapshot(collection(db, "tiendas"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTiendas(list);
      setIsDbEmpty(list.length === 0);
    });

    // Escuchar Productos
    const unsubProductos = onSnapshot(collection(db, "productos"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProductos(list);
    });

    // Escuchar Visitas
    const unsubVisitas = onSnapshot(collection(db, "visitas"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVisitas(list);
    });

    return () => {
      unsubTiendas();
      unsubProductos();
      unsubVisitas();
    };
  }, []);

  useEffect(() => {
    // Calcular estadísticas cuando cambien las colecciones
    let ventasTotales = 0;
    visitas.forEach(v => {
      if (v.totales && v.totales.totalCobrado) {
        ventasTotales += v.totales.totalCobrado;
      }
    });

    const tiendasActivas = tiendas.filter(t => t.estado === "activo").length;
    const totalProductos = productos.length;

    let piezasEnCalle = 0;
    let valorEnCalle = 0;

    tiendas.forEach(t => {
      if (t.inventarioActual) {
        Object.entries(t.inventarioActual).forEach(([prodId, qty]) => {
          piezasEnCalle += qty;
          const prod = productos.find(p => p.id === prodId);
          if (prod) {
            valorEnCalle += qty * prod.precioPublico;
          }
        });
      }
    });

    setStats({
      ventasTotales,
      tiendasActivas,
      totalProductos,
      piezasEnCalle,
      valorEnCalle
    });
  }, [tiendas, productos, visitas]);

  const handleSeed = async () => {
    setSeedingLoading(true);
    setSeedingMessage("Inicializando base de datos...");
    try {
      const res = await seedDatabase();
      setSeedingMessage(res.message);
    } catch (err) {
      setSeedingMessage("Error al inicializar la base de datos.");
    } finally {
      setSeedingLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
      <div className="main-header">
        <div className="header-title">
          <h1>Dashboard Analítico</h1>
          <p>Easy Tech Consignaciones - Resumen operacional de ganchos y exhibidores</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button 
            className="btn btn-primary" 
            onClick={() => setShowReporte(true)}
            style={{ fontSize: "0.9rem" }}
          >
            📈 Reporte de Ventas
          </button>
        </div>
      </div>

      {isDbEmpty && (
        <div className="card" style={{ border: "2px dashed var(--color-warning)", display: "flex", flexDirection: "column", gap: "15px", alignItems: "center", padding: "30px", textAlign: "center" }}>
          <span style={{ fontSize: "2rem" }}>🚨</span>
          <h3 style={{ color: "var(--color-warning)" }}>¡Base de datos vacía!</h3>
          <p style={{ maxWidth: "600px", color: "var(--color-text-muted)" }}>
            No hemos detectado productos ni puntos de venta en tu base de datos de Firestore. ¿Deseas cargar información de demostración para probar los módulos?
          </p>
          <button className="btn btn-accent" onClick={handleSeed} disabled={seedingLoading}>
            {seedingLoading ? "Cargando..." : "Cargar Datos Demo en Firestore"}
          </button>
          {seedingMessage && <p style={{ fontSize: "0.85rem", fontWeight: "bold" }}>{seedingMessage}</p>}
        </div>
      )}

      {/* TARJETAS DE MÉTRICAS */}
      <div className="dashboard-grid">
        
        <div className="card stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-info">
            <span className="stat-value">${stats.ventasTotales.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            <span className="stat-label">Ventas Totales Cobradas</span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon">🏪</div>
          <div className="stat-info">
            <span className="stat-value">{stats.tiendasActivas}</span>
            <span className="stat-label">Tiendas Activas</span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-info">
            <span className="stat-value">{stats.totalProductos}</span>
            <span className="stat-label">Productos Catálogo</span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon">🚚</div>
          <div className="stat-info">
            <span className="stat-value">{stats.piezasEnCalle} pzas</span>
            <span className="stat-label">Stock en Calle</span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon">🏛️</div>
          <div className="stat-info">
            <span className="stat-value">${stats.valorEnCalle.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            <span className="stat-label">Valor en Exhibición</span>
          </div>
        </div>

      </div>

      <div className="layout-grid">
        
        {/* TIENDAS MÁS RENTABLES */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <h3>Rendimiento por Tienda</h3>
          <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>Inventario actual y estado de exhibidores</p>
          
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Tienda</th>
                  <th>Encargado</th>
                  <th>Estado</th>
                  <th style={{ textAlign: "right" }}>Pzas colgadas</th>
                </tr>
              </thead>
              <tbody>
                {tiendas.slice(0, 5).map(t => {
                  let totalPcs = 0;
                  if (t.inventarioActual) {
                    totalPcs = Object.values(t.inventarioActual).reduce((a, b) => a + b, 0);
                  }
                  
                  return (
                    <tr key={t.id}>
                      <td><strong>{t.nombre}</strong></td>
                      <td>{t.encargado}</td>
                      <td>
                        <span className={`badge ${
                          t.estado === "activo" ? "badge-success" : 
                          t.estado === "en_mora" ? "badge-danger" : "badge-warning"
                        }`}>
                          {t.estado === "activo" ? "Activo" : 
                           t.estado === "en_mora" ? "En Mora" : "Inactivo"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: "bold" }}>{totalPcs} pzas</td>
                    </tr>
                  );
                })}
                {tiendas.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "20px" }}>No hay tiendas registradas.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ÚLTIMOS CORTES / VISITAS REGISTRADOS */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <h3>Últimas Visitas</h3>
          <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>Historial de cortes de caja en ruta</p>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "300px", overflowY: "auto" }}>
            {visitas.slice(0, 5).map(v => {
              const tiendaObj = tiendas.find(t => t.id === v.tiendaId);
              const nombreTienda = tiendaObj ? tiendaObj.nombre : "Tienda Desconocida";
              const fechaObj = v.fecha?.seconds ? new Date(v.fecha.seconds * 1000) : new Date(v.fecha);
              
              return (
                <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)" }}>
                  <div>
                    <h5 style={{ fontSize: "0.9rem" }}>{nombreTienda}</h5>
                    <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                      {fechaObj.toLocaleDateString()} | {v.tipo === "surtido" ? "Surtido Inicial" : "Corte"}
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontWeight: "bold", fontSize: "0.95rem", color: v.tipo === "surtido" ? "var(--color-accent-blue)" : "var(--color-success)" }}>
                      {v.tipo === "surtido" ? "Surtido" : `$${v.totales?.totalCobrar?.toFixed(2) || "0.00"}`}
                    </span>
                  </div>
                </div>
              );
            })}
            {visitas.length === 0 && (
              <p style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "20px" }}>No hay visitas registradas aún.</p>
            )}
          </div>
        </div>

      </div>

      {/* MODAL DE REPORTES */}
      {showReporte && (
        <Reportes
          productos={productos}
          tiendas={tiendas}
          visitas={visitas}
          onClose={() => setShowReporte(false)}
        />
      )}
    </div>
  );
}
