'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || '';
const API_URL_ERROR = validateApiUrl(API_URL);
const DEFAULT_ERROR_MESSAGE = 'Ocurrió un problema de conexión. Probá de nuevo en unos segundos.';
const CHAT_INIT_TIMEOUT_MS = 10000;
const CHAT_MESSAGE_TIMEOUT_MS = 30000;
const CHAT_INIT_TIMEOUT_MESSAGE = 'La creación del chat está tardando demasiado. Probá de nuevo sin recargar la página.';
const CHAT_MESSAGE_TIMEOUT_MESSAGE = 'La respuesta está tardando demasiado. Cortamos la espera para que no quede “Pensando...” para siempre. Probá de nuevo en unos segundos.';

const THEMES = {
  dark: { label: { es: 'Oscuro', en: 'Dark' }, icon: '●', hint: { es: 'Nocturno', en: 'Night' } },
  blue: { label: { es: 'Azul', en: 'Blue' }, icon: '◆', hint: { es: 'Foco', en: 'Focus' } },
  light: { label: { es: 'Claro', en: 'Light' }, icon: '○', hint: { es: 'Diurno', en: 'Day' } },
  beige: { label: { es: 'Beige', en: 'Beige' }, icon: '◒', hint: { es: 'Cálido', en: 'Warm' } },
};


const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';
const FALLBACK_TIMEZONES = [DEFAULT_TIMEZONE, 'America/New_York', 'Europe/Madrid', 'Asia/Tokyo', 'UTC'];
const BROWSER_TIMEZONES = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : FALLBACK_TIMEZONES;
const TIMEZONES = Array.from(new Set([...BROWSER_TIMEZONES, 'UTC'])).sort();
const FEATURED_TIMEZONES = [DEFAULT_TIMEZONE, 'America/New_York', 'Europe/Madrid', 'Asia/Tokyo'];
const TIMEZONE_REGION_LABELS = {
  Africa: { es: 'África', en: 'Africa' },
  America: { es: 'América', en: 'Americas' },
  Antarctica: { es: 'Antártida', en: 'Antarctica' },
  Arctic: { es: 'Ártico', en: 'Arctic' },
  Asia: { es: 'Asia', en: 'Asia' },
  Atlantic: { es: 'Atlántico', en: 'Atlantic' },
  Australia: { es: 'Australia', en: 'Australia' },
  Europe: { es: 'Europa', en: 'Europe' },
  Indian: { es: 'Índico', en: 'Indian' },
  Pacific: { es: 'Pacífico', en: 'Pacific' },
  UTC: { es: 'UTC', en: 'UTC' },
  Other: { es: 'Otras', en: 'Other' },
};


