// Publicación en Vercel: config.js armado con la variable de entorno y los mismos encabezados que _headers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ARCHIVO_CONFIG, generarConfig, leerAjustes } from '../tools/generar-config.js';
import { revisarConfig } from '../sitio/js/logica.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const actual = fs.readFileSync(ARCHIVO_CONFIG, 'utf8');
const jwt = (datos) => `x.${Buffer.from(JSON.stringify(datos)).toString('base64url')}.y`;

test('al publicar arma config.js con la clave pública de la variable de entorno', () => {
  assert.equal(generarConfig(actual, {}), null);
  const original = leerAjustes(actual);
  const ajustes = leerAjustes(generarConfig(actual, { SUPABASE_PUBLISHABLE_KEY: '  sb_publishable_abc123  ' }));
  assert.equal(ajustes.supabaseKey, 'sb_publishable_abc123');
  assert.equal(ajustes.supabaseUrl, original.supabaseUrl);
  assert.equal(ajustes.whatsapp, original.whatsapp);
  assert.equal(revisarConfig(ajustes).ok, true);

  const vieja = leerAjustes(generarConfig(actual, { SUPABASE_ANON_KEY: jwt({ role: 'anon' }), SUPABASE_URL: 'https://otroproyecto.supabase.co/' }));
  assert.equal(vieja.supabaseUrl, 'https://otroproyecto.supabase.co');
  assert.equal(revisarConfig(vieja).ok, true);
});

test('se niega a publicar una clave secreta o una dirección que no es de Supabase', () => {
  assert.throws(() => generarConfig(actual, { SUPABASE_PUBLISHABLE_KEY: 'sb_secret_abc' }), /SECRETA/);
  assert.throws(() => generarConfig(actual, { SUPABASE_PUBLISHABLE_KEY: jwt({ role: 'service_role' }) }), /SECRETA/);
  assert.throws(() => generarConfig(actual, { SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x', SUPABASE_URL: 'https://otro.com' }), /no parece/);
});

test('vercel.json publica solo la carpeta sitio, con los mismos encabezados de seguridad que _headers', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8'));
  assert.equal(vercel.outputDirectory, 'sitio');
  assert.match(vercel.buildCommand, /tools\/generar-config\.js/);
  const generales = vercel.headers.find((h) => h.source === '/(.*)').headers;
  const cloudflare = fs.readFileSync(path.join(RAIZ, 'sitio', '_headers'), 'utf8');
  for (const clave of ['X-Content-Type-Options', 'Referrer-Policy', 'X-Frame-Options', 'Content-Security-Policy', 'Permissions-Policy']) {
    const valor = generales.find((h) => h.key === clave)?.value;
    assert.ok(valor, `falta ${clave}`);
    assert.ok(cloudflare.includes(`${clave}: ${valor}`), `${clave} es distinto en sitio/_headers`);
  }
});
