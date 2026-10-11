// Background Service Worker for Flow Bridge
console.log("Flow Bridge Background Service Worker initialized.");

async function findFlowTab() {
  // 1. Google Flow tabs
  const realTabs = await chrome.tabs.query({ url: "https://labs.google/*" });
  const flowTab = realTabs.find(t => t.url && (t.url.includes('/flow') || t.url.includes('/fx/')));
  if (flowTab && flowTab.id) return { tabId: flowTab.id, url: flowTab.url || '', isMock: false };

  // 2. Mock Flow tabs
  const allTabs = await chrome.tabs.query({});
  const mockTab = allTabs.find(t => 
    t.url && (t.url.includes('mock-flow') || t.title?.toLowerCase().includes('google flow mock') || t.title?.toLowerCase().includes('google flow — project'))
  );
  if (mockTab && mockTab.id) return { tabId: mockTab.id, url: mockTab.url || '', isMock: true };

  return null;
}

function handleMessage(message, sender, sendResponse) {
  if (!message || typeof message !== 'object') return false;

  const envelopeId = message.id || `ext_${Date.now()}`;

  if (message.type === "PING") {
    sendResponse({
      id: envelopeId,
      type: "PONG",
      source: "extension",
      timestamp: Date.now(),
      payload: { status: "ready", version: "1.0.0" }
    });
    return false;
  }

  if (message.type === "GET_FLOW_STATUS" || message.type === "INSPECT_FLOW") {
    (async () => {
      const flowTab = await findFlowTab();
      if (!flowTab) {
        sendResponse({
          id: envelopeId,
          type: "GET_FLOW_STATUS",
          source: "extension",
          timestamp: Date.now(),
          payload: {
            status: "FLOW_TAB_NOT_FOUND",
            message: "No Google Flow or Mock Flow tab detected in Chrome."
          }
        });
        return;
      }

      // Check if project is open
      const url = flowTab.url;
      const isProject = url.includes('/project/') || url.includes('#project') || url.includes('data-flow-mock');

      sendResponse({
        id: envelopeId,
        type: "GET_FLOW_STATUS",
        source: "extension",
        timestamp: Date.now(),
        payload: {
          status: isProject ? "CONNECTED" : "PROJECT_NOT_OPEN",
          message: isProject ? "Connected to active Flow project." : "Flow is open, but Project is not open.",
          details: {
            url,
            isFlowPage: true,
            isProjectOpen: isProject,
            hasPromptInput: true,
            status: isProject ? "CONNECTED" : "PROJECT_NOT_OPEN"
          }
        }
      });
    })();
    return true;
  }

  if (message.type === "PREPARE_JOB" || message.type === "GENERATE_IMAGE") {
    const prompt = message.payload?.prompt || message.prompt;
    (async () => {
      const flowTab = await findFlowTab();
      if (!flowTab) {
        sendResponse({
          id: envelopeId,
          type: "ERROR",
          source: "extension",
          timestamp: Date.now(),
          error: { code: "FLOW_TAB_NOT_FOUND", message: "No active Google Flow tab found" }
        });
        return;
      }

      // Try sending to content script
      chrome.tabs.sendMessage(flowTab.tabId, { action: "FILL_PROMPT", prompt }, (response) => {
        sendResponse({
          id: envelopeId,
          type: "PREPARE_JOB",
          source: "extension",
          timestamp: Date.now(),
          payload: {
            status: "PREPARED",
            method: "composer-input",
            prompt,
            detail: response
          }
        });
      });
    })();
    return true;
  }
}

// Listen for messages from Content Scripts
chrome.runtime.onMessage.addListener(handleMessage);
chrome.runtime.onMessageExternal.addListener(handleMessage);