const COPY = {
  es: {
    heroBadge: 'Versión 1.5.0 · Atlas operativo',
    heroTitle: 'Kabot ahora se siente como un atlas vivo de inteligencia conversacional.',
    heroText: 'Navegá conversaciones, preferencias, exportaciones y todos los husos horarios del planeta como capas de un mapa interactivo. La experiencia 1.5.0 está pensada para coordinar mejor, actuar más rápido y conservar cada insight útil.',
    whyTitle: 'Por qué este diseño es ideal para Kabot',
    whyText: 'El “atlas holográfico” es ideal para Kabot porque convierte un asistente generalista en una herramienta global: las zonas horarias, la conversación y la personalización conviven como capas visuales, reduciendo búsquedas y reforzando una identidad tecnológica memorable.',
    versionLabel: 'Mejoras 1.5.0',
    releaseItems: ['Exportá la conversación en Markdown', 'Atajos de foco para trabajo, estudio y soporte', 'Panel de preparación antes de enviar'],
    newChat: '+ Nuevo chat',
    savedChats: 'Conversaciones guardadas',
    searchChats: 'Buscar conversación...',
    mobilePanel: 'Panel',
    mobileChat: 'Chat',
    density: 'Densidad',
    comfortable: 'Cómoda',
    compact: 'Compacta',
    autoScroll: 'Auto-scroll',
    on: 'Activo',
    off: 'Pausado',
    jumpLatest: 'Ir al último mensaje',
    draftSaved: 'Borrador guardado localmente',
    statsTitle: 'Pulso de la conversación',
    messagesStat: 'mensajes',
    userStat: 'tuyos',
    assistantStat: 'Kabot',
    contextStat: 'ventana IA',
    lastUpdate: 'Última actividad',
    shortcutsTitle: 'Accesos rápidos',
    clearDraft: 'Limpiar borrador',
    exportChat: 'Exportar chat',
    prepTitle: 'Pre-vuelo del mensaje',
    prepReady: 'Listo para enviar',
    prepEmpty: 'Escribí un mensaje para activar el envío',
    focusMode: 'Modo de foco',
    wordLabel: 'palabras',
    focusModes: { strategy: 'Estrategia', learning: 'Aprendizaje', support: 'Soporte' },
    control: 'Personalización',
    language: 'Idioma',
    theme: 'Tema',
    languageSwitch: 'Selector bilingüe',
    themeHint: 'Cambiá el ambiente visual al instante.',
    worldTime: 'Horario mundial',
    worldTimeHint: 'Mostramos todas las zonas horarias disponibles en el navegador para coordinar equipos sin salir del chat.',
    responseStyle: 'Estilo de respuesta',
    concise: 'Conciso',
    balanced: 'Balanceado',
    detailed: 'Detallado',
    delete: 'Eliminar',
    retry: 'Reintentar',
    headerSubtitle: 'Memoria persistente, streaming de tokens, preferencias locales y contexto de uso.',
    initErrorTitle: 'No pudimos iniciar el chat.',
    readyTitle: 'Listo para conversar',
    loadingTitle: 'Preparando el chat...',
    emptyText: 'Elegí un atajo o escribí tu primer mensaje.',
    you: 'Vos',
    copy: 'Copiar',
    copied: 'Copiado',
    typing: 'Respuesta en vivo',
    placeholder: 'Escribí tu mensaje... Enter envía, Shift+Enter agrega línea',
    chars: 'caracteres disponibles',
    thinking: 'Pensando...',
    send: 'Enviar',
    apiConfigTitle: 'Configuración incompleta del frontend',
    prompts: [
      'Analizá esta idea de negocio y proponé próximos pasos.',
      'Actuá como tutor y explicame un tema complejo paso a paso.',
      'Ayudame a escribir, revisar o mejorar un texto profesional.',
    ],
    timezoneSearch: 'Buscar zona horaria...',
    timezoneCount: 'zonas horarias',
    featuredTimezones: 'Destacadas',
    allTimezones: 'Todas las zonas horarias',
    noTimezones: 'No encontramos zonas con ese filtro.',
  },
  en: {
    heroBadge: 'Version 1.5.0 · Operational atlas',
    heroTitle: 'Kabot now feels like a living atlas of conversational intelligence.',
    heroText: 'Navigate conversations, preferences, exports, and every world time zone as layers of an interactive map. The 1.5.0 experience helps teams coordinate, act faster, and preserve every useful insight.',
    whyTitle: 'Why this design is ideal for Kabot',
    whyText: 'The “holographic atlas” is ideal for Kabot because it turns a general assistant into a global tool: time zones, conversation, and personalization coexist as visual layers, reducing lookup friction while creating a memorable tech identity.',
    versionLabel: '1.5.0 improvements',
    releaseItems: ['Export the conversation as Markdown', 'Focus shortcuts for work, learning, and support', 'Pre-flight panel before sending'],
    newChat: '+ New chat',
    savedChats: 'Saved conversations',
    searchChats: 'Search conversation...',
    mobilePanel: 'Panel',
    mobileChat: 'Chat',
    density: 'Density',
    comfortable: 'Comfortable',
    compact: 'Compact',
    autoScroll: 'Auto-scroll',
    on: 'On',
    off: 'Paused',
    jumpLatest: 'Jump to latest',
    draftSaved: 'Draft saved locally',
    statsTitle: 'Conversation pulse',
    messagesStat: 'messages',
    userStat: 'yours',
    assistantStat: 'Kabot',
    contextStat: 'AI window',
    lastUpdate: 'Last activity',
    shortcutsTitle: 'Quick actions',
    clearDraft: 'Clear draft',
    exportChat: 'Export chat',
    prepTitle: 'Message pre-flight',
    prepReady: 'Ready to send',
    prepEmpty: 'Write a message to enable sending',
    focusMode: 'Focus mode',
    wordLabel: 'words',
    focusModes: { strategy: 'Strategy', learning: 'Learning', support: 'Support' },
    control: 'Personalization',
    language: 'Language',
    theme: 'Theme',
    languageSwitch: 'Bilingual switch',
    themeHint: 'Change the visual mood instantly.',
    worldTime: 'World time',
    worldTimeHint: 'We show every time zone available in the browser so teams can coordinate without leaving chat.',
    responseStyle: 'Response style',
    concise: 'Concise',
    balanced: 'Balanced',
    detailed: 'Detailed',
    delete: 'Delete',
    retry: 'Retry',
    headerSubtitle: 'Persistent memory, token streaming, local preferences, and usage context.',
    initErrorTitle: 'We could not start the chat.',
    readyTitle: 'Ready to chat',
    loadingTitle: 'Preparing chat...',
    emptyText: 'Choose a shortcut or write your first message.',
    you: 'You',
    copy: 'Copy',
    copied: 'Copied',
    typing: 'Live response',
    placeholder: 'Type your message... Enter sends, Shift+Enter adds a line',
    chars: 'characters available',
    thinking: 'Thinking...',
    send: 'Send',
    apiConfigTitle: 'Incomplete frontend configuration',
    prompts: [
      'Analyze this business idea and propose next steps.',
      'Act as a tutor and explain a complex topic step by step.',
      'Help me write, review, or improve a professional text.',
    ],
    timezoneSearch: 'Search time zone...',
    timezoneCount: 'time zones',
    featuredTimezones: 'Featured',
    allTimezones: 'All time zones',
    noTimezones: 'No zones match that filter.',
  },
};

