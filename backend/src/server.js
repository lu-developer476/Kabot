import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { query, pool } from './db.js';
import { generateAssistantReply, streamAssistantReply } from './openai.js';
import { env } from './env.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);
const HOST = '0.0.0.0';
const CHAT_CONTEXT_WINDOW_SIZE = env.CHAT_CONTEXT_WINDOW_SIZE;
const JSON_BODY_LIMIT = '100kb';
const MAX_USER_MESSAGE_LENGTH = 4000;
const MAX_CHAT_TITLE_LENGTH = 80;
const DEFAULT_CHAT_TITLE = 'Nueva conversación';
const UUID_V4_OR_COMPATIBLE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const { FRONTEND_URL, APP_NAME, APP_DESCRIPTION, ASSISTANT_TONE, ASSISTANT_LANGUAGE, SYSTEM_PROMPT } = env;
const allowedOrigins = new Set(
  FRONTEND_URL.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => origin.replace(/\/+$/, ''))
);

function logInfo(message, details) {
  if (details) {
    console.log(`[${APP_NAME}] ${message}`, details);
    return;
  }

  console.log(`[${APP_NAME}] ${message}`);
}

function logError(message, error, details) {
  if (details) {
    console.error(`[${APP_NAME}] ${message}`, details);
  } else {
    console.error(`[${APP_NAME}] ${message}`);
  }

  if (error) {
    console.error(error);
  }
}

function buildPromptMessages(historyRows) {
  // Limitamos el historial enviado al modelo para bajar costo y latencia sin dejar de guardar todo en la base.
  const recentMessages = historyRows.slice(-CHAT_CONTEXT_WINDOW_SIZE);

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    ...recentMessages.map((row) => ({ role: row.role, content: row.content })),
  ];
}

function compactTitle(value, fallback = DEFAULT_CHAT_TITLE) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const compacted = value.trim().replace(/\s+/g, ' ');
  if (!compacted) {
    return fallback;
  }

  return compacted.length > MAX_CHAT_TITLE_LENGTH
    ? `${compacted.slice(0, MAX_CHAT_TITLE_LENGTH - 1)}…`
    : compacted;
}

function titleFromMessage(content) {
  return compactTitle(content, DEFAULT_CHAT_TITLE);
}

function validateChatId(req, res, next) {
  if (!UUID_V4_OR_COMPATIBLE_PATTERN.test(req.params.chatId || '')) {
    return res.status(400).json({ error: 'El identificador del chat no es válido.' });
  }

  return next();
}

function validateUserMessage(rawContent) {
  if (typeof rawContent !== 'string') {
    return { valid: false, error: 'El mensaje debe ser texto.' };
  }

  const content = rawContent.trim();

  if (!content) {
    return { valid: false, error: 'El mensaje está vacío.' };
  }

  if (content.length > MAX_USER_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: `El mensaje supera el máximo permitido de ${MAX_USER_MESSAGE_LENGTH} caracteres.`,
    };
  }

  return { valid: true, content };
}


function sendStreamEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function prepareAssistantTurn(chatId, content) {
  const chatExists = await query('select id, title from chats where id = $1 limit 1', [chatId]);
  if (chatExists.rowCount === 0) {
    return { error: { status: 404, message: 'El chat no existe.' } };
  }

  await query(
    `insert into messages (chat_id, role, content)
     values ($1, 'user', $2)`,
    [chatId, content]
  );

  const chatTitle = chatExists.rows[0]?.title;
  if (!chatTitle || chatTitle === DEFAULT_CHAT_TITLE) {
    await query('update chats set title = $1, updated_at = now() where id = $2', [titleFromMessage(content), chatId]);
  }

  const history = await query(
    `select role, content
     from messages
     where chat_id = $1
     order by created_at asc`,
    [chatId]
  );

  return { promptMessages: buildPromptMessages(history.rows) };
}

