# Voice provider guarantee clarification

Updated: 2026-09-12. Status: **DEFERRED BY USER; REQUEST PREVIOUSLY SUBMITTED**.
Main: gpt-6-astra / medium. Subagents: none.

On 2026-09-12 the user chose to omit this step for now. No further support
follow-up is planned, and independent local work need not await a reply. The
submission history remains below; the response was not rechecked or the request
withdrawn. Live activation guards remain unchanged. Earlier next-action language
in this packet is historical and superseded by this direction.

Submission update: the user authorized sending this request. Its full text was
entered and submitted to the OpenAI Help Center chat at https://help.openai.com/en.
The user supplied the reply email and authorized its use. The chat confirmed
"Email received" and displayed "Reviewing the request." No ticket number or
human escalation has yet been confirmed. This is submission to the support
assistant, not a technical guarantee or confirmation of human review.
The browser conversation was preserved for continuation. Live guards remain blocked.

Historical preparation scope: this is the next documentation package from the
[activation proof](INTERVIEW_CHAINED_VOICE_ACTIVATION_PROOF.md). No account access,
provider call, support contact, live activation or spending occurred. Answers
below describe public documentation, not account-specific provider confirmation.

## Current answers and unresolved questions

All linked sources were reviewed on 2026-09-10, using official documentation
retrieved in this session. The earlier proof package contains the request/code
cross-check and billing-unit inventory.

