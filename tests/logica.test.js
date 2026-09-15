import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as L from '../sitio/js/logica.js';

const jwt = (datos) => ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', Buffer.from(JSON.stringify(datos)).toString('base64url'), 'firma'].join('.');
const producto = (datos) => L.prepararProducto({ id: 'x', nombre: 'Algo', precio_efectivo: 100, precio_transferencia: 110, disponible: true, ...datos });

test('normalizar ignora tildes, eñes, mayúsculas y espacios de más', () => {
  assert.equal(L.normalizar('  Lámpara   LED  Cálida '), 'lampara led calida');
  assert.equal(L.normalizar('ÑANDÚ'), 'nandu');
  assert.equal(L.normalizar(null), '');
  assert.equal(L.normalizar(undefined), '');
  assert.equal(L.normalizar(12), '12');
});

test('precio con separador de miles argentino y sin decimales', () => {
  assert.equal(L.precio(12400), '$' + L.ESPACIO_FIJO + '12.400');
  assert.equal(L.precio('1234567.6'), '$' + L.ESPACIO_FIJO + '1.234.568');
  assert.equal(L.precio(999), '$' + L.ESPACIO_FIJO + '999');
  assert.equal(L.precio(0), null);
  assert.equal(L.precio(-5), null);
  assert.equal(L.precio('abc'), null);
  assert.equal(L.precio(null), null);
  assert.equal(L.precio(Infinity), null);
});

test('prepararProducto limpia datos y completa lo que falta', () => {
  const p = L.prepararProducto({
    id: 7, nombre: '  Lámpara   LED ', categoria: '  ', codigo: '779123', foto: 'abc-1.jpg',
    precio_efectivo: '4740', precio_transferencia: 0, disponible: true,
  });
  assert.deepEqual(p, {
    id: '7', nombre: 'Lámpara LED', categoria: 'Otros', foto: 'abc-1.jpg',
    efectivo: 4740, transferencia: 4740, disponible: true, busqueda: 'lampara led otros 779123',
  });
  assert.equal(L.prepararProducto({ id: 1, nombre: '   ' }), null);
  assert.equal(L.prepararProducto({ nombre: 'sin id' }), null);
  assert.equal(L.prepararProducto(null), null);
  assert.equal(L.prepararProducto('texto'), null);
  assert.equal(producto({ disponible: 'true' }).disponible, true);
  assert.equal(producto({ disponible: 1 }).disponible, false);
  assert.equal(producto({ disponible: null }).disponible, false);
});

test('solo acepta nombres de foto como los que genera el programa', () => {
  assert.equal(producto({ foto: '1726000000000-a1b2c3d4.jpg' }).foto, '1726000000000-a1b2c3d4.jpg');
  for (const mala of ['../../secreto.jpg', 'a.png', 'A.JPG', 'javascript:alert(1)', 'a b.jpg', 'x.jpg?y', '', 5, null]) {
    assert.equal(producto({ foto: mala }).foto, null, String(mala));
  }
});

test('prepararCatalogo descarta filas inválidas y repetidas', () => {
  const lista = L.prepararCatalogo([
    { id: 'a', nombre: 'Uno' }, { id: 'a', nombre: 'Uno repetido' }, null, { id: 'b', nombre: '' }, { id: 'c', nombre: 'Tres' },
  ]);
  assert.deepEqual(lista.map((p) => p.nombre), ['Uno', 'Tres']);
  assert.deepEqual(L.prepararCatalogo(null), []);
  assert.deepEqual(L.prepararCatalogo({ no: 'lista' }), []);
});

test('preciosVisibles según lo que tenga cargado el producto', () => {
  assert.deepEqual(L.preciosVisibles(producto({})), [
    { etiqueta: 'Efectivo', valor: '$' + L.ESPACIO_FIJO + '100' },
    { etiqueta: 'Transferencia', valor: '$' + L.ESPACIO_FIJO + '110' },
  ]);
  assert.deepEqual(L.preciosVisibles(producto({ precio_transferencia: 100 })), [{ etiqueta: 'Precio', valor: '$' + L.ESPACIO_FIJO + '100' }]);
  assert.deepEqual(L.preciosVisibles(producto({ precio_transferencia: 0 })), [{ etiqueta: 'Precio', valor: '$' + L.ESPACIO_FIJO + '100' }]);
  assert.deepEqual(L.preciosVisibles(producto({ precio_efectivo: 0, precio_transferencia: 900 })), [{ etiqueta: 'Transferencia', valor: '$' + L.ESPACIO_FIJO + '900' }]);
  assert.deepEqual(L.preciosVisibles(producto({ precio_efectivo: 0, precio_transferencia: 0 })), []);
});

