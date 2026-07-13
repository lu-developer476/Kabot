# Kabot

<p align="center">
  <img alt="Node.js 20" src="https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white" />
  <img alt="Next.js 15" src="https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111111" />
  <img alt="Express" src="https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white" />
  <img alt="OpenAI API" src="https://img.shields.io/badge/OpenAI-API-412991?logo=openai&logoColor=white" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql&logoColor=white" />
  <img alt="Vercel" src="https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white" />
  <img alt="Render" src="https://img.shields.io/badge/Deploy-Render-46E3B7?logo=render&logoColor=111111" />
</p>


Kabot es un asistente conversacional full stack en estado funcional. El proyecto combina una landing pública para GitHub Pages, una aplicación Next.js con experiencia de chat en tiempo real y una API Express conectada a PostgreSQL + OpenAI, preparado para correr localmente y para deploy simple en Vercel + Render sin cambiar su arquitectura base.


## Estado actual del proyecto

- **Landing pública lista:** `index.html` permite publicar una demo en GitHub Pages sin build ni backend, con modo demo local y opción de conectar una API real publicada.
- **Frontend operativo:** la app en `frontend/` usa Next.js 15 + React 19 con una interfaz tipo “atlas holográfico”, selector bilingüe ES/EN, temas visuales, densidad de lectura, preferencias persistidas en `localStorage`, borradores por chat, búsqueda de conversaciones y selector global de zonas horarias.
- **Chat en tiempo real:** la UI consume Server-Sent Events para mostrar tokens progresivos, conserva un fallback JSON y sincroniza el historial canónico al finalizar cada respuesta.
- **Backend funcional:** la API Express expone healthcheck, configuración pública del asistente, CRUD básico de chats y endpoints de mensajes con streaming o respuesta tradicional.
- **Persistencia:** PostgreSQL/Supabase guarda chats y mensajes completos; el backend envía al modelo una ventana reciente configurable para reducir tokens, costo y latencia sin perder historial en la base.
- **Configuración robusta:** el backend valida variables obligatorias, CORS, tamaños de payload, mensajes de usuario y URLs de origen; el frontend bloquea el envío si `NEXT_PUBLIC_API_URL` falta o es inválida.
- **Deploy previsto:** frontend en Vercel, backend en Render y base en Supabase, con Node.js 20.x como versión recomendada.


## Sitio GitHub Pages

El repo incluye un `index.html` en la raíz para que `https://lu-developer476.github.io/Kabot/` abra una landing funcional en vez de mostrar este README.

La página pública funciona sin build ni backend gracias a un modo demo local, pero también permite pegar la URL del backend publicado para usar la API real cuando esté disponible. Incluye conversación persistente en el navegador, prompts rápidos, exportación del chat, tema claro/oscuro, copiado de respuestas y fallback automático a demo si el backend no responde.

## Stack

- **Frontend:** Next.js 15.2.4 + React 19.0.0
- **Backend:** Node.js 20.x + Express 4
- **IA:** OpenAI API mediante el SDK oficial `openai`
- **Base de datos:** PostgreSQL (Supabase) con `pg`
- **Comunicación en vivo:** Server-Sent Events para streaming de tokens
- **Deploy:** Vercel (frontend) + Render (backend) + GitHub Pages (landing demo)
- **Versión de Node recomendada:** 20.x (alineada con `engines`)

## Estructura

```bash
kabot/
├── index.html  # Landing demo para GitHub Pages
├── frontend/   # Next.js app
└── backend/    # Express API
```

## Flujo

1. El usuario escribe en el frontend.
2. El frontend envía el prompt al backend y, en la UI principal, abre un canal de streaming para recibir tokens progresivos.
3. El backend guarda la conversación en PostgreSQL.
4. El backend consulta OpenAI con streaming o modo JSON tradicional.
5. El backend persiste la respuesta final y la devuelve completa al frontend.

## Conversación en tiempo real y ventana de contexto

