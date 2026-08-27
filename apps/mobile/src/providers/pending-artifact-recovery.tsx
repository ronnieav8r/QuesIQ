import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import { bootstrapQueryKey } from "@/lib/bootstrap";
import {
  deletePendingArtifact,
  listPendingArtifacts,
  type PendingArtifactRecord,
} from "@/lib/pending-artifact";
import { persistSessionArtifact } from "@/lib/session-persistence";
import { useAuth } from "@/providers/auth-provider";

type RecoveryDependencies = {
  list: () => Promise<PendingArtifactRecord[]>;
  persist: (record: PendingArtifactRecord) => Promise<void>;
  remove: (sessionId: string) => void;
};

export async function recoverPendingArtifacts(dependencies: RecoveryDependencies) {
  const records = await dependencies.list();
  let recovered = 0;
  let retained = 0;

  for (const record of records) {
    try {
      await dependencies.persist(record);
      dependencies.remove(record.sessionId);
      recovered += 1;
    } catch {
      retained += 1;
    }
  }

  return { recovered, retained };
}

export function PendingArtifactRecovery() {
  const { ready, request, user } = useAuth();
  const queryClient = useQueryClient();
  const runningRef = useRef(false);

  const recover = useCallback(async () => {
    if (!ready || !user || runningRef.current) return;
    runningRef.current = true;
    try {
      const result = await recoverPendingArtifacts({
        list: listPendingArtifacts,
        persist: (record) => persistSessionArtifact(
          request,
          record.sessionId,
          record.artifact,
        ),
        remove: deletePendingArtifact,
      });
      if (result.recovered > 0) {
        await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
      }
      if (__DEV__ && (result.recovered > 0 || result.retained > 0)) {
        console.info(`QUESIQ_PENDING_ARTIFACT_RECOVERY ${JSON.stringify(result)}`);
      }
    } finally {
      runningRef.current = false;
    }
  }, [queryClient, ready, request, user]);

  useEffect(() => {
    void recover();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void recover();
    });
    return () => subscription.remove();
  }, [recover]);

  return null;
}
