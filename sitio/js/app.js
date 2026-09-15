// Catálogo público de Allegra Importadora: muestra productos y precios que el programa sube a Supabase.
import { CAMPOS_NEGOCIO, ErrorCatalogo, crearDatos } from './datos.js';
import {
  POR_PAGINA, categorias, escribirEstado, filtrar, leerEstado, linkWhatsapp, mensajeConsulta,
  numeroWhatsapp, prepararCatalogo, preciosVisibles, revisarConfig, urlFoto,
} from './logica.js';

const CLAVE_CACHE = 'allegra-catalogo-v1';
const REFRESCO_MS = 10 * 60 * 1000;
const SALUDO = '¡Hola! Vi el catálogo en la página y quería hacer una consulta.';

const $ = (selector) => document.querySelector(selector);
const el = {
  nombre: $('#nombre-negocio'),
  waCabecera: $('#wa-cabecera'),
  centinela: $('#centinela'),
  barra: $('#barra'),
  buscar: $('#buscar'),
  limpiar: $('#limpiar'),
  chips: $('#categorias'),
  resultados: $('#resultados'),
  aviso: $('#aviso'),
  avisoTexto: $('#aviso-texto'),
  avisoReintentar: $('#aviso-reintentar'),
  opciones: $('#opciones'),
  contador: $('#contador'),
  soloStock: $('#solo-stock'),
  orden: $('#orden'),
  grilla: $('#grilla'),
  verMas: $('#ver-mas'),
  vacio: $('#vacio'),
  vacioTitulo: $('#vacio-titulo'),
  vacioTexto: $('#vacio-texto'),
  verTodos: $('#ver-todos'),
  vacioWa: $('#vacio-wa'),
  error: $('#error'),
  errorTitulo: $('#error-titulo'),
  errorTexto: $('#error-texto'),
  reintentar: $('#reintentar'),
  errorWa: $('#error-wa'),
  pieNombre: $('#pie-nombre'),
  pieTel: $('#pie-tel'),
  pieWa: $('#pie-wa'),
  pieDir: $('#pie-dir'),
  anio: $('#anio'),
  detalle: $('#detalle'),
  detCerrar: $('#det-cerrar'),
  detFoto: $('#det-foto'),
  detCat: $('#det-cat'),
  detNombre: $('#det-nombre'),
  detPrecios: $('#det-precios'),
  detStock: $('#det-stock'),
  detWa: $('#det-wa'),
  detCompartir: $('#det-compartir'),
  detCompartirTxt: $('#det-compartir-txt'),
  tplTarjeta: $('#tpl-tarjeta'),
  tplSinFoto: $('#tpl-sin-foto'),
};

const ERRORES = {
  sin_conexion: ['No pudimos conectarnos', 'Revisá tu conexión a internet y volvé a intentar.'],
  servidor: ['El catálogo no está disponible ahora', 'Estamos teniendo un problema técnico. Probá de nuevo en unos minutos.'],
  configuracion: ['El catálogo no está disponible ahora', 'Mientras lo solucionamos, escribinos por WhatsApp y te pasamos los precios.'],
};

const ajustes = window.ALLEGRA || {};
const estado = { ...leerEstado(location.search), mostrados: POR_PAGINA };
let productos = [];
let porId = new Map();
let filtrados = [];
let negocio = {};
let whatsapp = numeroWhatsapp(ajustes.whatsapp);
let urlBase = '';
let cargando = false;
let fechaDatos = 0;
let productoPendiente = estado.producto;
let cerrandoPorHistorial = false;
let esperaBusqueda;
let esperaCompartir;

