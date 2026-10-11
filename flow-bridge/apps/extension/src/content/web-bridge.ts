/// <reference types="chrome" />

import { BridgeEnvelope } from '@shared/types/index.js';
import { isAllowedOrigin, isValidEnvelope } from '@shared/validation/index.js';
import { createErrorEnvelope } from '@shared/messages/index.js';

console.log('[Flow Bridge Web-Bridge] Injected on', window.location.origin);

// Announce extension presence to the web page
window.postMessage(
  {
    type: 'EXTENSION_DETECTED',
    source: 'extension',
    payload: { version: '1.0.0', ready: true },
  },
  window.location.origin
);

window.addEventListener('message', async (event: MessageEvent) => {
  // 1. Strict Origin Validation
  if (event.source !== window || !isAllowedOrigin(event.origin)) {
    return;
  }

  // 2. Ignore messages originating from extension itself to avoid infinite loop
  const rawData = event.data;
  if (!rawData || typeof rawData !== 'object' || (rawData as { source?: string }).source !== 'web') {
    return;
  }

  // 3. Envelope Validation
  if (!isValidEnvelope(rawData)) {
    const errorEnv = createErrorEnvelope(
      'extension',
      'MALFORMED_MESSAGE',
      'The message does not match BridgeEnvelope schema'
    );
    window.postMessage(errorEnv, event.origin);
    return;
  }

  const envelope = rawData as BridgeEnvelope;

  try {
    // 4. Forward message to Extension Background Service Worker
    const response = await chrome.runtime.sendMessage(envelope);
    window.postMessage(response, event.origin);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const errEnv = createErrorEnvelope('extension', 'EXTENSION_UNAVAILABLE', msg, envelope.id);
    window.postMessage(errEnv, event.origin);
  }
});
