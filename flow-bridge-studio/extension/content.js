// Content Script injected into pages
console.log("Flow Bridge Content Script injected on:", window.location.href);

const wait = (s) => new Promise(r => setTimeout(r, s * 1000));

// ══════════════════════════════════════════════════
// DOM FINDERS — robust selectors for Google Flow
// ══════════════════════════════════════════════════
const DOM = {
    getPromptInput() {
        return document.querySelector('textarea[aria-label*="prompt" i]')
            || document.querySelector('textarea[aria-label*="Prompt" i]')
            || document.querySelector('textarea[placeholder*="prompt" i]')
            || document.querySelector('textarea[placeholder*="Describe" i]')
            || document.querySelector('div[contenteditable="true"][role="textbox"]')
            || document.querySelector('textarea');
    },

    findButtonByText(text) {
        const primary = document.querySelectorAll('button, [role="button"], [role="tab"], [role="menuitem"], a');
        for (const el of primary) {
            const t = (el.textContent || el.innerText || '').trim().toLowerCase();
            if (t === text.toLowerCase() || (t.length > 0 && t.includes(text.toLowerCase()))) return el;
        }
        
        const labeled = document.querySelector(`[aria-label*="${text}" i], [title*="${text}" i], [data-tooltip*="${text}" i]`);
        if (labeled) return labeled;

        const containers = document.querySelectorAll('span, div');
        for (const el of containers) {
            const t = (el.textContent || el.innerText || '').trim().toLowerCase();
            if (t === text.toLowerCase() && t.length < 20) {
                if (el.offsetWidth > 0 || el.offsetHeight > 0) return el;
            }
        }
        return null;
    },

    getGenerateButton(inputEl) {
        // 1. Context-aware search for Chat interfaces
        // The submit button (arrow) is usually in the same container as the text input
        if (inputEl) {
            let parent = inputEl.parentElement;
            for(let i=0; i<6; i++) {
                if(!parent) break;
                // Find all buttons in this container
                let btns = Array.from(parent.querySelectorAll('button, div[role="button"]'));
                // The submit/send button is typically the last interactive element in the input wrapper
                if (btns.length > 0) {
                    let lastBtn = btns[btns.length - 1];
                    if (lastBtn && lastBtn !== inputEl) return lastBtn;
                }
                parent = parent.parentElement;
            }
        }

        // 2. Fallbacks
        return this.findButtonByText('Generate') 
            || this.findButtonByText('Tạo')
            || this.findButtonByText('Run') 
            || this.findButtonByText('Create')
            || document.querySelector('button.generate-button');
    },

    getDownloadButton() {
        return document.querySelector('a[download]')
            || this.findButtonByText('Download')
            || document.querySelector('button[aria-label*="Download" i]');
    },

    getErrorText() {
        const containers = document.querySelectorAll('[role="alert"], [role="status"], .toast, .snackbar, .error-box, .status-bar');
        for (const el of containers) {
            const text = el.innerText.toLowerCase();
            if (text.includes("policy") && text.includes("error")) return "Policy Error";
            if (text.includes("busy") || text.includes("server")) return "Server Busy";
            if (text.includes("rate limit")) return "Rate Limited";
            if (text.includes("failed to generate") || text.includes("something went wrong")) return "Generation Failed";
        }
        return null;
    }
};

// ══════════════════════════════════════════════════
// AUTOMATION ENGINE
// ══════════════════════════════════════════════════

// React 16+ Native Value Setter
function setNativeValue(element, value) {
    const desc = Object.getOwnPropertyDescriptor(element, 'value');
    const proto = Object.getPrototypeOf(element);
    const protoDesc = Object.getOwnPropertyDescriptor(proto, 'value');

    const setter = desc ? desc.set : null;
    const protoSetter = protoDesc ? protoDesc.set : null;

    if (protoSetter && setter !== protoSetter) {
        protoSetter.call(element, value);
    } else if (setter) {
        setter.call(element, value);
    } else {
        element.value = value;
    }
}

async function executeAutomation(prompt) {
    try {
        console.log("[FLOW] Starting automation for prompt:", prompt);
        
        // 1. Find and Fill Prompt
        let inputEl = DOM.getPromptInput();
        if (!inputEl) throw new Error("Prompt input not found");

        inputEl.focus();
        
        try {
            if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
                setNativeValue(inputEl, prompt);
            } else {
                inputEl.textContent = prompt;
            }
        } catch(e) {
            inputEl.value = prompt;
        }

        // Trick React into detecting changes
        inputEl.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        inputEl.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter' }));
        inputEl.dispatchEvent(new KeyboardEvent('keyup',   { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter' }));
        
        await wait(0.5);

        // 2. Click Generate
        let btn = DOM.getGenerateButton(inputEl);
        if (!btn) throw new Error("Generate button not found");

        let tries = 0;
        while (btn.disabled && tries < 15) {
            await wait(1);
            tries++;
        }
        if (btn.disabled) throw new Error("Generate button stayed disabled");

        btn.click();
        console.log("[FLOW] Clicked Generate!");
        
        // MVP: Just confirm click. Later we can add the polling for the download button here!
        return { success: true, status: "processing" };

    } catch (err) {
        console.error("[FLOW] Automation error:", err);
        return { success: false, status: "error", message: err.message || String(err) };
    }
}


// Listen for messages from Background Script (for Google Flow tab)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received message:", message);
  
  if (message.action === "FILL_PROMPT") {
      executeAutomation(message.prompt).then(res => sendResponse(res));
      return true; // Keep channel open for async response
  }
});

// Bridge for the Frontend App (localhost)
if (window.location.href.includes('localhost') || window.location.href.includes('127.0.0.1')) {
  console.log("Flow Bridge: Setting up frontend listener");

  // Announce extension presence to the web page
  window.postMessage({
    type: 'EXTENSION_DETECTED',
    source: 'extension',
    payload: { version: '1.0.0', ready: true }
  }, window.location.origin);

  window.addEventListener("message", (event) => {
    // We only accept messages from ourselves
    if (event.source !== window) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.source !== 'web' && data.type !== 'GENERATE_IMAGE' && data.type !== 'PING') return;

    chrome.runtime.sendMessage(data, (response) => {
      if (chrome.runtime.lastError) {
        window.postMessage({
          id: data.id,
          type: 'ERROR',
          source: 'extension',
          timestamp: Date.now(),
          error: { code: 'EXTENSION_ERROR', message: chrome.runtime.lastError.message }
        }, event.origin || window.location.origin);
      } else if (response) {
        window.postMessage(response, event.origin || window.location.origin);
      }
    });
  }, false);
}

