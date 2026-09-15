// Revisiones de los archivos que se publican: referencias rotas, seguridad y coincidencia con Supabase.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { CAMPOS, CAMPOS_NEGOCIO } from '../sitio/js/datos.js';
import { revisarConfig, tipoDeClave } from '../sitio/js/logica.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITIO = path.join(RAIZ, 'sitio');
const leer = (...partes) => fs.readFileSync(path.join(SITIO, ...partes), 'utf8');
const html = leer('index.html');
const app = leer('js', 'app.js');
const ESQUEMA = path.resolve(RAIZ, '..', 'allegra-ventas', 'supabase', 'esquema.sql');

test('todos los archivos que usa la página existen', () => {
  const referencias = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1])
    .filter((r) => !/^(https?:|#|mailto:|tel:|data:)/.test(r) && r !== './');
  assert.ok(referencias.length >= 5);
  for (const ref of referencias) assert.ok(fs.existsSync(path.join(SITIO, ref)), `falta ${ref}`);

  for (const archivo of ['app.js', 'datos.js']) {
    for (const [, ref] of leer('js', archivo).matchAll(/from '(\.[^']+)'/g)) {
      assert.ok(fs.existsSync(path.join(SITIO, 'js', ref)), `${archivo} importa ${ref} que no existe`);
    }
  }
});

test('cada elemento que busca app.js existe en la página (y una sola vez)', () => {
  const ids = [...app.matchAll(/\$\('#([\w-]+)'\)/g)].map((m) => m[1]);
  assert.ok(ids.length > 40);
  for (const id of ids) {
    const veces = html.split(`id="${id}"`).length - 1;
    assert.equal(veces, 1, `#${id} aparece ${veces} veces en index.html`);
  }
  for (const clase of ['tarjeta-foto', 'tarjeta-cat', 'tarjeta-nombre', 'tarjeta-precios', 'stock', 'consultar', 'tarjeta-abrir']) {
    assert.ok(html.includes(`class="${clase}"`), `la plantilla de tarjeta no tiene .${clase}`);
  }
});

test('la política de seguridad no se puede saltear con código en línea', () => {
  const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1];
  assert.ok(csp, 'falta la política de seguridad');
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.match(csp, /style-src 'self'(;|$)/);
  assert.match(csp, /connect-src 'self' https:\/\/\*\.supabase\.co/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, 'no puede haber scripts en línea');
  assert.doesNotMatch(html, /\sstyle="/, 'no puede haber estilos en línea');
  assert.doesNotMatch(html, /\son[a-z]+="/, 'no puede haber manejadores en línea');
  assert.doesNotMatch(app, /setAttribute\('style'/);
});

test('los datos de Supabase nunca se insertan como HTML', () => {
  for (const archivo of ['app.js', 'datos.js', 'logica.js']) {
    const codigo = leer('js', archivo);
    assert.doesNotMatch(codigo, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/, archivo);
  }
});

test('los enlaces que abren otra pestaña no le dan acceso a la página', () => {
  for (const [etiqueta] of html.matchAll(/<a [^>]*target="_blank"[^>]*>/g)) {
    assert.match(etiqueta, /rel="noopener"/, etiqueta);
  }
});

test('config.js publicado no tiene una clave secreta y apunta al proyecto real', () => {
  const contexto = { window: {} };
  vm.runInNewContext(leer('config.js'), contexto);
  const ajustes = contexto.window.ALLEGRA;
  assert.ok(ajustes, 'config.js tiene que definir window.ALLEGRA');
  assert.match(ajustes.supabaseUrl, /^https:\/\/[a-z0-9]+\.supabase\.co$/);
  assert.notEqual(tipoDeClave(ajustes.supabaseKey), 'secreta', '¡config.js tiene una clave secreta!');
  assert.notEqual(revisarConfig(ajustes).problema, 'secreta');
});

test('las columnas que pide la página existen en las vistas de Supabase', { skip: !fs.existsSync(ESQUEMA) && 'no está el esquema del programa' }, () => {
  const sql = fs.readFileSync(ESQUEMA, 'utf8');
  const catalogo = /create or replace view public\.catalogo as([\s\S]+?)from public\.productos/.exec(sql)?.[1];
  const negocio = /create or replace view public\.negocio as([\s\S]+?)from public\.config/.exec(sql)?.[1];
  assert.ok(catalogo && negocio, 'no se encontraron las vistas en esquema.sql');
  for (const campo of CAMPOS.split(',')) {
    assert.match(catalogo, new RegExp(`(\\bas|\\bp\\.)\\s*${campo}\\b`), `catalogo.${campo}`);
  }
  for (const campo of CAMPOS_NEGOCIO.split(',')) {
    assert.match(negocio, new RegExp(`\\bas ${campo}\\b`), `negocio.${campo}`);
  }
  assert.match(sql, /grant select on public\.catalogo to anon/);
  assert.match(sql, /grant select on public\.negocio to anon/);
  assert.match(sql, /values \('productos', 'productos', true\)/, 'el bucket de fotos tiene que ser público');
});

test('el nombre de foto que acepta la página es el mismo que genera el programa', { skip: !fs.existsSync(ESQUEMA) && 'no está el programa' }, () => {
  const fotos = fs.readFileSync(path.resolve(RAIZ, '..', 'allegra-ventas', 'src', 'main', 'fotos.js'), 'utf8');
  const delPrograma = /NOMBRE_VALIDO = (\/.+\/);/.exec(fotos)?.[1];
  assert.equal(delPrograma, String(/^[a-z0-9-]+\.jpg$/));
  assert.match(leer('js', 'logica.js'), /NOMBRE_FOTO = \/\^\[a-z0-9-\]\+\\\.jpg\$\//);
});

test('las imágenes publicadas son livianas', () => {
  for (const imagen of fs.readdirSync(path.join(SITIO, 'img'))) {
    const kb = fs.statSync(path.join(SITIO, 'img', imagen)).size / 1024;
    assert.ok(kb < 60, `${imagen} pesa ${kb.toFixed(0)} KB`);
  }
});
