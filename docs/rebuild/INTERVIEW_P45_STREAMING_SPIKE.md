# P4.5 native TTS transport feasibility spike

Scope frozen 2026-09-08 in QuesIQ-dev, codex/interview-mobile, HEAD64344c1
with accepted P4.2-P4.4 and earlier documentation changes preserved.

## Decision and evidence boundary

Progressive HTTP encoded audio is a feasible API path in installed
expo-audio57.0.4. Reliability and latency on a physical phone remain unproven.
Keep learner Coaching on the validated full-file path. This slice adds a
developer-only runnable comparison harness; it does not promote a production
transport or certify heard audio.

Reviewed sources:

- [Expo SDK57 Audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/): remote
  sources, request headers, downloadFirst and player lifecycle/status APIs.
- Installed node_modules/expo-audio/src/Audio.types.ts: URI/header sources;
  downloadFirst defaults false. No encoded-chunk append playback interface.
- Android AudioModule.kt, createMediaSource/buildMediaSourceFactory:
  OkHttpDataSource and ProgressiveMediaSource for ordinary remote audio.
- iOS AudioUtils.swift, createAVPlayerItem: AVURLAsset with request headers;
  AudioPlayer.swift removes observers/cancellables on release.
- useAudioStream captures microphone PCM; it is not a playback append API.

One Luna/medium worker performed the bounded read-only installed-source review.
Manager verified relevant source paths and owns implementation/tests. No worker
writes, recursive delegation or measured cost-saving claim.

## Implementation

The mobile turn route returns JSON only after full TTS generation. Changing only
player settings cannot remove that wait. A future promoted path needs a separately
playable, owned audio resource after complete controlled-response validation,
preserving request correlation, provider usage, replay and recovery. This spike
adds no paid/production endpoint.

apps/mobile/src/app/coaching-stream-spike.tsx is disabled unless __DEV__ and
EXPO_PUBLIC_COACHING_STREAM_SPIKE_ORIGIN are both set. It has no learner tab,
microphone request or automatic audio/network action on mount. A comparison tap
fetches the complete manifest, parses the shared Coaching contract, checks passed
validation, then attaches an actual Expo AudioPlayer. Stream mode uses
downloadFirst=false. Full-file mode downloads identical bytes to a version1
temporary file before attaching its local URI.

The controller invalidates before stop/release, aborts pending fetches, deletes
completed/stale downloads and ignores late callbacks. The entire short fixture
has a30second timeout. Failure never automatically repeats audio; Compare full
file is the explicit fallback. Background/unmount stop the run. Production
lifecycle and P4.4 percentile observations are unchanged.

coachingSpeechText keeps complete feedback and answer/retry questions. Choice
states speak only “Choose your next step.” The on-screen structured menu remains.
No model prompt/selection change is made.

## Local fixture server

The disposable process binds only127.0.0.1:3217 and makes no provider, DB or
credential calls. It is not a second product/backend deployment. It serves
validated metadata and identical progressive/full audio resources, Content-Length,
Content-Type, single explicit byte ranges and no-store headers. Progressive writes
respect backpressure; close clears paced writes. Logs contain event names/times,
not learner text. Stop the process after the experiment.

```powershell
npx tsx scripts/interview/run-coaching-stream-fixture.ts normal
```

Default audio is a six-second low-amplitude synthetic WAV tone. It proves fixture
transport behavior only, not TTS or perceptual quality. For separately authorized
approved-TTS work, supply an existing reviewed generic MP3 and its corresponding
complete ChainedCoachingTurn JSON:

```powershell
npx tsx scripts/interview/run-coaching-stream-fixture.ts normal GENERIC.mp3 TURN.json
```

MP3 and TURN must correspond; the operator declaration is not machine verification
of audio semantics. Use no learner-specific content. MP3 is bounded to2MB,
manifest to32KB; omit embedded base64 audio. Supply both files or neither.
Use stall or truncate instead of normal for broken transport; /full stays intact.
Unknown paths/methods/ranges are rejected.

## Cache policy

Reusable clip allowlist is empty. Dynamic feedback, personal questions and raw
answer audio must not enter a shared cache. The generic cue remains part of the
complete response; caching it separately would require sequencing/voice work
without established benefit. No cross-session cache or persistence is introduced.

Full-file comparison uses quesiq-stream-spike-v1-* temporary names, one active
file per run, deletion on stop/completion/failure/unmount and stale-download
cleanup. OS cache eviction is the fallback. Durable crash/restart cleanup and
existing Coaching spool behavior belong to P4.6. Future reusable clips require
an explicit generic allowlist, text/model/voice/format/version key, bounded
storage, invalidation and deletion before enabling reuse.

## Separately authorized operator procedure

Do not launch a device or play audio as part of the local automated gate.
When device work is authorized, start Metro with
EXPO_PUBLIC_COACHING_STREAM_SPIKE_ORIGIN=http://127.0.0.1:3217 and open
quesiq-interview://coaching-stream-spike in the development build. Android needs
the usual port reverse for3217; 10.0.2.2 is allowed for a configured emulator.
Only loopback origins are accepted. This does not establish an iPhone LAN/signing
workflow; that remains a separate gate.

1. Confirm no traffic/audio before a tap. Compare stream and full file with the
   same approved MP3, device/build/network/audio route and player settings.
2. Record first positive playing position, buffering, perceived start and full
   completion against transport logs. Controller firstAudioMs starts at comparison
   tap/manifest load, not Done; never merge it into the P4.4 voice baseline.
3. Stop/background during metadata, download, initial buffering and playback.
   Confirm silence, release, closed stream and absent temporary files.
4. Repeat with stall/truncate; inspect explicit full-file fallback and no overlap,
   late playback or second provider request. Check unsupported media too.
5. Do not promote until approved MP3 plays before the last bytes arrive on both
   target platforms and cleanup/recovery passes. Report buffering that negates
   the gain. Keep full-file fallback if unreliable.

Production auth/resource expiry, provider-cancellation accounting, post-validation
delivery, stable recovery URLs and both platforms' media behavior must be resolved
before promotion. This local spike creates no latency promise.
