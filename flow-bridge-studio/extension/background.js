// Background Service Worker for Flow Bridge
console.log("Flow Bridge Background Service Worker initialized.");

function handleMessage(message, sender, sendResponse) {
  console.log("Job received:", message);
  
  if (message.type === "PING") {
    sendResponse({ status: "connected", version: "1.0.0" });
    return false;
  }

  if (message.type === "GENERATE_IMAGE") {
    const prompt = message.payload.prompt;
    console.log("Prompt to generate:", prompt);
    
    // Find the Google Flow tab
    chrome.tabs.query({ url: "*://labs.google/fx/tools/flow*" }, (tabs) => {
      if (tabs.length > 0) {
        let flowTab = tabs[0];
        console.log("Found Google Flow tab:", flowTab.id);
        
        chrome.tabs.sendMessage(flowTab.id, { action: "FILL_PROMPT", prompt: prompt }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Error sending to content script:", chrome.runtime.lastError.message);
            sendResponse({ status: "error", message: "Content script not responding. Please refresh Flow page." });
          } else {
            console.log("Response from Flow tab:", response);
            // Provide the status back to the web app
            sendResponse({ status: response?.status || "processing", detail: response });
          }
        });
      } else {
        // Also check if they are using the old flow.google.com URL just in case
        chrome.tabs.query({ url: "*://flow.google.com/*" }, (fallbackTabs) => {
            if (fallbackTabs.length > 0) {
                let flowTab = fallbackTabs[0];
                chrome.tabs.sendMessage(flowTab.id, { action: "FILL_PROMPT", prompt: prompt }, (response) => {
                    if (chrome.runtime.lastError) {
                        sendResponse({ status: "error", message: "Content script not responding." });
                    } else {
                        sendResponse({ status: response?.status || "processing", detail: response });
                    }
                });
            } else {
                console.log("No Google Flow tab found.");
                sendResponse({ status: "error", message: "Google Flow tab not found. Please open labs.google/fx/tools/flow" });
            }
        });
      }
    });
    
    return true; // Keep the message channel open for async response
  }
}

// Listen for messages from the React Website (externally_connectable)
chrome.runtime.onMessageExternal.addListener(handleMessage);

// Listen for messages from Content Scripts
chrome.runtime.onMessage.addListener(handleMessage);
