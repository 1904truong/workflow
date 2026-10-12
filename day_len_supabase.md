#—IMPLEMENT AUTOMATIC SUPABASE CLOUD IMAGE STORAGE

## ROLE

You are a senior Chrome Extension engineer specializing in Manifest V3, React, TypeScript, Google Flow automation, and Supabase.

## OBJECTIVE

Implement a complete automatic cloud image-saving system for my personal TobyFlow Chrome Extension.

IMPORTANT:

- Cloud-only storage.
- Never automatically download images to the computer.
- Keep the existing TobyFlow interface and features.
- Do not add paid plans, premium features, or subscription systems.
- Use the existing Supabase project.
- Do not introduce a paid image-generation API.

## PHASE 1 — PROJECT INSPECTION

Before writing code:

1. Inspect the entire current project structure.
2. Identify React components and Extension entry points.
3. Inspect manifest.json.
4. Identify how TobyFlow interacts with Google Flow.
5. Identify existing Supabase configuration and authentication.
6. Determine how Google Flow results are detected.
7. Determine whether original image files can be accessed.

Do not assume the Google Flow DOM structure.

## PHASE 2 — SUPABASE DATABASE

Implement:

- generation_jobs table
- generated_images table
- Private Storage bucket: flow-images
- Supabase Auth integration
- Row Level Security
- User-specific storage paths

Each image must be associated with the correct generation job.

## PHASE 3 — AUTOMATIC IMAGE DETECTION

When a TobyFlow generation task starts:

1. Create a unique job ID.
2. Record the prompt, model, aspect ratio, and expected output count.
3. Observe Google Flow for completed results.
4. Match generated results to the correct job.
5. Retrieve the original image file, not a thumbnail.
6. Detect MIME type and image dimensions.
7. Validate file integrity.
8. Pass the image to the upload system.

Support multiple simultaneous or sequential generation jobs without mixing results.

## PHASE 4 — CLOUD UPLOAD

Implement a persistent upload queue.

Requirements:

- Upload directly to Supabase Storage.
- Save metadata to PostgreSQL.
- Prevent duplicate uploads.
- Retry temporary failures.
- Recover from Manifest V3 service worker suspension.
- Persist job status.
- Handle partial uploads.
- Verify Storage and Database before marking success.
- Use deterministic object paths and safe retry logic.
- Never overwrite a different image.
- Do not store Google account cookies or credentials.

## PHASE 5 — IMAGE LIBRARY UI

Add a new Image Library tab to TobyFlow.

Preserve the existing dark theme, spacing, typography, and lime-green accent.

Features:

- Responsive image grid
- Original image preview
- Prompt information
- Model information
- Aspect ratio
- Creation date
- Upload status
- Search and filtering
- Copy prompt
- Manual download
- Delete image
- Signed URL support for private images

No premium badges, upgrade buttons, subscriptions, or credit purchasing features.

## PHASE 6 — AUTO SAVE SETTINGS

Add a setting:

Auto Save to Supabase Cloud

Default: ON

When enabled:
Automatically upload every successfully generated image.

When disabled:
Do not upload automatically.

Never download files locally unless the user explicitly clicks Download.

## PHASE 7 — ERROR HANDLING

Handle:

1. No Supabase session.
2. Expired authentication.
3. Missing Storage bucket.
4. Storage permission denied.
5. Google Flow image not found.
6. Blob URL inaccessible.
7. Thumbnail detected instead of original.
8. Network interruption.
9. Service worker suspended.
10. Duplicate image detection.
11. Storage upload succeeded but Database insert failed.
12. Multiple images from one prompt.
13. User closes the side panel.
14. User navigates away from Google Flow.
15. Unsupported image format.
16. Insufficient Supabase storage quota.

Never silently report success when upload verification fails.

## PHASE 8 — TESTING

Test the full workflow:

TobyFlow → Google Flow → Detect Result → Extract Original Image → Upload Storage → Save Metadata → Verify → Image Library

Test generation of 1, 2, 3, and 4 images.

Test retry behavior, duplicate prevention, authentication, and database security.

Test with mock data first, then perform an actual end-to-end test.

Do not delete existing production data during tests.

## PHASE 9 — DELIVERY

After implementation, provide:

1. List of files created and modified.
2. SQL migrations.
3. Manifest permissions added.
4. Supabase configuration steps.
5. Explanation of the image extraction method.
6. Upload and retry architecture.
7. Actual test results.
8. Known limitations.

Do not claim completion until the entire flow is verified.

Start by analyzing my existing TobyFlow source code. Do not rewrite the whole extension.
