// Arma sitio/config.js al publicar (Vercel lo corre como "build") con la clave pública tomada de una
// variable de entorno: así la clave no queda escrita en el repositorio de GitHub.
//   SUPABASE_PUBLISHABLE_KEY   clave pública de Supabase (sb_publishable_… o la vieja anon eyJ…)
//   SUPABASE_URL               opcional: solo si algún día cambia el proyecto
// Sin la variable deja config.js como está (en Vercel falla, para no publicar una página vacía).
// Con una clave secreta se niega y la publicación falla.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tipoDeClave } from '../sitio/js/logica.js';

export const ARCHIVO_CONFIG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'sitio', 'config.js');

export function leerAjustes(texto) {
  const contexto = { window: {} };
  vm.runInNewContext(texto, contexto);
  if (!contexto.window.ALLEGRA) throw new Error('config.js tiene que definir window.ALLEGRA');
  return { ...contexto.window.ALLEGRA };
}

// Devuelve el texto nuevo de config.js, o null si no hay clave para poner
export function generarConfig(textoActual, env) {
  const clave = String(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '').trim();
  if (!clave) return null;
  if (tipoDeClave(clave) === 'secreta') {
    throw new Error('La variable tiene una clave SECRETA de Supabase. Borrala, generá una nueva en Supabase ' +
      'y usá la clave pública (sb_publishable_…).');
  }
  const ajustes = { ...leerAjustes(textoActual), supabaseKey: clave };
  const url = String(env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  if (url) {
    if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(url)) throw new Error(`SUPABASE_URL no parece una dirección de Supabase: ${url}`);
    ajustes.supabaseUrl = url;
  }
  return '// Generado al publicar por tools/generar-config.js con las variables de entorno del hosting.\n' +
    `window.ALLEGRA = ${JSON.stringify(ajustes, null, 2)};\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const nuevo = generarConfig(fs.readFileSync(ARCHIVO_CONFIG, 'utf8'), process.env);
    if (nuevo) {
      fs.writeFileSync(ARCHIVO_CONFIG, nuevo);
      console.log('config.js listo con la clave pública de SUPABASE_PUBLISHABLE_KEY.');
    } else if (process.env.VERCEL) {
      console.error('Falta la variable SUPABASE_PUBLISHABLE_KEY (Vercel → Settings → Environment Variables). ' +
        'Sin ella la página no puede mostrar los productos.');
      process.exit(1);
    } else {
      console.log('Sin SUPABASE_PUBLISHABLE_KEY: config.js queda como está.');
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
