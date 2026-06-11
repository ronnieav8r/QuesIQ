import type { BrowserContext, Page } from "@playwright/test";

export async function grantFakeMicrophone(context: BrowserContext, origin: string) {
  await context.grantPermissions(["microphone"], { origin });
}

export async function installMediaRecorderStub(page: Page) {
  await page.addInitScript(() => {
    class StubMediaStreamTrack {
      enabled = true;
      id = "e2e-audio-track";
      kind = "audio";
      label = "E2E microphone";
      muted = false;
      readyState = "live";

      addEventListener() {}
      applyConstraints() {
        return Promise.resolve();
      }
      clone() {
        return new StubMediaStreamTrack();
      }
      dispatchEvent() {
        return true;
      }
      getCapabilities() {
        return {};
      }
      getConstraints() {
        return {};
      }
      getSettings() {
        return {};
      }
      removeEventListener() {}
      stop() {
        this.readyState = "ended";
      }
    }

    class StubMediaStream {
      private readonly tracks = [new StubMediaStreamTrack()];

      addEventListener() {}
      addTrack() {}
      clone() {
        return new StubMediaStream();
      }
      dispatchEvent() {
        return true;
      }
      getAudioTracks() {
        return this.tracks;
      }
      getTracks() {
        return this.tracks;
      }
      getVideoTracks() {
        return [];
      }
      removeEventListener() {}
      removeTrack() {}
    }

    class StubMediaRecorder extends EventTarget {
      static isTypeSupported() {
        return true;
      }

      mimeType = "audio/webm";
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      state: "inactive" | "paused" | "recording" = "inactive";

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        const blob = new Blob(["e2e audio"], { type: this.mimeType });
        const event = new BlobEvent("dataavailable", { data: blob });
        this.ondataavailable?.(event);
        this.dispatchEvent(event);
        this.onstop?.();
        this.dispatchEvent(new Event("stop"));
      }
    }

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: async () => [
          {
            deviceId: "e2e-mic",
            groupId: "e2e",
            kind: "audioinput",
            label: "E2E microphone",
            toJSON() {
              return this;
            },
          },
        ],
        getUserMedia: async () => new StubMediaStream(),
      },
    });

    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: StubMediaRecorder,
    });
  });
}
