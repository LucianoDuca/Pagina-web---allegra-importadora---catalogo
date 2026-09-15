# Allegra Importadora · página web del catálogo

Página pública donde los clientes buscan productos, ven precios en efectivo y transferencia y consultan
por WhatsApp. **Se actualiza sola**: lee de Supabase lo que sube el programa de ventas del local, así que
no hay que volver a publicarla cuando cambian precios, productos, fotos o el dólar.

```
Programa del local ──sube──▶ Supabase ──vistas públicas "catalogo" y "negocio"──▶ Página web ──▶ WhatsApp del local
```

**Qué muestra:** nombre, categoría, foto, precio en efectivo y en transferencia (ya en pesos, con el dólar y el
redondeo actuales) y si hay stock. **Qué no muestra nunca:** ventas, movimientos, cantidades de stock ni
productos marcados como ocultos. Supabase no le deja leer nada más aunque alguien lo intente.

## Publicarla (una sola vez)

El código está en GitHub: <https://github.com/LucianoDuca/Pagina-web---allegra-importadora---catalogo>.
Se publica **solo la carpeta `sitio`**; `tests` y `tools` no quedan en internet.

La clave que necesita es la **pública** de Supabase: **Project Settings → API Keys → Publishable key**
(`sb_publishable_…`) o, en la pestaña de claves viejas, la **anon public** (`eyJ…`). Es la misma que se usó
en la ventana técnica del programa.

> ⚠️ **Nunca** la *Secret key* ni la *service_role*: dan acceso total a la base. Si por error se usa una,
> la publicación falla y la página se niega a funcionar, pero igual hay que borrarla y generar una nueva en Supabase.

### Con Vercel, conectado a GitHub

1. Entrar a <https://vercel.com> con la cuenta de GitHub → **Add New… → Project** → importar el repositorio.
2. No hace falta tocar la configuración del proyecto: `vercel.json` ya dice qué publicar (carpeta `sitio`)
   y agrega los encabezados de seguridad.
3. Antes de **Deploy**, en **Environment Variables** agregar:
   **Name** `SUPABASE_PUBLISHABLE_KEY` · **Value** la clave pública.
4. **Deploy**. Queda en `https://<nombre-del-proyecto>.vercel.app`.

Al publicar, `tools/generar-config.js` escribe la clave en `config.js`, así **la clave no queda en GitHub**.
Si falta la variable o es una clave secreta, la publicación falla con un mensaje que lo explica.
Cada `git push` a `main` vuelve a publicar solo. Si se cambia la variable: **Deployments → ⋯ → Redeploy**.

> **Plan gratis de Vercel (Hobby):** sus condiciones lo limitan a uso personal y no comercial. Para la página
> de un comercio corresponde el plan Pro (pago) o publicarla gratis en Cloudflare Pages (abajo).
> La página funciona igual en cualquiera de los dos.

### Alternativa: Cloudflare Pages o Netlify (subiendo la carpeta)

1. Pegar la clave pública en `sitio/config.js`, en `supabaseKey`, en lugar de `PEGAR_ACA_LA_CLAVE_PUBLICA`.
2. **Cloudflare Pages** (gratis y con uso comercial): <https://dash.cloudflare.com> → **Workers & Pages → Create →
   Pages → Upload assets** → arrastrar la carpeta `sitio` → **Deploy**.
   **Netlify:** <https://app.netlify.com/drop> y arrastrar `sitio`. Los dos leen los encabezados de `sitio/_headers`.

### WhatsApp de respaldo y dominio

En `sitio/config.js` están el WhatsApp y el teléfono de respaldo (los del logo: 261 504-8381). Se usan solo
si en el programa no se cargó el teléfono del negocio. **Confirmar que ese número tenga WhatsApp.**

**Dominio propio (opcional):** un `.com.ar` se registra en NIC Argentina y se conecta desde el panel del hosting
(*Domains* en Vercel, *Custom domains* en Cloudflare o Netlify).

### 3. Probar

Abrir la dirección: tienen que aparecer los productos. Si dice *"El catálogo no está disponible ahora"* sin botón
de reintentar, falta o está mal la clave de `config.js` (con F12 → Consola se ve el motivo).

## Qué cargar en el programa para que se vea completa

