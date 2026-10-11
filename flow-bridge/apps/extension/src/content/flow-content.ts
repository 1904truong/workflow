/// <reference types="chrome" />

import { GoogleFlowAdapter } from '../adapters/flow-adapter.js';
import { BridgeEnvelope, FlowInspection, PrepareJobPayload } from '@shared/types/index.js';
import { createEnvelope, createErrorEnvelope } from '@shared/messages/index.js';
import { isValidEnvelope } from '@shared/validation/index.js';

const adapter = new GoogleFlowAdapter(document);

console.log('[Flow Bridge Content Script] Loaded on', location.href);

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    if (!isValidEnvelope(message)) {
      sendResponse(createErrorEnvelope('flow-adapter', 'INVALID_MESSAGE', 'Malformed message envelope'));
      return false;
    }

    const envelope = message as BridgeEnvelope;

    (async () => {
      try {
        switch (envelope.type) {
          case 'PING': {
            sendResponse(
              createEnvelope(
                'PONG',
                'flow-adapter',
                {
                  url: location.href,
                  isProject: adapter.isProjectOpen(),
                },
                envelope.id
              )
            );
            break;
          }

          case 'INSPECT_FLOW': {
            const inspection: FlowInspection = await adapter.inspect();
            sendResponse(createEnvelope('INSPECT_FLOW', 'flow-adapter', inspection, envelope.id));
            break;
          }

          case 'PREPARE_JOB': {
            const payload = envelope.payload as PrepareJobPayload;
            if (!payload || !payload.prompt) {
              sendResponse(
                createErrorEnvelope('flow-adapter', 'INVALID_PAYLOAD', 'Prompt text is required', envelope.id)
              );
              return;
            }

            const res = await adapter.preparePrompt(payload.prompt);
            if (!res.success) {
              sendResponse(
                createErrorEnvelope('flow-adapter', 'PREPARATION_FAILED', res.error || 'Failed to prepare prompt', envelope.id)
              );
            } else {
              sendResponse(
                createEnvelope(
                  'PREPARE_JOB',
                  'flow-adapter',
                  {
                    status: 'PREPARED',
                    method: res.method,
                    prompt: payload.prompt,
                    actualValue: res.actualValue,
                  },
                  envelope.id
                )
              );
            }
            break;
          }

          case 'TRIGGER_GENERATE': {
            const payload = envelope.payload as { prompt?: string };
            const promptText = payload?.prompt || 'Create a beautiful landscape photograph of a green mountain under a clear blue sky.';

            // 1. Prepare and place prompt
            const prep = await adapter.preparePrompt(promptText);
            if (!prep.success) {
              sendResponse(
                createErrorEnvelope('flow-adapter', 'PREPARATION_FAILED', prep.error || 'Failed to enter prompt', envelope.id)
              );
              return;
            }

            // 2. Count images before generation
            const beforeImgs = adapter.getGeneratedImages();
            const beforeCount = beforeImgs.length;

            // 3. Locate submit button
            const submitBtn = adapter.findGenerateButton();
            if (!submitBtn) {
              sendResponse(
                createErrorEnvelope('flow-adapter', 'GENERATE_BUTTON_NOT_FOUND', 'Could not locate submit button in prompt bar', envelope.id)
              );
              return;
            }

            // 4. Click once (strictly 1 single request, no auto-retry)
            submitBtn.click();
            const startTime = Date.now();

            // 5. Monitor for completion (poll for new image up to 90s)
            let completed = false;
            let newestImgUrl = '';
            for (let i = 0; i < 90; i++) {
              await new Promise((r) => setTimeout(r, 1000));
              const currentImgs = adapter.getGeneratedImages();
              if (currentImgs.length > beforeCount) {
                completed = true;
                newestImgUrl = currentImgs[0].src;
                break;
              }
            }

            const timeTakenMs = Date.now() - startTime;
            if (completed) {
              sendResponse(
                createEnvelope(
                  'TRIGGER_GENERATE',
                  'flow-adapter',
                  {
                    status: 'GENERATED',
                    prompt: promptText,
                    beforeCount,
                    afterCount: beforeCount + 1,
                    timeTakenMs,
                    imageUrl: newestImgUrl,
                  },
                  envelope.id
                )
              );
            } else {
              sendResponse(
                createEnvelope(
                  'TRIGGER_GENERATE',
                  'flow-adapter',
                  {
                    status: 'TIMEOUT_OR_PENDING',
                    prompt: promptText,
                    beforeCount,
                    message: 'Submitted successfully. Generation still in progress or manual review required.',
                    timeTakenMs,
                  },
                  envelope.id
                )
              );
            }
            break;
          }

          default:
            sendResponse(
              createErrorEnvelope('flow-adapter', 'UNKNOWN_COMMAND', `Unsupported type: ${envelope.type}`, envelope.id)
            );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        sendResponse(createErrorEnvelope('flow-adapter', 'EXECUTION_ERROR', msg, envelope.id));
      }
    })();

    return true;
  }
);
