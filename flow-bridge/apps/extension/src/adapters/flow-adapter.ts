import type { FlowConnectionStatus, FlowInspection } from '../../../../packages/shared/types/index.ts';

export interface IFlowAdapter {
  detectPage(): boolean;
  isProjectOpen(): boolean;
  findPromptInput(): HTMLElement | null;
  findUploadInput(): HTMLInputElement | null;
  findAttachButton(): HTMLElement | null;
  findGenerateButton(): HTMLElement | null;
  findDownloadButton(): HTMLElement | null;
  findResultImageContainer(): HTMLElement | null;
  getGeneratedImages(): HTMLImageElement[];
  preparePrompt(text: string): Promise<{ success: boolean; method: string; actualValue?: string; error?: string }>;
  inspect(): Promise<FlowInspection>;
}

export class GoogleFlowAdapter implements IFlowAdapter {
  private doc: Document;

  constructor(customDoc?: Document) {
    this.doc = customDoc || (typeof document !== 'undefined' ? document : ({} as Document));
  }

  private norm(s: string | null | undefined): string {
    return (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  private isVisible(el: HTMLElement | null): boolean {
    if (!el) return false;
    try {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const win = this.doc.defaultView || window;
      const style = win.getComputedStyle(el);
      return style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
    } catch {
      // In non-DOM testing environments
      return true;
    }
  }

  /**
   * Detects if the current document is a Google Flow page (flow.google.com or labs.google) or Mock Flow page
   */
  public detectPage(): boolean {
    const href = this.doc.location?.href || '';
    if (href.includes('flow.google.com')) return true;
    if (href.includes('labs.google/fx/tools/flow')) return true;

    // Allow local mock environment for testing
    if (href.includes('mock-flow') || href.includes('localhost') || href.includes('127.0.0.1')) {
      if (
        this.doc.querySelector?.('[data-flow-mock="true"]') ||
        this.doc.title?.toLowerCase().includes('google flow')
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Detects if the user has navigated inside an actual Flow Project
   */
  public isProjectOpen(): boolean {
    const href = this.doc.location?.href || '';
    if (/\/project\//.test(href) || href.includes('#project') || href.includes('project=')) {
      return true;
    }
    // Check DOM markers (e.g. project workspace container)
    if (
      this.doc.querySelector?.(
        '[data-project-id], [data-flow-project="true"], .flow-project-workspace, [data-project-workspace="true"]'
      )
    ) {
      return true;
    }
    return false;
  }

  /**
   * Robust multi-strategy locator for Agent chat prompt input
   * Matches English and Vietnamese prompt placeholders
   */
  public findPromptInput(): HTMLElement | null {
    const keywords = [
      'what do you want to create',
      'bạn muốn tạo gì',
      'tạo',
      'mô tả',
      'lời nhắc',
      'nhập',
      'create',
      'prompt',
      'describe',
    ];

    // Strategy 1: contenteditable div with matching aria-label, placeholder, or text
    const editables = Array.from(
      this.doc.querySelectorAll<HTMLElement>('[contenteditable="true"], [role="textbox"]')
    ).filter((el) => this.isVisible(el));

    for (const el of editables) {
      const aria = this.norm(el.getAttribute('aria-label'));
      const dataPh = this.norm(el.getAttribute('data-placeholder'));
      const text = this.norm(el.textContent);

      if (keywords.some((k) => aria.includes(k) || dataPh.includes(k) || text.includes(k))) {
        return el;
      }
    }

    // Strategy 2: classic textarea or input
    const inputs = Array.from(
      this.doc.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>('textarea, input[type="text"]')
    ).filter((el) => this.isVisible(el));

    for (const input of inputs) {
      const ph = this.norm(input.placeholder);
      const aria = this.norm(input.getAttribute('aria-label'));
      if (keywords.some((k) => ph.includes(k) || aria.includes(k))) {
        return input;
      }
    }

    // Strategy 3: Lowest visible contenteditable (composer is anchored at bottom of screen)
    if (editables.length > 0) {
      editables.sort((a, b) => {
        const topA = a.getBoundingClientRect?.().top || 0;
        const topB = b.getBoundingClientRect?.().top || 0;
        return topB - topA;
      });
      return editables[0];
    }

    // Strategy 4: Fallback to lowest visible textarea
    if (inputs.length > 0) {
      inputs.sort((a, b) => {
        const topA = a.getBoundingClientRect?.().top || 0;
        const topB = b.getBoundingClientRect?.().top || 0;
        return topB - topA;
      });
      return inputs[0];
    }

    return null;
  }

  /**
   * Locates the '+' / Attach / Add Image button in Google Flow
   */
  public findAttachButton(): HTMLElement | null {
    const buttons = Array.from(
      this.doc.querySelectorAll<HTMLElement>('button, [role="button"]')
    ).filter((b) => this.isVisible(b));

    // 1. Material icon ligatures: add, attach_file, add_photo_alternate
    const addBtn = buttons.find((b) => {
      const t = this.norm(b.textContent);
      return (
        t === 'add' ||
        t === '+' ||
        t.includes('attach_file') ||
        t.includes('add_photo') ||
        t.includes('image_search')
      );
    });
    if (addBtn) return addBtn;

    // 2. Aria-label matching attach / add image
    const ariaMatch = buttons.find((b) => {
      const aria = this.norm(b.getAttribute('aria-label'));
      return (
        aria.includes('đính kèm') ||
        aria.includes('thêm ảnh') ||
        aria.includes('attach') ||
        aria.includes('add image') ||
        aria.includes('upload') ||
        aria.includes('thêm')
      );
    });
    if (ariaMatch) return ariaMatch;

    return null;
  }

  /**
   * Locates image upload input for reference images
   */
  public findUploadInput(): HTMLInputElement | null {
    const fileInputs = Array.from(this.doc.querySelectorAll<HTMLInputElement>('input[type="file"]'));
    if (fileInputs.length > 0) return fileInputs[0];
    return null;
  }

  /**
   * Locates Generate/Submit Button (the right-most arrow_forward button in prompt bar)
   */
  public findGenerateButton(): HTMLElement | null {
    const buttons = Array.from(
      this.doc.querySelectorAll<HTMLElement>('button, [role="button"]')
    ).filter((b) => this.isVisible(b));

    // 1. Material icon ligature "arrow_forward" (Flow prompt submit button)
    const arrowBtns = buttons.filter((b) => this.norm(b.textContent).includes('arrow_forward'));
    if (arrowBtns.length > 0) {
      arrowBtns.sort((a, b) => {
        const rightA = a.getBoundingClientRect?.().right || 0;
        const rightB = b.getBoundingClientRect?.().right || 0;
        return rightB - rightA;
      });
      return arrowBtns[0];
    }

    // 2. Aria-label or text containing "create", "generate", "tạo", "gửi"
    const genBtn = buttons.find((b) => {
      const aria = this.norm(b.getAttribute('aria-label'));
      const text = this.norm(b.textContent);
      return (
        aria.includes('generate') ||
        aria.includes('create') ||
        aria.includes('tạo') ||
        aria.includes('gửi') ||
        text.includes('generate') ||
        text.includes('create') ||
        text.includes('tạo') ||
        text.includes('gửi')
      );
    });
    if (genBtn) return genBtn;

    return null;
  }

  /**
   * Checks if an image is a Flow generated image
   */
  private isGenImg(img: HTMLImageElement): boolean {
    const s = img.src || '';
    if (img.naturalWidth && img.naturalWidth < 200) return false; // exclude avatars
    return (
      /getMediaUrlRedirect/.test(s) ||
      /labs\.google\/fx\/api\/.*media/i.test(s) ||
      /\/fx\/.*\/(media|image|result)/i.test(s) ||
      ((/(lh3|lh4|lh5|lh6)\.googleusercontent/.test(s)) && !/\/a[/-]/.test(s)) ||
      (/googleusercontent/.test(s) && !/\/a\//.test(s))
    );
  }

  /**
   * Returns all generated images found on the canvas
   */
  public getGeneratedImages(): HTMLImageElement[] {
    return Array.from(this.doc.querySelectorAll<HTMLImageElement>('img')).filter((img) =>
      this.isGenImg(img)
    );
  }

  /**
   * Locates the canvas / gallery container where result images are displayed
   */
  public findResultImageContainer(): HTMLElement | null {
    const genImgs = this.getGeneratedImages();
    if (genImgs.length > 0) {
      let p: HTMLElement | null = genImgs[0];
      for (let i = 0; i < 6 && p?.parentElement; i++) {
        p = p.parentElement as HTMLElement;
        if (p.querySelectorAll('img').length > 1) {
          return p;
        }
      }
      return genImgs[0].parentElement;
    }

    const container = this.doc.querySelector<HTMLElement>(
      '[data-flow-results="true"], .flow-results, .flow-canvas, .flow-gallery, main'
    );
    return container || null;
  }

  /**
   * Locates Download Button or Menu Item
   */
  public findDownloadButton(): HTMLElement | null {
    const candidates = Array.from(
      this.doc.querySelectorAll<HTMLElement>('button, [role="menuitem"], a, [role="button"]')
    ).filter((el) => this.isVisible(el));

    const dlBtn = candidates.find((el) => {
      const text = this.norm(el.textContent);
      const aria = this.norm(el.getAttribute('aria-label'));
      return text.includes('download') || aria.includes('download') || text.includes('tải xuống');
    });

    return dlBtn || null;
  }

  /**
   * Prepares and enters the prompt text safely into the Flow composer
   * Uses execCommand('insertText') so React synthetic events trigger properly
   */
  public async preparePrompt(
    text: string
  ): Promise<{ success: boolean; method: string; actualValue?: string; error?: string }> {
    const input = this.findPromptInput();
    if (!input) {
      return { success: false, method: 'none', error: 'Prompt input element not found' };
    }

    try {
      input.focus();

      if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
        const inputEl = input as HTMLInputElement | HTMLTextAreaElement;
        const proto = inputEl.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) {
          setter.call(inputEl, text);
        } else {
          inputEl.value = text;
        }
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true, method: 'native-value', actualValue: inputEl.value };
      } else {
        // Contenteditable element - use execCommand to insert text so React state synchronizes
        const win = this.doc.defaultView || window;
        const sel = win.getSelection?.();
        if (sel) {
          try {
            const range = this.doc.createRange();
            range.selectNodeContents(input);
            sel.removeAllRanges();
            sel.addRange(range);
            this.doc.execCommand?.('delete', false);
          } catch {
            input.textContent = '';
          }
        } else {
          input.textContent = '';
        }

        let inserted = false;
        try {
          inserted = !!this.doc.execCommand?.('insertText', false, text);
        } catch {
          inserted = false;
        }

        if (!inserted) {
          input.textContent = text;
        }

        try {
          input.dispatchEvent(new InputEvent('input', { bubbles: true }));
        } catch {
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        input.dispatchEvent(new Event('change', { bubbles: true }));

        const actual = input.textContent || '';
        return {
          success: true,
          method: inserted ? 'execCommand-insertText' : 'contenteditable-synthetic',
          actualValue: actual,
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, method: 'failed', error: msg };
    }
  }

  /**
   * Complete DOM inspection report
   */
  public async inspect(): Promise<FlowInspection> {
    const url = this.doc.location?.href || '';
    const isFlow = this.detectPage();
    const isProj = isFlow && this.isProjectOpen();

    const promptInput = isProj ? this.findPromptInput() : null;
    const uploadInput = isProj ? this.findUploadInput() : null;
    const attachBtn = isProj ? this.findAttachButton() : null;
    const generateBtn = isProj ? this.findGenerateButton() : null;
    const downloadBtn = isProj ? this.findDownloadButton() : null;
    const resultContainer = isProj ? this.findResultImageContainer() : null;
    const genImgs = isProj ? this.getGeneratedImages() : [];

    let inputType: 'contenteditable' | 'textarea' | 'input' | 'none' = 'none';
    if (promptInput) {
      if (promptInput.tagName === 'TEXTAREA') inputType = 'textarea';
      else if (promptInput.tagName === 'INPUT') inputType = 'input';
      else inputType = 'contenteditable';
    }

    const supportedOps: string[] = [];
    const unsupportedOps: string[] = [];

    if (isFlow) supportedOps.push('page_detection');
    if (isProj) supportedOps.push('project_detection');

    if (promptInput) {
      supportedOps.push('prompt_inspection');
      supportedOps.push('prompt_preparation');
    } else if (isProj) {
      unsupportedOps.push('prompt_input_missing');
    }

    if (attachBtn) {
      supportedOps.push('attach_button_located');
    }

    if (uploadInput) {
      supportedOps.push('reference_image_upload');
    } else if (isProj) {
      unsupportedOps.push('reference_image_upload_unavailable');
    }

    if (generateBtn) {
      supportedOps.push('generate_button_located');
    } else if (isProj) {
      unsupportedOps.push('generate_button_missing');
    }

    if (resultContainer) {
      supportedOps.push('result_container_located');
    }

    if (downloadBtn) {
      supportedOps.push('download_button_located');
    }

    let status: FlowConnectionStatus = 'NOT_CONNECTED';
    if (!isFlow) {
      status = 'FLOW_TAB_NOT_FOUND';
    } else if (!isProj) {
      status = 'PROJECT_NOT_OPEN';
    } else if (!promptInput) {
      status = 'PROMPT_INPUT_NOT_FOUND';
    } else {
      status = 'CONNECTED';
    }

    return {
      url,
      isFlowPage: isFlow,
      isProjectOpen: isProj,
      hasPromptInput: !!promptInput,
      hasUploadInput: !!uploadInput,
      hasAttachButton: !!attachBtn,
      hasGenerateButton: !!generateBtn,
      hasDownloadButton: !!downloadBtn,
      hasResultContainer: !!resultContainer,
      resultImageCount: genImgs.length,
      promptInputType: inputType,
      detectedUiVersion: isFlow ? 'Google Flow (Agent UI 2026 / Compatible)' : 'Unknown',
      supportedOperations: supportedOps,
      unsupportedOperations: unsupportedOps,
      status,
      diagnosticDetails: {
        timestamp: Date.now(),
        docTitle: this.doc.title,
        readyState: this.doc.readyState,
      },
    };
  }
}