function getTimezoneLabel(zone, language = 'es') {
  if (zone === 'UTC') return 'UTC';
  const city = zone.split('/').pop()?.replace(/_/g, ' ') || zone;
  const region = zone.split('/')[0] || 'UTC';
  const translatedRegion = TIMEZONE_REGION_LABELS[region]?.[language] || region;
  return `${city} · ${translatedRegion}`;
}

function getTimezoneRegion(zone) {
  return zone.includes('/') ? zone.split('/')[0] : zone;
}

function validateApiUrl(value) {
  if (!value) return 'Falta la variable de entorno NEXT_PUBLIC_API_URL. Configurala para conectar el frontend con el backend.';
  try { return new URL(value).toString() ? '' : 'La variable NEXT_PUBLIC_API_URL no es válida.'; } catch { return 'La variable de entorno NEXT_PUBLIC_API_URL debe ser una URL válida.'; }
}

async function parseHttpError(response, fallbackMessage) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try { const data = await response.json(); if (typeof data?.error === 'string' && data.error.trim()) return data.error.trim(); }
    catch (error) { console.error('No se pudo interpretar la respuesta de error del backend.', error); }
  }
  return fallbackMessage;
}

async function streamRequest(path, body, handlers = {}) {
  if (API_URL_ERROR) throw new Error(API_URL_ERROR);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CHAT_MESSAGE_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL.replace(/\/$/, '')}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify(body), signal: controller.signal });
    if (!response.ok) throw new Error(await parseHttpError(response, response.status >= 500 ? 'El servidor no pudo responder correctamente. Probá de nuevo en un momento.' : 'No pudimos completar la solicitud. Revisá los datos e intentá otra vez.'), { cause: response });
    if (!response.body) throw new Error('El navegador no pudo abrir el canal de respuesta en tiempo real.');
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
    const processEvent = (rawEvent) => {
      const eventName = rawEvent.match(/^event: (.+)$/m)?.[1]; const dataLine = rawEvent.match(/^data: (.+)$/m)?.[1]; if (!eventName || !dataLine) return;
      const payload = JSON.parse(dataLine);
      if (eventName === 'token') handlers.onToken?.(payload.token || '');
      if (eventName === 'done') handlers.onDone?.(payload.messages || []);
      if (eventName === 'error') throw new Error(payload.error || DEFAULT_ERROR_MESSAGE);
    };
    while (true) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const events = buffer.split('\n\n'); buffer = events.pop() || ''; events.forEach(processEvent); }
    if (buffer.trim()) processEvent(buffer);
  } catch (error) { if (error?.name === 'AbortError') throw new Error(CHAT_MESSAGE_TIMEOUT_MESSAGE, { cause: error }); throw error; }
  finally { clearTimeout(timeoutId); }
}

