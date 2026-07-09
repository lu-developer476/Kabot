'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || '';
const API_URL_ERROR = validateApiUrl(API_URL);
const DEFAULT_ERROR_MESSAGE = 'Ocurrió un problema de conexión. Probá de nuevo en unos segundos.';
const CHAT_INIT_TIMEOUT_MS = 10000;
const CHAT_MESSAGE_TIMEOUT_MS = 30000;
const CHAT_INIT_TIMEOUT_MESSAGE = 'La creación del chat está tardando demasiado. Probá de nuevo sin recargar la página.';
const CHAT_MESSAGE_TIMEOUT_MESSAGE = 'La respuesta está tardando demasiado. Cortamos la espera para que no quede “Pensando...” para siempre. Probá de nuevo en unos segundos.';
const STARTER_PROMPTS = [
  'Analizá esta idea de negocio y proponé próximos pasos.',
  'Actuá como tutor y explicame un tema complejo paso a paso.',
  'Ayudame a escribir, revisar o mejorar un texto profesional.',
];

function validateApiUrl(value) {
  if (!value) return 'Falta la variable de entorno NEXT_PUBLIC_API_URL. Configurala para conectar el frontend con el backend.';
  try { return new URL(value).toString() ? '' : 'La variable NEXT_PUBLIC_API_URL no es válida.'; } catch { return 'La variable de entorno NEXT_PUBLIC_API_URL debe ser una URL válida.'; }
}

async function parseHttpError(response, fallbackMessage) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const data = await response.json();
      if (typeof data?.error === 'string' && data.error.trim()) return data.error.trim();
    } catch (error) { console.error('No se pudo interpretar la respuesta de error del backend.', error); }
  }
  return fallbackMessage;
}


