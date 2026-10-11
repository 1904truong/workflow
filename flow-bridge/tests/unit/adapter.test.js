import test from 'node:test';
import assert from 'node:assert/strict';

import { GoogleFlowAdapter } from '../../apps/extension/src/adapters/flow-adapter.ts';

class MockElement {
  constructor(tagName, attrs = {}, text = '') {
    this.tagName = tagName.toUpperCase();
    this.attributes = { ...attrs };
    this.textContent = text;
    this.value = text;
    this.src = attrs['src'] || '';
    this.naturalWidth = attrs['naturalWidth'] ?? 512;
    this.style = {};
    this.dispatchedEvents = [];
    this.focused = false;
    this.parentElement = null;
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  setAttribute(name, val) {
    this.attributes[name] = val;
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  getBoundingClientRect() {
    return { width: 100, height: 40, top: 100, left: 100, right: 200, bottom: 140 };
  }

  focus() {
    this.focused = true;
  }

  dispatchEvent(evt) {
    this.dispatchedEvents.push(evt.type);
    return true;
  }

  querySelectorAll(sel) {
    return [];
  }
}

// Helper to construct simulated DOM Document
function createMockDoc(options = {}) {
  const elements = options.elements || [];
  for (const el of elements) {
    if (!el.parentElement) {
      el.parentElement = new MockElement('div');
    }
  }

  const doc = {
    location: { href: options.url || 'https://flow.google.com/project/34777e1b-4166-4f62-a34a-92fdab11f9af' },
    title: options.title || 'Google Flow – Project',
    readyState: 'complete',
    execCommand: (cmd, showUi, val) => {
      if (cmd === 'insertText') {
        const active = elements.find((e) => e.focused);
        if (active) {
          active.textContent = val;
        }
        return true;
      }
      return true;
    },
    createRange: () => ({
      selectNodeContents: () => {},
    }),
    querySelectorAll(selector) {
      return elements.filter((el) => {
        if (selector.includes('contenteditable="true"') && el.attributes['contenteditable'] === 'true') return true;
        if (selector.includes('role="textbox"') && el.attributes['role'] === 'textbox') return true;
        if (selector.includes('textarea') && el.tagName === 'TEXTAREA') return true;
        if (selector.includes('input[type="text"]') && el.tagName === 'INPUT' && (!el.attributes['type'] || el.attributes['type'] === 'text')) return true;
        if (selector.includes('input[type="file"]') && el.tagName === 'INPUT' && el.attributes['type'] === 'file') return true;
        if (selector.includes('button') && el.tagName === 'BUTTON') return true;
        if (selector.includes('img') && el.tagName === 'IMG') return true;
        return false;
      });
    },
    querySelector(selector) {
      const all = this.querySelectorAll(selector);
      return all.length > 0 ? all[0] : null;
    },
    defaultView: {
      getComputedStyle: () => ({ visibility: 'visible', display: 'block', opacity: '1' }),
      getSelection: () => ({
        removeAllRanges: () => {},
        addRange: () => {},
      }),
    },
  };

  return { doc };
}

test('Adapter: Detects real Google Flow and Mock Flow URLs', () => {
  // Test 1: Modern flow.google.com project
  const { doc: modernDoc } = createMockDoc({ url: 'https://flow.google.com/project/34777e1b-4166-4f62-a34a-92fdab11f9af' });
  const modernAdapter = new GoogleFlowAdapter(modernDoc);
  assert.equal(modernAdapter.detectPage(), true, 'Must detect modern flow.google.com');

  // Test 2: Legacy labs.google URL
  const { doc: legacyDoc } = createMockDoc({ url: 'https://labs.google/fx/tools/flow/project/123' });
  const legacyAdapter = new GoogleFlowAdapter(legacyDoc);
  assert.equal(legacyAdapter.detectPage(), true, 'Must detect labs.google flow');

  // Test 3: Local mock environment
  const { doc: mockDoc } = createMockDoc({ url: 'http://localhost:5173/tests/mock-flow/index.html' });
  const mockAdapter = new GoogleFlowAdapter(mockDoc);
  assert.equal(mockAdapter.detectPage(), true, 'Must detect mock-flow');

  // Test 4: Unrelated domain
  const { doc: otherDoc } = createMockDoc({ url: 'https://example.com' });
  const otherAdapter = new GoogleFlowAdapter(otherDoc);
  assert.equal(otherAdapter.detectPage(), false, 'Must reject third-party URL');
});

test('Adapter: Detects when a Project is open vs Home screen', () => {
  const { doc: projDoc } = createMockDoc({ url: 'https://flow.google.com/project/34777e1b-4166-4f62-a34a-92fdab11f9af' });
  const projAdapter = new GoogleFlowAdapter(projDoc);
  assert.equal(projAdapter.isProjectOpen(), true, 'Must detect open project via /project/');

  const { doc: homeDoc } = createMockDoc({ url: 'https://flow.google.com/' });
  const homeAdapter = new GoogleFlowAdapter(homeDoc);
  assert.equal(homeAdapter.isProjectOpen(), false, 'Must reject home screen without project');
});

test('Adapter: Locates Vietnamese & English prompt input ("Bạn muốn tạo gì?")', () => {
  const { doc } = createMockDoc({
    url: 'https://flow.google.com/project/34777e1b-4166-4f62-a34a-92fdab11f9af',
    elements: [
      new MockElement('div', { contenteditable: 'true', role: 'textbox', 'aria-label': 'Bạn muốn tạo gì?' }),
    ],
  });
  const adapter = new GoogleFlowAdapter(doc);
  const input = adapter.findPromptInput();
  assert.ok(input, 'Must locate Vietnamese prompt box');
  assert.equal(input.tagName, 'DIV');
  assert.equal(input.getAttribute('aria-label'), 'Bạn muốn tạo gì?');
});

test('Adapter: Locates attachment "+" button and file input', () => {
  const { doc } = createMockDoc({
    url: 'https://flow.google.com/project/34777e1b-4166-4f62-a34a-92fdab11f9af',
    elements: [
      new MockElement('button', { 'aria-label': 'Đính kèm ảnh' }, 'add'),
      new MockElement('input', { type: 'file' }),
    ],
  });
  const adapter = new GoogleFlowAdapter(doc);
  const attachBtn = adapter.findAttachButton();
  assert.ok(attachBtn, 'Must find attachment button');
  assert.equal(attachBtn.textContent, 'add');

  const uploadInput = adapter.findUploadInput();
  assert.ok(uploadInput, 'Must find file input');
  assert.equal(uploadInput.attributes['type'], 'file');
});

test('Adapter: Locates prompt submit button (arrow_forward)', () => {
  const { doc } = createMockDoc({
    url: 'https://flow.google.com/project/34777e1b-4166-4f62-a34a-92fdab11f9af',
    elements: [
      new MockElement('button', { 'aria-label': 'Gửi' }, 'arrow_forward'),
    ],
  });
  const adapter = new GoogleFlowAdapter(doc);
  const btn = adapter.findGenerateButton();
  assert.ok(btn, 'Must locate arrow_forward submit button');
  assert.equal(btn.textContent, 'arrow_forward');
});

test('Adapter: Prepares prompt text and verifies actual value in editor', async () => {
  const promptInput = new MockElement('div', {
    contenteditable: 'true',
    role: 'textbox',
    'aria-label': 'Bạn muốn tạo gì?',
  });
  const { doc } = createMockDoc({
    url: 'https://flow.google.com/project/34777e1b-4166-4f62-a34a-92fdab11f9af',
    elements: [promptInput],
  });
  const adapter = new GoogleFlowAdapter(doc);
  const testPrompt = 'Create a beautiful landscape photograph of a green mountain under a clear blue sky.';
  const res = await adapter.preparePrompt(testPrompt);

  assert.equal(res.success, true);
  assert.equal(res.actualValue, testPrompt, 'Actual value must match test prompt exactly');
  assert.equal(promptInput.textContent, testPrompt);
});

test('Adapter: Detects result images and avoids avatars', () => {
  const { doc } = createMockDoc({
    url: 'https://flow.google.com/project/34777e1b-4166-4f62-a34a-92fdab11f9af',
    elements: [
      new MockElement('img', { src: 'https://lh3.googleusercontent.com/a/avatar=s96-c', naturalWidth: 48 }), // avatar
      new MockElement('img', { src: 'https://labs.google/fx/api/media.getMediaUrlRedirect?name=result_01', naturalWidth: 1024 }), // result image
      new MockElement('img', { src: 'https://lh3.googleusercontent.com/flower_landscape_highres', naturalWidth: 768 }), // result image
    ],
  });
  const adapter = new GoogleFlowAdapter(doc);
  const genImgs = adapter.getGeneratedImages();
  assert.equal(genImgs.length, 2, 'Must locate exactly 2 result images and ignore avatar');
});

test('Adapter: Full CONNECTED status on live Google Flow Project structure', async () => {
  const { doc } = createMockDoc({
    url: 'https://flow.google.com/project/34777e1b-4166-4f62-a34a-92fdab11f9af',
    elements: [
      new MockElement('div', { contenteditable: 'true', role: 'textbox', 'aria-label': 'Bạn muốn tạo gì?' }),
      new MockElement('button', { 'aria-label': 'Đính kèm' }, 'add'),
      new MockElement('input', { type: 'file' }),
      new MockElement('button', { 'aria-label': 'Tạo' }, 'arrow_forward'),
      new MockElement('button', {}, 'Download'),
      new MockElement('img', { src: 'https://labs.google/fx/api/media.getMediaUrlRedirect?name=flower', naturalWidth: 800 }),
    ],
  });
  const adapter = new GoogleFlowAdapter(doc);
  const inspection = await adapter.inspect();

  assert.equal(inspection.status, 'CONNECTED');
  assert.equal(inspection.isFlowPage, true);
  assert.equal(inspection.isProjectOpen, true);
  assert.equal(inspection.hasPromptInput, true);
  assert.equal(inspection.hasAttachButton, true);
  assert.equal(inspection.hasUploadInput, true);
  assert.equal(inspection.hasGenerateButton, true);
  assert.equal(inspection.hasDownloadButton, true);
  assert.equal(inspection.resultImageCount, 1);
});
