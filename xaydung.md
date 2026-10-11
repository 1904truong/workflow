You are a Senior Chrome Extension Developer.

I am building a Chrome Extension called Flow Bridge.

The current Google Flow interface uses:

https://flow.google.com/project/

This is a chat-based Agent interface, NOT the older labs.google Flow interface.

Reference repository:
https://github.com/Yeamin-Sheikh/Flow-Automation

TASK:

Build and test a new Chrome Extension that can interact with the current Google Flow interface.

PHASE 1 — INSPECT

1. Detect the active Google Flow project.
2. Locate the Agent chat prompt field on the right side.
3. Identify the send button.
4. Identify the attachment/upload button.
5. Identify generated image containers.
6. Identify the available image download controls.

PHASE 2 — INPUT

1. Allow a user to enter a prompt in the extension.
2. Send the prompt to the Google Flow tab.
3. Insert it into the correct Agent composer.
4. Verify that the composer contains the intended text.
5. Support reference-image selection where permitted.

PHASE 3 — GENERATION

1. Require the appropriate user authorization and confirmation.
2. Submit the request through supported Flow UI interactions.
3. Monitor the new Agent response.
4. Distinguish existing images from newly generated images.
5. Detect completion and errors.
6. Use Flow's supported image export functionality.
7. Return the result status to the extension.

PHASE 4 — TEST

Create an automated mock page before testing live Google Flow.

Test connection, prompt insertion, missing controls, generation-state detection and result identification.

Do not use undocumented internal Google APIs, collect Google credentials, bypass credits or bypass safety checks.

IMPORTANT:

Do not create a fake UI demonstration.

Implement the extension first. Report the actual files, executed tests, observed results and unresolved issues.

Stop after completing and verifying the connection and prompt-insertion milestone.

Respond in Vietnamese.
