import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
        try {
            const video =
                args.source === "local"
                    ? args.location
                    : await dl.fetch({ source: args.source, url: args.location });

            const audio = await aud.extract(video);
            const s3Uri = await s3.upload(audio);
            const jobId = await stt.startJob(s3Uri, args.languageCode);

            return {
                content: [
                    {
                        type: "text",
                        text: `🎧 Job queued — id: \`${jobId}\`\n\nCall **get_transcription_status** to track progress.`,
                    },
                ],
            };
        } catch (error) {
            log.error("Error in start_transcription:", error);
            return {
                content: [
                    {
                        type: "text",
                        text: `❌ Failed to start transcription:\n\n\`\`\`\n${(error as Error).message}\n\`\`\``,
                    },
                ],
                isError: true,
            };
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
