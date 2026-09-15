// Lectura de las vistas públicas de Supabase (catalogo y negocio). Solo lectura, sin sesión.
import { esJwt } from './logica.js';

export const CAMPOS = 'id,nombre,categoria,codigo,foto,precio_efectivo,precio_transferencia,disponible';
export const CAMPOS_NEGOCIO = 'nombre,telefono,direccion';

export class ErrorCatalogo extends Error {
  constructor(tipo, mensaje) {
    super(mensaje);
    this.name = 'ErrorCatalogo';
    this.tipo = tipo; // 'sin_conexion' | 'servidor' | 'configuracion'
  }
}

export function crearDatos({
  url,
  clave,
  fetch: pedirHttp = (...args) => globalThis.fetch(...args),
  tamPagina = 1000,
  tiempoLimite = 15000,
}) {
  const base = String(url).replace(/\/+$/, '');
  const encabezados = { apikey: clave, Accept: 'application/json' };
  // Las claves nuevas (sb_publishable_…) no son JWT y no deben ir en Authorization.
  if (esJwt(clave)) encabezados.Authorization = `Bearer ${clave}`;

  async function pedir(ruta, extra = {}) {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), tiempoLimite);
    try {
      const respuesta = await pedirHttp(base + ruta, { headers: { ...encabezados, ...extra }, signal: control.signal });
      if (!respuesta.ok) {
        const tipo = respuesta.status === 401 || respuesta.status === 403 ? 'configuracion' : 'servidor';
        throw new ErrorCatalogo(tipo, `El servidor respondió ${respuesta.status}`);
      }
      let cuerpo;
      try {
        cuerpo = await respuesta.json();
      } catch (e) {
        if (control.signal.aborted) throw e;
        throw new ErrorCatalogo('servidor', 'Respuesta inválida del servidor');
      }
      return { cuerpo, rango: respuesta.headers.get('content-range') };
    } catch (e) {
      if (e instanceof ErrorCatalogo) throw e;
      throw new ErrorCatalogo('sin_conexion', control.signal.aborted ? 'El servidor tardó demasiado' : 'Sin conexión');
    } finally {
      clearTimeout(reloj);
    }
  }

  // Pide el total en la primera página: así no se corta antes si Supabase limita las filas por pedido.
  async function catalogo() {
    const filas = [];
    let total = null;
    for (let vuelta = 0; vuelta < 1000; vuelta++) {
      const { cuerpo, rango } = await pedir(
        `/rest/v1/catalogo?select=${CAMPOS}&order=nombre.asc,id.asc&offset=${filas.length}&limit=${tamPagina}`,
        vuelta === 0 ? { Prefer: 'count=exact' } : {},
      );
      if (!Array.isArray(cuerpo)) throw new ErrorCatalogo('servidor', 'Respuesta inesperada del catálogo');
      if (vuelta === 0) {
        const coincide = /\/(\d+)\s*$/.exec(rango || '');
        total = coincide ? Number(coincide[1]) : null;
      }
      filas.push(...cuerpo);
      if (cuerpo.length === 0) break;
      if (total !== null ? filas.length >= total : cuerpo.length < tamPagina) break;
    }
    return filas;
  }

  async function negocio() {
    const { cuerpo } = await pedir(`/rest/v1/negocio?select=${CAMPOS_NEGOCIO}`);
    const fila = Array.isArray(cuerpo) ? cuerpo[0] : null;
    return fila && typeof fila === 'object' ? fila : {};
  }

  return { catalogo, negocio };
}
