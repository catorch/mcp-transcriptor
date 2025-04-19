import { pino } from "pino"; // ← named import for v8
import { cfg } from "../config.js";

/**
 * Write logs to stderr (fd 2) so stdout is clean for JSON‑RPC.
 * `pino.destination({ fd: 2 })` is the v8 way to target stderr.
 */
export const log = pino(
    { level: cfg.LOG_LEVEL, timestamp: pino.stdTimeFunctions.isoTime },
    pino.destination({ fd: 2 })
);