- La UI principal usa `POST /api/chats/:chatId/messages/stream` para mostrar la respuesta token por token, con cursor en vivo y estado de respuesta progresiva.
- El endpoint JSON `POST /api/chats/:chatId/messages` se mantiene como fallback compatible para integraciones que no quieran consumir Server-Sent Events.
- Al terminar el streaming, el backend guarda la respuesta completa en PostgreSQL y envía el historial canónico para sincronizar la interfaz.
- Si el usuario cierra la conexión, el backend aborta la generación para evitar trabajo innecesario.

## Ventana de contexto enviada al modelo

- Kabot sigue guardando **todo** el historial del chat en PostgreSQL.
- Al consultar OpenAI, el backend envía siempre el `SYSTEM_PROMPT` más una ventana reciente de mensajes del chat.
- Esa ventana se controla con la constante `CHAT_CONTEXT_WINDOW_SIZE` en `backend/src/server.js` y por defecto usa los últimos `16` mensajes.
- Los mensajes se mantienen en orden cronológico para no romper el contexto reciente.
- Este recorte solo reduce tokens, costo y latencia hacia OpenAI; no cambia lo que se almacena ni lo que luego se puede recuperar desde la base.

## Variables de entorno

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

- `NEXT_PUBLIC_API_URL` es **obligatoria** y debe ser una URL válida.
- Si falta o es inválida, el frontend muestra un mensaje visible en pantalla, deshabilita el formulario y no intenta hacer requests al backend.

### Backend (`backend/.env`)

```env
PORT=4000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres?sslmode=require
OPENAI_API_KEY=sk-...
FRONTEND_URL=http://localhost:3000,https://mi-frontend.vercel.app
OPENAI_MODEL=gpt-4.1-mini
APP_NAME=Kabot
APP_DESCRIPTION=un asistente conversacional en tiempo real para soporte, análisis, creatividad, aprendizaje y automatización
ASSISTANT_TONE=profesional, claro, práctico y cercano
ASSISTANT_LANGUAGE=español
SYSTEM_PROMPT=Eres Kabot, un asistente útil, claro, rápido y confiable. Responde en español salvo que el usuario pida otro idioma.
```

#### Variables requeridas del backend

- `DATABASE_URL`: conexión a PostgreSQL.
- `OPENAI_API_KEY`: credencial de OpenAI.

Si falta cualquiera de esas dos variables, el backend registra un error claro en español y termina inmediatamente con código de salida `1`.

#### Variables opcionales del backend (con defaults seguros)

- `PORT` → `4000` en local. En Render conviene dejar que la plataforma inyecte su propio puerto.
- `FRONTEND_URL` → `http://localhost:3000` (acepta una o varias URLs separadas por comas)
- `OPENAI_MODEL` → `gpt-4.1-mini`
- `APP_NAME` → `Kabot`
- `APP_DESCRIPTION` → describe el alcance del asistente; por defecto contempla soporte, análisis, creatividad, aprendizaje y automatización
- `ASSISTANT_TONE` → define la personalidad visible del bot
- `ASSISTANT_LANGUAGE` → idioma principal de respuesta
- `SYSTEM_PROMPT` → si se define, reemplaza el prompt construido con las variables anteriores

`FRONTEND_URL` también se valida como URL. Si está presente pero es inválida, el backend no arranca.

Formato de `FRONTEND_URL`:

- Acepta una o varias URLs separadas por comas.
- Se recortan espacios alrededor de cada origen.
- Se normalizan barras finales automáticamente.
- Ejemplo válido para desarrollo + producción: `FRONTEND_URL=http://localhost:3000, https://mi-frontend.vercel.app/`.
- Requests sin header `Origin` siguen permitidos para health checks y llamadas server-to-server.
- Cualquier origen fuera de la lista se rechaza con un error `403` claro.

## Base de datos

Ejecutá este SQL en Supabase:

```sql
create extension if not exists pgcrypto;

create table if not exists chats (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Nueva conversación',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_chat_id_created_at on messages(chat_id, created_at);
```

También está incluido en `backend/sql/schema.sql`.

## Scripts del proyecto

### Backend

```bash
cd backend
npm install
npm run dev    # desarrollo con watch
npm run check  # validación sintáctica del entrypoint
npm start      # arranque estilo producción
```

### Frontend

```bash
cd frontend
npm install
npm run dev
npm run build
npm start
npm run lint
```

