import type { BridgeEnvelope, MessageType } from '../types/index.ts';

/**
 * Message Protocol Builder
 */
export function createEnvelope<T>(
  type: MessageType,
  source: 'web' | 'extension' | 'flow-adapter',
  payload: T,
  requestId?: string
): BridgeEnvelope<T> {
  return {
    id: requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    type,
    source,
    timestamp: Date.now(),
    payload,
  };
}

export function createErrorEnvelope(
  source: 'web' | 'extension' | 'flow-adapter',
  errorCode: string,
  errorMessage: string,
  requestId?: string,
  details?: unknown
): BridgeEnvelope<null> {
  return {
    id: requestId || `err_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    type: 'ERROR',
    source,
    timestamp: Date.now(),
    payload: null,
    error: {
      code: errorCode,
      message: errorMessage,
      details,
    },
  };
}