async function request(path, options = {}, timeoutMs = CHAT_MESSAGE_TIMEOUT_MS, timeoutMessage = CHAT_MESSAGE_TIMEOUT_MESSAGE) {
  if (API_URL_ERROR) throw new Error(API_URL_ERROR);
  const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), timeoutMs); let response;
  try { response = await fetch(`${API_URL.replace(/\/$/, '')}${path}`, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options, signal: controller.signal }); }
  catch (error) { if (error?.name === 'AbortError') throw new Error(timeoutMessage, { cause: error }); throw new Error(DEFAULT_ERROR_MESSAGE, { cause: error }); }
  finally { clearTimeout(timeoutId); }
  if (!response.ok) throw new Error(await parseHttpError(response, response.status >= 500 ? 'El servidor no pudo responder correctamente. Probá de nuevo en un momento.' : 'No pudimos completar la solicitud. Revisá los datos e intentá otra vez.'), { cause: response });
  if (response.status === 204) return null;
  return response.json();
}

export default function ChatShell() {
  const [config, setConfig] = useState({ appName: 'Kabot', appDescription: 'un asistente conversacional en tiempo real para soporte, análisis, creatividad, aprendizaje y automatización', maxUserMessageLength: 4000, chatContextWindowSize: 16 });
  const [chats, setChats] = useState([]); const [chatId, setChatId] = useState(null); const [messages, setMessages] = useState([]); const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false); const [error, setError] = useState(API_URL_ERROR); const [chatStatus, setChatStatus] = useState(API_URL_ERROR ? 'error' : 'idle');
  const [theme, setTheme] = useState('dark'); const [language, setLanguage] = useState('es'); const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE); const [timezoneFilter, setTimezoneFilter] = useState(''); const [responseStyle, setResponseStyle] = useState('balanced'); const [focusMode, setFocusMode] = useState('strategy'); const [density, setDensity] = useState('comfortable'); const [autoScroll, setAutoScroll] = useState(true); const [mobileView, setMobileView] = useState('chat'); const [chatFilter, setChatFilter] = useState(''); const [clock, setClock] = useState(new Date()); const [copiedId, setCopiedId] = useState('');
  const messagesEndRef = useRef(null);
  const t = COPY[language];
  const activeChat = useMemo(() => chats.find((chat) => chat.id === chatId), [chats, chatId]);
  const filteredChats = useMemo(() => chats.filter((chat) => chat.title.toLowerCase().includes(chatFilter.trim().toLowerCase())), [chats, chatFilter]);
  const messageStats = useMemo(() => ({ total: messages.length, user: messages.filter((message) => message.role === 'user').length, assistant: messages.filter((message) => message.role === 'assistant').length }), [messages]);
  const disabled = loading || !input.trim() || Boolean(API_URL_ERROR) || !chatId || chatStatus !== 'ready';
  const remainingCharacters = config.maxUserMessageLength - input.length;
  const inputWordCount = input.trim() ? input.trim().split(/\s+/).length : 0;
  const locale = language === 'es' ? 'es-AR' : 'en-US';
  const timezoneLabel = useMemo(() => getTimezoneLabel(timezone, language), [timezone, language]);
  const worldTime = useMemo(() => new Intl.DateTimeFormat(locale, { timeZone: timezone, hour: '2-digit', minute: '2-digit', weekday: 'short', day: '2-digit', month: 'short' }).format(clock), [clock, locale, timezone]);
  const featuredClockCards = useMemo(() => FEATURED_TIMEZONES.map((zone) => ({
    zone,
    city: getTimezoneLabel(zone, language),
    time: new Intl.DateTimeFormat(locale, { timeZone: zone, hour: '2-digit', minute: '2-digit' }).format(clock),
    date: new Intl.DateTimeFormat(locale, { timeZone: zone, weekday: 'short', day: '2-digit', month: 'short' }).format(clock),
  })), [clock, language, locale]);
  const filteredTimezones = useMemo(() => {
    const filter = timezoneFilter.trim().toLowerCase();
    return TIMEZONES.filter((zone) => `${zone} ${getTimezoneLabel(zone, language)}`.toLowerCase().includes(filter));
  }, [language, timezoneFilter]);
  const groupedTimezones = useMemo(() => filteredTimezones.reduce((groups, zone) => {
    const region = getTimezoneRegion(zone);
    const key = TIMEZONE_REGION_LABELS[region]?.[language] || region;
    return { ...groups, [key]: [...(groups[key] || []), zone] };
  }, {}), [filteredTimezones, language]);

  useEffect(() => { const saved = JSON.parse(localStorage.getItem('kabot.preferences.v2') || '{}'); setTheme(saved.theme || 'dark'); setLanguage(saved.language || 'es'); setTimezone(TIMEZONES.includes(saved.timezone) ? saved.timezone : DEFAULT_TIMEZONE); setResponseStyle(saved.responseStyle || 'balanced'); setFocusMode(saved.focusMode || 'strategy'); setDensity(saved.density || 'comfortable'); setAutoScroll(saved.autoScroll ?? true); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('kabot.preferences.v2', JSON.stringify({ theme, language, timezone, responseStyle, focusMode, density, autoScroll })); }, [theme, language, timezone, responseStyle, focusMode, density, autoScroll]);
  useEffect(() => { const id = setInterval(() => setClock(new Date()), 30000); return () => clearInterval(id); }, []);
  useEffect(() => { if (!chatId) return; setInput(localStorage.getItem(`kabot.draft.${chatId}`) || ''); }, [chatId]);
  useEffect(() => { if (!chatId) return; localStorage.setItem(`kabot.draft.${chatId}`, input); }, [chatId, input]);

  const refreshChats = useCallback(async () => { if (API_URL_ERROR) return []; const data = await request('/api/chats', {}, CHAT_INIT_TIMEOUT_MS, CHAT_INIT_TIMEOUT_MESSAGE); setChats(data.chats || []); return data.chats || []; }, []);
  const loadMessages = useCallback(async (nextChatId) => { const data = await request(`/api/chats/${nextChatId}/messages`, {}, CHAT_INIT_TIMEOUT_MS, CHAT_INIT_TIMEOUT_MESSAGE); setMessages(data.messages || []); }, []);
  const initializeChat = useCallback(async () => { if (API_URL_ERROR) { setChatStatus('error'); setError(API_URL_ERROR); return; } try { setLoading(true); setChatStatus('loading'); setError(''); const [metadata, chatList] = await Promise.all([request('/api/config', {}, CHAT_INIT_TIMEOUT_MS, CHAT_INIT_TIMEOUT_MESSAGE), refreshChats()]); setConfig((prev) => ({ ...prev, ...metadata })); if (chatList.length > 0) { setChatId(chatList[0].id); await loadMessages(chatList[0].id); } else { const created = await request('/api/chats', { method: 'POST', body: JSON.stringify({}) }, CHAT_INIT_TIMEOUT_MS, CHAT_INIT_TIMEOUT_MESSAGE); setChatId(created.chat.id); setChats([created.chat]); setMessages([]); } setChatStatus('ready'); } catch (err) { console.error('Error al iniciar Kabot.', err); setChatId(null); setChatStatus('error'); setError(err.message || 'No se pudo iniciar el chat.'); } finally { setLoading(false); } }, [loadMessages, refreshChats]);
  useEffect(() => { initializeChat(); }, [initializeChat]);
  useEffect(() => { if (autoScroll) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading, autoScroll]);

  const createConversation = async () => { try { setLoading(true); setError(''); const created = await request('/api/chats', { method: 'POST', body: JSON.stringify({}) }, CHAT_INIT_TIMEOUT_MS, CHAT_INIT_TIMEOUT_MESSAGE); setChats((prev) => [created.chat, ...prev]); setChatId(created.chat.id); setMessages([]); setInput(''); setChatStatus('ready'); setMobileView('chat'); } catch (err) { setError(err.message || 'No se pudo crear el chat.'); } finally { setLoading(false); } };
  const selectChat = async (selectedChatId) => { if (selectedChatId === chatId || loading) return; try { setLoading(true); setError(''); setChatId(selectedChatId); await loadMessages(selectedChatId); setChatStatus('ready'); setMobileView('chat'); } catch (err) { setError(err.message || 'No se pudo cargar la conversación.'); } finally { setLoading(false); } };
  const deleteActiveChat = async () => { if (!chatId || loading) return; try { setLoading(true); setError(''); await request(`/api/chats/${chatId}`, { method: 'DELETE' }, CHAT_INIT_TIMEOUT_MS, CHAT_INIT_TIMEOUT_MESSAGE); const nextChats = chats.filter((chat) => chat.id !== chatId); setChats(nextChats); if (nextChats[0]) { setChatId(nextChats[0].id); await loadMessages(nextChats[0].id); } else { setChatId(null); setMessages([]); await createConversation(); } } catch (err) { setError(err.message || 'No se pudo eliminar el chat.'); } finally { setLoading(false); } };
  const handleSubmit = async (event) => { event.preventDefault(); if (disabled) return; const styleInstruction = language === 'es' ? `\n\nPreferencias del usuario: idioma ${language}, respuesta ${responseStyle}, modo de foco ${t.focusModes[focusMode]}, horario de referencia ${timezoneLabel} ${worldTime}.` : `\n\nUser preferences: language ${language}, ${responseStyle} response, focus mode ${t.focusModes[focusMode]}, reference time ${timezoneLabel} ${worldTime}.`; const prompt = `${input.trim()}${styleInstruction}`; const visiblePrompt = input.trim(); const optimisticUser = { role: 'user', content: visiblePrompt, id: crypto.randomUUID() }; setMessages((prev) => [...prev, optimisticUser]); setInput(''); localStorage.removeItem(`kabot.draft.${chatId}`); setLoading(true); setError(''); const assistantDraftId = crypto.randomUUID(); setMessages((prev) => [...prev, { role: 'assistant', content: '', id: assistantDraftId, streaming: true }]); try { await streamRequest(`/api/chats/${chatId}/messages/stream`, { content: prompt }, { onToken: (token) => setMessages((prev) => prev.map((message) => (message.id === assistantDraftId ? { ...message, content: `${message.content}${token}` } : message))), onDone: (nextMessages) => setMessages(nextMessages) }); await refreshChats(); } catch (err) { console.error('Error al enviar un mensaje.', err); setMessages((prev) => prev.filter((message) => message.id !== optimisticUser.id && message.id !== assistantDraftId)); setInput(visiblePrompt); setError(err.message || 'No se pudo enviar el mensaje.'); } finally { setLoading(false); } };
  const handleKeyDown = (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } };
  const copyMessage = async (message) => { await navigator.clipboard?.writeText(message.content); setCopiedId(message.id || message.content.slice(0, 16)); setTimeout(() => setCopiedId(''), 1200); };
  const exportTranscript = () => { if (!messages.length) return; const title = activeChat?.title || config.appName; const markdown = [`# ${title}`, '', `- ${t.lastUpdate}: ${new Date().toLocaleString(locale)}`, `- ${t.focusMode}: ${t.focusModes[focusMode]}`, ''].concat(messages.map((message) => `## ${message.role === 'user' ? t.you : config.appName}\n\n${message.content}`)).join('\n\n'); const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'kabot-chat'}.md`; link.click(); URL.revokeObjectURL(url); };
  const showChatInitializationError = !API_URL_ERROR && chatStatus === 'error';

  return <main className={`page-shell density-${density}`}>
    <section className="hero cockpit-card"><div><div className="hero-badge">{t.heroBadge}</div><h1>{t.heroTitle}</h1><p>{t.heroText}</p></div><aside className="why-card"><strong>{t.versionLabel}</strong><ul className="release-list">{t.releaseItems.map((item) => <li key={item}>{item}</li>)}</ul><strong>{t.whyTitle}</strong><p>{t.whyText}</p></aside></section>
    <nav className="mobile-switch" aria-label="Mobile view"><button type="button" className={mobileView === 'panel' ? 'active' : ''} onClick={() => setMobileView('panel')}>{t.mobilePanel}</button><button type="button" className={mobileView === 'chat' ? 'active' : ''} onClick={() => setMobileView('chat')}>{t.mobileChat}</button></nav>
    <section className="workspace">
      <aside className={`sidebar cockpit-card ${mobileView === 'panel' ? 'mobile-visible' : ''}`}><img src="/kabot-mascot.jpg" alt="Mascota de Kabot" className="mascot" /><button onClick={createConversation} className="primary-action" disabled={loading || Boolean(API_URL_ERROR)}>{t.newChat}</button><section className="control-panel" aria-label={t.control}><h2>{t.control}</h2><div className="language-card"><span>{t.languageSwitch}</span><div className="segmented-control" role="group" aria-label={t.language}>{['es', 'en'].map((option) => <button key={option} type="button" className={language === option ? 'active' : ''} onClick={() => setLanguage(option)}>{option === 'es' ? 'ES Español' : 'EN English'}</button>)}</div></div><div><span>{t.theme}</span><small>{t.themeHint}</small><div className="theme-grid">{Object.entries(THEMES).map(([key, item]) => <button key={key} type="button" className={theme === key ? 'theme active' : 'theme'} onClick={() => setTheme(key)}><strong>{item.icon} {item.label[language]}</strong><small>{item.hint[language]}</small></button>)}</div></div><label className="timezone-picker">{t.worldTime}<select value={timezone} onChange={(e) => setTimezone(e.target.value)}>{TIMEZONES.map((zone) => <option key={zone} value={zone}>{getTimezoneLabel(zone, language)} — {zone}</option>)}</select><small>{TIMEZONES.length} {t.timezoneCount}. {t.worldTimeHint}</small></label><div className="world-clock"><strong>{timezoneLabel}</strong><span>{worldTime}</span></div><div className="world-clock-grid" aria-label={t.featuredTimezones}>{featuredClockCards.map((item) => <button key={item.zone} type="button" className={timezone === item.zone ? 'active' : ''} onClick={() => setTimezone(item.zone)}><span>{item.city}</span><strong>{item.time}</strong><small>{item.date}</small></button>)}</div><section className="timezone-atlas" aria-label={t.allTimezones}><div><strong>{t.allTimezones}</strong><small>{filteredTimezones.length} / {TIMEZONES.length} {t.timezoneCount}</small></div><input value={timezoneFilter} onChange={(event) => setTimezoneFilter(event.target.value)} placeholder={t.timezoneSearch} aria-label={t.timezoneSearch} />{filteredTimezones.length ? <div className="timezone-region-list">{Object.entries(groupedTimezones).map(([region, zones]) => <details key={region} open={timezoneFilter.trim().length > 0 || region === (TIMEZONE_REGION_LABELS.America[language])}><summary>{region}<span>{zones.length}</span></summary><div>{zones.map((zone) => <button key={zone} type="button" className={timezone === zone ? 'active' : ''} onClick={() => setTimezone(zone)}><span>{getTimezoneLabel(zone, language)}</span><small>{zone}</small></button>)}</div></details>)}</div> : <p>{t.noTimezones}</p>}</section><label>{t.responseStyle}<select value={responseStyle} onChange={(e) => setResponseStyle(e.target.value)}><option value="concise">{t.concise}</option><option value="balanced">{t.balanced}</option><option value="detailed">{t.detailed}</option></select></label><label>{t.focusMode}<select value={focusMode} onChange={(e) => setFocusMode(e.target.value)}>{Object.entries(t.focusModes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>{t.density}<select value={density} onChange={(e) => setDensity(e.target.value)}><option value="comfortable">{t.comfortable}</option><option value="compact">{t.compact}</option></select></label><button type="button" className="theme" onClick={() => setAutoScroll((value) => !value)}>{t.autoScroll}: {autoScroll ? t.on : t.off}</button></section><section className="conversation-pulse"><h2>{t.statsTitle}</h2><div><strong>{messageStats.total}</strong><span>{t.messagesStat}</span></div><div><strong>{messageStats.user}</strong><span>{t.userStat}</span></div><div><strong>{messageStats.assistant}</strong><span>{t.assistantStat}</span></div><div><strong>{config.chatContextWindowSize}</strong><span>{t.contextStat}</span></div><small>{t.lastUpdate}: {activeChat ? new Date(activeChat.updated_at).toLocaleString(language === 'es' ? 'es-AR' : 'en-US') : '—'}</small></section><input className="chat-search" value={chatFilter} onChange={(event) => setChatFilter(event.target.value)} placeholder={t.searchChats} aria-label={t.searchChats} /><div className="chat-list" aria-label={t.savedChats}>{filteredChats.map((chat) => <button key={chat.id} onClick={() => selectChat(chat.id)} className={chat.id === chatId ? 'chat-item active' : 'chat-item'} disabled={loading}><span>{chat.title}</span><small>{new Date(chat.updated_at).toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US')}</small></button>)}</div></aside>
      <section className={`chat-panel cockpit-card ${mobileView === 'chat' ? 'mobile-visible' : ''}`}><header className="chat-header"><div><h2>{activeChat?.title || 'Kabot'}</h2><p>{t.headerSubtitle}</p></div><div className="header-actions"><button type="button" onClick={() => setAutoScroll(true)} className="ghost-button">{t.jumpLatest}</button><button type="button" onClick={exportTranscript} className="ghost-button" disabled={!messages.length}>{t.exportChat}</button><button onClick={deleteActiveChat} className="ghost-button" disabled={loading || !chatId}>{t.delete}</button></div></header>{API_URL_ERROR ? <div className="error-box"><strong>{t.apiConfigTitle}</strong><p>{API_URL_ERROR}</p></div> : null}{showChatInitializationError ? <div className="warning-box"><strong>{t.initErrorTitle}</strong><p>{error || 'Probá de nuevo sin recargar la página.'}</p><button type="button" onClick={initializeChat} disabled={loading}>{t.retry}</button></div> : null}<div className="messages-box">{messages.length === 0 ? <div className="empty-state"><h3>{chatStatus === 'loading' ? t.loadingTitle : t.readyTitle}</h3><p>{t.emptyText}</p><div className="prompt-grid">{t.prompts.map((prompt) => <button key={prompt} onClick={() => setInput(prompt)} disabled={loading}>{prompt}</button>)}</div></div> : messages.map((message, index) => <article key={message.id || `${message.role}-${index}`} className={`message ${message.role === 'user' ? 'user' : 'assistant'}`}><span>{message.role === 'user' ? t.you : config.appName}</span><p>{message.content}{message.streaming ? <span className="stream-cursor" aria-label="respuesta en curso">▍</span> : null}</p>{message.role === 'assistant' && message.content ? <button type="button" onClick={() => copyMessage(message)} className="copy-button">{copiedId === (message.id || message.content.slice(0, 16)) ? t.copied : t.copy}</button> : null}</article>)}{loading && messages.length > 0 ? <div className="typing">{t.typing}<span>.</span><span>.</span><span>.</span></div> : null}<div ref={messagesEndRef} /></div><form onSubmit={handleSubmit} className="composer"><div className="preflight-card"><strong>{t.prepTitle}</strong><span>{input.trim() ? t.prepReady : t.prepEmpty}</span><small>{inputWordCount} {t.wordLabel} · {remainingCharacters} {t.chars} · {t.focusModes[focusMode]}</small></div><div className="composer-tools"><strong>{t.shortcutsTitle}</strong><button type="button" onClick={() => setInput('')} disabled={!input}>{t.clearDraft}</button><span>{input ? t.draftSaved : ''}</span></div><textarea value={input} onFocus={() => setAutoScroll(false)} onChange={(event) => setInput(event.target.value.slice(0, config.maxUserMessageLength))} onKeyDown={handleKeyDown} placeholder={t.placeholder} disabled={loading || chatStatus !== 'ready' || Boolean(API_URL_ERROR)} /><div className="composer-footer"><span className={error ? 'form-error' : 'counter'}>{error || `${remainingCharacters} ${t.chars}`}</span><button type="submit" disabled={disabled}>{loading ? t.thinking : t.send}</button></div></form></section>
    </section>
  </main>;
}
