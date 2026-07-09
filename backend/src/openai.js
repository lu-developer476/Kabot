import OpenAI from 'openai';
import { env } from './env.js';

const OPENAI_TIMEOUT_MS = 25000;

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  timeout: OPENAI_TIMEOUT_MS,
});

function normalizeOpenAiError(error) {
  if (error?.status === 408 || error?.code === 'ETIMEDOUT' || error?.name === 'AbortError') {
    return new Error('OpenAI tardó demasiado en responder.');
  }

  return error;
}

export async function generateAssistantReply(messages) {
  try {
    const completion = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages,
      temperature: 0.7,
    });

    return completion.choices?.[0]?.message?.content?.trim() || 'No pude generar una respuesta.';
  } catch (error) {
    throw normalizeOpenAiError(error);
  }
}

export async function streamAssistantReply(messages, { signal, onToken } = {}) {
  try {
    const stream = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages,
      temperature: 0.7,
      stream: true,
    }, { signal });

    let fullReply = '';

    for await (const chunk of stream) {
      if (signal?.aborted) {
        break;
      }

      const token = chunk.choices?.[0]?.delta?.content || '';
      if (!token) {
        continue;
      }

      fullReply += token;
      onToken?.(token);
    }

    return fullReply.trim() || 'No pude generar una respuesta.';
  } catch (error) {
    throw normalizeOpenAiError(error);
  }
}