| ID | Finding | Missing provider clarification / acceptance rule |
| --- | --- | --- |
| Q1 Speech ceiling | The [speech request](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create) describes input limits and audio options, with no explicit output-token or duration ceiling in the reviewed parameter list. | Require a numerical provider-enforced maximum charge or maximum billed output quantity for the exact model/path, with conditions and tariff units. Input truncation and client timeout do not satisfy it. **UNRESOLVED**. |
| Q2 Speech cancellation and accounting | Current MP3 integration records bytes and request ID, not complete usage. The speech reference's output options do not establish a cancellation-to-billing deadline. | Require cancellation semantics, maximum billed tail, and authoritative request-attributable input/output usage, including partial/failed requests. **UNRESOLVED**. |
| Q3 Transcription exchange and identity | [Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription) supports `gpt-live-transcribe`, transcription sessions and WebRTC, with explicit commit and plural `languages`. | Exact multipart `/v1/realtime/calls` admission, durable trusted call ID and hangup applicability still need confirmation and subsequent live verification. **PARTIALLY DOCUMENTED**. |
| Q4 Duration and failure cap | [Realtime conversations](https://developers.openai.com/api/docs/guides/realtime-conversations) states a 60-minute Realtime maximum in its speech-to-speech section. This is a relevant lead, not proof of transcription billing semantics. | Confirm applicability to dedicated transcription; start point, server enforcement, disconnected/orphan behavior, billed duration definition, rounding and maximum tail. Only then derive a tariff-based bound. **UNRESOLVED**. |
| Q5 Orphan recovery and stop evidence | Local implementation cannot recover a provider ID lost before durable storage; queued stops and retry timeouts are not cessation evidence. | Require documented finite orphan lifetime or independent identity recovery, and authoritative evidence that hangup stops processing/billing. **UNRESOLVED**. |
| Q6 Transcription usage reconciliation | Transcript completion is not final billing evidence. Existing generic file-transcription usage parsing does not certify this live model. | Require exact live-model usage event/API, identity linkage, delivery/retrieval guarantees, billing latency and reconciliation method after failed connections. **UNRESOLVED**. |

Do not borrow `POST /v1/live/sessions` initialization charges or GPT-Live close
events for this Realtime transcription path. The Markdown WebRTC guide fetched
with `?api=realtime` returned Live-oriented content during this review; that
response is excluded as evidence for this path's billing or close contract.
No API account/model availability was tested.

## Ready-to-send request

**Subject:** API guarantees for bounded TTS and WebRTC transcription billing

Hello OpenAI Support,

We are preparing an interview-practice application and need to confirm provider
limits before enabling paid voice calls. We have not run a live validation for
this implementation. Could you provide authoritative documentation or written
technical clarification for the following exact paths?

- Speech: `POST /v1/audio/speech`, `gpt-4o-mini-tts`, voice `marin`, MP3 output.
  Our application truncates the input to 1,000 JavaScript string code units and
  uses a 30-second HTTP timeout. We do not assume these cap provider billing.
- Transcription: multipart `POST /v1/realtime/calls` with an SDP offer and the
  session configuration below, followed by server-side call termination.

```json
{
  "type": "transcription",
  "audio": {
    "input": {
      "format": { "rate": 24000, "type": "audio/pcm" },
      "noise_reduction": { "type": "near_field" },
      "transcription": { "languages": ["en"], "model": "gpt-live-transcribe" },
      "turn_detection": null
    }
  }
}
```

1. **TTS maximum charge:** Is there a provider-enforced maximum audio-output
   token count or duration per request for this speech model? Can a caller set
   it? Please specify the maximum and all conditions needed to bound total
   billed input/output, including any internal retries. If no such guarantee is
   available, please confirm that explicitly.
2. **TTS abort and usage:** Does aborting the HTTP request stop generation and
   billing? Is there a guaranteed maximum billed tail? How can we obtain final
   authoritative input/audio-output quantities attributable to one request,
   including incomplete responses, errors and disconnects? If a different
   response format is required for usage, please identify it without changing
   the model.
3. **Transcription transport/control:** Is the exact multipart transcription
   request above supported? Does the response provide a stable call identifier
   through `Location`, usable with `POST /v1/realtime/calls/{call_id}/hangup`?
   Please identify any account restrictions and exact identifier/response contract.
4. **Finite transcription billing:** Does the documented 60-minute Realtime
   maximum apply to this dedicated `gpt-live-transcribe` session? When does its
   clock start, and is it enforced if the client or our server disappears?
   Does billing count connected wall time, received/processed audio, silence,
   uncommitted buffers, setup or post-hangup work? What rounding, minimum charge
   and maximum billing tail apply? Is a shorter provider-enforced lifetime available?
5. **Orphan calls and termination:** If the provider accepts the call but our
   server fails before persisting its ID, is there supported independent recovery
   or a guaranteed finite lifetime? What does successful hangup guarantee, what
   do repeat hangup/404 responses mean, and what independent event or query proves
   cessation when the original connection is gone?
6. **Transcription usage:** Which server-accessible events or API expose final
   billable duration for this exact model, including failure cases? How is it
   linked to call/request ID, retrieved after disconnect, and reconciled with
   billed charges? Please specify rounding and expected reporting delay.

Relevant references we reviewed:

- [Speech request](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create)
- [Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription)
- [Realtime session duration](https://developers.openai.com/api/docs/guides/realtime-conversations)
- [Hangup reference](https://developers.openai.com/api/reference/python/resources/realtime/subresources/calls/methods/hangup)

For each answer, please specify the model/endpoint scope, effective date and
documentation link where available. We need enforced limits distinguished from
typical latency, estimates and best-effort behavior. We are not requesting
activation or a paid test. Thank you.

## Sending and processing the response

The request above is a draft for user review; its six questions and JSON are
self-contained. Never attach the repository, credentials, SDP, personal
audio or account identifiers. If support needs account context, supply it only
through an authenticated channel after authorization. No recipient/channel was
selected or accessed here.

When an authorized response arrives, preserve the original in a restricted local
record and add one answer per Q1-Q6 with source/date, exact applicable model and
endpoint, numerical limits/units where provided, conditions, and unresolved gaps.
Distinguish a written guarantee from a suggested experiment or a typical value.
Do not fill omissions with assumptions or transform support wording into a
stronger guarantee. Record explicit negative answers as resolved-negative;
they can settle the question while leaving activation blocked.

Reconcile any contradiction with the original source before changing a verdict.
For an asserted 60-minute cap, confirm all Q4 conditions before computing a
maximum charge; do not install a tariff or choose a live budget in this package.
Written clarification can inform a later implementation/test proposal but does
not substitute for account-specific endpoint, termination or billing verification.

**Outcome:** Q1, Q2, Q4, Q5 and Q6 unresolved; Q3 partially documented. All live
guards remain blocked. Next action is review and authorized submission of this
request, followed by assessment of the response. No supervisor or runner work is
implicitly authorized. Validation is limited to documentation links, whitespace
and changed-file scope; no application tests/builds were run.
