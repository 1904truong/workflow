/// <reference types="chrome" />

import {
  BridgeEnvelope,
  FlowConnectionStatus,
  FlowInspection,
  PrepareJobPayload,
} from '@shared/types/index.js';
import { createEnvelope, createErrorEnvelope } from '@shared/messages/index.js';
import { isValidEnvelope } from '@shared/validation/index.js';

interface FlowTabInfo {
  tabId: number;
  url: string;
  isMock: boolean;
}

/**
 * Searches for an open Google Flow tab or local Mock Flow tab
 */
async function findActiveFlowTab(): Promise<FlowTabInfo | null> {
  // Query all tabs to reliably detect real Google Flow or local Mock Flow
  const allTabs = await chrome.tabs.query({});

  // 1. Check real Google Flow tabs (flow.google.com or labs.google)
  const flowMatch = allTabs.find(
    (t: chrome.tabs.Tab) =>
      t.url &&
      (t.url.includes('flow.google.com') ||
        (t.url.includes('labs.google') && (t.url.includes('/flow') || t.url.includes('/fx/'))))
  );
  if (flowMatch && flowMatch.id) {
    return { tabId: flowMatch.id, url: flowMatch.url || '', isMock: false };
  }

  // 2. Check local Mock Flow tabs
  const mockMatch = allTabs.find(
    (t: chrome.tabs.Tab) =>
      t.url &&
      (t.url.includes('mock-flow') ||
        t.url.includes('/tests/mock-flow') ||
        t.title?.toLowerCase().includes('google flow mock') ||
        t.title?.toLowerCase().includes('google flow — project'))
  );
  if (mockMatch && mockMatch.id) {
    return { tabId: mockMatch.id, url: mockMatch.url || '', isMock: true };
  }

  return null;
}

/**
 * Sends a message to the tab with automatic script injection fallback
 */
async function sendToFlowTab<T = unknown, R = unknown>(
  tabId: number,
  envelope: BridgeEnvelope<T>
): Promise<BridgeEnvelope<R>> {
  try {
    const response = (await chrome.tabs.sendMessage(tabId, envelope)) as BridgeEnvelope<R>;
    if (response) return response;
  } catch (err) {
    console.warn('[Flow Bridge SW] Message failed, attempting content script injection...', err);
  }

  // Self-injection attempt
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['dist/flow-content.js'],
    });
    // Brief sleep to allow listener setup
    await new Promise((r) => setTimeout(r, 200));
    return (await chrome.tabs.sendMessage(tabId, envelope)) as BridgeEnvelope<R>;
  } catch (injectErr: unknown) {
    const msg = injectErr instanceof Error ? injectErr.message : String(injectErr);
    return createErrorEnvelope('extension', 'CONTENT_SCRIPT_INJECTION_FAILED', msg, envelope.id) as BridgeEnvelope<R>;
  }
}

/**
 * Main Extension Message Router
 */
chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    // Internal or Web Bridge messages
    if (!isValidEnvelope(message)) {
      sendResponse(
        createErrorEnvelope('extension', 'INVALID_MESSAGE_FORMAT', 'Message does not conform to BridgeEnvelope schema')
      );
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
                'extension',
                {
                  version: '1.0.0',
                  status: 'READY',
                  sender: sender.tab?.url || 'extension-internal',
                },
                envelope.id
              )
            );
            break;
          }

          case 'GET_FLOW_STATUS': {
            const flowTab = await findActiveFlowTab();
            if (!flowTab) {
              sendResponse(
                createEnvelope<{ status: FlowConnectionStatus; message: string }>(
                  'GET_FLOW_STATUS',
                  'extension',
                  {
                    status: 'FLOW_TAB_NOT_FOUND',
                    message: 'No Google Flow or Mock Flow tab detected in Chrome.',
                  },
                  envelope.id
                )
              );
              return;
            }

            // Query the tab
            const inspectionEnvelope = createEnvelope<null>('INSPECT_FLOW', 'extension', null, envelope.id);
            const tabResp = await sendToFlowTab<null, FlowInspection>(flowTab.tabId, inspectionEnvelope);

            if (tabResp.type === 'ERROR' || !tabResp.payload) {
              sendResponse(
                createEnvelope<{ status: FlowConnectionStatus; message: string }>(
                  'GET_FLOW_STATUS',
                  'extension',
                  {
                    status: 'ERROR',
                    message: tabResp.error?.message || 'Failed to inspect Flow tab',
                  },
                  envelope.id
                )
              );
            } else {
              sendResponse(
                createEnvelope<{ status: FlowConnectionStatus; details: FlowInspection }>(
                  'GET_FLOW_STATUS',
                  'extension',
                  {
                    status: tabResp.payload.status,
                    details: tabResp.payload,
                  },
                  envelope.id
                )
              );
            }
            break;
          }

          case 'INSPECT_FLOW': {
            const flowTab = await findActiveFlowTab();
            if (!flowTab) {
              sendResponse(
                createEnvelope<FlowInspection>(
                  'INSPECT_FLOW',
                  'extension',
                  {
                    url: '',
                    isFlowPage: false,
                    isProjectOpen: false,
                    hasPromptInput: false,
                    hasUploadInput: false,
                    hasGenerateButton: false,
                    hasDownloadButton: false,
                    detectedUiVersion: 'None',
                    supportedOperations: [],
                    unsupportedOperations: ['flow_tab_missing'],
                    status: 'FLOW_TAB_NOT_FOUND',
                  },
                  envelope.id
                )
              );
              return;
            }

            const tabResp = await sendToFlowTab<unknown, FlowInspection>(flowTab.tabId, envelope);
            sendResponse(tabResp);
            break;
          }

          case 'PREPARE_JOB': {
            const flowTab = await findActiveFlowTab();
            if (!flowTab) {
              sendResponse(
                createErrorEnvelope('extension', 'FLOW_TAB_NOT_FOUND', 'Cannot prepare job without active Flow tab', envelope.id)
              );
              return;
            }

            const tabResp = await sendToFlowTab<PrepareJobPayload, unknown>(
              flowTab.tabId,
              envelope as BridgeEnvelope<PrepareJobPayload>
            );
            sendResponse(tabResp);
            break;
          }

          case 'TRIGGER_GENERATE': {
            const flowTab = await findActiveFlowTab();
            if (!flowTab) {
              sendResponse(
                createErrorEnvelope('extension', 'FLOW_TAB_NOT_FOUND', 'Cannot generate without active Flow tab', envelope.id)
              );
              return;
            }

            const tabResp = await sendToFlowTab(flowTab.tabId, envelope);
            sendResponse(tabResp);
            break;
          }

          default:
            sendResponse(
              createErrorEnvelope('extension', 'UNSUPPORTED_TYPE', `Unknown message type: ${envelope.type}`, envelope.id)
            );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        sendResponse(createErrorEnvelope('extension', 'INTERNAL_ERROR', msg, envelope.id));
      }
    })();

    return true; // Keep channel open for async response
  }
);

console.log('[Flow Bridge Service Worker] Initialized');
