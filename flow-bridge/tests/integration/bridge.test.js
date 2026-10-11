import test from 'node:test';
import assert from 'node:assert/strict';

import { createEnvelope, createErrorEnvelope } from '../../packages/shared/messages/index.ts';
import { isValidEnvelope } from '../../packages/shared/validation/index.ts';

// Simulated Job Manager to enforce Section 11 & Section 12 rules
class JobManager {
  constructor() {
    this.jobs = new Map();
  }

  submitJob(jobId, prompt, mode = 't2i') {
    // Rule: One job ID per request & prevent duplicate submission
    if (this.jobs.has(jobId)) {
      return { success: false, error: 'DUPLICATE_JOB_ID', message: `Job ${jobId} already exists` };
    }

    // Check if any existing job is currently running
    for (const [, job] of this.jobs) {
      if (['VALIDATING', 'PREPARING', 'GENERATING'].includes(job.state)) {
        return { success: false, error: 'JOB_IN_PROGRESS', message: `Another job (${job.id}) is currently in progress` };
      }
    }

    const newJob = {
      id: jobId,
      prompt,
      mode,
      state: 'PENDING',
      createdAt: Date.now(),
      history: ['PENDING'],
    };

    this.jobs.set(jobId, newJob);
    return { success: true, job: newJob };
  }

  transition(jobId, nextState) {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    job.state = nextState;
    job.history.push(nextState);
    return true;
  }

  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }
}

test('Job Manager: Prevents duplicate job submissions', () => {
  const manager = new JobManager();
  const res1 = manager.submitJob('job_101', 'Prompt A');
  assert.equal(res1.success, true);

  // Duplicate submission with same ID
  const resDuplicate = manager.submitJob('job_101', 'Prompt B');
  assert.equal(resDuplicate.success, false);
  assert.equal(resDuplicate.error, 'DUPLICATE_JOB_ID');
});

test('Job Manager: Prevents concurrent submissions while job is in progress', () => {
  const manager = new JobManager();
  manager.submitJob('job_201', 'Prompt 1');
  manager.transition('job_201', 'PREPARING');

  const resConcurrent = manager.submitJob('job_202', 'Prompt 2');
  assert.equal(resConcurrent.success, false);
  assert.equal(resConcurrent.error, 'JOB_IN_PROGRESS');

  // Once job_201 completes, new submissions succeed
  manager.transition('job_201', 'COMPLETED');
  const resAfter = manager.submitJob('job_202', 'Prompt 2');
  assert.equal(resAfter.success, true);
});

test('Integration: Bridge message routing cycle', () => {
  // Web dispatches GET_FLOW_STATUS
  const webMsg = createEnvelope('GET_FLOW_STATUS', 'web', null);
  assert.ok(isValidEnvelope(webMsg));
  assert.equal(webMsg.source, 'web');

  // Extension responds with CONNECTED
  const extResp = createEnvelope(
    'GET_FLOW_STATUS',
    'extension',
    { status: 'CONNECTED', url: 'https://labs.google/fx/tools/flow/project/nordic-42' },
    webMsg.id
  );
  assert.ok(isValidEnvelope(extResp));
  assert.equal(extResp.id, webMsg.id); // Matches correlation ID
  assert.equal(extResp.source, 'extension');
  assert.equal(extResp.payload.status, 'CONNECTED');
});

test('Integration: Error responses maintain correlation ID and details', () => {
  const req = createEnvelope('PREPARE_JOB', 'web', { prompt: '' }, 'req_test_999');
  const errResp = createErrorEnvelope(
    'flow-adapter',
    'EMPTY_PROMPT',
    'Prompt cannot be empty',
    req.id,
    { field: 'prompt' }
  );

  assert.equal(errResp.id, 'req_test_999');
  assert.equal(errResp.type, 'ERROR');
  assert.equal(errResp.error?.code, 'EMPTY_PROMPT');
  assert.deepEqual(errResp.error?.details, { field: 'prompt' });
});
