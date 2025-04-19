import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as fs from "fs/promises";
import { z } from "zod";
import { FfmpegExtractor } from "./services/audio.js";
import { YtDlpDownloader } from "./services/downloader.js";
import { S3Storage } from "./services/storage.js";
import { AwsTranscriber } from "./services/transcriber.js";
import { StartArgsT, StatusArgsT } from "./types.js";
import { log } from "./utils/logger.js";

const dl = new YtDlpDownloader();
const aud = new FfmpegExtractor();
const s3 = new S3Storage();
const stt = new AwsTranscriber();

/* ------------------------------------------------------------------ */
/* 1.  Create an MCP server using the high‑level helper               */
/* ------------------------------------------------------------------ */
export const server = new McpServer({
    name: "mcp-transcriber",
    version: "0.3.0"
});

/* ------------------------------------------------------------------ */
/* 2.  Tool: start_transcription                                      */
/* ------------------------------------------------------------------ */
server.tool(
    "start_transcription",
    {
        source: z.enum(["youtube", "x", "url", "local"]),
        location: z.string(),
        languageCode: z.string().optional().default("en-US"),
    },
    async (args: StartArgsT) => {
        let videoPath: string | undefined = undefined;
        let audioPath: string | undefined = undefined;
        try {
            log.info({ args }, "Received start_transcription request");
            videoPath = args.source === "local"
                ? args.location
                : await dl.fetch({ source: args.source, url: args.location });
            log.info({ videoPath }, "Video file ready");

            audioPath = await aud.extract(videoPath);
            log.info({ audioPath }, "Audio file extracted");

            const s3Uri = await s3.upload(audioPath);
            log.info({ s3Uri }, "Audio file uploaded to S3");

            const jobId = await stt.startJob(s3Uri, args.languageCode);
            log.info({ jobId }, "Transcription job started");

            return {
                content: [
                    {
                        type: "text",
                        text: `🎧 Job queued — id: \`${jobId}\`\n\nCall **get_transcription_status** to track progress.`,
                    },
                ],
            };
        } catch (error) {
            log.error({ err: error }, "Error in start_transcription");
            return {
                content: [
                    {
                        type: "text",
                        text: `❌ Failed to start transcription:\n\n\`\`\`\n${(error as Error).message}\n\`\`\``,
                    },
                ],
                isError: true,
            };
        } finally {
            // Cleanup temporary files
            if (audioPath) {
                try {
                    await fs.unlink(audioPath);
                    log.info({ audioPath }, "✅ Cleaned up temporary audio file");
                } catch (unlinkErr) {
                    log.warn({ err: unlinkErr, file: audioPath }, "⚠️ Failed to clean up temporary audio file");
                }
            }
            // Only delete video if it wasn't a local source
            if (videoPath && args.source !== 'local') {
                try {
                    await fs.unlink(videoPath);
                    log.info({ videoPath }, "✅ Cleaned up temporary video file");
                } catch (unlinkErr) {
                    log.warn({ err: unlinkErr, file: videoPath }, "⚠️ Failed to clean up temporary video file");
                }
            }
        }
    }
);


/* ------------------------------------------------------------------ */
/* 3.  Tool: get_transcription_status                                 */
/* ------------------------------------------------------------------ */
server.tool(
    "get_transcription_status",
    {
        jobId: z.string(),
    },
    async ({ jobId }: StatusArgsT) => {
        try {
            const status = await stt.getJobStatus(jobId);

            if (status.status === "COMPLETED") {
                return {
                    content: [
                        {
                            type: "text",
                            text: `✅ Transcript for \`${jobId}\`:\n\n${status.transcript}`,
                        },
                    ],
                };
            }

            return {
                content: [
                    {
                        type: "text",
                        text: `⏳ \`${jobId}\` is ${status.status.toLowerCase()}`,
                    },
                ],
            };
        } catch (error) {
            log.error("Error in get_transcription_status:", error);
            return {
                content: [
                    {
                        type: "text",
                        text: `❌ Failed to retrieve transcription status:\n\n\`\`\`\n${(error as Error).message}\n\`\`\``,
                    },
                ],
                isError: true,
            };
        }
    }
);


/* ------------------------------------------------------------------ */
/* 4.  Connect to a transport (stdio here, Streamable HTTP works too) */
/* ------------------------------------------------------------------ */
export async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log.info("MCP‑transcriber ready on stdio");
}

if (import.meta.url === `file://${process.argv[1]}`) {
    /* c8 ignore next 3 */
    main().catch(err => {
        log.error(err);
        process.exit(1);
    });
}
