"use client";

import { useState, useCallback } from "react";
import type { ParsedReceipt } from "@/app/api/ocr/route";

// ---------------------------------------------------------------------------
// State machine for the OCR lifecycle
// ---------------------------------------------------------------------------

type OCRStatus =
  | { state: "idle" }
  | { state: "uploading" }
  | { state: "analyzing"; message: string; blobUrl: string }
  | { state: "success"; receipt: ParsedReceipt; blobUrl: string }
  | { state: "error"; message: string };

export function useOCR() {
  const [status, setStatus] = useState<OCRStatus>({ state: "idle" });

  const scan = useCallback(async (file: File) => {
    setStatus({ state: "uploading" });

    const form = new FormData();
    form.append("file", file);

    let response: Response;
    try {
      response = await fetch("/api/ocr", { method: "POST", body: form });
    } catch {
      setStatus({ state: "error", message: "Network error. Check your connection." });
      return;
    }

    if (!response.ok || !response.body) {
      setStatus({ state: "error", message: "Server error. Please try again." });
      return;
    }

    // --- Consume SSE stream ---
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const chunk of parts) {
        const eventLine = chunk.match(/^event: (\w+)/m)?.[1];
        const dataLine = chunk.match(/^data: (.+)/m)?.[1];
        if (!eventLine || !dataLine) continue;

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(dataLine);
        } catch {
          continue;
        }

        switch (eventLine) {
          case "status":
            setStatus({
              state: "analyzing",
              message: payload.message as string,
              blobUrl: (payload.blobUrl as string) ?? "",
            });
            break;
          case "result":
            setStatus({
              state: "success",
              receipt: payload.receipt as ParsedReceipt,
              blobUrl: payload.blobUrl as string,
            });
            break;
          case "error":
            setStatus({ state: "error", message: payload.message as string });
            break;
        }
      }
    }
  }, []);

  const reset = useCallback(() => setStatus({ state: "idle" }), []);

  return { status, scan, reset };
}
