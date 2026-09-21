import { useCallback, useEffect, useRef, useState } from "react";
import type { TimerMode } from "../types";

export type TimerStatus = "idle" | "running" | "paused" | "finished";

const TICK_INTERVAL_MS = 250;
export const MAX_DURATION_MS = 24 * 60 * 60 * 1000;

export function useTimer(initialDurationMs = 5 * 60 * 1000) {
  const [mode, setModeState] = useState<TimerMode>("countdown");
  const [status, setStatus] = useState<TimerStatus>("idle");
  const [durationMs, setDurationMs] = useState(initialDurationMs);
  const [remainingMs, setRemainingMs] = useState(initialDurationMs);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [activeElapsedMs, setActiveElapsedMs] = useState(0);
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [endedAtMs, setEndedAtMs] = useState<number | null>(null);

  const modeRef = useRef<TimerMode>("countdown");
  const statusRef = useRef<TimerStatus>("idle");
  const durationRef = useRef(initialDurationMs);
  const remainingRef = useRef(initialDurationMs);
  const elapsedRef = useRef(0);
  const activeElapsedRef = useRef(0);
  const endsAtRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const activeStartedAtRef = useRef<number | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);

  modeRef.current = mode;
  statusRef.current = status;
  durationRef.current = durationMs;
  remainingRef.current = remainingMs;
  elapsedRef.current = elapsedMs;
  activeElapsedRef.current = activeElapsedMs;

  const setMode = useCallback(
    (nextMode: TimerMode) => {
      if (statusRef.current === "running") return false;
      if (nextMode === modeRef.current) return true;

      setModeState(nextMode);

      if (nextMode === "counter") {
        startedAtRef.current = null;
        activeStartedAtRef.current = null;
        if (statusRef.current !== "paused") {
          sessionStartedAtRef.current = null;
          setStartedAtMs(null);
          setEndedAtMs(null);
          elapsedRef.current = 0;
          setElapsedMs(0);
          activeElapsedRef.current = 0;
          setActiveElapsedMs(0);
        }
        if (durationRef.current <= 0) {
          durationRef.current = initialDurationMs;
          setDurationMs(initialDurationMs);
        }
        return true;
      }

      if (statusRef.current !== "paused") {
        sessionStartedAtRef.current = null;
        setStartedAtMs(null);
        setEndedAtMs(null);
        const safeDuration =
          durationRef.current > 0 ? durationRef.current : initialDurationMs;
        durationRef.current = safeDuration;
        remainingRef.current = safeDuration;
        setDurationMs(safeDuration);
        setRemainingMs(safeDuration);
        if (statusRef.current === "finished") {
          setStatus("idle");
        }
        activeElapsedRef.current = 0;
        setActiveElapsedMs(0);
      }

      return true;
    },
    [initialDurationMs],
  );

  const start = useCallback((ms?: number) => {
    if (sessionStartedAtRef.current === null) {
      sessionStartedAtRef.current = Date.now();
      setStartedAtMs(sessionStartedAtRef.current);
    }
    setEndedAtMs(null);
    activeStartedAtRef.current = Date.now() - activeElapsedRef.current;
    if (modeRef.current === "counter") {
      const base = Math.min(ms ?? elapsedRef.current, MAX_DURATION_MS);
      startedAtRef.current = Date.now() - base;
      elapsedRef.current = base;
      setElapsedMs(base);
      setStatus("running");
      return;
    }

    const base =
      ms ?? (remainingRef.current > 0 ? remainingRef.current : durationRef.current);
    const duration = Math.max(0, base);
    setDurationMs(duration);
    setRemainingMs(duration);
    endsAtRef.current = Date.now() + duration;
    setStatus("running");
  }, []);

  const pause = useCallback(() => {
    if (modeRef.current === "counter") {
      if (statusRef.current !== "running" || startedAtRef.current === null) return;
      const elapsed = Math.min(
        Date.now() - startedAtRef.current,
        durationRef.current,
      );
      elapsedRef.current = elapsed;
      setElapsedMs(elapsed);
      startedAtRef.current = null;
      if (activeStartedAtRef.current !== null) {
        const activeElapsed = Date.now() - activeStartedAtRef.current;
        activeElapsedRef.current = activeElapsed;
        setActiveElapsedMs(activeElapsed);
        activeStartedAtRef.current = null;
      }
      setStatus("paused");
      return;
    }

    if (statusRef.current !== "running" || endsAtRef.current === null) return;
    const remaining = Math.max(0, endsAtRef.current - Date.now());
    endsAtRef.current = null;
    remainingRef.current = remaining;
    setRemainingMs(remaining);
    if (activeStartedAtRef.current !== null) {
      const activeElapsed = Date.now() - activeStartedAtRef.current;
      activeElapsedRef.current = activeElapsed;
      setActiveElapsedMs(activeElapsed);
      activeStartedAtRef.current = null;
    }
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    if (modeRef.current === "counter") {
      if (statusRef.current !== "paused") return;
      startedAtRef.current = Date.now() - elapsedRef.current;
      activeStartedAtRef.current = Date.now() - activeElapsedRef.current;
      setStatus("running");
      return;
    }

    if (statusRef.current !== "paused") return;
    endsAtRef.current = Date.now() + remainingRef.current;
    activeStartedAtRef.current = Date.now() - activeElapsedRef.current;
    setStatus("running");
  }, []);

  const reset = useCallback(() => {
    endsAtRef.current = null;
    startedAtRef.current = null;
    activeStartedAtRef.current = null;
    activeElapsedRef.current = 0;
    setActiveElapsedMs(0);
    sessionStartedAtRef.current = null;
    setStartedAtMs(null);
    setEndedAtMs(null);

    if (modeRef.current === "counter") {
      elapsedRef.current = 0;
      setElapsedMs(0);
      setStatus("idle");
      return;
    }

    setStatus("idle");
    setRemainingMs(durationMs);
    remainingRef.current = durationMs;
  }, [durationMs]);

  const adjust = useCallback((deltaMs: number) => {
    if (modeRef.current === "counter") {
      const nextElapsed = Math.min(elapsedRef.current + deltaMs, MAX_DURATION_MS);

      elapsedRef.current = nextElapsed;
      setElapsedMs(nextElapsed);

      if (statusRef.current === "running" && startedAtRef.current !== null) {
        startedAtRef.current = Date.now() - nextElapsed;
      }

      if (nextElapsed >= durationRef.current) {
        if (activeStartedAtRef.current !== null) {
          const activeElapsed = Date.now() - activeStartedAtRef.current;
          activeElapsedRef.current = activeElapsed;
          setActiveElapsedMs(activeElapsed);
        }
        startedAtRef.current = null;
        activeStartedAtRef.current = null;
        setStatus("finished");
        setEndedAtMs(Date.now());
      } else if (statusRef.current === "finished") {
        setStatus("idle");
      }
      return;
    }

    if (statusRef.current === "running" && endsAtRef.current !== null) {
      const newRemaining = endsAtRef.current - Date.now() + deltaMs;
      if (newRemaining <= 0) {
        if (activeStartedAtRef.current !== null) {
          const activeElapsed = Date.now() - activeStartedAtRef.current;
          activeElapsedRef.current = activeElapsed;
          setActiveElapsedMs(activeElapsed);
        }
        endsAtRef.current = null;
        remainingRef.current = 0;
        setRemainingMs(0);
        setStatus("finished");
        setEndedAtMs(Date.now());
        return;
      }
      const clamped = Math.min(newRemaining, MAX_DURATION_MS);
      endsAtRef.current = Date.now() + clamped;
      remainingRef.current = clamped;
      setRemainingMs(clamped);
      return;
    }

    const newRemaining = Math.min(
      Math.max(0, remainingRef.current + deltaMs),
      MAX_DURATION_MS,
    );
    remainingRef.current = newRemaining;
    setRemainingMs(newRemaining);

    if (newRemaining === 0) {
      endsAtRef.current = null;
      setStatus("finished");
      setEndedAtMs(Date.now());
      return;
    }

    if (statusRef.current === "idle" || statusRef.current === "finished") {
      if (statusRef.current === "finished") setStatus("idle");
      setDurationMs(newRemaining);
      durationRef.current = newRemaining;
    }
  }, []);

  const updateGoal = useCallback((ms: number) => {
    const nextDuration = Math.min(Math.max(0, ms), MAX_DURATION_MS);
    const previousDuration = durationRef.current;
    durationRef.current = nextDuration;
    setDurationMs(nextDuration);

    if (modeRef.current === "counter") {
      if (elapsedRef.current >= nextDuration) {
        elapsedRef.current = nextDuration;
        setElapsedMs(nextDuration);
        if (activeStartedAtRef.current !== null) {
          const activeElapsed = Date.now() - activeStartedAtRef.current;
          activeElapsedRef.current = activeElapsed;
          setActiveElapsedMs(activeElapsed);
        }
        startedAtRef.current = null;
        activeStartedAtRef.current = null;
        setStatus("finished");
        setEndedAtMs(Date.now());
      }
      return;
    }

    const elapsed = Math.max(0, previousDuration - remainingRef.current);
    const nextRemaining = Math.max(0, nextDuration - elapsed);
    remainingRef.current = nextRemaining;
    setRemainingMs(nextRemaining);

    if (nextRemaining === 0) {
      if (activeStartedAtRef.current !== null) {
        const activeElapsed = Date.now() - activeStartedAtRef.current;
        activeElapsedRef.current = activeElapsed;
        setActiveElapsedMs(activeElapsed);
      }
      endsAtRef.current = null;
      activeStartedAtRef.current = null;
      setStatus("finished");
      setEndedAtMs(Date.now());
    } else if (statusRef.current === "running") {
      endsAtRef.current = Date.now() + nextRemaining;
    }
  }, []);

  useEffect(() => {
    if (status !== "running") return;

    const tick = () => {
      if (mode === "countdown") {
        if (endsAtRef.current === null) return;
        const remaining = Math.max(0, endsAtRef.current - Date.now());
        setRemainingMs(remaining);
        remainingRef.current = remaining;
        if (activeStartedAtRef.current !== null) {
          const activeElapsed = Date.now() - activeStartedAtRef.current;
          setActiveElapsedMs(activeElapsed);
          activeElapsedRef.current = activeElapsed;
        }
        if (remaining <= 0) {
          endsAtRef.current = null;
          activeStartedAtRef.current = null;
          setStatus("finished");
          setEndedAtMs(Date.now());
        }
        return;
      }

      if (startedAtRef.current === null) return;
      const elapsed = Math.min(Date.now() - startedAtRef.current, durationRef.current);
      setElapsedMs(elapsed);
      elapsedRef.current = elapsed;
      if (activeStartedAtRef.current !== null) {
        const activeElapsed = Date.now() - activeStartedAtRef.current;
        setActiveElapsedMs(activeElapsed);
        activeElapsedRef.current = activeElapsed;
      }
      if (elapsed >= durationRef.current) {
        startedAtRef.current = null;
        activeStartedAtRef.current = null;
        setStatus("finished");
        setEndedAtMs(Date.now());
      }
    };

    const interval = setInterval(tick, TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [mode, status]);

  const load = useCallback((ms: number) => {
    const clamped = Math.min(Math.max(0, ms), MAX_DURATION_MS);
    endsAtRef.current = null;
    startedAtRef.current = null;
    activeStartedAtRef.current = null;
    sessionStartedAtRef.current = null;
    setStartedAtMs(null);
    setEndedAtMs(null);

    if (modeRef.current === "counter") {
      durationRef.current = clamped;
      setDurationMs(clamped);
      elapsedRef.current = 0;
      setElapsedMs(0);
      activeElapsedRef.current = 0;
      setActiveElapsedMs(0);
      setStatus("idle");
      return;
    }

    remainingRef.current = clamped;
    setRemainingMs(clamped);
    setDurationMs(clamped);
    durationRef.current = clamped;
    activeElapsedRef.current = 0;
    setActiveElapsedMs(0);
    setStatus("idle");
  }, []);

  return {
    mode,
    status,
    remainingMs,
    durationMs,
    elapsedMs,
    activeElapsedMs,
    startedAtMs,
    endedAtMs,
    setMode,
    start,
    pause,
    resume,
    reset,
    adjust,
    updateGoal,
    load,
  };
}

export const useCountdown = useTimer;
