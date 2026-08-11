import React, { useState, useEffect } from "react";
import { collection, onSnapshot, doc, setDoc, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import Swal from "sweetalert2";

export default function Visitas() {
  const [tiendas, setTiendas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [selectedTiendaId, setSelectedTiendaId] = useState("");
  const [tipoOperacion, setTipoOperacion] = useState("corte"); // "corte" o "surtido"
  const [comisionPct, setComisionPct] = useState(20); // Porcentaje de comisión (e.g. 20)
  const [comentarios, setComentarios] = useState("");
  const [folio, setFolio] = useState("");
  
  // Pestaña activa en celulares ("conteo" o "cobro")
  const [mobileTab, setMobileTab] = useState("conteo");

  // Tabla de conteo: almacena { prodId: { inicial: X, fisico: Y, reab: Z } }
  const [conteo, setConteo] = useState({});

  useEffect(() => {
    // Escuchar Tiendas
    const unsubTiendas = onSnapshot(collection(db, "tiendas"), (snapshot) => {
      setTiendas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Escuchar Productos
    const unsubProductos = onSnapshot(collection(db, "productos"), (snapshot) => {
      setProductos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Generar un folio tentativo de ticket
    setFolio(`ETC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);

    return () => {
      unsubTiendas();
      unsubProductos();
    };
  }, []);

  // Cargar inventario inicial al seleccionar tienda o cambiar operación
  useEffect(() => {
    if (!selectedTiendaId) {
      setConteo({});
      return;
    }

    const tienda = tiendas.find(t => t.id === selectedTiendaId);
    if (!tienda) return;

    // Cargar comisión de la tienda si tiene
    if (tienda.comisionDefecto !== undefined) {
      setComisionPct(Math.round(tienda.comisionDefecto * 100));
    }

    const inicializado = {};
    productos.forEach(prod => {
      if (prod.activo) {
        const inventarioActualMap = tienda.inventarioActual || {};
        const stockInicial = tipoOperacion === "surtido" ? 0 : (inventarioActualMap[prod.id] || 0);

        inicializado[prod.id] = {
          inicial: stockInicial,
          fisico: stockInicial, // Por defecto asumimos que hay lo mismo física e inicialmente
          reab: 0
        };
      }
    });
    setConteo(inicializado);
  }, [selectedTiendaId, tipoOperacion, productos, tiendas]);

  const handleQtyChange = (prodId, field, val) => {
    const intVal = parseInt(val) || 0;
    setConteo(prev => ({
      ...prev,
      [prodId]: {
        ...prev[prodId],
        [field]: intVal
      }
    }));
  };

  const handleSelectTienda = (e) => {
    setSelectedTiendaId(e.target.value);
    setMobileTab("conteo"); // Restablecer a conteo al cambiar de tienda
  };

  // Calcular totales financieros
  const calculateTotals = () => {
    let totalPcsVendidas = 0;
    let totalPcsEntregadas = 0;
    let totalMontoVendido = 0;
    let totalValorInventarioDejado = 0;
    let totalCobrar = 0;
    const itemsCorte = [];

    Object.entries(conteo).forEach(([prodId, val]) => {
      const prod = productos.find(p => p.id === prodId);
      if (!prod) return;

      const vendido = Math.max(0, val.inicial - val.fisico);
      const subtotalVenta = vendido * prod.precioPublico;
      const nuevoDejado = val.fisico + val.reab;
      const valorDejado = nuevoDejado * prod.precioPublico;

      const pConsignacion = prod.precioConsignacion !== undefined ? prod.precioConsignacion : (prod.precioPublico * 0.8);
      const subtotalCobrar = vendido * pConsignacion;

      if (tipoOperacion === "surtido") {
        totalPcsEntregadas += val.reab;
        totalValorInventarioDejado += valorDejado;
      } else {
        totalPcsVendidas += vendido;
        totalMontoVendido += subtotalVenta;
        totalValorInventarioDejado += valorDejado;
        totalCobrar += subtotalCobrar;
      }

      itemsCorte.push({
        productoId: prodId,
        nombre: prod.nombre,
        precioVenta: prod.precioPublico,
        precioConsignacion: pConsignacion,
        cantidadInicial: val.inicial,
        cantidadFisica: val.fisico,
        vendido: tipoOperacion === "surtido" ? 0 : vendido,
        reabastecido: val.reab,
        cantidadDejada: nuevoDejado
      });
    });

    const totalComision = totalMontoVendido - totalCobrar;

    return {
      totalPcsVendidas,
      totalPcsEntregadas,
      totalMontoVendido,
      totalComision,
      totalCobrar,
      totalValorInventarioDejado,
      itemsCorte
    };
  };

  const totals = calculateTotals();

  const handleRegistrar = async () => {
    if (!selectedTiendaId) {
      Swal.fire({
        title: "Atención",
        text: "Por favor selecciona una tienda para realizar la operación.",
        icon: "warning",
        confirmButtonColor: "#3A86FF"
      });
      return;
    }

    const tienda = tiendas.find(t => t.id === selectedTiendaId);
    if (!tienda) return;

    // 1. Armar documento de visita
    const visitaDoc = {
      tiendaId: selectedTiendaId,
      fecha: new Date(), // Local timestamp
      usuarioId: "operador_ruta_default", // Se ligaría al Auth de Firebase
      tipo: tipoOperacion,
      productosCorte: totals.itemsCorte,
      totales: {
        totalCobrado: tipoOperacion === "surtido" ? 0 : totals.totalCobrar,
        totalComision: tipoOperacion === "surtido" ? 0 : totals.totalComision,
        totalMontoVenta: tipoOperacion === "surtido" ? 0 : totals.totalMontoVendido,
        totalPiezas: tipoOperacion === "surtido" ? totals.totalPcsEntregadas : totals.totalPcsVendidas,
        totalValorInventarioDejado: totals.totalValorInventarioDejado
      },
      comentarios: comentarios
    };

    // 2. Armar mapa de inventario a dejar en la tienda
    const nuevoInventarioMap = {};
    totals.itemsCorte.forEach(item => {
      nuevoInventarioMap[item.productoId] = item.cantidadDejada;
    });

    try {
      // Registrar Visita en Firestore
      await addDoc(collection(db, "visitas"), visitaDoc);

      // Actualizar inventario actual de la Tienda y su último corte
      await setDoc(doc(db, "tiendas", selectedTiendaId), {
        ...tienda,
        inventarioActual: nuevoInventarioMap,
        ultimoCorte: new Date()
      });

      // 3. ENVIAR DATOS A LOCALSTORAGE PARA IMPRESIÓN DEL TICKET
      const ticketData = {
        folio: folio,
        fecha: new Date().toISOString(),
        tienda: tienda.nombre,
        encargado: tienda.encargado || "Responsable",
        telefono: tienda.telefono || "",
        tipoOperacion: tipoOperacion,
        comisionPct: totals.totalMontoVendido > 0 ? Math.round((totals.totalComision / totals.totalMontoVendido) * 100) : comisionPct,
        totales: {
          totalMontoVendido: totals.totalMontoVendido,
          totalComision: totals.totalComision,
          totalCobrar: totals.totalCobrar,
          totalPiezas: totals.totalPcsVendidas,
          totalValorInventarioDejado: totals.totalValorInventarioDejado
        },
        productos: totals.itemsCorte.map(item => ({
          nombre: item.nombre,
          precio: item.precioVenta,
          inicial: item.cantidadInicial,
          fisico: item.cantidadFisica,
          reab: item.reabastecido,
          vendido: item.vendido,
          dejado: item.cantidadDejada
        })),
        comentarios: comentarios
      };

      localStorage.setItem("print_ticket_data", JSON.stringify(ticketData));
      
      const actionResult = await Swal.fire({
        title: "¡Visita Registrada!",
        text: "¿Cómo deseas enviar o recibir el ticket de la visita?",
        icon: "success",
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: "🖨️ Ver / Imprimir Ticket",
        denyButtonText: "💬 Enviar por WhatsApp",
        cancelButtonText: "Cerrar",
        confirmButtonColor: "#3A86FF",
        denyButtonColor: "#25D366",
        cancelButtonColor: "#6c757d",
      });

      if (actionResult.isConfirmed) {
        const ticketUrl = "/templates/ticket.html?source=app";
        const newWin = window.open(ticketUrl, "_blank");
        if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
          window.location.href = ticketUrl;
        }
      } else if (actionResult.isDenied) {
        // Seleccionar formato de envío
        const { value: format } = await Swal.fire({
          title: "Formato de WhatsApp",
          text: "¿Cómo deseas compartir el ticket?",
          icon: "question",
          input: "radio",
          inputOptions: {
            text: "💬 Mensaje de Texto (Directo)",
            pdf: "📄 Documento PDF (Descargar + Abrir Chat)",
            image: "🖼️ Imagen PNG (Descargar + Abrir Chat)"
          },
          inputValue: "text",
          confirmButtonText: "Siguiente",
          showCancelButton: true,
          cancelButtonText: "Cancelar",
          confirmButtonColor: "#3A86FF",
          cancelButtonColor: "#6c757d"
        });

        if (!format) return; // Si cancela

        let phone = tienda.telefono ? tienda.telefono.replace(/[^0-9]/g, "") : "";
        const { value: inputPhone } = await Swal.fire({
          title: "Enviar por WhatsApp",
          text: "Confirma o ingresa el número de teléfono (con código de país, ej. 524441234567):",
          input: "text",
          inputValue: phone,
          inputPlaceholder: "Ej. 524441234567",
          showCancelButton: true,
          confirmButtonColor: "#3A86FF",
          inputValidator: (value) => {
            if (!value) {
              return "¡Debes ingresar un número!";
            }
            if (!/^\d{10,15}$/.test(value.replace(/[^0-9]/g, ""))) {
              return "Por favor ingresa un número de teléfono válido de 10 a 15 dígitos.";
            }
          }
        });

        if (inputPhone) {
          let finalPhone = inputPhone.replace(/[^0-9]/g, "");
          if (finalPhone.length === 10) {
            finalPhone = "52" + finalPhone;
          }

          if (format === "text") {
            // Construir mensaje legible para WhatsApp (Texto)
            let message = `*EasyTech Supply* 🛒\n`;
            message += `*${tipoOperacion === "surtido" ? "NOTA DE SURTIDO / NUEVO CLIENTE" : "TICKET DE CORTE Y COBRO"}*\n\n`;
            message += `*Folio:* ${ticketData.folio}\n`;
            message += `*Fecha:* ${new Date(ticketData.fecha).toLocaleDateString("es-MX")} ${new Date(ticketData.fecha).toLocaleTimeString("es-MX", {hour: '2-digit', minute:'2-digit'})}\n`;
            message += `*Tienda:* ${ticketData.tienda}\n`;
            message += `*Encargado:* ${ticketData.encargado}\n\n`;
            
            message += `*Detalle de Productos:*\n`;
            ticketData.productos.forEach(prod => {
              if (tipoOperacion === "surtido") {
                if (prod.reab > 0) {
                  message += `- *${prod.nombre}*:\n  Surtido: *+${prod.reab}* pzas (Queda en exhibidor: ${prod.dejado})\n`;
                }
              } else {
                if (prod.vendido > 0 || prod.reab > 0 || prod.inicial > 0) {
                  message += `- *${prod.nombre}*:\n  Inicial: ${prod.inicial} | Físico: ${prod.fisico} | Surtido: +${prod.reab} | Queda: *${prod.dejado}* | Vendido: *${prod.vendido}* pzas ($${(prod.vendido * prod.precio).toFixed(2)})\n`;
                }
              }
            });
            
            message += `\n*Totales:*\n`;
            if (tipoOperacion === "surtido") {
              message += `- Piezas Entregadas: *${totals.totalPcsEntregadas}*\n`;
              message += `- Valor total en Consignación: *$${totals.totalValorInventarioDejado.toFixed(2)}*\n`;
            } else {
              message += `- Piezas Vendidas: *${ticketData.totales.totalPiezas}*\n`;
              message += `- Venta Bruta: *$${ticketData.totales.totalMontoVendido.toFixed(2)}*\n`;
              message += `- Comisión Tienda (${ticketData.comisionPct}%): *-$${ticketData.totales.totalComision.toFixed(2)}*\n`;
              message += `- *TOTAL NETO A COBRAR:* *$${ticketData.totales.totalCobrar.toFixed(2)}*\n`;
              message += `- Valor Inventario Restante: *$${totals.totalValorInventarioDejado.toFixed(2)}*\n`;
            }

            if (ticketData.comentarios) {
              message += `\n*Comentarios:* ${ticketData.comentarios}\n`;
            }
            
            message += `\n¡Gracias por su preferencia!`;

            const encodedText = encodeURIComponent(message);
            const whatsappUrl = `https://wa.me/${finalPhone}?text=${encodedText}`;
            const newWin = window.open(whatsappUrl, "_blank");
            if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
              window.location.href = whatsappUrl;
            }
          } else {
            // Formatos PDF o Imagen (redirección)
            const ticketUrl = `/templates/ticket.html?source=app&download=${format}&phone=${finalPhone}`;
            const newWin = window.open(ticketUrl, "_blank");
            if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
              window.location.href = ticketUrl;
            }
          }
        }
      }
      
      // Limpiar formulario
      setSelectedTiendaId("");
      setComentarios("");
      setFolio(`ETC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setMobileTab("conteo"); // Restablecer pestaña
    } catch (err) {
      console.error(err);
      Swal.fire({
        title: "Error",
        text: "Error al registrar la visita en la base de datos de Firestore.",
        icon: "error",
        confirmButtonColor: "#3A86FF"
      });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
      
      <div className="main-header">
        <div className="header-title">
          <h1>Registro de Visita y Cortes</h1>
          <p>Operación diaria en ruta: Conteo de ganchos, cobros y reabastecimiento</p>
        </div>
      </div>

      {/* 1. SELECCIONADOR DE TIENDA Y OPERACIÓN (Siempre visible arriba) */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
        <div className="form-grid">
          <div className="form-group">
            <label>Seleccionar Tienda a Visitar</label>
            <select value={selectedTiendaId} onChange={handleSelectTienda}>
              <option value="">-- Selecciona una Tienda --</option>
              {tiendas.map(t => (
                <option key={t.id} value={t.id}>{t.nombre} ({t.encargado})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Tipo de Operación</label>
            <select value={tipoOperacion} onChange={(e) => setTipoOperacion(e.target.value)}>
              <option value="corte">Corte y Cobro (Regular)</option>
              <option value="surtido">Surtido Inicial (Nueva Tienda)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Segmentador de pestañas para celulares */}
      {selectedTiendaId && (
        <div className="mobile-tabs-container">
          <button 
            className={`mobile-tab-btn ${mobileTab === "conteo" ? "active" : ""}`}
            onClick={() => setMobileTab("conteo")}
          >
            📋 Conteo de Inventario
          </button>
          <button 
            className={`mobile-tab-btn ${mobileTab === "cobro" ? "active" : ""}`}
            onClick={() => setMobileTab("cobro")}
          >
            💰 Cobro y Confirmación ({tipoOperacion === "surtido" ? `${totals.totalPcsEntregadas} pcs` : `$${totals.totalCobrar.toFixed(2)}`})
          </button>
        </div>
      )}

      <div className="layout-grid">
        
        {/* COLUMNA IZQUIERDA: PLANILLA DE AUDITORÍA */}
        <div className={`card ${mobileTab !== "conteo" ? "mobile-hide" : ""}`} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          {!selectedTiendaId ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted)" }}>
              Selecciona un punto de venta en el selector superior para cargar el inventario del exhibidor.
            </div>
          ) : (
            <>
              <h3>Planilla de Conteo</h3>
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th style={{ textAlign: "center" }}>Inicial</th>
                      <th style={{ textAlign: "center" }}>Físico</th>
                      <th style={{ textAlign: "center" }}>Vendido</th>
                      <th style={{ textAlign: "center" }}>Surtir</th>
                      <th style={{ textAlign: "right" }}>Queda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productos.filter(p => p.activo).map(prod => {
                      const itemConteo = conteo[prod.id] || { inicial: 0, fisico: 0, reab: 0 };
                      const vendido = tipoOperacion === "surtido" ? 0 : Math.max(0, itemConteo.inicial - itemConteo.fisico);
                      const queda = itemConteo.fisico + itemConteo.reab;

                      return (
                        <tr key={prod.id}>
                          <td data-label="Producto">
                            <div><strong>{prod.nombre}</strong></div>
                            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Precio: ${prod.precioPublico.toFixed(2)}</div>
                          </td>
                          <td data-label="Inicial" style={{ textAlign: "center", fontWeight: "bold" }}>
                            {itemConteo.inicial}
                          </td>
                          <td data-label="Físico" style={{ textAlign: "center" }}>
                            <input 
                              type="number" 
                              min="0" 
                              max={itemConteo.inicial}
                              value={itemConteo.fisico} 
                              disabled={tipoOperacion === "surtido"}
                              onChange={(e) => handleQtyChange(prod.id, "fisico", e.target.value)}
                              style={{ width: "60px", textAlign: "center", padding: "6px" }}
                            />
                          </td>
                          <td data-label="Vendido" style={{ textAlign: "center", color: vendido > 0 ? "var(--color-success)" : "inherit", fontWeight: vendido > 0 ? "bold" : "normal" }}>
                            {vendido}
                          </td>
                          <td data-label="Surtir" style={{ textAlign: "center" }}>
                            <input 
                              type="number" 
                              min="0" 
                              value={itemConteo.reab} 
                              onChange={(e) => handleQtyChange(prod.id, "reab", e.target.value)}
                              style={{ width: "60px", textAlign: "center", padding: "6px" }}
                            />
                          </td>
                          <td data-label="Queda" style={{ textAlign: "right", fontWeight: "bold", color: "var(--color-primary)" }}>
                            {queda} pzas
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* COLUMNA DERECHA: DETALLE Y CONFIRMACIÓN DE OPERACIÓN */}
        {selectedTiendaId && (
          <div className={`${mobileTab !== "cobro" ? "mobile-hide" : ""}`} style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
            
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <h3>Folio de Operación</h3>
              <div className="form-group">
                <label>Número de Ticket</label>
                <input type="text" value={folio} onChange={(e) => setFolio(e.target.value)} />
              </div>
            </div>

            <div className="card" style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <h3>Cálculos en Tiempo Real</h3>

              {tipoOperacion === "corte" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                    <span>Comisión Promedio Ganada:</span>
                    <strong>{totals.totalMontoVendido > 0 ? Math.round((totals.totalComision / totals.totalMontoVendido) * 100) : 0}%</strong>
                  </div>
                  
                  <div style={{ borderTop: "1px dashed var(--color-border)", margin: "10px 0" }}></div>

                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Piezas Vendidas:</span>
                    <strong>{totals.totalPcsVendidas} pzas</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Cobrado Bruto:</span>
                    <strong>${totals.totalMontoVendido.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--color-danger)" }}>
                    <span>Comisión Tienda ({comisionPct}%):</span>
                    <strong>-${totals.totalComision.toFixed(2)}</strong>
                  </div>
                  
                  <div style={{ borderTop: "2px solid var(--color-border)", margin: "10px 0" }}></div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.2rem", fontWeight: "bold" }}>
                    <span>Total a Cobrar:</span>
                    <span style={{ color: "var(--color-success)" }}>${totals.totalCobrar.toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Piezas Entregadas:</span>
                    <strong>{totals.totalPcsEntregadas} pzas</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.1rem" }}>
                    <span>Valor Consignación:</span>
                    <strong style={{ color: "var(--color-accent-blue)" }}>${totals.totalValorInventarioDejado.toFixed(2)}</strong>
                  </div>
                  
                  <div style={{ borderTop: "2px solid var(--color-border)", margin: "10px 0" }}></div>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.1rem", fontWeight: "bold" }}>
                    <span>Total Efectivo:</span>
                    <span>$0.00</span>
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontStyle: "italic", textAlign: "justify" }}>
                    * El cliente no liquida efectivo en esta visita. Firma de recibido a consignación.
                  </p>
                </div>
              )}
            </div>

            <div className="card" style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <h3>Notas de Ruta</h3>
              <div className="form-group">
                <textarea 
                  rows="3" 
                  value={comentarios} 
                  onChange={(e) => setComentarios(e.target.value)} 
                  placeholder="Detalles sobre el exhibidor, problemas, etc."
                />
              </div>

              <button 
                className="btn btn-primary" 
                onClick={handleRegistrar} 
                disabled={(tipoOperacion === "surtido" ? totals.totalPcsEntregadas : totals.totalPcsVendidas) === 0}
                style={{ width: "100%", fontSize: "1rem", padding: "14px" }}
              >
                💾 Guardar e Imprimir Ticket
              </button>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
