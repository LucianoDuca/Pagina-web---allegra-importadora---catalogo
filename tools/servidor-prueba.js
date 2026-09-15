// Servidor de prueba: sirve la página y simula Supabase (vistas catalogo y negocio, y fotos) con datos inventados.
// Uso:  node tools/servidor-prueba.js [--puerto 5178] [--modo normal|vacio|error|lento|muchos|sinclave|caido]
// El modo se cambia en caliente abriendo http://localhost:5178/__modo?m=error
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { NEGOCIO_PRUEBA, catalogoPrueba, fotoPrueba } from './datos-prueba.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'sitio');
export const CLAVE_PRUEBA = 'clave-de-prueba';
export const MODOS = ['normal', 'vacio', 'error', 'lento', 'muchos', 'sinclave', 'caido'];

const COLUMNAS = ['id', 'nombre', 'categoria', 'codigo', 'foto', 'precio_efectivo', 'precio_transferencia', 'disponible', 'updated_at'];
const PREFIJO_FOTOS = '/storage/v1/object/public/productos/fotos/';
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function enviar(res, codigo, tipo, cuerpo, extra = {}) {
  res.writeHead(codigo, { 'Content-Type': tipo, ...extra });
  res.end(cuerpo);
}

const json = (res, codigo, datos, extra) => enviar(res, codigo, 'application/json; charset=utf-8', JSON.stringify(datos), extra);
const elegir = (fila, columnas) => (columnas.includes('*') ? { ...fila } : Object.fromEntries(columnas.map((c) => [c, fila[c]])));
const ordenar = (filas) => filas.sort((a, b) => (a.nombre < b.nombre ? -1 : a.nombre > b.nombre ? 1 : a.id < b.id ? -1 : 1));