const CATALOGO = L.prepararCatalogo([
  { id: '1', nombre: 'Lámpara LED 9W cálida', categoria: 'Iluminación', codigo: '7791234560011', precio_efectivo: 4740, disponible: true },
  { id: '2', nombre: 'Lámpara LED 12W fría', categoria: 'Iluminación', precio_efectivo: 5920, disponible: true },
  { id: '3', nombre: 'Alargue 5m', categoria: 'Eléctrica', precio_efectivo: 13500, disponible: false },
  { id: '4', nombre: 'Ficha macho 10A', categoria: 'Eléctrica', precio_efectivo: 1750, disponible: true },
  { id: '5', nombre: 'Kit sin precio', categoria: null, precio_efectivo: 0, disponible: true },
  { id: '6', nombre: 'Lámpara LED 100W', categoria: 'Iluminación', precio_efectivo: 30000, disponible: true },
]);
const nombres = (lista) => lista.map((p) => p.nombre);

test('buscar sin importar tildes, orden de palabras ni mayúsculas', () => {
  assert.deepEqual(nombres(L.filtrar(CATALOGO, { texto: 'lampara led' })), ['Lámpara LED 9W cálida', 'Lámpara LED 12W fría', 'Lámpara LED 100W']);
  assert.deepEqual(nombres(L.filtrar(CATALOGO, { texto: 'FRIA   lámpara' })), ['Lámpara LED 12W fría']);
  assert.deepEqual(nombres(L.filtrar(CATALOGO, { texto: '7791234560011' })), ['Lámpara LED 9W cálida']);
  assert.deepEqual(nombres(L.filtrar(CATALOGO, { texto: 'electrica' })), ['Ficha macho 10A', 'Alargue 5m']);
  assert.deepEqual(L.filtrar(CATALOGO, { texto: 'heladera' }), []);
  assert.equal(L.filtrar(CATALOGO, { texto: '   ' }).length, CATALOGO.length);
  assert.equal(L.filtrar(CATALOGO, { texto: '(' }).length, 0);
});

test('orden natural de números y sin stock al final', () => {
  assert.deepEqual(nombres(L.filtrar(CATALOGO)), [
    'Ficha macho 10A', 'Kit sin precio', 'Lámpara LED 9W cálida', 'Lámpara LED 12W fría', 'Lámpara LED 100W', 'Alargue 5m',
  ]);
});

test('filtrar por categoría y por stock', () => {
  assert.deepEqual(nombres(L.filtrar(CATALOGO, { categoria: 'Eléctrica' })), ['Ficha macho 10A', 'Alargue 5m']);
  assert.deepEqual(nombres(L.filtrar(CATALOGO, { categoria: 'Eléctrica', soloDisponibles: true })), ['Ficha macho 10A']);
  assert.deepEqual(nombres(L.filtrar(CATALOGO, { categoria: 'Otros' })), ['Kit sin precio']);
  assert.deepEqual(L.filtrar(CATALOGO, { categoria: 'No existe' }), []);
});

test('ordenar por precio deja los que no tienen precio al final', () => {
  assert.deepEqual(nombres(L.filtrar(CATALOGO, { orden: 'menor' })), [
    'Ficha macho 10A', 'Lámpara LED 9W cálida', 'Lámpara LED 12W fría', 'Lámpara LED 100W', 'Kit sin precio', 'Alargue 5m',
  ]);
  assert.deepEqual(nombres(L.filtrar(CATALOGO, { orden: 'mayor' })), [
    'Lámpara LED 100W', 'Lámpara LED 12W fría', 'Lámpara LED 9W cálida', 'Ficha macho 10A', 'Kit sin precio', 'Alargue 5m',
  ]);
});

test('filtrar no modifica la lista original', () => {
  const antes = nombres(CATALOGO);
  L.filtrar(CATALOGO, { orden: 'mayor' });
  assert.deepEqual(nombres(CATALOGO), antes);
});

test('categorías con cantidades, alfabéticas y "Otros" al final', () => {
  assert.deepEqual(L.categorias(CATALOGO), [
    { nombre: 'Eléctrica', cantidad: 2 },
    { nombre: 'Iluminación', cantidad: 3 },
    { nombre: 'Otros', cantidad: 1 },
  ]);
  assert.deepEqual(L.categorias([]), []);
});

test('estado de la búsqueda en la dirección, ida y vuelta', () => {
  const estado = { texto: ' lámpara & led ', categoria: 'Iluminación', soloDisponibles: true, orden: 'menor', producto: 'abc' };
  const url = L.escribirEstado(estado);
  assert.deepEqual(L.leerEstado(url), { ...estado, texto: 'lámpara & led' });
  assert.equal(L.escribirEstado({ texto: '', categoria: '', soloDisponibles: false, orden: 'nombre', producto: '' }), '');
  assert.deepEqual(L.leerEstado('?orden=hackeo&stock=si&q=' + 'x'.repeat(500)), {
    texto: 'x'.repeat(100), categoria: '', soloDisponibles: false, orden: 'nombre', producto: '',
  });
  assert.deepEqual(L.leerEstado(''), { texto: '', categoria: '', soloDisponibles: false, orden: 'nombre', producto: '' });
});

