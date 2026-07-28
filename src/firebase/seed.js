import { collection, getDocs, writeBatch, doc } from "firebase/firestore";
import { db } from "../firebase";

const mockProductos = [
  { id: "75030101", nombre: "Cable USB Tipo C Reforzado 1m", categoria: "Cables", costo: 25, precioConsignacion: 64, precioPublico: 80, comisionDefecto: 0.20, stockAlmacen: 500, activo: true },
  { id: "75030102", nombre: "Cable USB a Lightning 1m", categoria: "Cables", costo: 30, precioConsignacion: 72, precioPublico: 90, comisionDefecto: 0.20, stockAlmacen: 450, activo: true },
  { id: "75030103", nombre: "Cargador Carga Rápida 20W USB-C", categoria: "Cargadores", costo: 50, precioConsignacion: 120, precioPublico: 150, comisionDefecto: 0.20, stockAlmacen: 300, activo: true },
  { id: "75030104", nombre: "Adaptador Tipo C a Jack 3.5mm", categoria: "Adaptadores", costo: 15, precioConsignacion: 56, precioPublico: 70, comisionDefecto: 0.20, stockAlmacen: 200, activo: true },
  { id: "75030105", nombre: "Soporte Magnético Rejilla Auto", categoria: "Soportes", costo: 40, precioConsignacion: 96, precioPublico: 120, comisionDefecto: 0.20, stockAlmacen: 150, activo: true },
  { id: "75030106", nombre: "Audífonos de Cable con Manos Libres", categoria: "Audio", costo: 28, precioConsignacion: 79, precioPublico: 99, comisionDefecto: 0.20, stockAlmacen: 250, activo: true }
];

const mockTiendas = [
  {
    nombre: "Abarrotes y Novedades Candy",
    encargado: "Sra. Carmen Gómez",
    direccion: "Av. Principal #123, Col. Centro",
    telefono: "+52 444 123 4567",
    estado: "activo",
    fechaCreacion: new Date(),
    ultimoCorte: new Date(),
    ubicacionGps: { latitude: 22.1565, longitude: -100.9855 },
    inventarioActual: {
      "75030101": 15,
      "75030102": 12,
      "75030103": 8,
      "75030104": 6,
      "75030105": 5,
      "75030106": 10
    }
  },
  {
    nombre: "Papelería La Escolar",
    encargado: "Juan Pérez",
    direccion: "Calle Juárez #456, Col. Tepeyac",
    telefono: "+52 444 987 6543",
    estado: "activo",
    fechaCreacion: new Date(),
    ultimoCorte: new Date(),
    ubicacionGps: { latitude: 22.1485, longitude: -100.9755 },
    inventarioActual: {
      "75030101": 10,
      "75030102": 10,
      "75030103": 5,
      "75030104": 5,
      "75030105": 3,
      "75030106": 5
    }
  },
  {
    nombre: "Farmacia El Camino",
    encargado: "Dr. Raúl Martínez",
    direccion: "Blvd. Río Verde #789, Col. Prados",
    telefono: "+52 444 555 1212",
    estado: "en_mora",
    fechaCreacion: new Date(),
    ultimoCorte: new Date(),
    ubicacionGps: { latitude: 22.1625, longitude: -100.9925 },
    inventarioActual: {
      "75030101": 8,
      "75030102": 5,
      "75030103": 4,
      "75030104": 3,
      "75030105": 0,
      "75030106": 4
    }
  }
];

export const seedDatabase = async () => {
  try {
    const productsSnap = await getDocs(collection(db, "productos"));
    if (!productsSnap.empty) {
      console.log("La base de datos ya contiene productos. Saltando inicialización.");
      return { success: false, message: "La base de datos ya está inicializada." };
    }

    const batch = writeBatch(db);

    // Cargar Catálogo de Productos
    mockProductos.forEach((prod) => {
      const prodRef = doc(db, "productos", prod.id);
      batch.set(prodRef, prod);
    });

    // Cargar Tiendas Iniciales
    mockTiendas.forEach((tienda, idx) => {
      const tiendaRef = doc(db, "tiendas", `tienda_seed_${idx + 1}`);
      batch.set(tiendaRef, tienda);
    });

    await batch.commit();
    console.log("Base de datos inicializada correctamente.");
    return { success: true, message: "Se inicializaron 6 productos y 3 tiendas de demostración." };
  } catch (error) {
    console.error("Error al sembrar la base de datos:", error);
    throw error;
  }
};
