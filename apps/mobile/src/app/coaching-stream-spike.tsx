import { useEffect, useMemo, useState } from "react";
import { AppState, Text } from "react-native";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { File, Paths } from "expo-file-system";
import { Button } from "@/components/ui/button";
import { SessionFrame } from "@/components/ui/session-frame";
import { CoachingStreamSpike, type SpikeState } from "@/lib/coaching-stream-spike";
import { colors } from "@/theme/tokens";

async function downloadFixture(url: string, signal: AbortSignal) {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error("Fixture unavailable");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (signal.aborted || bytes.length > 2_000_000) throw new Error("Invalid download");
      const file = new File(Paths.cache, `quesiq-stream-spike-v1-${Date.now()}.${url.endsWith("mp3") ? "mp3" : "wav"}`);
      const dispose = () => { try { if (file.exists) file.delete(); } catch { /* OS cache eviction is the final fallback. */ } };
      try { file.create(); file.write(bytes); } catch (error) { dispose(); throw error; }
      return { uri: file.uri, dispose };
    }

const origin = process.env.EXPO_PUBLIC_COACHING_STREAM_SPIKE_ORIGIN;
export default function CoachingStreamSpikeRoute() {
  if (!__DEV__ || !origin) return <Text>Development spike disabled.</Text>;
  return <Spike origin={origin} />;
}
function Spike({ origin }: { origin: string }) {
  const [state, setState] = useState<SpikeState>({ mode: "stream", phase: "stopped" });
  const spike = useMemo(() => new CoachingStreamSpike({
    changed: setState,
    prepare: () => setAudioModeAsync({ allowsRecording: false, shouldPlayInBackground: false, playsInSilentMode: true }),
    manifest: async (url, signal) => {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error("Fixture unavailable");
      const text = await response.text();
      if (text.length > 32_768) throw new Error("Fixture too large");
      return JSON.parse(text);
    },
    download: downloadFixture,
    play: (uri, status) => {
      const player = createAudioPlayer({ uri }, { downloadFirst: false, updateInterval: 100 });
      const subscription = player.addListener("playbackStatusUpdate", status);
      const stop = () => { subscription.remove(); try { player.pause(); } finally { player.remove(); } };
      try { player.play(); } catch (error) { stop(); throw error; }
      return stop;
    },
  }), []);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (value) => { if (value !== "active") spike.stop(); });
    return () => { subscription.remove(); spike.stop(false); };
  }, [spike]);
  return <SessionFrame active={state.phase === "playing"} status="Development audio spike" timer="P4.5" footer={<>
    <Button label="Compare HTTP stream" onPress={() => { void spike.start(origin, "stream"); }} />
    <Button label="Compare full file" variant="secondary" onPress={() => { void spike.start(origin, "file"); }} />
    <Button label="Stop" variant="danger" onPress={() => spike.stop()} />
  </>}>
    <Text style={{ color: colors.text }}>Fixture transport experiment. No learner session or provider call. Audio starts only after a comparison tap. Default fixture is a synthetic tone, not TTS evidence.</Text>
    <Text selectable style={{ color: colors.text }}>{JSON.stringify(state, null, 2)}</Text>
  </SessionFrame>;
}