async function persistAssistantReply(chatId, assistantReply) {
  await query(
    `insert into messages (chat_id, role, content)
     values ($1, 'assistant', $2)`,
    [chatId, assistantReply]
  );

  await query('update chats set updated_at = now() where id = $1', [chatId]);

  const allMessages = await query(
    `select id, role, content, created_at
     from messages
     where chat_id = $1
     order by created_at asc`,
    [chatId]
  );

  return allMessages.rows;
}

function sendError(res, statusCode, clientMessage, logContext, error) {
  if (statusCode >= 500) {
    logError(logContext, error);
  }

  return res.status(statusCode).json({ error: clientMessage });
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.trim().replace(/\/+$/, '');

    if (allowedOrigins.has(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(
      new Error(
        `CORS blocked for origin ${origin}. Allowed origins: ${Array.from(allowedOrigins).join(', ')}`
      )
    );
  },
};

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
app.use(cors(corsOptions));
app.use(express.json({ limit: JSON_BODY_LIMIT }));

app.get('/health', async (_req, res) => {
  try {
    await query('select 1');
    res.json({
      ok: true,
      app: APP_NAME,
      description: APP_DESCRIPTION,
      model: env.OPENAI_MODEL,
      uptimeSeconds: Math.round(process.uptime()),
    });
  } catch (error) {
    return sendError(res, 500, 'La base de datos no está disponible.', 'Healthcheck falló.', error);
  }
});

app.get('/api/config', (_req, res) => {
  res.json({
    appName: APP_NAME,
    appDescription: APP_DESCRIPTION,
    assistantTone: ASSISTANT_TONE,
    assistantLanguage: ASSISTANT_LANGUAGE,
    maxUserMessageLength: MAX_USER_MESSAGE_LENGTH,
    chatContextWindowSize: CHAT_CONTEXT_WINDOW_SIZE,
  });
});

app.get('/api/chats', async (_req, res) => {
  try {
    const result = await query(
      `select id, title, created_at, updated_at
       from chats
       order by updated_at desc
       limit 20`
    );
    res.json({ chats: result.rows });
  } catch (error) {
    return sendError(res, 500, 'No se pudieron obtener los chats.', 'Error al listar chats.', error);
  }
});

app.post('/api/chats', async (req, res) => {
  try {
    const title = compactTitle(req.body?.title);
    const result = await query(
      `insert into chats (title)
       values ($1)
       returning id, title, created_at, updated_at`,
      [title]
    );

    res.status(201).json({ chat: result.rows[0] });
  } catch (error) {
    return sendError(res, 500, 'No se pudo crear el chat.', 'Error al crear un chat.', error);
  }
});

app.patch('/api/chats/:chatId', validateChatId, async (req, res) => {
  try {
    const title = compactTitle(req.body?.title);
    const result = await query(
      `update chats
       set title = $1, updated_at = now()
       where id = $2
       returning id, title, created_at, updated_at`,
      [title, req.params.chatId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'El chat no existe.' });
    }

    return res.json({ chat: result.rows[0] });
  } catch (error) {
    return sendError(res, 500, 'No se pudo renombrar el chat.', `Error al renombrar el chat ${req.params.chatId}.`, error);
  }
});

app.delete('/api/chats/:chatId', validateChatId, async (req, res) => {
  try {
    const result = await query('delete from chats where id = $1 returning id', [req.params.chatId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'El chat no existe.' });
    }

    return res.status(204).send();
  } catch (error) {
    return sendError(res, 500, 'No se pudo eliminar el chat.', `Error al eliminar el chat ${req.params.chatId}.`, error);
  }
});

app.get('/api/chats/:chatId/messages', validateChatId, async (req, res) => {
  try {
    const { chatId } = req.params;
    const chatExists = await query('select id from chats where id = $1 limit 1', [chatId]);
    if (chatExists.rowCount === 0) {
      return res.status(404).json({ error: 'El chat no existe.' });
    }

    const result = await query(
      `select id, role, content, created_at
       from messages
       where chat_id = $1
       order by created_at asc`,
      [chatId]
    );

    return res.json({ messages: result.rows });
  } catch (error) {
    return sendError(
      res,
      500,
      'No se pudieron obtener los mensajes.',
      `Error al obtener mensajes del chat ${req.params.chatId}.`,
      error
    );
  }
});

