import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, test } from 'node:test';
import { CAMPOS, ErrorCatalogo, crearDatos } from '../sitio/js/datos.js';
import { CLAVE_PRUEBA, crearServidor } from '../tools/servidor-prueba.js';

let servidor;
let url;

before(async () => {
  servidor = crearServidor({ retraso: 400, maxFilas: 500 });
  url = `http://127.0.0.1:${await servidor.escuchar(0)}`;
});
after(() => servidor.cerrar());

function modo(nombre) {
  servidor.estado.modo = nombre;
  servidor.estado.pedidos.length = 0;
}

const rechaza = (promesa, tipo) => assert.rejects(promesa, (e) => e instanceof ErrorCatalogo && e.tipo === tipo);

// fetch falso que devuelve siempre lo mismo y guarda lo que se pidió
function fetchFalso(cuerpo, { estado = 200, rango = null } = {}) {
  const pedidos = [];
  const funcion = async (direccion, opciones) => {
    pedidos.push({ direccion, opciones });
    const headers = rango ? { 'content-range': rango } : {};
    return new Response(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo), { status: estado, headers });
  };
  return { funcion, pedidos };
}

test('baja el catálogo completo y los datos del negocio', async () => {
  modo('normal');
  const datos = crearDatos({ url, clave: CLAVE_PRUEBA });
  const filas = await datos.catalogo();
  assert.equal(filas.length, 36);
  assert.deepEqual(Object.keys(filas[0]).sort(), CAMPOS.split(',').sort());
  assert.deepEqual(await datos.negocio(), { nombre: 'Allegra Importadora', telefono: '261 504-8381', direccion: 'San Martín 1234, Mendoza' });

  const [primero] = servidor.estado.pedidos;
  assert.equal(primero.headers.apikey, CLAVE_PRUEBA);
  assert.equal(primero.headers.authorization, undefined, 'una clave que no es JWT no va en Authorization');
  assert.equal(primero.headers.prefer, 'count=exact');
  assert.equal(primero.parametros.get('order'), 'nombre.asc,id.asc');
});

test('trae todo aunque Supabase limite las filas por pedido', async () => {
  modo('muchos');
  const filas = await crearDatos({ url, clave: CLAVE_PRUEBA, tamPagina: 1000 }).catalogo();
  assert.equal(filas.length, 2600);
  assert.equal(new Set(filas.map((f) => f.id)).size, 2600);
  const pedidosCatalogo = servidor.estado.pedidos.filter((p) => p.ruta.endsWith('/catalogo'));
  assert.equal(pedidosCatalogo.length, 6, 'con límite de 500 filas: 6 pedidos para 2600');
  assert.equal(pedidosCatalogo.filter((p) => p.headers.prefer).length, 1, 'el total se pide una sola vez');
});

test('páginas más chicas que el límite del servidor', async () => {
  modo('muchos');
  const filas = await crearDatos({ url, clave: CLAVE_PRUEBA, tamPagina: 300 }).catalogo();
  assert.equal(filas.length, 2600);
  assert.equal(servidor.estado.pedidos.length, 9);
});

test('catálogo vacío y negocio sin datos', async () => {
  modo('vacio');
  const datos = crearDatos({ url, clave: CLAVE_PRUEBA });
  assert.deepEqual(await datos.catalogo(), []);
  assert.deepEqual(await datos.negocio(), { nombre: null, telefono: null, direccion: null });
  assert.equal(servidor.estado.pedidos.length, 2);
});

test('clave equivocada se informa como problema de configuración', async () => {
  modo('normal');
  await rechaza(crearDatos({ url, clave: 'otra-clave' }).catalogo(), 'configuracion');
});

test('servidor con error', async () => {
  modo('error');
  await rechaza(crearDatos({ url, clave: CLAVE_PRUEBA }).catalogo(), 'servidor');
  await rechaza(crearDatos({ url, clave: CLAVE_PRUEBA }).negocio(), 'servidor');
});

test('conexión cortada a mitad del pedido', async () => {
  modo('caido');
  await rechaza(crearDatos({ url, clave: CLAVE_PRUEBA }).catalogo(), 'sin_conexion');
});

