import React, { useState, useMemo } from "react";

export default function Reportes({ productos, tiendas, visitas, onClose }) {
  const [activeSection, setActiveSection] = useState("faltante");

  // ── Cálculos centralizados a partir de visitas ──
  const analytics = useMemo(() => {
    // Acumuladores por producto
    const porProducto = {};
    // Acumuladores por tienda
    const porTienda = {};

    visitas.forEach(v => {
      const esCorte = v.tipo === "corte";
      const tiendaId = v.tiendaId;

      // Acumular por tienda
      if (!porTienda[tiendaId]) {
        porTienda[tiendaId] = {
          totalCobrado: 0,
          totalVentaBruta: 0,
          totalPiezasVendidas: 0,
          numVisitas: 0,
          numCortes: 0,
          numSurtidos: 0
        };
      }
      porTienda[tiendaId].numVisitas++;
      if (esCorte) {
        porTienda[tiendaId].numCortes++;
        porTienda[tiendaId].totalCobrado += v.totales?.totalCobrado || 0;
        porTienda[tiendaId].totalVentaBruta += v.totales?.totalMontoVenta || 0;
        porTienda[tiendaId].totalPiezasVendidas += v.totales?.totalPiezas || 0;
      } else {
        porTienda[tiendaId].numSurtidos++;
      }

      // Acumular por producto
      const items = v.productosCorte || [];
      items.forEach(item => {
        const prodId = item.productoId;
        if (!prodId) return;

        if (!porProducto[prodId]) {
          porProducto[prodId] = {
            nombre: item.nombre || "Desconocido",
            totalVendido: 0,
            totalResurtido: 0,
            ingresoBruto: 0,
            ingresoNeto: 0,
            precioVenta: item.precioVenta || 0,
            precioConsignacion: item.precioConsignacion || 0
          };
        }

        if (esCorte) {
          porProducto[prodId].totalVendido += item.vendido || 0;
          porProducto[prodId].ingresoBruto += (item.vendido || 0) * (item.precioVenta || 0);
          porProducto[prodId].ingresoNeto += (item.vendido || 0) * (item.precioConsignacion || 0);
        }
        porProducto[prodId].totalResurtido += item.reabastecido || 0;
      });
    });

    return { porProducto, porTienda };
  }, [visitas]);

  // ── Sección 1: Faltante en Inventario Central ──
  const faltanteData = useMemo(() => {
    const rows = [];
    Object.entries(analytics.porProducto).forEach(([prodId, data]) => {
      if (data.totalVendido === 0 && data.totalResurtido === 0) return;

      const prod = productos.find(p => p.id === prodId);
      const stockCentral = prod ? prod.stockAlmacen : 0;
      const costo = prod ? prod.costo : 0;

      // "Salidas netas del almacén" = lo que se resurtió a tiendas
      // El usuario quiere ver cuánto necesita reponer
      // Si vendió X y resurtió Y a tiendas, entonces Y piezas salieron del almacén
      const salidaAlmacen = data.totalResurtido;
      const costoReposicion = salidaAlmacen * costo;

      rows.push({
        prodId,
        nombre: data.nombre,
        categoria: prod?.categoria || "General",
        totalVendido: data.totalVendido,
        totalResurtido: data.totalResurtido,
        stockCentral,
        salidaAlmacen,
        costo,
        costoReposicion
      });
    });

    // Ordenar por mayor cantidad resurtida (más salidas del almacén)
    rows.sort((a, b) => b.salidaAlmacen - a.salidaAlmacen);
    return rows;
  }, [analytics.porProducto, productos]);

  // ── Sección 2: Top Productos Más Vendidos ──
  const topVendidos = useMemo(() => {
    return Object.entries(analytics.porProducto)
      .map(([prodId, data]) => {
        const prod = productos.find(p => p.id === prodId);
        return {
          prodId,
          nombre: data.nombre,
          categoria: prod?.categoria || "General",
          unidades: data.totalVendido,
          ingresoBruto: data.ingresoBruto,
          ingresoNeto: data.ingresoNeto,
          comisionTotal: data.ingresoBruto - data.ingresoNeto
        };
      })
      .filter(r => r.unidades > 0)
      .sort((a, b) => b.unidades - a.unidades)
      .slice(0, 15);
  }, [analytics.porProducto, productos]);

  // ── Sección 3: Rentabilidad por Producto ──
  const rentabilidad = useMemo(() => {
    return Object.entries(analytics.porProducto)
      .map(([prodId, data]) => {
        const prod = productos.find(p => p.id === prodId);
        const costo = prod ? prod.costo : 0;
        const costoTotal = data.totalVendido * costo;
        const utilidad = data.ingresoNeto - costoTotal;
        const margen = data.ingresoNeto > 0 ? (utilidad / data.ingresoNeto) * 100 : 0;

        return {
          prodId,
          nombre: data.nombre,
          categoria: prod?.categoria || "General",
          unidades: data.totalVendido,
          ingresoNeto: data.ingresoNeto,
          costoTotal,
          utilidad,
          margen
        };
      })
      .filter(r => r.unidades > 0)
      .sort((a, b) => b.utilidad - a.utilidad)
      .slice(0, 15);
  }, [analytics.porProducto, productos]);

  // ── Sección 4: Rendimiento por Tienda ──
  const rendimientoTiendas = useMemo(() => {
    return Object.entries(analytics.porTienda)
      .map(([tiendaId, data]) => {
        const tienda = tiendas.find(t => t.id === tiendaId);
        const promedioVenta = data.numCortes > 0 ? data.totalCobrado / data.numCortes : 0;

        // Calcular inventario actual en la tienda
        let piezasEnTienda = 0;
        if (tienda?.inventarioActual) {
          piezasEnTienda = Object.values(tienda.inventarioActual).reduce((a, b) => a + b, 0);
        }

        return {
          tiendaId,
          nombre: tienda?.nombre || "Tienda eliminada",
          encargado: tienda?.encargado || "-",
          estado: tienda?.estado || "inactivo",
          totalCobrado: data.totalCobrado,
          totalVentaBruta: data.totalVentaBruta,
          totalPiezasVendidas: data.totalPiezasVendidas,
          numCortes: data.numCortes,
          numSurtidos: data.numSurtidos,
          numVisitas: data.numVisitas,
          promedioVenta,
          piezasEnTienda
        };
      })
      .sort((a, b) => b.totalCobrado - a.totalCobrado);
  }, [analytics.porTienda, tiendas]);

  // ── Sección 5: Resumen General ──
  const resumenGeneral = useMemo(() => {
    let totalCobradoGlobal = 0;
    let totalVentaBrutaGlobal = 0;
    let totalPiezasVendidasGlobal = 0;
    let totalComisionGlobal = 0;
    let totalCortesGlobal = 0;
    let totalSurtidosGlobal = 0;

    visitas.forEach(v => {
      if (v.tipo === "corte") {
        totalCobradoGlobal += v.totales?.totalCobrado || 0;
        totalVentaBrutaGlobal += v.totales?.totalMontoVenta || 0;
        totalPiezasVendidasGlobal += v.totales?.totalPiezas || 0;
        totalComisionGlobal += v.totales?.totalComision || 0;
        totalCortesGlobal++;
      } else {
        totalSurtidosGlobal++;
      }
    });

    // Calcular costo total de lo vendido
    let costoTotalVendido = 0;
    Object.entries(analytics.porProducto).forEach(([prodId, data]) => {
      const prod = productos.find(p => p.id === prodId);
      if (prod) {
        costoTotalVendido += data.totalVendido * prod.costo;
      }
    });

    const utilidadNeta = totalCobradoGlobal - costoTotalVendido;

    return {
      totalCobradoGlobal,
      totalVentaBrutaGlobal,
      totalPiezasVendidasGlobal,
      totalComisionGlobal,
      totalCortesGlobal,
      totalSurtidosGlobal,
      totalVisitas: visitas.length,
      costoTotalVendido,
      utilidadNeta,
      margenGlobal: totalCobradoGlobal > 0 ? (utilidadNeta / totalCobradoGlobal) * 100 : 0
    };
  }, [visitas, analytics.porProducto, productos]);

  // ── Exportar a CSV ──
  const exportCSV = (filename, headers, rows) => {
    const csvHeaders = headers.join(",");
    const csvRows = rows.map(r => r.map(v => `"${v}"`).join(","));
    const csvContent = [csvHeaders, ...csvRows].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportFaltante = () => {
    exportCSV(
      "reporte_faltante_inventario.csv",
      ["Producto", "Categoría", "Total Vendido", "Total Resurtido a Tiendas", "Stock Central Actual", "Costo Unitario", "Costo Reposición"],
      faltanteData.map(r => [r.nombre, r.categoria, r.totalVendido, r.totalResurtido, r.stockCentral, r.costo.toFixed(2), r.costoReposicion.toFixed(2)])
    );
  };

  const exportTopVendidos = () => {
    exportCSV(
      "reporte_top_vendidos.csv",
      ["Producto", "Categoría", "Unidades Vendidas", "Ingreso Bruto", "Ingreso Neto (Tu cobro)", "Comisión Cedida"],
      topVendidos.map(r => [r.nombre, r.categoria, r.unidades, r.ingresoBruto.toFixed(2), r.ingresoNeto.toFixed(2), r.comisionTotal.toFixed(2)])
    );
  };

  const exportRentabilidad = () => {
    exportCSV(
      "reporte_rentabilidad.csv",
      ["Producto", "Categoría", "Unidades", "Ingreso Neto", "Costo Total", "Utilidad", "Margen %"],
      rentabilidad.map(r => [r.nombre, r.categoria, r.unidades, r.ingresoNeto.toFixed(2), r.costoTotal.toFixed(2), r.utilidad.toFixed(2), r.margen.toFixed(1)])
    );
  };

  const exportTiendas = () => {
    exportCSV(
      "reporte_rendimiento_tiendas.csv",
      ["Tienda", "Encargado", "Estado", "Total Cobrado", "Piezas Vendidas", "Cortes", "Surtidos", "Promedio/Visita", "Pzas en Tienda"],
      rendimientoTiendas.map(r => [r.nombre, r.encargado, r.estado, r.totalCobrado.toFixed(2), r.totalPiezasVendidas, r.numCortes, r.numSurtidos, r.promedioVenta.toFixed(2), r.piezasEnTienda])
    );
  };

  const maxVendido = topVendidos.length > 0 ? topVendidos[0].unidades : 1;
  const maxUtilidad = rentabilidad.length > 0 ? Math.max(...rentabilidad.map(r => Math.abs(r.utilidad))) : 1;

  const sections = [
    { key: "faltante", label: "🔴 Faltante Inventario", shortLabel: "🔴 Faltante" },
    { key: "vendidos", label: "🏆 Más Vendidos", shortLabel: "🏆 Top" },
    { key: "rentabilidad", label: "💰 Rentabilidad", shortLabel: "💰 Rentab." },
    { key: "tiendas", label: "🏪 Por Tienda", shortLabel: "🏪 Tiendas" },
    { key: "resumen", label: "📊 Resumen General", shortLabel: "📊 Resumen" }
  ];

  return (
    <div className="report-overlay" onClick={onClose}>
      <div className="report-modal" onClick={(e) => e.stopPropagation()}>

        {/* HEADER */}
        <div className="report-header">
          <div>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.4rem" }}>📈 Reporte de Inteligencia de Ventas</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginTop: "4px" }}>
              Datos acumulados de {visitas.length} visita{visitas.length !== 1 ? "s" : ""} registrada{visitas.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button className="report-close-btn" onClick={onClose} title="Cerrar">✕</button>
        </div>

        {/* NAVIGATION TABS */}
        <div className="report-tabs">
          {sections.map(s => (
            <button
              key={s.key}
              className={`report-tab-btn ${activeSection === s.key ? "active" : ""}`}
              onClick={() => setActiveSection(s.key)}
            >
              <span className="report-tab-full">{s.label}</span>
              <span className="report-tab-short">{s.shortLabel}</span>
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div className="report-content">

          {/* ═══ FALTANTE INVENTARIO ═══ */}
          {activeSection === "faltante" && (
            <div className="report-section">
              <div className="report-section-header">
                <div>
                  <h3>Faltante en Inventario Central</h3>
                  <p>Productos que se han resurtido a tiendas y necesitan reponerse en tu almacén.</p>
                </div>
                <button className="btn btn-secondary" onClick={exportFaltante} style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>📥 Exportar CSV</button>
              </div>

              {faltanteData.length === 0 ? (
                <div className="report-empty">
                  <span style={{ fontSize: "2rem" }}>📦</span>
                  <p>No se han registrado ventas ni resurtidos aún.</p>
                </div>
              ) : (
                <>
                  {/* Resumen rápido */}
                  <div className="report-summary-row">
                    <div className="report-summary-card" style={{ borderLeft: "4px solid var(--color-danger)" }}>
                      <span className="report-summary-value">{faltanteData.reduce((a, r) => a + r.totalResurtido, 0)} pzas</span>
                      <span className="report-summary-label">Total Resurtido a Tiendas</span>
                    </div>
                    <div className="report-summary-card" style={{ borderLeft: "4px solid var(--color-warning)" }}>
                      <span className="report-summary-value">${faltanteData.reduce((a, r) => a + r.costoReposicion, 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                      <span className="report-summary-label">Costo de Reposición</span>
                    </div>
                    <div className="report-summary-card" style={{ borderLeft: "4px solid var(--color-accent-blue)" }}>
                      <span className="report-summary-value">{faltanteData.reduce((a, r) => a + r.totalVendido, 0)} pzas</span>
                      <span className="report-summary-label">Total Vendido Acumulado</span>
                    </div>
                  </div>

                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th style={{ textAlign: "center" }}>Vendidos</th>
                          <th style={{ textAlign: "center" }}>Resurtido a Tiendas</th>
                          <th style={{ textAlign: "center" }}>Stock Central</th>
                          <th style={{ textAlign: "right" }}>Costo Reposición</th>
                        </tr>
                      </thead>
                      <tbody>
                        {faltanteData.map(row => (
                          <tr key={row.prodId}>
                            <td data-label="Producto">
                              <div><strong>{row.nombre}</strong></div>
                              <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{row.categoria}</div>
                            </td>
                            <td data-label="Vendidos" style={{ textAlign: "center", fontWeight: "bold" }}>{row.totalVendido}</td>
                            <td data-label="Resurtido" style={{ textAlign: "center", color: "var(--color-warning)", fontWeight: "bold" }}>{row.totalResurtido}</td>
                            <td data-label="Stock Central" style={{ textAlign: "center", fontWeight: "bold", color: row.stockCentral < 3 ? "var(--color-danger)" : "inherit" }}>
                              {row.stockCentral} pzas
                            </td>
                            <td data-label="Costo Repos." style={{ textAlign: "right", fontWeight: "bold" }}>
                              ${row.costoReposicion.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ═══ TOP VENDIDOS ═══ */}
          {activeSection === "vendidos" && (
            <div className="report-section">
              <div className="report-section-header">
                <div>
                  <h3>Top Productos Más Vendidos</h3>
                  <p>Ranking por unidades vendidas acumuladas en todas las tiendas.</p>
                </div>
                <button className="btn btn-secondary" onClick={exportTopVendidos} style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>📥 Exportar CSV</button>
              </div>

              {topVendidos.length === 0 ? (
                <div className="report-empty">
                  <span style={{ fontSize: "2rem" }}>🏆</span>
                  <p>Aún no hay ventas registradas para generar un ranking.</p>
                </div>
              ) : (
                <div className="report-ranking">
                  {topVendidos.map((item, idx) => (
                    <div key={item.prodId} className="report-rank-item">
                      <div className="report-rank-position">
                        {idx < 3 ? ["🥇", "🥈", "🥉"][idx] : `#${idx + 1}`}
                      </div>
                      <div className="report-rank-info">
                        <div className="report-rank-name">
                          <strong>{item.nombre}</strong>
                          <span className="badge badge-info">{item.categoria}</span>
                        </div>
                        <div className="report-rank-bar-container">
                          <div
                            className="report-rank-bar"
                            style={{ width: `${(item.unidades / maxVendido) * 100}%` }}
                          />
                        </div>
                        <div className="report-rank-stats">
                          <span><strong>{item.unidades}</strong> pzas vendidas</span>
                          <span>Bruto: <strong>${item.ingresoBruto.toFixed(2)}</strong></span>
                          <span>Neto: <strong style={{ color: "var(--color-success)" }}>${item.ingresoNeto.toFixed(2)}</strong></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ RENTABILIDAD ═══ */}
          {activeSection === "rentabilidad" && (
            <div className="report-section">
              <div className="report-section-header">
                <div>
                  <h3>Rentabilidad por Producto</h3>
                  <p>Utilidad neta = Tu cobro (Precio Consignación) − Costo de compra.</p>
                </div>
                <button className="btn btn-secondary" onClick={exportRentabilidad} style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>📥 Exportar CSV</button>
              </div>

              {rentabilidad.length === 0 ? (
                <div className="report-empty">
                  <span style={{ fontSize: "2rem" }}>💰</span>
                  <p>Sin datos de rentabilidad. Registra ventas para ver este reporte.</p>
                </div>
              ) : (
                <div className="report-ranking">
                  {rentabilidad.map((item, idx) => (
                    <div key={item.prodId} className="report-rank-item">
                      <div className="report-rank-position" style={{ color: item.utilidad >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
                        {idx < 3 ? ["🥇", "🥈", "🥉"][idx] : `#${idx + 1}`}
                      </div>
                      <div className="report-rank-info">
                        <div className="report-rank-name">
                          <strong>{item.nombre}</strong>
                          <span className={`badge ${item.utilidad >= 0 ? "badge-success" : "badge-danger"}`}>
                            {item.margen.toFixed(0)}% margen
                          </span>
                        </div>
                        <div className="report-rank-bar-container">
                          <div
                            className="report-rank-bar"
                            style={{
                              width: `${(Math.abs(item.utilidad) / maxUtilidad) * 100}%`,
                              backgroundColor: item.utilidad >= 0 ? "var(--color-success)" : "var(--color-danger)"
                            }}
                          />
                        </div>
                        <div className="report-rank-stats">
                          <span><strong>{item.unidades}</strong> pzas</span>
                          <span>Cobrado: <strong>${item.ingresoNeto.toFixed(2)}</strong></span>
                          <span>Costo: <strong>${item.costoTotal.toFixed(2)}</strong></span>
                          <span>Utilidad: <strong style={{ color: item.utilidad >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>${item.utilidad.toFixed(2)}</strong></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ RENDIMIENTO POR TIENDA ═══ */}
          {activeSection === "tiendas" && (
            <div className="report-section">
              <div className="report-section-header">
                <div>
                  <h3>Rendimiento por Tienda</h3>
                  <p>Desempeño de cada punto de venta en base a las visitas registradas.</p>
                </div>
                <button className="btn btn-secondary" onClick={exportTiendas} style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>📥 Exportar CSV</button>
              </div>

              {rendimientoTiendas.length === 0 ? (
                <div className="report-empty">
                  <span style={{ fontSize: "2rem" }}>🏪</span>
                  <p>No hay tiendas con visitas registradas aún.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Tienda</th>
                        <th style={{ textAlign: "center" }}>Cortes</th>
                        <th style={{ textAlign: "center" }}>Pzas Vendidas</th>
                        <th style={{ textAlign: "right" }}>Total Cobrado</th>
                        <th style={{ textAlign: "right" }}>Prom/Corte</th>
                        <th style={{ textAlign: "center" }}>Inventario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rendimientoTiendas.map(row => (
                        <tr key={row.tiendaId}>
                          <td data-label="Tienda">
                            <div><strong>{row.nombre}</strong></div>
                            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{row.encargado}</div>
                          </td>
                          <td data-label="Cortes" style={{ textAlign: "center" }}>
                            <span className="badge badge-info">{row.numCortes}</span>
                          </td>
                          <td data-label="Vendidas" style={{ textAlign: "center", fontWeight: "bold" }}>{row.totalPiezasVendidas}</td>
                          <td data-label="Cobrado" style={{ textAlign: "right", fontWeight: "bold", color: "var(--color-success)" }}>
                            ${row.totalCobrado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </td>
                          <td data-label="Promedio" style={{ textAlign: "right", color: "var(--color-text-muted)" }}>
                            ${row.promedioVenta.toFixed(2)}
                          </td>
                          <td data-label="Inventario" style={{ textAlign: "center", fontWeight: "bold" }}>
                            {row.piezasEnTienda} pzas
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ═══ RESUMEN GENERAL ═══ */}
          {activeSection === "resumen" && (
            <div className="report-section">
              <div className="report-section-header">
                <div>
                  <h3>Resumen General del Negocio</h3>
                  <p>Panorama completo de la operación acumulada.</p>
                </div>
              </div>

              <div className="report-kpi-grid">
                <div className="report-kpi-card">
                  <div className="report-kpi-icon" style={{ backgroundColor: "rgba(76, 175, 80, 0.12)", color: "var(--color-success)" }}>💵</div>
                  <div className="report-kpi-value" style={{ color: "var(--color-success)" }}>
                    ${resumenGeneral.totalCobradoGlobal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="report-kpi-label">Total Cobrado (Neto)</div>
                </div>

                <div className="report-kpi-card">
                  <div className="report-kpi-icon" style={{ backgroundColor: "rgba(58, 134, 255, 0.12)", color: "var(--color-accent-blue)" }}>🏷️</div>
                  <div className="report-kpi-value">
                    ${resumenGeneral.totalVentaBrutaGlobal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="report-kpi-label">Venta Bruta (P. Público)</div>
                </div>

                <div className="report-kpi-card">
                  <div className="report-kpi-icon" style={{ backgroundColor: "rgba(255, 152, 0, 0.12)", color: "var(--color-warning)" }}>🤝</div>
                  <div className="report-kpi-value" style={{ color: "var(--color-warning)" }}>
                    ${resumenGeneral.totalComisionGlobal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="report-kpi-label">Comisión Cedida a Tiendas</div>
                </div>

                <div className="report-kpi-card">
                  <div className="report-kpi-icon" style={{ backgroundColor: "rgba(244, 67, 54, 0.12)", color: "var(--color-danger)" }}>📦</div>
                  <div className="report-kpi-value">
                    ${resumenGeneral.costoTotalVendido.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="report-kpi-label">Costo de Mercancía Vendida</div>
                </div>

                <div className="report-kpi-card" style={{ border: "2px solid var(--color-success)" }}>
                  <div className="report-kpi-icon" style={{ backgroundColor: "rgba(76, 175, 80, 0.2)", color: "var(--color-success)" }}>🏆</div>
                  <div className="report-kpi-value" style={{ color: "var(--color-success)", fontSize: "1.6rem" }}>
                    ${resumenGeneral.utilidadNeta.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="report-kpi-label">Utilidad Neta (Cobrado − Costo)</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "4px" }}>
                    Margen: <strong>{resumenGeneral.margenGlobal.toFixed(1)}%</strong>
                  </div>
                </div>

                <div className="report-kpi-card">
                  <div className="report-kpi-icon" style={{ backgroundColor: "rgba(58, 134, 255, 0.12)", color: "var(--color-accent-blue)" }}>📋</div>
                  <div className="report-kpi-value">{resumenGeneral.totalPiezasVendidasGlobal}</div>
                  <div className="report-kpi-label">Piezas Vendidas Totales</div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--color-border)", margin: "20px 0", paddingTop: "20px" }}>
                <h4 style={{ marginBottom: "12px" }}>📅 Actividad Registrada</h4>
                <div className="report-summary-row">
                  <div className="report-summary-card" style={{ borderLeft: "4px solid var(--color-accent-blue)" }}>
                    <span className="report-summary-value">{resumenGeneral.totalVisitas}</span>
                    <span className="report-summary-label">Visitas Totales</span>
                  </div>
                  <div className="report-summary-card" style={{ borderLeft: "4px solid var(--color-success)" }}>
                    <span className="report-summary-value">{resumenGeneral.totalCortesGlobal}</span>
                    <span className="report-summary-label">Cortes de Cobro</span>
                  </div>
                  <div className="report-summary-card" style={{ borderLeft: "4px solid var(--color-warning)" }}>
                    <span className="report-summary-value">{resumenGeneral.totalSurtidosGlobal}</span>
                    <span className="report-summary-label">Surtidos Iniciales</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
