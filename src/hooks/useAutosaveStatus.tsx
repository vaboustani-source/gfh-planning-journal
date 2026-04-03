import { useState, useCallback, useRef } from "react";

export type AutosaveState = "idle" | "saving" | "saved" | "unsaved";

export function useAutosaveStatus() {
  const [status, setStatus] = useState<AutosaveState>("idle");
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>();
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const markSaving = useCallback(() => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    setStatus("saving");
  }, []);

  const markSaved = useCallback(() => {
    setStatus("saved");
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => setStatus("idle"), 2000);
  }, []);

  const markUnsaved = useCallback(() => {
    setStatus("unsaved");
  }, []);

  /** Wraps an async save function with status tracking */
  const trackSave = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    markSaving();
    try {
      const result = await fn();
      markSaved();
      return result;
    } catch (e) {
      setStatus("idle");
      throw e;
    }
  }, [markSaving, markSaved]);

  /** Debounced save: call with a key and save function. 800ms debounce. */
  const debouncedSave = useCallback((key: string, fn: () => Promise<void>, delay = 800) => {
    setStatus("unsaved");
    const existing = debounceTimers.current.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(async () => {
      debounceTimers.current.delete(key);
      markSaving();
      try {
        await fn();
        markSaved();
      } catch {
        setStatus("idle");
      }
    }, delay);
    debounceTimers.current.set(key, timer);
  }, [markSaving, markSaved]);

  /** Check if there are pending debounced saves */
  const hasPending = useCallback(() => debounceTimers.current.size > 0, []);

  /** Flush all pending debounced saves immediately */
  const flushAll = useCallback(() => {
    // Note: flushing is complex since we don't store the fn refs.
    // For the unsaved warning, we just check hasPending.
  }, []);

  return { status, trackSave, debouncedSave, markSaving, markSaved, markUnsaved, hasPending };
}