app.post('/api/chats/:chatId/messages', validateChatId, async (req, res) => {
  const { chatId } = req.params;
  const validation = validateUserMessage(req.body?.content);

  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const turn = await prepareAssistantTurn(chatId, validation.content);
    if (turn.error) {
      return res.status(turn.error.status).json({ error: turn.error.message });
    }

    const assistantReply = await generateAssistantReply(turn.promptMessages);
    const messages = await persistAssistantReply(chatId, assistantReply);

    return res.status(201).json({ messages });
  } catch (error) {
    return sendError(
      res,
      500,
      'No se pudo procesar el mensaje.',
      `Error al procesar un mensaje del chat ${chatId}.`,
      error
    );
  }
});

app.post('/api/chats/:chatId/messages/stream', validateChatId, async (req, res) => {
  const { chatId } = req.params;
  const validation = validateUserMessage(req.body?.content);

  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const abortController = new AbortController();
  const abortStream = () => abortController.abort();
  req.on('aborted', abortStream);
  res.on('close', () => {
    if (!res.writableEnded) {
      abortStream();
    }
  });

  try {
    const turn = await prepareAssistantTurn(chatId, validation.content);
    if (turn.error) {
      return res.status(turn.error.status).json({ error: turn.error.message });
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sendStreamEvent(res, 'ready', { chatId });

    const assistantReply = await streamAssistantReply(turn.promptMessages, {
      signal: abortController.signal,
      onToken: (token) => sendStreamEvent(res, 'token', { token }),
    });

    if (abortController.signal.aborted) {
      return;
    }

    const messages = await persistAssistantReply(chatId, assistantReply);
    sendStreamEvent(res, 'done', { messages });
    res.end();
  } catch (error) {
    logError(`Error al procesar streaming del chat ${chatId}.`, error);

    if (!res.headersSent) {
      return res.status(500).json({ error: 'No se pudo procesar el mensaje en tiempo real.' });
    }

    sendStreamEvent(res, 'error', { error: 'No se pudo procesar el mensaje en tiempo real.' });
    res.end();
  }
});

app.use((_req, res) => {
  return res.status(404).json({ error: 'Ruta no encontrada.' });
});

app.use((err, req, res, _next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: `El body supera el límite permitido de ${JSON_BODY_LIMIT}.` });
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'El body JSON es inválido.' });
  }

  if (err.message?.startsWith('CORS blocked for origin')) {
    logError(`Solicitud bloqueada por CORS en ${req.method} ${req.originalUrl}.`, null, {
      origin: req.headers.origin || 'sin origin',
    });
    return res.status(403).json({ error: err.message });
  }

  logError(`Error no controlado en ${req.method} ${req.originalUrl}.`, err);
  return res.status(500).json({ error: 'Error interno del servidor.' });
});

const server = app.listen(PORT, HOST, () => {
  logInfo(`Backend listo en http://${HOST}:${PORT}`);
  logInfo('Configuración de runtime', {
    node: process.version,
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    allowedOrigins: Array.from(allowedOrigins),
    chatContextWindowSize: CHAT_CONTEXT_WINDOW_SIZE,
  });
});

async function shutdown(signal) {
  logInfo(`Señal ${signal} recibida. Cerrando servidor...`);

  server.close(async (serverError) => {
    if (serverError) {
      logError('Error al cerrar el servidor HTTP.', serverError);
      process.exit(1);
      return;
    }

    try {
      await pool.end();
      logInfo('Conexiones a PostgreSQL cerradas. Proceso finalizado.');
      process.exit(0);
    } catch (poolError) {
      logError('Error al cerrar el pool de PostgreSQL.', poolError);
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('unhandledRejection', (reason) => {
  logError('Unhandled promise rejection.', reason);
});

process.on('uncaughtException', (error) => {
  logError('Uncaught exception.', error);
  process.exit(1);
});
