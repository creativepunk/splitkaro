"use client";

import { useState, useCallback } from "react";
import { parseReceiptText, type ParsedReceipt } from "@/lib/parseReceipt";

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export type OCRStatus =
  | { state: "idle" }
  | { state: "uploading" }
  | { state: "analyzing"; message: string }
  | { state: "success"; receipt: ParsedReceipt }
  | { state: "error"; message: string };

// ---------------------------------------------------------------------------
// Hook — runs Tesseract.js entirely in the browser, no API key required
// ---------------------------------------------------------------------------

export function useOCR() {
  const [status, setStatus] = useState<OCRStatus>({ state: "idle" });

  const scan = useCallback(async (file: File) => {
    setStatus({ state: "uploading" });

    try {
      // Dynamic import keeps Tesseract's WASM out of the initial bundle
      const { createWorker } = await import("tesseract.js");

      setStatus({ state: "analyzing", message: "Loading OCR engine…" });

      const worker = await createWorker("eng", undefined as unknown as number, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") {
            setStatus({
              state: "analyzing",
              message: `Scanning receipt… ${Math.round(m.progress * 100)}%`,
            });
          }
        },
      });

      setStatus({ state: "analyzing", message: "Reading receipt…" });

      const {
        data: { text },
      } = await worker.recognize(file);
      await worker.terminate();

      const receipt = parseReceiptText(text);
      setStatus({ state: "success", receipt });
    } catch (err) {
      setStatus({
        state: "error",
        message:
          err instanceof Error
            ? err.message
            : "OCR failed. Please enter items manually.",
      });
    }
  }, []);

  const reset = useCallback(() => setStatus({ state: "idle" }), []);

  return { status, scan, reset };
}
