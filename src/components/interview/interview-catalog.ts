import { useEffect, useState } from "react";

import { fallbackInterviewCatalog } from "@/product/practice-data";
import type { InterviewCatalog } from "@/product/interview-types";

type InterviewCatalogState = {
  catalog: InterviewCatalog;
  error?: string;
  source: "fallback" | "server";
  status: "idle" | "loaded" | "loading";
};

export function useInterviewCatalog(): InterviewCatalogState {
  const [state, setState] = useState<InterviewCatalogState>({
    catalog: fallbackInterviewCatalog,
    source: "fallback",
    status: "idle",
  });

  useEffect(() => {
    let ignore = false;

    async function loadCatalog() {
      try {
        setState((current) => ({
          ...current,
          error: undefined,
          status: "loading",
        }));
        const response = await fetch("/api/catalog");
        const body = (await response.json()) as {
          catalog?: InterviewCatalog;
          detail?: string;
          error?: string;
        };

        if (!response.ok || !body.catalog) {
          throw new Error(body.detail || body.error || "Interview catalog could not be loaded.");
        }

        if (!ignore) {
          setState({
            catalog: body.catalog,
            source: "server",
            status: "loaded",
          });
        }
      } catch (error) {
        if (!ignore) {
          setState({
            catalog: fallbackInterviewCatalog,
            error:
              error instanceof Error
                ? error.message
                : "Interview catalog could not be loaded.",
            source: "fallback",
            status: "loaded",
          });
        }
      }
    }

    void loadCatalog();

    return () => {
      ignore = true;
    };
  }, []);

  return state;
}
