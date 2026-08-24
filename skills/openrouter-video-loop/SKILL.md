# OpenRouter controlled illustration loop

Plan a private, illustrated ambient-video loop without camera drift.

## Required process

1. Fetch `https://openrouter.ai/api/v1/videos/models` before selecting a model.
2. Select only a model that advertises `first_frame`, `last_frame`, 720p output, and a six-second duration.
3. Prefer `bytedance/seedance-2.0-fast`; use `bytedance/seedance-2.0` only when higher-quality output is needed.
4. Treat the station illustration as private. A generation may use only a server-created, short-lived signed source URL. Never expose or log the URL.
5. Use the same illustration for first and last frame. Keep the camera locked; request only a short typing gesture, blink, or background orbital movement.
6. Generate silent video. Never replace the station soundtrack.
7. Present a sanitized request preview and require human confirmation before POSTing to `/api/v1/videos`.
8. Poll server-side with a bounded retry policy, then store accepted output in the private station library.

## Rejection criteria

Reject any output that changes camera position, character identity, composition, or background geometry. Do not use generative video for a whole-scene camera move.