async function streamRequest(path, body, handlers = {}) {
  if (API_URL_ERROR) throw new Error(API_URL_ERROR);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CHAT_MESSAGE_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_URL.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const fallbackMessage = response.status >= 500 ? 'El servidor no pudo responder correctamente. Probá de nuevo en un momento.' : 'No pudimos completar la solicitud. Revisá los datos e intentá otra vez.';
      throw new Error(await parseHttpError(response, fallbackMessage), { cause: response });
    }

    if (!response.body) {
      throw new Error('El navegador no pudo abrir el canal de respuesta en tiempo real.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const processEvent = (rawEvent) => {
      const eventName = rawEvent.match(/^event: (.+)$/m)?.[1];
      const dataLine = rawEvent.match(/^data: (.+)$/m)?.[1];
      if (!eventName || !dataLine) return;

      const payload = JSON.parse(dataLine);
      if (eventName === 'token') handlers.onToken?.(payload.token || '');
      if (eventName === 'done') handlers.onDone?.(payload.messages || []);
      if (eventName === 'error') throw new Error(payload.error || DEFAULT_ERROR_MESSAGE);
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      events.forEach(processEvent);
    }

    if (buffer.trim()) processEvent(buffer);
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(CHAT_MESSAGE_TIMEOUT_MESSAGE, { cause: error });
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function request(path, options = {}, timeoutMs = CHAT_MESSAGE_TIMEOUT_MS, timeoutMessage = CHAT_MESSAGE_TIMEOUT_MESSAGE) {
  if (API_URL_ERROR) throw new Error(API_URL_ERROR);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`${API_URL.replace(/\/$/, '')}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(timeoutMessage, { cause: error });
    throw new Error(DEFAULT_ERROR_MESSAGE, { cause: error });
  } finally { clearTimeout(timeoutId); }
  if (!response.ok) {
    const fallbackMessage = response.status >= 500 ? 'El servidor no pudo responder correctamente. Probá de nuevo en un momento.' : 'No pudimos completar la solicitud. Revisá los datos e intentá otra vez.';
    throw new Error(await parseHttpError(response, fallbackMessage), { cause: response });
  }
  if (response.status === 204) return null;
  return response.json();
}

export default function ChatShell() {
  const [config, setConfig] = useState({ appName: 'Kabot', appDescription: 'un asistente conversacional en tiempo real para soporte, análisis, creatividad, aprendizaje y automatización', maxUserMessageLength: 4000 });
  const [chats, setChats] = useState([]);
  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(API_URL_ERROR);
  const [chatStatus, setChatStatus] = useState(API_URL_ERROR ? 'error' : 'idle');
  const messagesEndRef = useRef(null);

  const activeChat = useMemo(() => chats.find((chat) => chat.id === chatId), [chats, chatId]);
  const disabled = loading || !input.trim() || Boolean(API_URL_ERROR) || !chatId || chatStatus !== 'ready';
  const remainingCharacters = config.maxUserMessageLength - input.length;

  const refreshChats = useCallback(async () => {
    if (API_URL_ERROR) return [];
    const data = await request('/api/chats', {}, CHAT_INIT_TIMEOUT_MS, CHAT_INIT_TIMEOUT_MESSAGE);
    setChats(data.chats || []);
    return data.chats || [];
  }, []);

  const loadMessages = useCallback(async (nextChatId) => {
    const data = await request(`/api/chats/${nextChatId}/messages`, {}, CHAT_INIT_TIMEOUT_MS, CHAT_INIT_TIMEOUT_MESSAGE);
    setMessages(data.messages || []);
  }, []);

  const initializeChat = useCallback(async () => {
    if (API_URL_ERROR) { setChatStatus('error'); setError(API_URL_ERROR); return; }
    try {
      setLoading(true); setChatStatus('loading'); setError('');
      const [metadata, chatList] = await Promise.all([
        request('/api/config', {}, CHAT_INIT_TIMEOUT_MS, CHAT_INIT_TIMEOUT_MESSAGE),
        refreshChats(),
      ]);
      setConfig((prev) => ({ ...prev, ...metadata }));
      if (chatList.length > 0) {
        setChatId(chatList[0].id);
        await loadMessages(chatList[0].id);
      } else {
        const created = await request('/api/chats', { method: 'POST', body: JSON.stringify({}) }, CHAT_INIT_TIMEOUT_MS, CHAT_INIT_TIMEOUT_MESSAGE);
        setChatId(created.chat.id); setChats([created.chat]); setMessages([]);
      }
      setChatStatus('ready');
    } catch (err) {
      console.error('Error al iniciar Kabot.', err); setChatId(null); setChatStatus('error'); setError(err.message || 'No se pudo iniciar el chat.');
    } finally { setLoading(false); }
  }, [loadMessages, refreshChats]);

  useEffect(() => { initializeChat(); }, [initializeChat]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const createConversation = async () => {
    try {
      setLoading(true); setError('');
      const created = await request('/api/chats', { method: 'POST', body: JSON.stringify({}) }, CHAT_INIT_TIMEOUT_MS, CHAT_INIT_TIMEOUT_MESSAGE);
      setChats((prev) => [created.chat, ...prev]); setChatId(created.chat.id); setMessages([]); setInput(''); setChatStatus('ready');
    } catch (err) { setError(err.message || 'No se pudo crear el chat.'); } finally { setLoading(false); }
  };

  const selectChat = async (selectedChatId) => {
    if (selectedChatId === chatId || loading) return;
    try { setLoading(true); setError(''); setChatId(selectedChatId); await loadMessages(selectedChatId); setChatStatus('ready'); }
    catch (err) { setError(err.message || 'No se pudo cargar la conversación.'); }
    finally { setLoading(false); }
  };

  const deleteActiveChat = async () => {
    if (!chatId || loading) return;
    try {
      setLoading(true); setError(''); await request(`/api/chats/${chatId}`, { method: 'DELETE' }, CHAT_INIT_TIMEOUT_MS, CHAT_INIT_TIMEOUT_MESSAGE);
      const nextChats = chats.filter((chat) => chat.id !== chatId); setChats(nextChats);
      if (nextChats[0]) { setChatId(nextChats[0].id); await loadMessages(nextChats[0].id); } else { setChatId(null); setMessages([]); await createConversation(); }
    } catch (err) { setError(err.message || 'No se pudo eliminar el chat.'); } finally { setLoading(false); }
  };

  const handleSubmit = async (event) => {
    event.preventDefault(); if (disabled) return;
    const prompt = input.trim(); const optimisticUser = { role: 'user', content: prompt, id: crypto.randomUUID() };
    setMessages((prev) => [...prev, optimisticUser]); setInput(''); setLoading(true); setError('');
    const assistantDraftId = crypto.randomUUID();
    setMessages((prev) => [...prev, { role: 'assistant', content: '', id: assistantDraftId, streaming: true }]);
    try {
      await streamRequest(`/api/chats/${chatId}/messages/stream`, { content: prompt }, {
        onToken: (token) => {
          setMessages((prev) => prev.map((message) => (message.id === assistantDraftId ? { ...message, content: `${message.content}${token}` } : message)));
        },
        onDone: (nextMessages) => {
          setMessages(nextMessages);
        },
      });
      await refreshChats();
    } catch (err) {
      console.error('Error al enviar un mensaje.', err); setMessages((prev) => prev.filter((message) => message.id !== optimisticUser.id && message.id !== assistantDraftId)); setInput(prompt); setError(err.message || 'No se pudo enviar el mensaje.');
    } finally { setLoading(false); }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
  };

  const showChatInitializationError = !API_URL_ERROR && chatStatus === 'error';

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-badge">{config.appName}</div>
        <h1>Un asistente conversacional en tiempo real, amplio y listo para producción.</h1>
        <p>{config.appDescription}. Conversá con respuestas progresivas estilo ChatGPT, memoria persistente y una base configurable para múltiples casos de uso.</p>
      </section>

      <section className="workspace">
        <aside className="sidebar">
          <img src="/kabot-mascot.jpg" alt="Mascota de Kabot" className="mascot" />
          <button onClick={createConversation} className="primary-action" disabled={loading || Boolean(API_URL_ERROR)}>+ Nuevo chat</button>
          <div className="chat-list" aria-label="Conversaciones guardadas">
            {chats.map((chat) => (
              <button key={chat.id} onClick={() => selectChat(chat.id)} className={chat.id === chatId ? 'chat-item active' : 'chat-item'} disabled={loading}>
                <span>{chat.title}</span><small>{new Date(chat.updated_at).toLocaleDateString('es-AR')}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="chat-panel">
          <header className="chat-header">
            <div><h2>{activeChat?.title || 'Consola de conversación'}</h2><p>Memoria persistente, streaming de tokens e interacción en tiempo real.</p></div>
            <button onClick={deleteActiveChat} className="ghost-button" disabled={loading || !chatId}>Eliminar</button>
          </header>

          {API_URL_ERROR ? <div className="error-box"><strong>Configuración incompleta del frontend</strong><p>{API_URL_ERROR}</p></div> : null}
          {showChatInitializationError ? <div className="warning-box"><strong>No pudimos iniciar el chat.</strong><p>{error || 'Probá de nuevo sin recargar la página.'}</p><button type="button" onClick={initializeChat} disabled={loading}>Reintentar</button></div> : null}

          <div className="messages-box">
            {messages.length === 0 ? (
              <div className="empty-state"><h3>{chatStatus === 'loading' ? 'Preparando el chat...' : 'Listo para conversar'}</h3><p>Elegí un atajo o escribí tu primer mensaje.</p><div className="prompt-grid">{STARTER_PROMPTS.map((prompt) => <button key={prompt} onClick={() => setInput(prompt)} disabled={loading}>{prompt}</button>)}</div></div>
            ) : messages.map((message, index) => (
              <article key={message.id || `${message.role}-${index}`} className={`message ${message.role === 'user' ? 'user' : 'assistant'}`}>
                <span>{message.role === 'user' ? 'Vos' : config.appName}</span><p>{message.content}{message.streaming ? <span className="stream-cursor" aria-label="respuesta en curso">▍</span> : null}</p>
                {message.role === 'assistant' && message.content ? <button type="button" onClick={() => navigator.clipboard?.writeText(message.content)} className="copy-button">Copiar</button> : null}
              </article>
            ))}
            {loading && messages.length > 0 ? <div className="typing">Respuesta en vivo<span>.</span><span>.</span><span>.</span></div> : null}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="composer">
            <textarea value={input} onChange={(event) => setInput(event.target.value.slice(0, config.maxUserMessageLength))} onKeyDown={handleKeyDown} placeholder="Escribí tu mensaje... Enter envía, Shift+Enter agrega línea" disabled={loading || chatStatus !== 'ready' || Boolean(API_URL_ERROR)} />
            <div className="composer-footer"><span className={error ? 'form-error' : 'counter'}>{error || `${remainingCharacters} caracteres disponibles`}</span><button type="submit" disabled={disabled}>{loading ? 'Pensando...' : 'Enviar'}</button></div>
          </form>
        </section>
      </section>
    </main>
  );
}
