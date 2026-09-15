// Datos inventados para probar la página sin tocar el Supabase real
// (los mismos productos que el modo demo del programa, ya pasados a pesos como lo hace la vista catalogo).

// [nombre, categoría, efectivo, transferencia, en dólares, stock]
const PRODUCTOS = [
  ['Zapatilla 4 tomas 1,5m', 'Eléctrica', 12400, 13640, false, 28],
  ['Zapatilla 6 tomas con interruptor', 'Eléctrica', 18900, 20790, false, 14],
  ['Alargue 3m reforzado', 'Eléctrica', 9800, 10780, false, 15],
  ['Alargue 5m', 'Eléctrica', 13500, 14850, false, 11],
  ['Ficha macho 10A', 'Eléctrica', 1750, 1925, false, 120],
  ['Ficha hembra 10A', 'Eléctrica', 1850, 2035, false, 96],
  ['Adaptador universal de viaje', 'Eléctrica', 4200, 4620, false, 37],
  ['Cinta aisladora negra', 'Eléctrica', 1200, 1320, false, 64],
  ['Tomacorriente doble', 'Eléctrica', 3900, 4290, false, 22],
  ['Interruptor termomagnético 20A', 'Eléctrica', 16.5, 18.2, true, 4],
  ['Lámpara LED 9W cálida', 'Iluminación', 3.2, 3.5, true, 17],
  ['Lámpara LED 12W fría', 'Iluminación', 4, 4.4, true, 42],
  ['Lámpara LED 18W', 'Iluminación', 5.5, 6.05, true, 25],
  ['Lamparita filamento vintage', 'Iluminación', 8300, 9130, false, 0],
  ['Tira LED 5m RGB con control', 'Iluminación', 14, 15.4, true, 12],
  ['Reflector LED 50W exterior', 'Iluminación', 22, 24.2, true, 8],
  ['Portalámparas E27', 'Iluminación', 1100, 1210, false, 58],
  ['Ventilador de pie 20"', 'Climatización', 50, 55, true, 9],
  ['Ventilador de techo 4 palas', 'Climatización', 95, 104.5, true, 5],
  ['Caloventor 2000W', 'Climatización', 32, 35.2, true, 6],
  ['Auricular inalámbrico BT', 'Electrónica', 15, 16.5, true, 3],
  ['Parlante Bluetooth portátil', 'Electrónica', 28, 30.8, true, 10],
  ['Cargador USB-C 20W', 'Electrónica', 9, 9.9, true, 31],
  ['Cable USB-C 1m', 'Electrónica', 3500, 3850, false, 45],
  ['Cable HDMI 2m', 'Electrónica', 5200, 5720, false, 19],
  ['Pilas AA x4', 'Electrónica', 3100, 3410, false, 70],
  ['Pilas AAA x4', 'Electrónica', 2900, 3190, false, 0],
  ['Linterna LED recargable', 'Hogar', 11800, 12980, false, 13],
  ['Pava eléctrica 1,7L', 'Hogar', 27, 29.7, true, 7],
  ['Plancha a vapor', 'Hogar', 35, 38.5, true, 4],
  ['Secador de pelo 2200W', 'Hogar', 30, 33, true, 6],
  ['Mouse inalámbrico', 'Computación', 7200, 7920, false, 21],
  ['Teclado USB', 'Computación', 9900, 10890, false, 12],
  ['Estabilizador de tensión 1000VA', 'Computación', 60, 66, true, 5],
];

const DOLAR = 1480;
const REDONDEO = 10;
const ACTUALIZADO = '2026-09-12T15:00:00.000Z';
const CATEGORIAS = [...new Set(PRODUCTOS.map((p) => p[1]))];

const aPesos = (valor, enDolares) => (enDolares ? Math.round((valor * DOLAR) / REDONDEO) * REDONDEO : Math.round(valor));
export const uuidPrueba = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const NEGOCIO_PRUEBA = {
  nombre: 'Allegra Importadora',
  telefono: '261 504-8381',
  direccion: 'San Martín 1234, Mendoza',
};

export function catalogoPrueba({ cantidad = 0 } = {}) {
  const filas = PRODUCTOS.map(([nombre, categoria, efectivo, transferencia, enDolares, stock], i) => ({
    id: uuidPrueba(i + 1),
    nombre,
    categoria,
    codigo: i % 11 === 7 ? null : String(7791234560000 + i * 37 + 11),
    foto: i % 6 === 5 ? null : `demo-${i + 1}.jpg`,
    precio_efectivo: aPesos(efectivo, enDolares),
    precio_transferencia: aPesos(transferencia, enDolares),
    disponible: stock > 0,
    updated_at: ACTUALIZADO,
  }));

  // Casos raros: HTML en el nombre, sin categoría, sin precio, foto que no existe, solo precio de transferencia.
  filas.push(
    {
      id: uuidPrueba(901),
      nombre: 'Kit de herramientas <b>premium</b> & "especial"',
      categoria: null,
      codigo: null,
      foto: 'demo-rota.jpg',
      precio_efectivo: 0,
      precio_transferencia: 0,
      disponible: false,
      updated_at: ACTUALIZADO,
    },
    {
      id: uuidPrueba(902),
      nombre: 'Enchufe inteligente WiFi 16A',
      categoria: 'Eléctrica',
      codigo: '7790000000902',
      foto: null,
      precio_efectivo: 0,
      precio_transferencia: 21990,
      disponible: true,
      updated_at: ACTUALIZADO,
    },
  );

  for (let n = filas.length; n < cantidad; n++) {
    filas.push({
      id: uuidPrueba(1000 + n),
      nombre: `Artículo de prueba ${String(n).padStart(4, '0')}`,
      categoria: CATEGORIAS[n % CATEGORIAS.length],
      codigo: String(7780000000000 + n),
      foto: n % 3 ? `demo-${(n % PRODUCTOS.length) + 1}.jpg` : null,
      precio_efectivo: 1000 + ((n * 7919) % 90000),
      precio_transferencia: 0,
      disponible: n % 9 !== 0,
      updated_at: ACTUALIZADO,
    });
  }
  return filas;
}

const FONDOS = ['#F6E3E1', '#E3EEF8', '#E6F2E8', '#FFF1DC', '#EFE6F6', '#EFEBE4'];
const FORMAS = [
  // lamparita
  '<circle cx="240" cy="205" r="82" fill="none" stroke="#8B857C" stroke-width="14"/><rect x="200" y="290" width="80" height="60" rx="10" fill="#8B857C"/>',
  // caja
  '<rect x="140" y="150" width="200" height="180" rx="16" fill="none" stroke="#8B857C" stroke-width="14"/><path d="M140 205h200M240 150v55" stroke="#8B857C" stroke-width="14"/>',
  // enchufe
  '<path d="M205 130v60M275 130v60" stroke="#8B857C" stroke-width="16" stroke-linecap="round"/><path d="M170 190h140v50a70 70 0 0 1-140 0z" fill="#8B857C"/><path d="M240 310v40" stroke="#8B857C" stroke-width="14" stroke-linecap="round"/>',
];

// Imagen SVG servida en lugar de una foto real (el navegador la muestra por el Content-Type).
export function fotoPrueba(nombre) {
  const n = Number((/\d+/.exec(nombre) || ['0'])[0]);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480"><rect width="480" height="480" fill="#fff"/><rect x="50" y="50" width="380" height="380" rx="40" fill="${FONDOS[n % FONDOS.length]}"/>${FORMAS[n % FORMAS.length]}</svg>`;
}