- **Ajustes → datos del negocio:** nombre, teléfono (el de WhatsApp) y dirección. Aparecen en la página
  (la dirección abre Google Maps).
- **Valor del dólar:** sin dólar cargado, los productos en dólares salen como *"Consultar precio"*.
- **Productos:** categoría (arma los filtros de la página) y foto. Con el interruptor **"Mostrar en la página web"**
  de cada producto se decide si aparece. Viene activado: los productos nuevos se publican solos.

## Cómo se comporta

- Busca sin importar tildes ni mayúsculas, también por código de barras. Filtros por categoría, "solo con stock"
  y orden por precio.
- Los filtros quedan en la dirección: se puede compartir un enlace a una búsqueda o a un producto.
- Cada producto tiene **Consultar**: abre WhatsApp con un mensaje listo que dice qué producto y a qué precio lo vio.
- Guarda una copia del catálogo en el navegador: la segunda visita abre al instante y, si falla internet o
  Supabase, muestra los últimos precios con un aviso de la fecha.
- Pensada primero para celular (desde 360 px de ancho) y también para computadora. Necesita un navegador
  de 2022 en adelante (en iPhone, iOS 15.4 o más nuevo). Las fotos se cargan a medida que se baja por la página.

## Límites del plan gratis de Supabase

- **Transferencia mensual:** el plan gratis incluye un cupo por mes (hoy 5 GB). Las fotos son lo que más
  consume. Una visita típica gasta 1 o 2 MB, así que alcanza para miles de visitas por mes. El consumo
  se ve en Supabase → **Usage**.
- **Pausa por inactividad:** Supabase pausa los proyectos gratis sin uso durante una semana. Con la PC del local
  sincronizando todos los días no pasa.

## Probar en esta PC

Requiere Node.js 20 o más nuevo (en esta PC hay uno portátil en `C:\Users\lucia\tools\node-v24.21.0-win-x64`).
No instala nada: no tiene dependencias.

```bash
npm test      # 40 pruebas: lógica, lectura de Supabase, seguridad de los archivos publicados
npm run dev   # la página con un Supabase simulado y productos inventados: http://localhost:5178
```

El simulador nunca toca el Supabase real. Tiene modos para ver cada situación: abrir
`http://localhost:5178/__modo?m=MODO` y recargar la página.

| Modo | Qué simula |
|---|---|
| `normal` | 36 productos con casos raros (sin foto, foto rota, sin precio, sin stock, HTML en el nombre) |
| `muchos` | 2.600 productos, con Supabase limitando a 500 filas por pedido |
| `vacio` | Todavía no hay productos publicados |
| `lento` | Supabase tarda 2,5 segundos en responder |
| `error` | Supabase caído |
| `caido` | Se corta la conexión |
| `sinclave` | `config.js` sin la clave pública |

## Qué cubren las pruebas

- **Lógica:** búsqueda con tildes y códigos, filtros, orden por precio, precios que faltan, teléfonos argentinos
  escritos de todas las formas (con 0, 15, +54, 9), mensajes de WhatsApp, enlaces compartibles, claves secretas.
- **Datos:** catálogo completo aunque Supabase limite las filas por pedido, sin internet, servidor caído, lento,
  clave equivocada, respuestas raras, clave nueva y vieja.
- **Archivos publicados:** que no falte ningún archivo, que cada elemento que usa el código exista, que la política
  de seguridad no permita código en línea, que nada de Supabase se inserte como HTML, que `config.js` no tenga una
  clave secreta, que las columnas pedidas existan en `allegra-ventas/supabase/esquema.sql` y que las imágenes sean
  livianas.

## Estructura

```
sitio/               lo que se publica
  index.html         la página
  config.js          URL de Supabase, clave pública y WhatsApp de respaldo (único archivo a tocar)
  _headers           encabezados de seguridad y caché (Cloudflare Pages y Netlify los leen solos)
  css/estilos.css    estilos (mismos colores que el programa)
  js/app.js          interfaz
  js/datos.js        lectura de Supabase
  js/logica.js       búsqueda, filtros, precios, WhatsApp (sin DOM, probado aparte)
  img/               logo e ícono
tools/               servidor de prueba con Supabase simulado y datos inventados
tests/               pruebas automáticas
```