## Endurecimiento básico del backend

- El backend arranca con logs más claros sobre app, entorno, versión de Node, puerto y orígenes permitidos.
- Express desactiva `x-powered-by` y confía en un proxy simple (`trust proxy`) para funcionar mejor detrás de Render/Vercel.
- `express.json` está limitado a `100kb`, por lo que bodies enormes se rechazan antes de llegar a la lógica de negocio.
- Los mensajes de usuario se validan antes de guardarse y antes de enviarse a OpenAI.
- Se rechazan mensajes vacíos, no textuales o de más de `4000` caracteres con errores `400` claros.
- Requests con JSON inválido responden `400`, rutas inexistentes responden `404` JSON consistente y bodies demasiado grandes responden `413`.
- Los errores del backend ahora salen por una vía común, con contexto útil en logs sin agregar dependencias extra.
- El proceso maneja `SIGINT` y `SIGTERM` para cerrar HTTP + PostgreSQL de forma ordenada durante deploys o reinicios.

## Deploy en Vercel

- Root Directory: `frontend`
- Framework Preset: `Next.js`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output: default de Next.js
- Variable:
  - `NEXT_PUBLIC_API_URL=https://TU-BACKEND.onrender.com`
- Node.js: `20.x`

## Deploy en Render

- Root Directory: `backend`
- Environment: `Node`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/health`
- Node.js: `20.x`

Variables recomendadas para producción:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
OPENAI_API_KEY=...
FRONTEND_URL=https://TU-FRONTEND.vercel.app
OPENAI_MODEL=gpt-4.1-mini
APP_NAME=Kabot
SYSTEM_PROMPT=Eres Kabot...
```

Notas:

- En Render no hace falta fijar `PORT` manualmente salvo que quieras sobreescribirlo en otro entorno; la plataforma ya lo provee.
- Si usás preview deployments de Vercel, agregá también esos dominios a `FRONTEND_URL` separados por coma.
- `DATABASE_URL` y `OPENAI_API_KEY` siguen siendo obligatorias para iniciar el backend.

## Timeouts de requests

- El frontend corta la creación del chat si el backend no responde en `10s` y muestra un mensaje claro para reintentar.
- El envío de mensajes desde la UI vence a los `30s`, limpia el estado `loading` y evita dejar el botón en `Pensando...` indefinidamente.
- El cliente de OpenAI del backend usa un timeout de `25s`, para que una llamada lenta al modelo no deje colgada la request del servidor.
- Si alguno de esos timeouts se dispara, el usuario ve un error entendible y puede volver a intentar el flujo normal sin recargar toda la app.

## Mejoras de producto incluidas

- La UI carga conversaciones existentes, permite alternar entre chats guardados, crear nuevos chats y eliminar conversaciones desde una barra lateral.
- El primer mensaje renombra automáticamente la conversación para que el historial sea navegable sin configuración extra.
- La pantalla inicial incluye prompts sugeridos, indicador de escritura, envío con `Enter`, saltos con `Shift+Enter`, contador de caracteres y botón para copiar respuestas.
- El backend expone metadatos públicos del asistente para que el frontend muestre nombre, descripción, tono, idioma y límite de caracteres sin hardcodearlos.
- Kabot es más amplio y reutilizable: el prompt base cubre soporte, estrategia, creatividad, análisis, aprendizaje, redacción, tecnología y automatización, y podés adaptar marca, tono e idioma con `APP_NAME`, `APP_DESCRIPTION`, `ASSISTANT_TONE`, `ASSISTANT_LANGUAGE` o reemplazar todo con `SYSTEM_PROMPT`.
- La conversación se siente más cercana a ChatGPT: la respuesta aparece en vivo por streaming, se conserva en PostgreSQL y la UI se resincroniza con el historial final al cerrar cada turno.

## Endpoints

- `GET /health`
- `GET /api/config`
- `GET /api/chats`
- `POST /api/chats`
- `PATCH /api/chats/:chatId`
- `DELETE /api/chats/:chatId`
- `GET /api/chats/:chatId/messages`
- `POST /api/chats/:chatId/messages`
- `POST /api/chats/:chatId/messages/stream`
