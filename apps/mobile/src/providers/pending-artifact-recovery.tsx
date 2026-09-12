import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppState, Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { bootstrapQueryKey } from "@/lib/bootstrap";
import { cleanupExpiredCoachingAudio, deletePendingArtifact, listPendingArtifacts, savePendingArtifact, type PendingArtifactRecord } from "@/lib/pending-artifact";
import { persistRecoveredArtifact, withArtifactPersistenceLock } from "@/lib/session-persistence";
import { useAuth } from "@/providers/auth-provider";
import { useActiveSession } from "@/providers/session-provider";
import { Button } from "@/components/ui/button";
import { colors, spacing } from "@/theme/tokens";

type RecoveryDependencies = {
  list: () => Promise<PendingArtifactRecord[]>;
  persist: (record: PendingArtifactRecord) => Promise<void>;
  remove: (sessionId: string) => void;
  canRecover?: (record: PendingArtifactRecord) => boolean;
};
export async function recoverPendingArtifacts(dependencies: RecoveryDependencies) {
  const records = await dependencies.list();
  let recovered = 0, retained = 0;
  for (const record of records) {
    if (dependencies.canRecover && !dependencies.canRecover(record)) continue;
    try {
      await dependencies.persist(record);
      if (dependencies.canRecover && !dependencies.canRecover(record)) continue;
      dependencies.remove(record.sessionId); recovered++;
    } catch { retained++; }
  }
  return { recovered, retained };
}
export function PendingArtifactRecovery() {
  const { ready, request, user } = useAuth();
  const { activeSession } = useActiveSession();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{ owner: string; text: string }>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!ready || !user) return;
    let active = true, running = false;
    const abort = new AbortController();
    const ownerId = user.id;
    const ownedRequest: typeof request = (path, init) => {
      if (!active) return Promise.reject(new Error("Account changed"));
      return request(path, { ...init, signal: abort.signal });
    };
    const recover = async () => {
      if (running || !active) return;
      running = true;
      try {
        if (!activeSession?.id) { try { cleanupExpiredCoachingAudio(); } catch { /* Recovery records remain independent of audio cache cleanup. */ } }
        const result = await recoverPendingArtifacts({
          list: () => listPendingArtifacts(ownerId),
          canRecover: (record) => active && (!record.ownerId || record.ownerId === ownerId) && record.sessionId !== activeSession?.id,
          persist: (record) => withArtifactPersistenceLock(ownerId, record.sessionId, async () => {
            await persistRecoveredArtifact(ownedRequest, record, () => {
              if (active) savePendingArtifact({ ...record, ownerId, serverSaved: true });
            }, () => {
              if (!active) throw new Error("Account changed");
              if (!record.ownerId) savePendingArtifact({ ...record, ownerId });
            });
          }),
          remove: (id) => deletePendingArtifact(id, ownerId, true),
        });
        if (active) {
          setNotice(result.retained ? { owner: ownerId, text: "Some saved practice needs attention. Retry recovery when connected." } : undefined);
          if (result.recovered) await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
        }
      } catch { if (active) setNotice({ owner: ownerId, text: "Device recovery could not be checked. Please retry." }); }
      finally { running = false; }
    };
    void recover();
    const app = AppState.addEventListener("change", (state) => { if (state === "active") void recover(); });
    const network = NetInfo.addEventListener((state) => { if (state.isConnected) void recover(); });
    return () => { active = false; abort.abort(); app.remove(); network(); };
  }, [ready, request, user, activeSession?.id, queryClient, retry]);
  if (!notice || notice.owner !== user?.id || activeSession) return null;
  return <View style={{ padding: spacing.md, backgroundColor: colors.panel }}>
    <Text style={{ color: colors.text }} accessibilityLiveRegion="polite">{notice.text}</Text>
    <Button label="Retry saved sessions" onPress={() => setRetry((value) => value + 1)} />
  </View>;
}
