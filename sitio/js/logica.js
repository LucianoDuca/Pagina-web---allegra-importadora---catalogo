// Lógica pura del catálogo (sin DOM): la usan la página y las pruebas.

export const NOMBRE_FOTO = /^[a-z0-9-]+\.jpg$/;
export const POR_PAGINA = 48;
export const ORDENES = ['nombre', 'menor', 'mayor'];

const alfabetico = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
const miles = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
// Espacio que no se corta: el "$" nunca queda en un renglón y el número en otro.
export const ESPACIO_FIJO = String.fromCharCode(160);

export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function precio(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? `$${ESPACIO_FIJO}${miles.format(Math.round(n))}` : null;
}

function pesos(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

const limpiar = (texto) => String(texto ?? '').replace(/\s+/g, ' ').trim();

export function prepararProducto(fila) {
  if (!fila || typeof fila !== 'object' || fila.id == null) return null;
  const nombre = limpiar(fila.nombre);
  if (!nombre) return null;
  const categoria = limpiar(fila.categoria) || 'Otros';
  const efectivo = pesos(fila.precio_efectivo);
  return {
    id: String(fila.id),
    nombre,
    categoria,
    foto: typeof fila.foto === 'string' && NOMBRE_FOTO.test(fila.foto) ? fila.foto : null,
    efectivo,
    transferencia: pesos(fila.precio_transferencia) || efectivo,
    disponible: fila.disponible === true || fila.disponible === 'true',
    busqueda: normalizar(`${nombre} ${categoria} ${limpiar(fila.codigo)}`),
  };
}

// Descarta filas inválidas y repetidas (una paginación con cambios en el medio puede repetir alguna).
export function prepararCatalogo(filas) {
  const vistos = new Set();
  const productos = [];
  for (const fila of Array.isArray(filas) ? filas : []) {
    const p = prepararProducto(fila);
    if (!p || vistos.has(p.id)) continue;
    vistos.add(p.id);
    productos.push(p);
  }
  return productos;
}

export function preciosVisibles(p) {
  const efectivo = precio(p.efectivo);
  const transferencia = precio(p.transferencia);
  if (!efectivo && !transferencia) return [];
  if (!efectivo) return [{ etiqueta: 'Transferencia', valor: transferencia }];
  if (!transferencia || p.transferencia === p.efectivo) return [{ etiqueta: 'Precio', valor: efectivo }];
  return [
    { etiqueta: 'Efectivo', valor: efectivo },
    { etiqueta: 'Transferencia', valor: transferencia },
  ];
}

export function categorias(productos) {
  const cuenta = new Map();
  for (const p of productos) cuenta.set(p.categoria, (cuenta.get(p.categoria) || 0) + 1);
  return [...cuenta]
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => (a.nombre === 'Otros') - (b.nombre === 'Otros') || alfabetico.compare(a.nombre, b.nombre));
}

// Los que no tienen stock van siempre al final; sin precio, al final de su grupo al ordenar por precio.
export function filtrar(productos, { texto = '', categoria = '', soloDisponibles = false, orden = 'nombre' } = {}) {
  const palabras = normalizar(texto).split(' ').filter(Boolean);
  const lista = productos.filter((p) =>
    (!categoria || p.categoria === categoria)
    && (!soloDisponibles || p.disponible)
    && palabras.every((palabra) => p.busqueda.includes(palabra)));
  const valor = (p) => p.efectivo || p.transferencia;
  return lista.sort((a, b) => {
    if (a.disponible !== b.disponible) return a.disponible ? -1 : 1;
    if (orden === 'menor' || orden === 'mayor') {
      const va = valor(a);
      const vb = valor(b);
      if (!va !== !vb) return va ? -1 : 1;
      if (va !== vb) return orden === 'menor' ? va - vb : vb - va;
    }
    return alfabetico.compare(a.nombre, b.nombre) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
}

// Estado de la búsqueda en la dirección, para poder compartir un enlace.
export function leerEstado(busqueda) {
  const q = new URLSearchParams(busqueda);
  const orden = q.get('orden');
  return {
    texto: (q.get('q') || '').slice(0, 100),
    categoria: (q.get('cat') || '').slice(0, 100),
    soloDisponibles: q.get('stock') === '1',
    orden: ORDENES.includes(orden) ? orden : 'nombre',
    producto: (q.get('p') || '').slice(0, 64),
  };
}

export function escribirEstado(estado) {
  const q = new URLSearchParams();
  const texto = String(estado.texto ?? '').trim();
  if (texto) q.set('q', texto);
  if (estado.categoria) q.set('cat', estado.categoria);
  if (estado.soloDisponibles) q.set('stock', '1');
  if (estado.orden && estado.orden !== 'nombre') q.set('orden', estado.orden);
  if (estado.producto) q.set('p', estado.producto);
  const texto2 = q.toString();
  return texto2 ? `?${texto2}` : '';
}

// Convierte un teléfono argentino escrito de cualquier forma al formato de WhatsApp (549 + área + número).
export function numeroWhatsapp(telefono) {
  let d = String(telefono ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('54')) {
    d = d.slice(2);
    if (d.startsWith('9')) d = d.slice(1);
  }
  d = d.replace(/^0/, '');
  if (d.length === 12) {
    for (const largoArea of [2, 3, 4]) {
      if (d.slice(largoArea, largoArea + 2) === '15') {
        d = d.slice(0, largoArea) + d.slice(largoArea + 2);
        break;
      }
    }
  }
  return /^\d{10}$/.test(d) ? `549${d}` : null;
}

export function linkWhatsapp(numero, mensaje) {
  if (!numero) return null;
  return `https://wa.me/${numero}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''}`;
}

export function mensajeConsulta(p) {
  const [primero] = preciosVisibles(p);
  return `¡Hola! Quería consultar por "${p.nombre}"${primero ? ` (${primero.valor})` : ''}, que vi en la página.`;
}

export function urlFoto(base, foto) {
  if (typeof foto !== 'string' || !NOMBRE_FOTO.test(foto)) return null;
  return `${String(base).replace(/\/+$/, '')}/storage/v1/object/public/productos/fotos/${foto}`;
}

// 'publica' | 'secreta' | 'desconocida'. Una clave secreta en la página daría acceso total a la base.
export function tipoDeClave(clave) {
  const texto = String(clave ?? '').trim();
  if (texto.startsWith('sb_secret_')) return 'secreta';
  if (texto.startsWith('sb_publishable_')) return 'publica';
  const partes = texto.split('.');
  if (partes.length === 3) {
    try {
      const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
      const datos = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
      if (datos.role === 'service_role') return 'secreta';
      if (datos.role === 'anon') return 'publica';
    } catch {
      // no es un JWT válido
    }
  }
  return 'desconocida';
}

export function esJwt(clave) {
  return String(clave ?? '').split('.').length === 3;
}

export function revisarConfig(ajustes) {
  const url = String(ajustes?.supabaseUrl ?? '').trim().replace(/\/+$/, '');
  const clave = String(ajustes?.supabaseKey ?? '').trim();
  if (clave && tipoDeClave(clave) === 'secreta') return { ok: false, problema: 'secreta' };
  if (!/^https?:\/\/[^\s/?#]+$/i.test(url) || !clave || /^PEGAR/i.test(clave)) return { ok: false, problema: 'falta' };
  return { ok: true, url, clave };
}
