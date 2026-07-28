import React, { useState, useEffect } from "react";
import { collection, doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import Swal from "sweetalert2";

export default function Tiendas() {
  const [tiendas, setTiendas] = useState([]);
  const [visitas, setVisitas] = useState([]);
  const [selectedTienda, setSelectedTienda] = useState(null);
  const [editingTienda, setEditingTienda] = useState(null);
  const [search, setSearch] = useState("");
  const [productos, setProductos] = useState([]);
  
  // Pestaña activa en vista celular/tablet ("lista" o "registro")
  const [mobileTab, setMobileTab] = useState("lista");

  const [form, setForm] = useState({
    nombre: "",
    encargado: "",
    direccion: "",
    telefono: "",
    estado: "activo",
    latitud: "",
    longitud: "",
    fotoFachadaUrl: ""
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "tiendas"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTiendas(list);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "productos"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProductos(list);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "visitas"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVisitas(list);
    });
    return unsub;
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (tienda) => {
    setEditingTienda(tienda.id);
    setForm({
      nombre: tienda.nombre || "",
      encargado: tienda.encargado || "",
      direccion: tienda.direccion || "",
      telefono: tienda.telefono || "",
      estado: tienda.estado || "activo",
      latitud: tienda.ubicacionGps?.latitude || "",
      longitud: tienda.ubicacionGps?.longitude || "",
      fotoFachadaUrl: tienda.fotoFachadaUrl || ""
    });
    setMobileTab("registro"); // Cambiar automáticamente al formulario en celular
  };

  const handleImprimirContrato = (tienda) => {
    const contratoData = {
      tienda: tienda.nombre,
      encargado: tienda.encargado || "Responsable de la Tienda",
      direccion: tienda.direccion || "Dirección no especificada",
      telefono: tienda.telefono || "Sin teléfono",
      fecha: new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    };
    localStorage.setItem("print_contrato_data", JSON.stringify(contratoData));
    window.open("/templates/contrato.html?source=app", "_blank");
  };

  const handleImprimirFinContrato = (tienda) => {
    const inventarioRetornado = [];
    if (tienda.inventarioActual) {
      Object.entries(tienda.inventarioActual).forEach(([prodId, cant]) => {
        if (cant > 0) {
          const prod = productos.find(p => p.id === prodId);
          inventarioRetornado.push({
            id: prodId,
            nombre: prod ? prod.nombre : "Producto Desconocido",
            categoria: prod ? prod.categoria : "General",
            cantidad: cant
          });
        }
      });
    }

    const finContratoData = {
      tienda: tienda.nombre,
      encargado: tienda.encargado || "Responsable de la Tienda",
      direccion: tienda.direccion || "Dirección no especificada",
      telefono: tienda.telefono || "Sin teléfono",
      fecha: new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }),
      productos: inventarioRetornado
    };
    localStorage.setItem("print_fin_contrato_data", JSON.stringify(finContratoData));
    window.open("/templates/fin_contrato.html?source=app", "_blank");
  };

  const resetForm = () => {
    setEditingTienda(null);
    setForm({
      nombre: "",
      encargado: "",
      direccion: "",
      telefono: "",
      estado: "activo",
      latitud: "",
      longitud: "",
      fotoFachadaUrl: ""
    });
    setMobileTab("lista"); // Cambiar de vuelta al listado al cancelar
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre) {
      Swal.fire({
        title: "Atención",
        text: "Por favor ingresa el nombre de la tienda.",
        icon: "warning",
        confirmButtonColor: "#3A86FF"
      });
      return;
    }

    const docId = editingTienda || `tienda_${Date.now()}`;
    const payload = {
      nombre: form.nombre,
      encargado: form.encargado,
      direccion: form.direccion,
      telefono: form.telefono,
      estado: form.estado,
      ubicacionGps: form.latitud && form.longitud ? {
        latitude: parseFloat(form.latitud),
        longitude: parseFloat(form.longitud)
      } : null,
      fotoFachadaUrl: form.fotoFachadaUrl || "",
      fechaCreacion: editingTienda ? (tiendas.find(t => t.id === editingTienda)?.fechaCreacion || new Date()) : new Date(),
      ultimoCorte: new Date(),
      inventarioActual: editingTienda ? (tiendas.find(t => t.id === editingTienda)?.inventarioActual || {}) : {}
    };

    try {
      await setDoc(doc(db, "tiendas", docId), payload);
      Swal.fire({
        title: "¡Éxito!",
        text: editingTienda ? "Tienda actualizada correctamente." : "Nueva tienda agregada con éxito.",
        icon: "success",
        confirmButtonColor: "#3A86FF"
      });
      resetForm();
    } catch (err) {
      console.error(err);
      Swal.fire({
        title: "Error",
        text: "Error al registrar la tienda en la base de datos.",
        icon: "error",
        confirmButtonColor: "#3A86FF"
      });
    }
  };

  const filteredTiendas = tiendas.filter(t => 
    t.nombre.toLowerCase().includes(search.toLowerCase()) ||
    t.encargado.toLowerCase().includes(search.toLowerCase())
  );

  const tiendaVisitas = visitas
    .filter(v => v.tiendaId === selectedTienda?.id)
    .sort((a, b) => {
      const dateA = a.fecha?.seconds ? a.fecha.seconds : new Date(a.fecha).getTime() / 1000;
      const dateB = b.fecha?.seconds ? b.fecha.seconds : new Date(b.fecha).getTime() / 1000;
      return dateB - dateA;
    });

  const handleTiendaClick = (tienda) => {
    setSelectedTienda(tienda);
    if (window.innerWidth <= 900) {
      setMobileTab("registro"); // Redirigir a ficha/historial en celular
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
      
      <div className="main-header">
        <div className="header-title">
          <h1>Puntos de Venta (Clientes)</h1>
          <p>Catálogo de tiendas a consignación y estado de exhibidores en campo</p>
        </div>
      </div>

      {/* Segmentador de pestañas para celular */}
      <div className="mobile-tabs-container">
        <button 
          className={`mobile-tab-btn ${mobileTab === "lista" ? "active" : ""}`}
          onClick={() => setMobileTab("lista")}
        >
          📋 Ver Tiendas ({filteredTiendas.length})
        </button>
        <button 
          className={`mobile-tab-btn ${mobileTab === "registro" ? "active" : ""}`}
          onClick={() => setMobileTab("registro")}
        >
          ➕ {editingTienda ? "Editar" : selectedTienda ? "Ficha / Historial" : "Registrar"}
        </button>
      </div>

      <div className="layout-grid">
        
        {/* LISTADO DE TIENDAS */}
        <div className={`card ${mobileTab !== "lista" ? "mobile-hide" : ""}`} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "15px" }}>
            <h3>Tiendas en Ruta</h3>
            <input 
              type="text" 
              placeholder="Buscar tienda..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "200px", padding: "8px 12px", fontSize: "0.85rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)" }}
            />
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Contacto</th>
                  <th>Estado</th>
                  <th>Ubicación</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredTiendas.map(t => (
                  <tr key={t.id} style={{ cursor: "pointer" }} onClick={() => handleTiendaClick(t)}>
                    <td data-label="Nombre">
                      <div><strong>{t.nombre}</strong></div>
                      <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{t.direccion}</div>
                    </td>
                    <td data-label="Contacto">
                      <div>{t.encargado}</div>
                      {t.telefono && (
                        <div style={{ fontSize: "0.8rem" }}>
                          <a 
                            href={`https://wa.me/${t.telefono.replace(/[^0-9]/g, "")}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ color: "var(--color-accent-blue)", textDecoration: "none", fontWeight: "bold" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            💬 WhatsApp
                          </a>
                        </div>
                      )}
                    </td>
                    <td data-label="Estado">
                      <span className={`badge ${
                        t.estado === "activo" ? "badge-success" : 
                        t.estado === "en_mora" ? "badge-danger" : "badge-warning"
                      }`}>
                        {t.estado === "activo" ? "Activo" : 
                         t.estado === "en_mora" ? "En Mora" : "Inactivo"}
                      </span>
                    </td>
                    <td data-label="Ubicación">
                      {t.ubicacionGps ? (
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${t.ubicacionGps.latitude},${t.ubicacionGps.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="badge badge-info"
                          style={{ textDecoration: "none" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          📍 Ver Mapa
                        </a>
                      ) : (
                        <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>Sin GPS</span>
                      )}
                    </td>
                    <td data-label="Acción">
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: "6px 12px", fontSize: "0.8rem" }} 
                        onClick={(e) => { e.stopPropagation(); handleEdit(t); }}
                      >
                        ✏️ Editar
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredTiendas.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "20px" }}>
                      No se encontraron tiendas registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* COLUMNA DERECHA: EDICIÓN O HISTORIAL */}
        <div className={`${mobileTab !== "registro" ? "mobile-hide" : ""}`} style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
          
          {/* FORMULARIO */}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <h3>{editingTienda ? "Editar Tienda" : "Registrar Tienda"}</h3>
            
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className="form-group">
                <label>Nombre Comercial *</label>
                <input type="text" name="nombre" value={form.nombre} onChange={handleChange} placeholder="Ej. Abarrotes Candy" required />
              </div>

              <div className="form-group">
                <label>Nombre del Encargado / Dueño</label>
                <input type="text" name="encargado" value={form.encargado} onChange={handleChange} placeholder="Ej. Sra. Carmen Gómez" />
              </div>

              <div className="form-group">
                <label>Dirección Completa</label>
                <input type="text" name="direccion" value={form.direccion} onChange={handleChange} placeholder="Calle, Número, Colonia" />
              </div>

              <div className="form-grid" style={{ gridTemplateColumns: "1.2fr 0.8fr", gap: "12px" }}>
                <div className="form-group">
                  <label>Teléfono (WhatsApp)</label>
                  <input type="text" name="telefono" value={form.telefono} onChange={handleChange} placeholder="Ej. 4441234567" />
                </div>

                <div className="form-group">
                  <label>Estado</label>
                  <select name="estado" value={form.estado} onChange={handleChange}>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="en_mora">En Mora</option>
                  </select>
                </div>
              </div>

              <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="form-group">
                  <label>Latitud GPS (Opcional)</label>
                  <input type="number" name="latitud" value={form.latitud} onChange={handleChange} step="any" placeholder="Ej. 22.1565" />
                </div>

                <div className="form-group">
                  <label>Longitud GPS (Opcional)</label>
                  <input type="number" name="longitud" value={form.longitud} onChange={handleChange} step="any" placeholder="Ej. -100.9855" />
                </div>
              </div>

              <div className="form-group">
                <label>Enlace de Foto de Fachada (Storage/URL)</label>
                <input type="text" name="fotoFachadaUrl" value={form.fotoFachadaUrl} onChange={handleChange} placeholder="http://enlace-a-foto.jpg" />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {editingTienda ? "Actualizar" : "Guardar"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  {editingTienda ? "Cancelar" : "Limpiar"}
                </button>
              </div>
            </form>
          </div>

          {/* HISTORIAL DE VISITAS DE LA TIENDA SELECCIONADA */}
          {selectedTienda && (
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                <h4>Historial: {selectedTienda.nombre}</h4>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: "5px 10px", fontSize: "0.75rem" }}
                    onClick={() => handleImprimirContrato(selectedTienda)}
                  >
                    📄 Contrato
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: "5px 10px", fontSize: "0.75rem" }}
                    onClick={() => handleImprimirFinContrato(selectedTienda)}
                  >
                    📄 Fin Contrato
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: "5px 10px", fontSize: "0.75rem" }} 
                    onClick={() => setSelectedTienda(null)}
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "250px", overflowY: "auto" }}>
                {tiendaVisitas.map(v => {
                  const dateObj = v.fecha?.seconds ? new Date(v.fecha.seconds * 1000) : new Date(v.fecha);
                  return (
                    <div key={v.id} style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "0.85rem" }}>
                        <span>{dateObj.toLocaleDateString()} {dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        <span style={{ color: v.tipo === "surtido" ? "var(--color-accent-blue)" : "var(--color-success)" }}>
                          {v.tipo === "surtido" ? "Surtido Inicial" : `$${(v.totales?.totalCobrado ?? v.totales?.totalCobrar ?? 0).toFixed(2)}`}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "2px" }}>
                        {v.tipo === "surtido" ? 
                          `Surtido: ${v.totales?.totalValorInventarioDejado ? `$${v.totales.totalValorInventarioDejado.toFixed(2)} en mercancía` : ""}` : 
                          `Cobrado bruto: $${v.totales?.totalMontoVenta?.toFixed(2)} (Comisión entregada: $${v.totales?.totalComision?.toFixed(2)})`}
                      </p>
                      {v.comentarios && (
                        <p style={{ fontSize: "0.75rem", fontStyle: "italic", marginTop: "2px" }}>"{v.comentarios}"</p>
                      )}
                    </div>
                  );
                })}
                {tiendaVisitas.length === 0 && (
                  <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", textAlign: "center", padding: "10px" }}>
                    No se han registrado visitas a esta tienda todavía.
                  </p>
                )}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
