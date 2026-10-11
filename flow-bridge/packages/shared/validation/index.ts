import type { BridgeEnvelope, MessageType } from '../types/index.ts';

export const ALLOWED_WEB_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://flowbridge.local',
];

const VALID_MESSAGE_TYPES: Set<MessageType> = new Set([
  'PING',
  'PONG',
  'GET_FLOW_STATUS',
  'INSPECT_FLOW',
  'PREPARE_JOB',
  'TRIGGER_GENERATE',
  'JOB_STATUS',
  'CANCEL_JOB',
  'RESULT_AVAILABLE',
  'ERROR',
]);

/**
 * Validates if the origin is authorized to communicate with Flow Bridge Extension
 */
export function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  // Chrome Extension internal origins
  if (origin.startsWith('chrome-extension://')) return true;
  return ALLOWED_WEB_ORIGINS.includes(origin);
}

/**
 * Validates message envelope structure
 */
export function isValidEnvelope(msg: unknown): msg is BridgeEnvelope {
  if (!msg || typeof msg !== 'object') return false;
  const candidate = msg as Partial<BridgeEnvelope>;

  if (typeof candidate.id !== 'string' || candidate.id.trim() === '') return false;
  if (typeof candidate.type !== 'string' || !VALID_MESSAGE_TYPES.has(candidate.type as MessageType)) {
    return false;
  }
  if (!['web', 'extension', 'flow-adapter'].includes(candidate.source as string)) {
    return false;
  }
  if (typeof candidate.timestamp !== 'number' || candidate.timestamp <= 0) {
    return false;
  }

  return true;
}

/**
 * Sanitizes string input to prevent injection
 */
export function sanitizePrompt(text: string): string {
  if (!text) return '';
  return text.trim().slice(0, 4000);
}
