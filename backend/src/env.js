const DEFAULT_ENV = {
  FRONTEND_URL: 'http://localhost:3000',
  OPENAI_MODEL: 'gpt-4.1-mini',
  APP_NAME: 'Kabot',
  APP_DESCRIPTION: 'un asistente conversacional en tiempo real para soporte, análisis, creatividad, aprendizaje y automatización',
  ASSISTANT_TONE: 'profesional, claro, práctico y cercano',
  ASSISTANT_LANGUAGE: 'español',
  SYSTEM_PROMPT: '',
};

function readEnv(name, fallback) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function normalizeUrl(value) {
  return new URL(value).toString().replace(/\/+$/, '');
}

function ensureFrontendUrls(name, value) {
  const normalizedUrls = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      try {
        return normalizeUrl(entry);
      } catch {
        console.error(
          `Error de configuración: cada origen en ${name} debe ser una URL válida. Valor recibido: ${entry || '(vacío)'}.`
        );
        process.exit(1);
      }
    });

  if (normalizedUrls.length === 0) {
    console.error(
      `Error de configuración: la variable ${name} debe incluir al menos una URL válida separada por comas.`
    );
    process.exit(1);
  }

  return normalizedUrls.join(',');
}

function ensureRequired(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    console.error(
      `Error de configuración: falta la variable obligatoria ${name}. Revisá tu archivo .env o las variables del entorno de despliegue.`
    );
    process.exit(1);
  }

  return value;
}

function buildDefaultSystemPrompt({ appName, appDescription, assistantTone, assistantLanguage }) {
  return [
    `Eres ${appName}, ${appDescription}.`,
    `Tu tono debe ser ${assistantTone}.`,
    `Respondé principalmente en ${assistantLanguage}, salvo que el usuario pida otro idioma.`,
    'Podés ayudar con estrategia, soporte, creatividad, análisis, aprendizaje, planificación, redacción, tecnología y automatización.',
    'Conversá de forma natural, sostené el contexto reciente y adaptá la profundidad de la respuesta a la necesidad del usuario.',
    'Sé concreto, hacé preguntas de aclaración cuando falte contexto y proponé próximos pasos accionables.',
    'Si el usuario pide ayuda para adaptar este asistente a otro proyecto, explicá qué variables, textos y flujos debería cambiar.',
  ].join(' ');
}

const APP_NAME = readEnv('APP_NAME', DEFAULT_ENV.APP_NAME);
const APP_DESCRIPTION = readEnv('APP_DESCRIPTION', DEFAULT_ENV.APP_DESCRIPTION);
const ASSISTANT_TONE = readEnv('ASSISTANT_TONE', DEFAULT_ENV.ASSISTANT_TONE);
const ASSISTANT_LANGUAGE = readEnv('ASSISTANT_LANGUAGE', DEFAULT_ENV.ASSISTANT_LANGUAGE);
const fallbackSystemPrompt = buildDefaultSystemPrompt({
  appName: APP_NAME,
  appDescription: APP_DESCRIPTION,
  assistantTone: ASSISTANT_TONE,
  assistantLanguage: ASSISTANT_LANGUAGE,
});

export const env = {
  DATABASE_URL: ensureRequired('DATABASE_URL'),
  OPENAI_API_KEY: ensureRequired('OPENAI_API_KEY'),
  FRONTEND_URL: ensureFrontendUrls('FRONTEND_URL', readEnv('FRONTEND_URL', DEFAULT_ENV.FRONTEND_URL)),
  OPENAI_MODEL: readEnv('OPENAI_MODEL', DEFAULT_ENV.OPENAI_MODEL),
  APP_NAME,
  APP_DESCRIPTION,
  ASSISTANT_TONE,
  ASSISTANT_LANGUAGE,
  SYSTEM_PROMPT: readEnv('SYSTEM_PROMPT', fallbackSystemPrompt),
};