// "13/09 a las 14:32" (toLocaleString da "02:32 p. m." y el punto final se duplica en las oraciones)
function fechaHora(ms) {
  const fecha = new Date(ms);
  const dia = fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  const hora = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${dia} a las ${hora}`;
}

// ---------- copia local (para abrir rápido y para cuando falla internet) ----------
function leerCache() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_CACHE) || 'null');
    if (guardado && guardado.url === urlBase && Array.isArray(guardado.filas) && Number.isFinite(guardado.fecha)) return guardado;
  } catch {
    // almacenamiento bloqueado o dañado
  }
  return null;
}

function guardarCache(filas, datosNegocio) {
  try {
    localStorage.setItem(CLAVE_CACHE, JSON.stringify({ url: urlBase, fecha: Date.now(), filas, negocio: datosNegocio }));
  } catch {
    // sin lugar o bloqueado: la página funciona igual
  }
}

// ---------- dirección (filtros compartibles y botón "atrás" del celular) ----------
const urlActual = () => `${location.pathname}${escribirEstado(estado)}${location.hash}`;

function sincronizarUrl() {
  const nueva = urlActual();
  if (nueva !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(history.state, '', nueva);
}

// ---------- piezas de la interfaz ----------
const sinFoto = () => el.tplSinFoto.content.firstElementChild.cloneNode(true);

function nodoFoto(p, grande = false) {
  const url = urlFoto(urlBase, p.foto);
  if (!url) return sinFoto();
  const img = document.createElement('img');
  if (!grande) img.loading = 'lazy';
  img.decoding = 'async';
  img.width = 480;
  img.height = 480;
  img.alt = p.nombre;
  img.addEventListener('error', () => img.replaceWith(sinFoto()), { once: true });
  img.src = url;
  return img;
}

function nodosPrecio(p) {
  const lista = preciosVisibles(p);
  if (!lista.length) {
    const consultar = document.createElement('span');
    consultar.className = 'precio consultar-precio';
    consultar.textContent = 'Consultar precio';
    return [consultar];
  }
  return lista.map(({ etiqueta, valor }, i) => {
    const fila = document.createElement('span');
    fila.className = i ? 'precio secundario' : 'precio';
    const nombre = document.createElement('small');
    nombre.textContent = etiqueta;
    const importe = document.createElement('strong');
    importe.textContent = valor;
    fila.append(nombre, importe);
    return fila;
  });
}

function tarjeta(p) {
  const nodo = el.tplTarjeta.content.firstElementChild.cloneNode(true);
  nodo.dataset.id = p.id;
  nodo.classList.toggle('agotado', !p.disponible);
  nodo.querySelector('.tarjeta-foto').append(nodoFoto(p));
  nodo.querySelector('.tarjeta-cat').textContent = p.categoria;
  nodo.querySelector('.tarjeta-nombre').textContent = p.nombre;
  nodo.querySelector('.tarjeta-precios').append(...nodosPrecio(p));
  nodo.querySelector('.stock').textContent = p.disponible ? 'Disponible' : 'Sin stock';
  const consultar = nodo.querySelector('.consultar');
  const link = linkWhatsapp(whatsapp, mensajeConsulta(p));
  consultar.hidden = !link;
  if (link) {
    consultar.href = link;
    consultar.setAttribute('aria-label', `Consultar por WhatsApp: ${p.nombre}`);
  }
  return nodo;
}

function mostrarEsqueleto() {
  const tarjetas = Array.from({ length: 8 }, () => {
    const nodo = document.createElement('div');
    nodo.className = 'tarjeta esqueleto';
    nodo.setAttribute('aria-hidden', 'true');
    const foto = document.createElement('div');
    foto.className = 'tarjeta-foto';
    const bloqueFoto = document.createElement('div');
    bloqueFoto.className = 'blk blk-foto';
    foto.append(bloqueFoto);
    const info = document.createElement('div');
    info.className = 'tarjeta-info';
    for (const clase of ['blk-cat', 'blk-nombre', 'blk-nombre2', 'blk-precio']) {
      const bloque = document.createElement('div');
      bloque.className = `blk ${clase}`;
      info.append(bloque);
    }
    nodo.append(foto, info);
    return nodo;
  });
  el.grilla.replaceChildren(...tarjetas);
  el.grilla.setAttribute('aria-busy', 'true');
  el.opciones.hidden = true;
  el.verMas.hidden = true;
  el.vacio.hidden = true;
  el.error.hidden = true;
}

function pintarNegocio() {
  const nombre = String(negocio.nombre || ajustes.nombre || 'Allegra Importadora').trim();
  el.nombre.textContent = nombre;
  el.pieNombre.textContent = nombre;

  whatsapp = numeroWhatsapp(negocio.telefono) || numeroWhatsapp(ajustes.whatsapp);
  const link = linkWhatsapp(whatsapp, SALUDO);
  for (const enlace of [el.waCabecera, el.vacioWa, el.errorWa, el.pieWa]) {
    enlace.hidden = !link;
    if (link) enlace.href = link;
  }

  const telefono = String(negocio.telefono || ajustes.telefono || '').trim();
  el.pieTel.hidden = !telefono;
  el.pieTel.textContent = telefono ? `Tel.: ${telefono}` : '';

  const direccion = String(negocio.direccion || ajustes.direccion || '').trim();
  el.pieDir.hidden = !direccion;
  el.pieDir.textContent = direccion;
  if (direccion) el.pieDir.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
}

function pintarCategorias() {
  const lista = categorias(productos);
  if (estado.categoria && !lista.some((c) => c.nombre === estado.categoria)) estado.categoria = '';
  const chip = (valor, texto, cantidad) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'chip';
    boton.dataset.categoria = valor;
    boton.setAttribute('aria-pressed', String(estado.categoria === valor));
    const numero = document.createElement('span');
    numero.textContent = cantidad;
    boton.append(texto, numero);
    return boton;
  };
  el.chips.replaceChildren(chip('', 'Todos', productos.length), ...lista.map((c) => chip(c.nombre, c.nombre, c.cantidad)));
  el.chips.hidden = lista.length < 2;
}

function pintarLista() {
  filtrados = filtrar(productos, estado);
  el.grilla.replaceChildren(...filtrados.slice(0, estado.mostrados).map(tarjeta));
  el.grilla.setAttribute('aria-busy', 'false');
  el.opciones.hidden = productos.length === 0;
  el.contador.textContent = filtrados.length === 1 ? '1 producto' : `${filtrados.length.toLocaleString('es-AR')} productos`;
  el.verMas.hidden = filtrados.length <= estado.mostrados;

  el.vacio.hidden = filtrados.length > 0;
  if (!filtrados.length) {
    const texto = estado.texto.trim();
    if (!productos.length) {
      el.vacioTitulo.textContent = 'Todavía no hay productos publicados';
      el.vacioTexto.textContent = 'Escribinos por WhatsApp y te contamos qué tenemos.';
      el.verTodos.hidden = true;
    } else {
      el.vacioTitulo.textContent = texto ? `No encontramos “${texto}”` : 'No hay productos con esos filtros';
      el.vacioTexto.textContent = 'Probá con otra palabra, mirá todo el catálogo o consultanos.';
      el.verTodos.hidden = false;
    }
  }
  seguirSiHaceFalta();
}

function mostrarMas() {
  if (estado.mostrados >= filtrados.length) return;
  const desde = estado.mostrados;
  estado.mostrados += POR_PAGINA;
  el.grilla.append(...filtrados.slice(desde, estado.mostrados).map(tarjeta));
  el.verMas.hidden = filtrados.length <= estado.mostrados;
  seguirSiHaceFalta();
}

// En pantallas altas el botón "ver más" puede seguir visible después de agregar productos.
function seguirSiHaceFalta() {
  requestAnimationFrame(() => {
    if (!el.verMas.hidden && el.verMas.getBoundingClientRect().top < innerHeight + 600) mostrarMas();
  });
}

function mostrarError(tipo) {
  const [titulo, texto] = ERRORES[tipo] || ERRORES.servidor;
  el.errorTitulo.textContent = titulo;
  el.errorTexto.textContent = texto;
  el.reintentar.hidden = tipo === 'configuracion';
  el.error.hidden = false;
  el.grilla.replaceChildren();
  el.grilla.setAttribute('aria-busy', 'false');
  el.vacio.hidden = true;
  el.verMas.hidden = true;
  el.opciones.hidden = true;
  el.chips.hidden = true;
  el.aviso.hidden = true;
  pintarNegocio();
}

function mostrarAviso(texto) {
  el.avisoTexto.textContent = texto;
  el.aviso.hidden = false;
}

// ---------- ficha del producto ----------
function pintarDetalle(p) {
  el.detFoto.replaceChildren(nodoFoto(p, true));
  el.detCat.textContent = p.categoria;
  el.detNombre.textContent = p.nombre;
  el.detPrecios.replaceChildren(...nodosPrecio(p));
  el.detStock.textContent = p.disponible ? 'Disponible' : 'Sin stock por el momento';
  el.detStock.classList.toggle('sin', !p.disponible);
  const link = linkWhatsapp(whatsapp, mensajeConsulta(p));
  el.detWa.hidden = !link;
  if (link) el.detWa.href = link;
}

function abrirDetalle(id, { apilar = true } = {}) {
  const p = porId.get(id);
  if (!p) return;
  pintarDetalle(p);
  const yaAbierto = el.detalle.open;
  estado.producto = id;
  if (apilar && !yaAbierto) history.pushState({ detalle: id }, '', urlActual());
  else sincronizarUrl();
  if (!yaAbierto) {
    el.detCompartirTxt.textContent = 'Compartir';
    el.detalle.showModal();
    el.detalle.scrollTop = 0;
  }
}

async function compartir() {
  const p = porId.get(estado.producto);
  if (!p) return;
  const enlace = `${location.origin}${location.pathname}?p=${encodeURIComponent(p.id)}`;
  const avisar = (texto) => {
    el.detCompartirTxt.textContent = texto;
    clearTimeout(esperaCompartir);
    esperaCompartir = setTimeout(() => { el.detCompartirTxt.textContent = 'Compartir'; }, 2200);
  };
  if (navigator.share) {
    try {
      await navigator.share({ title: p.nombre, url: enlace });
    } catch {
      // la persona canceló
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(enlace);
    avisar('¡Enlace copiado!');
  } catch {
    avisar('No se pudo copiar');
  }
}

// ---------- datos ----------
function aplicarDatos(filas, datosNegocio, { definitivo }) {
  productos = prepararCatalogo(filas);
  porId = new Map(productos.map((p) => [p.id, p]));
  negocio = datosNegocio && typeof datosNegocio === 'object' ? datosNegocio : {};
  el.error.hidden = true;
  pintarNegocio();
  pintarCategorias();
  pintarLista();
  sincronizarUrl();

  if (productoPendiente) {
    if (porId.has(productoPendiente)) {
      abrirDetalle(productoPendiente, { apilar: false });
      productoPendiente = '';
    } else if (definitivo) {
      productoPendiente = '';
      estado.producto = '';
      sincronizarUrl();
    }
  } else if (el.detalle.open && porId.has(estado.producto)) {
    pintarDetalle(porId.get(estado.producto));
  }
}

async function cargar() {
  if (cargando) return;
  const config = revisarConfig(ajustes);
  if (!config.ok) {
    if (config.problema === 'secreta') {
      console.error('config.js tiene una clave SECRETA de Supabase: sacala y generá una nueva en el panel de Supabase.');
    } else {
      console.warn('Falta configurar config.js (URL de Supabase y clave pública).');
    }
    mostrarError('configuracion');
    return;
  }

  urlBase = config.url;
  cargando = true;
  el.reintentar.disabled = true;
  el.avisoReintentar.disabled = true;

  const cache = leerCache();
  if (!productos.length) {
    if (cache) {
      fechaDatos = cache.fecha;
      aplicarDatos(cache.filas, cache.negocio, { definitivo: false });
    } else {
      mostrarEsqueleto();
    }
  }

  try {
    const datos = crearDatos({ url: config.url, clave: config.clave });
    const [filas, datosNegocio] = await Promise.all([
      datos.catalogo(),
      datos.negocio().catch(() => cache?.negocio ?? negocio),
    ]);
    fechaDatos = Date.now();
    aplicarDatos(filas, pick(datosNegocio), { definitivo: true });
    guardarCache(filas, pick(datosNegocio));
    el.aviso.hidden = true;
  } catch (e) {
    if (!(e instanceof ErrorCatalogo)) console.error(e);
    if (productos.length) {
      mostrarAviso(`No pudimos actualizar el catálogo. Estás viendo los precios del ${fechaHora(fechaDatos)}.`);
    } else {
      mostrarError(e instanceof ErrorCatalogo ? e.tipo : 'servidor');
    }
  } finally {
    cargando = false;
    el.reintentar.disabled = false;
    el.avisoReintentar.disabled = false;
  }
}

// Guarda solo los campos conocidos del negocio.
function pick(datos) {
  const limpio = {};
  for (const campo of CAMPOS_NEGOCIO.split(',')) {
    if (typeof datos?.[campo] === 'string') limpio[campo] = datos[campo];
  }
  return limpio;
}

// ---------- eventos ----------
function cambiar(cambios) {
  Object.assign(estado, cambios);
  estado.mostrados = POR_PAGINA;
  for (const boton of el.chips.children) {
    boton.setAttribute('aria-pressed', String(boton.dataset.categoria === estado.categoria));
  }
  pintarLista();
  sincronizarUrl();
  const destino = el.resultados.getBoundingClientRect().top + scrollY - el.barra.offsetHeight - 8;
  if (scrollY > destino) scrollTo({ top: destino });
}

el.buscar.addEventListener('input', () => {
  el.limpiar.hidden = !el.buscar.value;
  clearTimeout(esperaBusqueda);
  esperaBusqueda = setTimeout(() => cambiar({ texto: el.buscar.value }), 150);
});

el.buscar.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  clearTimeout(esperaBusqueda);
  cambiar({ texto: el.buscar.value });
  el.buscar.blur();
});

el.limpiar.addEventListener('click', () => {
  el.buscar.value = '';
  el.limpiar.hidden = true;
  cambiar({ texto: '' });
  el.buscar.focus();
});

el.chips.addEventListener('click', (e) => {
  const boton = e.target.closest('.chip');
  if (boton) cambiar({ categoria: boton.dataset.categoria });
});

el.soloStock.addEventListener('change', () => cambiar({ soloDisponibles: el.soloStock.checked }));
el.orden.addEventListener('change', () => cambiar({ orden: el.orden.value }));

el.verTodos.addEventListener('click', () => {
  el.buscar.value = '';
  el.limpiar.hidden = true;
  el.soloStock.checked = false;
  cambiar({ texto: '', categoria: '', soloDisponibles: false });
});

el.verMas.addEventListener('click', mostrarMas);

el.grilla.addEventListener('click', (e) => {
  const boton = e.target.closest('.tarjeta-abrir');
  if (boton) abrirDetalle(boton.closest('.tarjeta').dataset.id);
});

el.detCerrar.addEventListener('click', () => el.detalle.close());
el.detalle.addEventListener('click', (e) => {
  if (e.target === el.detalle) el.detalle.close();
});
// Por si el navegador no cierra la ficha solo con Esc.
el.detalle.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  e.preventDefault();
  el.detalle.close();
});
el.detalle.addEventListener('close', () => {
  estado.producto = '';
  if (!cerrandoPorHistorial && history.state?.detalle) history.back();
  else sincronizarUrl();
  cerrandoPorHistorial = false;
});
el.detCompartir.addEventListener('click', compartir);

window.addEventListener('popstate', () => {
  const id = leerEstado(location.search).producto;
  if (id && porId.has(id)) {
    abrirDetalle(id, { apilar: false });
  } else if (el.detalle.open) {
    cerrandoPorHistorial = true;
    el.detalle.close();
  }
});

el.reintentar.addEventListener('click', cargar);
el.avisoReintentar.addEventListener('click', cargar);
window.addEventListener('online', () => {
  if (!el.error.hidden || !el.aviso.hidden) cargar();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && fechaDatos && Date.now() - fechaDatos > REFRESCO_MS) cargar();
});

if ('IntersectionObserver' in window) {
  new IntersectionObserver((entradas) => {
    if (entradas.some((e) => e.isIntersecting)) mostrarMas();
  }, { rootMargin: '600px 0px' }).observe(el.verMas);
  new IntersectionObserver(([entrada]) => {
    el.barra.classList.toggle('pegada', !entrada.isIntersecting);
  }).observe(el.centinela);
}

// ---------- inicio ----------
el.buscar.value = estado.texto;
el.limpiar.hidden = !estado.texto;
el.soloStock.checked = estado.soloDisponibles;
el.orden.value = estado.orden;
el.anio.textContent = String(new Date().getFullYear());
pintarNegocio();
cargar();
