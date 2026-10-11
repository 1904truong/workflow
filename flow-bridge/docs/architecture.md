# FLOW BRIDGE ARCHITECTURE

## 1. System Overview

Flow Bridge is an AI Image Studio system connecting a modern React Web Application with Google Flow through an authorized Chrome Extension (Manifest V3).

```
+-----------------------------------------------------------+
|                   Flow Bridge Web App                     |
|            (React 19, TypeScript, Tailwind CSS)           |
+-----------------------------------------------------------+
                              |
                     window.postMessage
                   (Origin & Type Checked)
                              |
+-----------------------------------------------------------+
|               Flow Bridge Chrome Extension                |
|  +-----------------------------------------------------+  |
|  | Content Script (Web Bridge - localhost:5173 only)   |  |
|  +-----------------------------------------------------+  |
|                             |                             |
|                 chrome.runtime.sendMessage                |
|                             |                             |
|  +-----------------------------------------------------+  |
|  | Background Service Worker (Connection & Job Manager)| |
|  +-----------------------------------------------------+  |
|                             |                             |
|                   chrome.tabs.sendMessage                 |
|                             |                             |
|  +-----------------------------------------------------+  |
|  | Flow Adapter Content Script (Google Flow Tab / Mock) | |
|  +-----------------------------------------------------+  |
+-----------------------------------------------------------+
                              |
                              v
             Google Flow Project Tab / Mock Page
```

## 2. Directory Structure

```text
flow-bridge/
  apps/
    web/          # React + Vite application (Flow Bridge Web)
    extension/    # Manifest V3 Chrome Extension (Flow Bridge Extension)
  packages/
    shared/       # Shared TypeScript types, message protocols, validators
  tests/
    unit/         # Vitest unit tests for validation & state logic
    integration/  # Message bridge & extension connection tests
    mock-flow/    # Local HTML Mock page simulating Google Flow controls
  docs/           # Project specifications, audit reports, licenses
```

## 3. Communication Protocol

All messages conform to strict schemas with unique `requestId`, `timestamp`, and typed payload.

### Standard Status Codes
- `CONNECTED`: Active connection with an open, ready Google Flow project.
- `NOT_CONNECTED`: Extension installed but communication bridge not established.
- `FLOW_TAB_NOT_FOUND`: No Google Flow or Mock Flow tab detected in Chrome.
- `PROJECT_NOT_OPEN`: Google Flow tab is open, but user is on the home/gallery page, not inside a project editor (`/project/`).
- `PROMPT_INPUT_NOT_FOUND`: Inside a project, but the prompt editor DOM element could not be resolved.
- `PERMISSION_REQUIRED`: User approval or tab focus required.
- `ERROR`: An unexpected runtime or DOM inspection exception occurred.