test('teléfonos argentinos escritos de cualquier forma sirven para WhatsApp', () => {
  const esperado = '5492615048381';
  for (const telefono of [
    '2615048381', '261 504-8381', '(0261) 15-504-8381', '0261 15 5048381', '261155048381',
    '+54 9 261 504-8381', '+54 261 504 8381', '5492615048381', '00549 261 5048381',
  ]) {
    assert.equal(L.numeroWhatsapp(telefono), esperado, telefono);
  }
  assert.equal(L.numeroWhatsapp('11 15 2345-6789'), '5491123456789');
  assert.equal(L.numeroWhatsapp('(011) 2345-6789'), '5491123456789');
  for (const malo of ['', null, undefined, '504-8381', '123', 'sin teléfono', '26150483811234']) {
    assert.equal(L.numeroWhatsapp(malo), null, String(malo));
  }
});

test('enlace y mensaje de WhatsApp', () => {
  const p = producto({ nombre: 'Alargue 5m "reforzado" & más', precio_efectivo: 13500, precio_transferencia: 14850 });
  const mensaje = L.mensajeConsulta(p);
  assert.equal(mensaje, '¡Hola! Quería consultar por "Alargue 5m "reforzado" & más" ($' + L.ESPACIO_FIJO + '13.500), que vi en la página.');
  const link = L.linkWhatsapp('5492615048381', mensaje);
  assert.ok(link.startsWith('https://wa.me/5492615048381?text='));
  assert.equal(decodeURIComponent(new URL(link).search.slice('?text='.length)), mensaje);
  assert.ok(!link.includes(' ') && !link.includes('&m'));
  assert.equal(L.linkWhatsapp(null, 'hola'), null);
  assert.equal(L.linkWhatsapp('5492615048381'), 'https://wa.me/5492615048381');
  assert.equal(L.mensajeConsulta(producto({ precio_efectivo: 0, precio_transferencia: 0 })), '¡Hola! Quería consultar por "Algo", que vi en la página.');
});

test('url de las fotos del bucket público', () => {
  assert.equal(
    L.urlFoto('https://abc.supabase.co/', '1726-ab.jpg'),
    'https://abc.supabase.co/storage/v1/object/public/productos/fotos/1726-ab.jpg',
  );
  assert.equal(L.urlFoto('https://abc.supabase.co', '../x.jpg'), null);
  assert.equal(L.urlFoto('https://abc.supabase.co', null), null);
});

test('reconoce claves públicas y secretas de Supabase', () => {
  assert.equal(L.tipoDeClave('sb_publishable_abc123'), 'publica');
  assert.equal(L.tipoDeClave('sb_secret_abc123'), 'secreta');
  assert.equal(L.tipoDeClave(jwt({ role: 'anon', iss: 'supabase' })), 'publica');
  assert.equal(L.tipoDeClave(jwt({ role: 'service_role', iss: 'supabase' })), 'secreta');
  assert.equal(L.tipoDeClave('a.b.c'), 'desconocida');
  assert.equal(L.tipoDeClave(''), 'desconocida');
  assert.equal(L.esJwt(jwt({ role: 'anon' })), true);
  assert.equal(L.esJwt('sb_publishable_abc'), false);
});

test('revisarConfig rechaza configuraciones incompletas y claves secretas', () => {
  const url = 'https://kdidrguymrkqwyriqmuq.supabase.co';
  assert.deepEqual(L.revisarConfig({ supabaseUrl: `${url}/`, supabaseKey: ' sb_publishable_x ' }), { ok: true, url, clave: 'sb_publishable_x' });
  assert.deepEqual(L.revisarConfig({ supabaseUrl: url, supabaseKey: 'PEGAR_ACA_LA_CLAVE_PUBLICA' }), { ok: false, problema: 'falta' });
  assert.deepEqual(L.revisarConfig({ supabaseUrl: url, supabaseKey: '' }), { ok: false, problema: 'falta' });
  assert.deepEqual(L.revisarConfig({ supabaseUrl: 'kdidrguymrkqwyriqmuq.supabase.co', supabaseKey: 'sb_publishable_x' }), { ok: false, problema: 'falta' });
  assert.deepEqual(L.revisarConfig({ supabaseUrl: `${url}/rest/v1`, supabaseKey: 'sb_publishable_x' }), { ok: false, problema: 'falta' });
  assert.deepEqual(L.revisarConfig({ supabaseUrl: url, supabaseKey: 'sb_secret_x' }), { ok: false, problema: 'secreta' });
  assert.deepEqual(L.revisarConfig({ supabaseUrl: url, supabaseKey: jwt({ role: 'service_role' }) }), { ok: false, problema: 'secreta' });
  assert.deepEqual(L.revisarConfig(undefined), { ok: false, problema: 'falta' });
});