test('servidor que tarda demasiado', async () => {
  modo('lento');
  const inicio = Date.now();
  await rechaza(crearDatos({ url, clave: CLAVE_PRUEBA, tiempoLimite: 120 }).catalogo(), 'sin_conexion');
  assert.ok(Date.now() - inicio < 380, 'corta por tiempo sin esperar la respuesta');
});

test('servidor apagado', async () => {
  const apagado = http.createServer();
  await new Promise((listo) => apagado.listen(0, '127.0.0.1', listo));
  const { port } = apagado.address();
  await new Promise((listo) => apagado.close(listo));
  await rechaza(crearDatos({ url: `http://127.0.0.1:${port}`, clave: CLAVE_PRUEBA }).catalogo(), 'sin_conexion');
});

test('respuestas raras del servidor', async () => {
  await rechaza(crearDatos({ url, clave: 'x', fetch: fetchFalso('<html>no es json</html>').funcion }).catalogo(), 'servidor');
  await rechaza(crearDatos({ url, clave: 'x', fetch: fetchFalso({ message: 'objeto' }).funcion }).catalogo(), 'servidor');
  await rechaza(crearDatos({ url, clave: 'x', fetch: fetchFalso({}, { estado: 403 }).funcion }).catalogo(), 'configuracion');
  await rechaza(crearDatos({ url, clave: 'x', fetch: fetchFalso({}, { estado: 404 }).funcion }).catalogo(), 'servidor');
  assert.deepEqual(await crearDatos({ url, clave: 'x', fetch: fetchFalso([]).funcion }).negocio(), {});
  assert.deepEqual(await crearDatos({ url, clave: 'x', fetch: fetchFalso([null]).funcion }).negocio(), {});
  assert.deepEqual(await crearDatos({ url, clave: 'x', fetch: fetchFalso({ nombre: 'no es lista' }).funcion }).negocio(), {});
});

test('sin total en la respuesta corta cuando llega una página incompleta', async () => {
  const falso = fetchFalso([{ id: 1 }, { id: 2 }]);
  const filas = await crearDatos({ url, clave: 'x', fetch: falso.funcion, tamPagina: 5 }).catalogo();
  assert.equal(filas.length, 2);
  assert.equal(falso.pedidos.length, 1);
});

test('la clave vieja (JWT) también viaja en Authorization; la nueva no', async () => {
  const claveJwt = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.firma';
  const conJwt = fetchFalso([], { rango: '*/0' });
  await crearDatos({ url: 'https://abc.supabase.co/', clave: claveJwt, fetch: conJwt.funcion }).catalogo();
  assert.equal(conJwt.pedidos[0].opciones.headers.Authorization, `Bearer ${claveJwt}`);
  assert.ok(conJwt.pedidos[0].direccion.startsWith('https://abc.supabase.co/rest/v1/catalogo?select='));

  const nueva = fetchFalso([], { rango: '*/0' });
  await crearDatos({ url: 'https://abc.supabase.co', clave: 'sb_publishable_abc', fetch: nueva.funcion }).catalogo();
  assert.equal(nueva.pedidos[0].opciones.headers.Authorization, undefined);
  assert.equal(nueva.pedidos[0].opciones.headers.apikey, 'sb_publishable_abc');
});

test('el servidor de prueba sirve la página, sus archivos y protege las rutas', async () => {
  modo('normal');
  const pagina = await fetch(`${url}/`);
  assert.equal(pagina.status, 200);
  assert.match(pagina.headers.get('content-type'), /text\/html/);
  const modulo = await fetch(`${url}/js/app.js`);
  assert.match(modulo.headers.get('content-type'), /text\/javascript/);
  const config = await (await fetch(`${url}/config.js`)).text();
  assert.match(config, /clave-de-prueba/);
  assert.equal((await fetch(`${url}/..%2f..%2fpackage.json`)).status, 403);
  assert.equal((await fetch(`${url}/no-existe.html`)).status, 404);
  assert.equal((await fetch(`${url}/storage/v1/object/public/productos/fotos/demo-1.jpg`)).status, 200);
  assert.equal((await fetch(`${url}/storage/v1/object/public/productos/fotos/demo-rota.jpg`)).status, 404);
});
