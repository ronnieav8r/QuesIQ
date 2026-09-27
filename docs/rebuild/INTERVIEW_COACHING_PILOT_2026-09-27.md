# Owner Coaching pilot

User authorization: enable live Coaching, reuse the existing OpenAI key, and use
a $20 total application allowance. The user explicitly accepted that this is not
a guaranteed provider invoice cap and will control live testing.

## Scope

The exact server-configured account can use Coaching only. Other accounts,
other Interview modes, preparation generation and legacy audio remain blocked.
The existing models/voice are preserved: gpt-live-transcribe, gpt-5.4-mini,
gpt-4o-mini-tts / marin; the existing choice classifier uses gpt-5.4-nano.

Server settings: INTERVIEW_BETA_ENABLED=1,
INTERVIEW_COACHING_PILOT_ENABLED=1, INTERVIEW_COACHING_PILOT_USER_ID=<owned account>.
Use OPENAI_INTERVIEW_API_KEY and OPENAI_INTERVIEW_REALTIME_API_KEY on the dedicated
Interview Render service. Do not expose them to Expo. Setting the pilot flag to 0
and beta flag to 0 and redeploying closes new admission.

## Allowance and lifecycle

- $20 total across non-synthetic reservation history; no daily reset. Account and
  global daily allowances are also $20. Per-session allowance is $5.
- Five-minute session lease/deadline. New Coaching snapshots advertise five minutes.
- Text admission retains byte/token bounds, no hidden conversation/tools, and exact
  model tariffs. Requests reserve before dispatch under the existing DB lock.
- Each transcription attempt holds $1.10 and each speech request holds $0.25.
  These are deliberately conservative application allowances, not measured bills
  or proven worst-case prices. Unknown audio usage remains reserved after shutdown.
- Speech input is at most 1000 characters, download at most 4MB, request timeout
  30 seconds. These bound app inputs/resources; local cancellation is not proof
  of provider billing termination.
- The Node server supervises durable transcription deadlines/stops every two seconds;
  failed hangups stay queued. Startup resumes deadlines and stale checks without
  unconditionally killing calls during a rolling deployment. New admission requires
  a recently successful sweep. Render remains one instance.
- Host failure, unavailable provider call IDs, delayed usage, and provider billing
  remain pilot limitations. This change does not mark general audio activation as
  verified or certify public-release readiness.

## Evidence

Existing key: authenticated models-list check passed for the three core models.
Local beta/voice-safety and pilot service tests pass; pilot checks cover foreign
account/session/mode denial, unsupported kinds, exact audio request bounds, replay
dispatch prevention, concurrent lifetime allowance, retained old settled charges,
unique transcription attempts, five-minute deadline and owned termination.
Production build and focused lint are required before deployment. Hosted proof is
recorded in the execution ledger after deployment; it is not implied by this file.

Tariffs reviewed September 27, 2026 from official model pages:
[transcription](https://developers.openai.com/api/docs/models/gpt-live-transcribe),
[speech](https://developers.openai.com/api/docs/models/gpt-4o-mini-tts),
[Mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini),
[nano](https://developers.openai.com/api/docs/models/gpt-5.4-nano).

Main gpt-6-astra/high; one gpt-6-luna/medium read-only review identified the
transcription retry-identity and rolling-startup issues, both corrected by the main agent.
