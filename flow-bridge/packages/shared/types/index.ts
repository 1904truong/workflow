/**
 * Shared Type Definitions for Flow Bridge System
 */

export type FlowConnectionStatus =
  | 'CONNECTED'
  | 'NOT_CONNECTED'
  | 'FLOW_TAB_NOT_FOUND'
  | 'PROJECT_NOT_OPEN'
  | 'PROMPT_INPUT_NOT_FOUND'
  | 'PERMISSION_REQUIRED'
  | 'ERROR';

export type JobState =
  | 'PENDING'
  | 'VALIDATING'
  | 'PREPARING'
  | 'AWAITING_CONFIRMATION'
  | 'GENERATING'
  | 'DOWNLOADING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'UNKNOWN';

export interface FlowInspection {
  url: string;
  isFlowPage: boolean;
  isProjectOpen: boolean;
  hasPromptInput: boolean;
  hasUploadInput: boolean;
  hasAttachButton?: boolean;
  hasGenerateButton: boolean;
  hasDownloadButton: boolean;
  hasResultContainer?: boolean;
  resultImageCount?: number;
  promptInputType?: 'contenteditable' | 'textarea' | 'input' | 'none';
  detectedUiVersion: string;
  supportedOperations: string[];
  unsupportedOperations: string[];
  diagnosticDetails?: Record<string, unknown>;
  status: FlowConnectionStatus;
}

export type MessageType =
  | 'PING'
  | 'PONG'
  | 'GET_FLOW_STATUS'
  | 'INSPECT_FLOW'
  | 'PREPARE_JOB'
  | 'TRIGGER_GENERATE'
  | 'JOB_STATUS'
  | 'CANCEL_JOB'
  | 'RESULT_AVAILABLE'
  | 'ERROR';

export interface BridgeEnvelope<T = unknown> {
  id: string; // unique requestId (UUID or nanoId)
  type: MessageType;
  source: 'web' | 'extension' | 'flow-adapter';
  timestamp: number;
  payload: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PrepareJobPayload {
  jobId: string;
  prompt: string;
  mode: 't2i' | 'i2i';
  referenceImageUrl?: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  modelPreference?: string;
}

export interface JobStatusPayload {
  jobId: string;
  state: JobState;
  progressPercent?: number;
  message?: string;
  resultUrls?: string[];
}
