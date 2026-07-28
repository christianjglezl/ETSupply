import React, { useState, useEffect } from "react";
import { collection, doc, setDoc, onSnapshot, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import Swal from "sweetalert2";

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [search, setSearch] = useState("");
  const [editingProd, setEditingProd] = useState(null);
  
  // Pestaña activa en vista celular/tablet ("lista" o "registro")
  const [mobileTab, setMobileTab] = useState("lista");
  
  // Estado para la importación masiva (Combinar por defecto)
  const [importMerge, setImportMerge] = useState(true);

  // Estado del formulario
  const [form, setForm] = useState({
    id: "",
    nombre: "",
    categoria: "",
    costo: 0,
    precioConsignacion: 0, // Lo que yo le cobro al tendero
    precioPublico: 0,      // Lo que el tendero le cobra al público (Recomendado)
    comisionDefecto: 20,   // Comisión informativa en %
    stockAlmacen: 0,
    activo: true
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "productos"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProductos(list);
    });
    return unsub;
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : 
              type === "number" ? parseFloat(value) || 0 : value
    }));
  };

  const handleEdit = (prod) => {
    setEditingProd(prod.id);
    setForm({
      id: prod.id,
      nombre: prod.nombre,
      categoria: prod.categoria,
      costo: prod.costo || 0,
      precioConsignacion: prod.precioConsignacion || 0,
      precioPublico: prod.precioPublico || 0,
      comisionDefecto: Math.round((prod.comisionDefecto || 0.2) * 100),
      stockAlmacen: prod.stockAlmacen || 0,
      activo: prod.activo !== undefined ? prod.activo : true
    });
    setMobileTab("registro"); // Redirigir a pestaña de edición en celulares
  };

  const resetForm = () => {
    setEditingProd(null);
    setForm({
      id: "",
      nombre: "",
      categoria: "",
      costo: 0,
      precioConsignacion: 0,
      precioPublico: 0,
      comisionDefecto: 20,
      stockAlmacen: 0,
      activo: true
    });
    setMobileTab("lista"); // Cambiar de vuelta al listado al cancelar o limpiar
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre || !form.categoria) {
      Swal.fire({
        title: "Atención",
        text: "Por favor ingresa el Nombre y selecciona una Categoría para el producto.",
        icon: "warning",
        confirmButtonColor: "#3A86FF"
      });
      return;
    }

    // Auto-generar SKU si está vacío
    let finalSku = form.id ? form.id.trim() : "";
    if (!finalSku) {
      do {
        // Generar un número aleatorio único de 8 dígitos
        finalSku = Math.floor(10000000 + Math.random() * 90000000).toString();
      } while (productos.some(p => p.id === finalSku));
    }

    const payload = {
      nombre: form.nombre,
      categoria: form.categoria || "Producto general",
      costo: form.costo,
      precioConsignacion: form.precioConsignacion,
      precioPublico: form.precioPublico,
      comisionDefecto: form.comisionDefecto / 100, // Almacenar en firestore como decimal
      stockAlmacen: form.stockAlmacen,
      activo: form.activo,
      codigo: finalSku
    };

    try {
      // Usamos el SKU como el ID de documento en Firestore
      await setDoc(doc(db, "productos", finalSku), payload);
      Swal.fire({
        title: "¡Éxito!",
        text: editingProd ? "Producto actualizado correctamente." : `Producto agregado con éxito (SKU: ${finalSku}).`,
        icon: "success",
        confirmButtonColor: "#3A86FF"
      });
      resetForm();
    } catch (err) {
      console.error(err);
      Swal.fire({
        title: "Error",
        text: "Error al guardar el producto en la base de datos.",
        icon: "error",
        confirmButtonColor: "#3A86FF"
      });
    }
  };

  // PARSER DE CSV AUTOMÁTICO (DETECTA COMA O PUNTO Y COMA)
  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length < 2) return [];

    const separator = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(separator).map(h => h.trim().toLowerCase());

    const results = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(separator).map(v => v.trim());
      if (values.length < headers.length) continue;

      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });
      results.push(row);
    }
    return results;
  };

  // DESCARGAR PLANTILLA CSV (INCLUYE PRECIO CONSIGNACIÓN)
  const descargarPlantilla = () => {
    const csvContent = "sku,nombre,categoria,costo,precio_consignacion,precio_publico,comision_tienda,stock_central\n" +
                       "75001,Cable reforzado Tipo C,Cables,15.50,30.00,45.00,20,100\n" +
                       ",Cargador carga rapida 20W,Cargadores,45.00,90.00,120.00,20,50\n" +
                       ",Audifonos bluetooth in-ear,Audífonos,65.00,135.00,180.00,20,20\n" +
                       "75004,Bocina portatil impermeable,Bocinas,120.00,280.00,350.00,15,10\n";
    
    // Usar BOM para que Excel en Windows reconozca caracteres latinos
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "plantilla_productos_easytech.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PROCESAR CARGA DE ARCHIVO
  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const parsedRows = parseCSV(text);

      if (parsedRows.length === 0) {
        Swal.fire({
          title: "Error de Archivo",
          text: "El archivo está vacío o no tiene los encabezados requeridos (sku, nombre, categoria, costo, precio_consignacion, precio_publico, comision_tienda, stock_central).",
          icon: "error",
          confirmButtonColor: "#3A86FF"
        });
        e.target.value = "";
        return;
      }

      // Validar filas básicas (sólo requerimos Nombre)
      const validRows = parsedRows.filter(r => r.nombre);
      if (validRows.length === 0) {
        Swal.fire({
          title: "Error de Datos",
          text: "No se encontraron filas con un Nombre válido en el archivo.",
          icon: "error",
          confirmButtonColor: "#3A86FF"
        });
        e.target.value = "";
        return;
      }

      const proceedWithImport = async () => {
        Swal.fire({
          title: "Procesando importación...",
          text: "Espere un momento mientras se actualiza Firestore.",
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        try {
          if (!importMerge) {
            // Eliminar todos los productos existentes
            const snapshot = await getDocs(collection(db, "productos"));
            const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);
          }

          // Mantener registro de SKUs utilizados para evitar colisiones durante la carga
          const usedSkus = new Set(productos.map(p => p.id));

          // Subir nuevos productos
          const uploadPromises = validRows.map(row => {
            let rowSku = row.sku ? row.sku.trim() : "";
            if (!rowSku) {
              do {
                // Auto-generar SKU de 8 dígitos único
                rowSku = Math.floor(10000000 + Math.random() * 90000000).toString();
              } while (usedSkus.has(rowSku));
            }
            usedSkus.add(rowSku);

            const comision = parseFloat(row.comision_tienda) || 20;
            const pPublico = parseFloat(row.precio_publico) || 0;
            const pConsignacion = parseFloat(row.precio_consignacion) || (pPublico * (1 - (comision / 100)));

            const payload = {
              nombre: row.nombre,
              categoria: row.categoria || "Producto general",
              costo: parseFloat(row.costo) || 0,
              precioConsignacion: pConsignacion,
              precioPublico: pPublico,
              comisionDefecto: comision / 100,
              stockAlmacen: parseInt(row.stock_central) || 0,
              activo: true,
              codigo: rowSku
            };
            return setDoc(doc(db, "productos", rowSku), payload);
          });

          await Promise.all(uploadPromises);

          Swal.fire({
            title: "¡Importación Exitosa!",
            text: `Se cargaron ${validRows.length} productos correctamente en la base de datos.`,
            icon: "success",
            confirmButtonColor: "#3A86FF"
          });
        } catch (err) {
          console.error(err);
          Swal.fire({
            title: "Error de Conexión",
            text: "Hubo un error al escribir en la base de datos.",
            icon: "error",
            confirmButtonColor: "#3A86FF"
          });
        } finally {
          e.target.value = "";
        }
      };

      if (!importMerge) {
        // Confirmar sobreescritura total
        Swal.fire({
          title: "¿Estás seguro de sobreescribir todo?",
          text: "Esta acción ELIMINARÁ permanentemente todos los productos guardados en Firestore y los reemplazará con los de este archivo.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#d33",
          cancelButtonColor: "#3A86FF",
          confirmButtonText: "Sí, eliminar y sobreescribir",
          cancelButtonText: "Cancelar"
        }).then((result) => {
          if (result.isConfirmed) {
            proceedWithImport();
          } else {
            e.target.value = "";
          }
        });
      } else {
        proceedWithImport();
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const filteredProducts = productos.filter(p => 
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
      
      <div className="main-header">
        <div className="header-title">
          <h1>Catálogo de Productos</h1>
          <p>Control de inventario central y precios recomendados de Easy Tech</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <a href="/templates/etiquetas.html" target="_blank" className="btn btn-secondary">
            🏷️ Impresor de Etiquetas
          </a>
        </div>
      </div>

      {/* Segmentador de pestañas para celulares */}
      <div className="mobile-tabs-container">
        <button 
          className={`mobile-tab-btn ${mobileTab === "lista" ? "active" : ""}`}
          onClick={() => setMobileTab("lista")}
        >
          📋 Ver Catálogo ({filteredProducts.length})
        </button>
        <button 
          className={`mobile-tab-btn ${mobileTab === "registro" ? "active" : ""}`}
          onClick={() => setMobileTab("registro")}
        >
          ➕ {editingProd ? "Editar Producto" : "Nuevo Producto"}
        </button>
      </div>

      <div className="layout-grid">
        
        {/* TABLA DE PRODUCTOS */}
        <div className={`card ${mobileTab !== "lista" ? "mobile-hide" : ""}`} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "15px" }}>
            <h3>Inventario Central</h3>
            <input 
              type="text" 
              placeholder="Buscar..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "180px", padding: "8px 12px", fontSize: "0.85rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)" }}
            />
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Costo</th>
                  <th>P. Consignación</th>
                  <th>P. Público</th>
                  <th>Comisión</th>
                  <th>Stock Central</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(p => {
                  const pConsig = p.precioConsignacion !== undefined ? p.precioConsignacion : (p.precioPublico * 0.8);
                  return (
                    <tr key={p.id} style={{ opacity: p.activo ? 1 : 0.5 }}>
                      <td data-label="Código"><code style={{ fontSize: "0.8rem", color: "var(--color-primary)" }}>{p.id}</code></td>
                      <td data-label="Descripción">
                        <div><strong>{p.nombre}</strong></div>
                        <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{p.categoria}</div>
                      </td>
                      <td data-label="Costo">${p.costo.toFixed(2)}</td>
                      <td data-label="P. Consignación" style={{ fontWeight: "bold", color: "var(--color-primary)" }}>${pConsig.toFixed(2)}</td>
                      <td data-label="P. Público" style={{ fontWeight: "bold" }}>${p.precioPublico.toFixed(2)}</td>
                      <td data-label="Comisión">{Math.round((p.comisionDefecto || 0.20) * 100)}%</td>
                      <td data-label="Stock Central" style={{ fontWeight: "bold", color: p.stockAlmacen < 10 ? "var(--color-danger)" : "inherit" }}>
                        {p.stockAlmacen} pzas
                      </td>
                      <td data-label="Acción">
                        <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "0.8rem" }} onClick={() => handleEdit(p)}>
                          ✏️ Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "20px" }}>
                      No se encontraron productos en el inventario.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* COLUMNA DERECHA: FORMULARIO E IMPORTACIÓN */}
        <div className={`${mobileTab !== "registro" ? "mobile-hide" : ""}`} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* FORMULARIO DE ALTA / EDICIÓN */}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "15px", height: "fit-content" }}>
            <h3>{editingProd ? "Editar Producto" : "Nuevo Producto"}</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
              {editingProd ? "Modifica los campos del accesorio seleccionado." : "Registra un nuevo accesorio para el inventario de la ruta."}
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div className="form-group">
                <label>Código de Barras / SKU (Opcional)</label>
                <input 
                  type="text" 
                  name="id" 
                  value={form.id} 
                  onChange={handleChange} 
                  disabled={!!editingProd} 
                  placeholder="Dejar vacío para auto-generar SKU"
                />
              </div>

              <div className="form-group">
                <label>Nombre del Producto *</label>
                <input 
                  type="text" 
                  name="nombre" 
                  value={form.nombre} 
                  onChange={handleChange} 
                  placeholder="Ej. Cable Tipo C Reforzado 1m"
                  required
                />
              </div>

              <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="form-group">
                  <label>Categoría *</label>
                  <select 
                    name="categoria" 
                    value={form.categoria} 
                    onChange={handleChange}
                    required
                  >
                    <option value="">-- Seleccionar --</option>
                    <option value="Cables">Cables</option>
                    <option value="Cargadores">Cargadores</option>
                    <option value="Audífonos">Audífonos</option>
                    <option value="Bocinas">Bocinas</option>
                    <option value="Ventiladores">Ventiladores</option>
                    <option value="Adaptadores">Adaptadores</option>
                    <option value="Producto general">Producto general</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Stock Almacén Central</label>
                  <input 
                    type="number" 
                    name="stockAlmacen" 
                    value={form.stockAlmacen} 
                    onChange={handleChange} 
                    min="0"
                  />
                </div>
              </div>

              {/* REJILLA DE VALORES FINANCIEROS (AUTO-AJUSTABLE A MÓVIL) */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: "10px" }}>
                <div className="form-group">
                  <label>Costo ($)</label>
                  <input 
                    type="number" 
                    name="costo" 
                    value={form.costo} 
                    onChange={handleChange} 
                    step="0.01" 
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label>P. Consig. ($) *</label>
                  <input 
                    type="number" 
                    name="precioConsignacion" 
                    value={form.precioConsignacion} 
                    onChange={handleChange} 
                    step="0.01" 
                    min="0"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>P. Público ($)</label>
                  <input 
                    type="number" 
                    name="precioPublico" 
                    value={form.precioPublico} 
                    onChange={handleChange} 
                    step="0.01" 
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label>Comisión (%)</label>
                  <input 
                    type="number" 
                    name="comisionDefecto" 
                    value={form.comisionDefecto} 
                    onChange={handleChange} 
                    min="0" 
                    max="100"
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "5px" }}>
                <input 
                  type="checkbox" 
                  id="form-activo" 
                  name="activo" 
                  checked={form.activo} 
                  onChange={handleChange}
                />
                <label htmlFor="form-activo" style={{ fontSize: "0.85rem", fontWeight: "bold", cursor: "pointer" }}>Producto activo para consignar</label>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {editingProd ? "Actualizar" : "Agregar"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  {editingProd ? "Cancelar" : "Limpiar"}
                </button>
              </div>
            </form>
          </div>

          {/* IMPORTACIÓN MASIVA (Solo Visible en Desktop / Laptop) */}
          <div className="card desktop-only" style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <h3>📥 Carga Masiva (Excel / CSV)</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", lineHeight: "1.4" }}>
              Carga tu catálogo completo de forma veloz. Haz clic para descargar la estructura estándar, llénala en Excel y guárdala como <strong>CSV</strong>.
            </p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <button className="btn btn-secondary" onClick={descargarPlantilla} style={{ fontSize: "0.8rem", width: "100%" }}>
                📄 Descargar Plantilla (.CSV)
              </button>
              
              <div style={{ borderTop: "1px dashed var(--color-border)", margin: "5px 0" }}></div>
              
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input 
                  type="checkbox" 
                  id="import-merge" 
                  checked={importMerge} 
                  onChange={(e) => setImportMerge(e.target.checked)}
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
                <label htmlFor="import-merge" style={{ fontSize: "0.8rem", fontWeight: "700", cursor: "pointer", color: "var(--color-primary)" }}>
                  Agregar como nuevos registros (Combinar)
                </label>
              </div>

              <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                {importMerge ? 
                  "✓ Combina: Actualiza registros existentes y añade los nuevos." : 
                  "⚠ Sobreescribe: Borra TODO el catálogo actual e inserta los del archivo."}
              </p>

              <input 
                type="file" 
                accept=".csv" 
                onChange={handleImportCSV} 
                style={{ 
                  fontSize: "0.8rem", 
                  width: "100%", 
                  padding: "8px", 
                  border: "1px dashed var(--color-border)", 
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  backgroundColor: "var(--color-bg)"
                }} 
              />
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
