document.addEventListener('DOMContentLoaded', () => {
  const statusBadge = document.getElementById('statusBadge');
  const tabUrl = document.getElementById('tabUrl');
  const projectState = document.getElementById('projectState');
  const ctrlPrompt = document.getElementById('ctrlPrompt');
  const ctrlUpload = document.getElementById('ctrlUpload');
  const ctrlGenerate = document.getElementById('ctrlGenerate');
  const ctrlDownload = document.getElementById('ctrlDownload');
  const diagnosticMsg = document.getElementById('diagnosticMsg');
  const btnInspect = document.getElementById('btnInspect');
  const btnTestPrompt = document.getElementById('btnTestPrompt');

  function renderStatus(status, details) {
    statusBadge.textContent = status;
    statusBadge.className = 'status-badge';

    switch (status) {
      case 'CONNECTED':
        statusBadge.classList.add('status-connected');
        diagnosticMsg.textContent = 'All core controls found. Flow Bridge is ready.';
        break;
      case 'PROJECT_NOT_OPEN':
        statusBadge.classList.add('status-warning');
        diagnosticMsg.textContent = 'Flow tab is open, but you are not inside a Project. Please click "New project" or open an existing project in Flow.';
        break;
      case 'FLOW_TAB_NOT_FOUND':
        statusBadge.classList.add('status-error');
        diagnosticMsg.textContent = 'No Google Flow (labs.google/fx/tools/flow) or local Mock Flow tab detected. Please open Google Flow in your browser.';
        break;
      case 'PROMPT_INPUT_NOT_FOUND':
        statusBadge.classList.add('status-warning');
        diagnosticMsg.textContent = 'Flow project is open, but the prompt editor DOM element could not be located.';
        break;
      default:
        statusBadge.classList.add('status-error');
        diagnosticMsg.textContent = `Status: ${status}`;
    }

    if (details) {
      tabUrl.textContent = details.url || 'Not available';
      tabUrl.title = details.url || '';
      projectState.textContent = details.isProjectOpen ? 'Open & Active' : 'Not open';

      // Controls
      setControlBadge(ctrlPrompt, details.hasPromptInput, details.promptInputType || 'Detected');
      setControlBadge(ctrlUpload, details.hasUploadInput, 'Detected');
      setControlBadge(ctrlGenerate, details.hasGenerateButton, 'Detected');
      setControlBadge(ctrlDownload, details.hasDownloadButton, 'Detected');
    } else {
      tabUrl.textContent = 'None';
      projectState.textContent = 'None';
      setControlBadge(ctrlPrompt, false);
      setControlBadge(ctrlUpload, false);
      setControlBadge(ctrlGenerate, false);
      setControlBadge(ctrlDownload, false);
    }
  }

  function setControlBadge(element, isPresent, label = 'Detected') {
    if (!element) return;
    if (isPresent) {
      element.textContent = label;
      element.className = 'control-status status-green';
    } else {
      element.textContent = 'Not found';
      element.className = 'control-status status-gray';
    }
  }

  async function checkInspection() {
    statusBadge.textContent = 'Inspecting...';
    statusBadge.className = 'status-badge status-loading';
    diagnosticMsg.textContent = 'Querying active Flow tabs and inspecting DOM elements...';

    const envelope = {
      id: `req_${Date.now()}`,
      type: 'INSPECT_FLOW',
      source: 'extension',
      timestamp: Date.now(),
      payload: null,
    };

    try {
      const response = await chrome.runtime.sendMessage(envelope);
      if (response && response.payload) {
        renderStatus(response.payload.status, response.payload);
      } else if (response && response.error) {
        renderStatus('ERROR', null);
        diagnosticMsg.textContent = `Error: ${response.error.message}`;
      } else {
        renderStatus('ERROR', null);
        diagnosticMsg.textContent = 'No response from service worker.';
      }
    } catch (err) {
      renderStatus('ERROR', null);
      diagnosticMsg.textContent = `Connection error: ${err.message}`;
    }
  }

  const btnTestGenerate = document.getElementById('btnTestGenerate');

  async function testPromptInput() {
    diagnosticMsg.textContent = 'Sending prompt preparation test to Flow tab...';
    const testPrompt = 'Create a beautiful landscape photograph of a green mountain under a clear blue sky.';
    const envelope = {
      id: `test_${Date.now()}`,
      type: 'PREPARE_JOB',
      source: 'extension',
      timestamp: Date.now(),
      payload: {
        jobId: 'test_job_1',
        prompt: testPrompt,
        mode: 't2i',
      },
    };

    try {
      const response = await chrome.runtime.sendMessage(envelope);
      if (response && response.payload && response.payload.status === 'PREPARED') {
        diagnosticMsg.textContent = `Prompt successfully placed into Flow composer via ${response.payload.method}. Actual: "${response.payload.actualValue || testPrompt}"`;
      } else {
        diagnosticMsg.textContent = `Prompt test failed: ${response?.error?.message || 'Unknown error'}`;
      }
    } catch (err) {
      diagnosticMsg.textContent = `Test prompt error: ${err.message}`;
    }
  }

  async function testGenerate() {
    if (!confirm('Run LIVE Generate test (consumes Google Flow credits for 1 image)?')) {
      return;
    }

    btnTestGenerate.disabled = true;
    btnTestGenerate.textContent = 'Generating (1 request in progress)...';
    diagnosticMsg.textContent = 'Submitting prompt to Google Flow and waiting for image creation...';

    const envelope = {
      id: `gen_${Date.now()}`,
      type: 'TRIGGER_GENERATE',
      source: 'extension',
      timestamp: Date.now(),
      payload: {
        prompt: 'Create a beautiful landscape photograph of a green mountain under a clear blue sky.',
      },
    };

    try {
      const response = await chrome.runtime.sendMessage(envelope);
      if (response && response.payload && response.payload.status === 'GENERATED') {
        diagnosticMsg.textContent = `✅ Generated successfully in ${Math.round((response.payload.timeTakenMs || 0)/1000)}s! New image: ${response.payload.imageUrl}`;
      } else if (response && response.payload && response.payload.status === 'TIMEOUT_OR_PENDING') {
        diagnosticMsg.textContent = `⏳ Prompt submitted to Flow. Image generation is still processing on the canvas.`;
      } else {
        diagnosticMsg.textContent = `❌ Generate failed: ${response?.error?.message || 'Unknown error'}`;
      }
    } catch (err) {
      diagnosticMsg.textContent = `❌ Generate error: ${err.message}`;
    } finally {
      btnTestGenerate.disabled = false;
      btnTestGenerate.textContent = '⚡ Generate (Single 1-Credit Test)';
    }
  }

  btnInspect.addEventListener('click', checkInspection);
  btnTestPrompt.addEventListener('click', testPromptInput);
  if (btnTestGenerate) {
    btnTestGenerate.addEventListener('click', testGenerate);
  }

  // Initial check
  checkInspection();
});