export function crearServidor({ raiz = RAIZ, modo = 'normal', maxFilas = 500, retraso = 2500 } = {}) {
  const estado = { modo, pedidos: [] };
  const catalogos = {
    normal: ordenar(catalogoPrueba()),
    muchos: ordenar(catalogoPrueba({ cantidad: 2600 })),
  };

  const server = http.createServer((req, res) => {
    atender(req, res).catch((e) => {
      if (res.headersSent) res.destroy();
      else enviar(res, 500, 'text/plain; charset=utf-8', String(e));
    });
  });

  async function atender(req, res) {
    const u = new URL(req.url, 'http://local');

    if (u.pathname === '/__modo') {
      const pedido = u.searchParams.get('m');
      if (MODOS.includes(pedido)) estado.modo = pedido;
      return enviar(res, 200, 'text/plain; charset=utf-8', estado.modo, { 'Cache-Control': 'no-store' });
    }

    if (u.pathname === '/config.js') {
      const ajustes = {
        supabaseUrl: `http://${req.headers.host}`,
        supabaseKey: estado.modo === 'sinclave' ? 'PEGAR_ACA_LA_CLAVE_PUBLICA' : CLAVE_PRUEBA,
        whatsapp: '2615048381',
        telefono: '261 504-8381',
        nombre: 'Allegra Importadora',
      };
      return enviar(res, 200, TIPOS['.js'], `window.ALLEGRA = ${JSON.stringify(ajustes)};\n`, { 'Cache-Control': 'no-store' });
    }

    const esSupabase = u.pathname.startsWith('/rest/v1/') || u.pathname.startsWith('/storage/v1/');
    if (esSupabase) {
      estado.pedidos.push({ ruta: u.pathname, parametros: u.searchParams, headers: req.headers });
      if (estado.modo === 'caido') {
        req.socket.destroy();
        return undefined;
      }
      if (estado.modo === 'lento') await new Promise((listo) => setTimeout(listo, retraso));
    }

    if (u.pathname.startsWith('/rest/v1/')) return api(req, res, u);

    if (u.pathname.startsWith(PREFIJO_FOTOS)) {
      const nombre = decodeURIComponent(u.pathname.slice(PREFIJO_FOTOS.length));
      if (estado.modo === 'error' || !/^demo-\d+\.jpg$/.test(nombre)) return json(res, 404, { message: 'Object not found' });
      return enviar(res, 200, 'image/svg+xml', fotoPrueba(nombre), { 'Cache-Control': 'public, max-age=3600' });
    }

    return estatico(res, u);
  }

  function api(req, res, u) {
    if (estado.modo === 'error') return json(res, 503, { message: 'Service Unavailable' });
    if (req.headers.apikey !== CLAVE_PRUEBA) return json(res, 401, { message: 'Invalid API key' });
    // Igual que Supabase con las claves nuevas: un Authorization que no es JWT se rechaza.
    const autorizacion = req.headers.authorization;
    if (autorizacion && autorizacion.replace(/^Bearer /, '').split('.').length !== 3) {
      return json(res, 401, { message: 'Invalid JWT' });
    }

    const vista = u.pathname.slice('/rest/v1/'.length);
    const columnas = (u.searchParams.get('select') || '*').split(',');

    if (vista === 'negocio') {
      const fila = estado.modo === 'vacio' ? { nombre: null, telefono: null, direccion: null } : NEGOCIO_PRUEBA;
      const desconocida = columnas.find((c) => c !== '*' && !(c in fila));
      if (desconocida) return json(res, 400, { code: '42703', message: `column negocio.${desconocida} does not exist` });
      return json(res, 200, [elegir(fila, columnas)]);
    }

    if (vista === 'catalogo') {
      const desconocida = columnas.find((c) => c !== '*' && !COLUMNAS.includes(c));
      if (desconocida) return json(res, 400, { code: '42703', message: `column catalogo.${desconocida} does not exist` });
      const filas = estado.modo === 'vacio' ? [] : catalogos[estado.modo === 'muchos' ? 'muchos' : 'normal'];
      const desde = Math.max(0, Number.parseInt(u.searchParams.get('offset') || '0', 10) || 0);
      const pedido = Number.parseInt(u.searchParams.get('limit') || '', 10);
      const limite = Math.min(pedido > 0 ? pedido : maxFilas, maxFilas);
      const pagina = filas.slice(desde, desde + limite).map((f) => elegir(f, columnas));
      const total = /count=exact/.test(req.headers.prefer || '') ? filas.length : '*';
      const rango = pagina.length ? `${desde}-${desde + pagina.length - 1}/${total}` : `*/${total}`;
      return json(res, 200, pagina, { 'Content-Range': rango });
    }

    return json(res, 404, { code: '42P01', message: `relation "public.${vista}" does not exist` });
  }

  function estatico(res, u) {
    let ruta;
    try {
      ruta = decodeURIComponent(u.pathname);
    } catch {
      return enviar(res, 400, 'text/plain; charset=utf-8', 'Ruta inválida');
    }
    if (ruta.endsWith('/')) ruta += 'index.html';
    const archivo = path.resolve(raiz, `.${ruta}`);
    if (!archivo.startsWith(raiz + path.sep)) return enviar(res, 403, 'text/plain; charset=utf-8', 'Prohibido');
    fs.readFile(archivo, (error, datos) => {
      if (error) return enviar(res, 404, 'text/plain; charset=utf-8', 'No encontrado');
      const tipo = TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream';
      return enviar(res, 200, tipo, datos, { 'Cache-Control': 'no-cache' });
    });
    return undefined;
  }

  return {
    estado,
    escuchar: (puerto = 0) => new Promise((listo, fallo) => {
      server.once('error', fallo);
      server.listen(puerto, '127.0.0.1', () => listo(server.address().port));
    }),
    cerrar: () => new Promise((listo) => {
      server.closeAllConnections();
      server.close(() => listo());
    }),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const argumento = (nombre, defecto) => {
    const i = process.argv.indexOf(`--${nombre}`);
    return i > 0 ? process.argv[i + 1] : defecto;
  };
  const servidor = crearServidor({ modo: argumento('modo', 'normal') });
  const puerto = await servidor.escuchar(Number(argumento('puerto', 5178)));
  console.log(`Página de prueba: http://localhost:${puerto}  (modo "${servidor.estado.modo}"; cambiar con /__modo?m=error)`);
}
