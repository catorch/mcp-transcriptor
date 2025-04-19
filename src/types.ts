import { z } from "zod";

/** Input for start_transcription */
export const StartArgs = z.object({
    source: z.enum(["youtube", "x", "url", "local"]),
    location: z.string(),
    languageCode: z.string().optional().default("en-US")
});
export type StartArgsT = z.infer<typeof StartArgs>;

/** Input for get_transcription_status */
export const StatusArgs = z.object({
    jobId: z.string()
});
export type StatusArgsT = z.infer<typeof StatusArgs>;
