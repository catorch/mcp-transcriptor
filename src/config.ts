import { z } from "zod";

export const Config = z.object({
    AWS_REGION: z.string().default("us-east-1"),
    TRANSCRIBE_BUCKET: z.string(),
    TMP_DIR: z.string().default("/tmp"),
    LOG_LEVEL: z.enum(["info", "debug", "warn", "error"]).default("info")
});

export type ConfigT = z.infer<typeof Config>;
export const cfg: ConfigT = Config.parse(process.env);
