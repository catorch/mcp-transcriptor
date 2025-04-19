import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
    GetTranscriptionJobCommand,
    LanguageCode,
    StartTranscriptionJobCommand,
    TranscribeClient
} from "@aws-sdk/client-transcribe";
import { Readable } from "stream";
import { cfg } from "../config.js";

async function streamToString(stream: Readable): Promise<string> {
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks).toString("utf-8");
}

export class AwsTranscriber {
    private tx = new TranscribeClient({
        region: cfg.AWS_REGION,
        credentials: {
            accessKeyId: cfg.AWS_ACCESS_KEY_ID,
            secretAccessKey: cfg.AWS_SECRET_ACCESS_KEY
        }
    });

    private s3 = new S3Client({
        region: cfg.AWS_REGION,
        credentials: {
            accessKeyId: cfg.AWS_ACCESS_KEY_ID,
            secretAccessKey: cfg.AWS_SECRET_ACCESS_KEY
        }
    });

    async startJob(s3Uri: string, lang: string): Promise<string> {
        const jobId = `mcp-${Date.now()}`;
        await this.tx.send(new StartTranscriptionJobCommand({
            TranscriptionJobName: jobId,
            Media: { MediaFileUri: s3Uri },
            LanguageCode: lang as LanguageCode,
            OutputBucketName: cfg.TRANSCRIBE_BUCKET,
            OutputKey: `${jobId}.json`
        }));
        return jobId;
    }

    async getJobStatus(jobId: string): Promise<{ status: string; transcript?: string }> {
        const { TranscriptionJob: j } = await this.tx.send(
            new GetTranscriptionJobCommand({ TranscriptionJobName: jobId })
        );

        if (!j) throw new Error("No such job");

        if (j.TranscriptionJobStatus === "COMPLETED") {
            const key = `${jobId}.json`;

            try {
                const res = await this.s3.send(new GetObjectCommand({
                    Bucket: cfg.TRANSCRIBE_BUCKET,
                    Key: key
                }));

                if (!res.Body) {
                    throw new Error("Empty response body from S3");
                }

                const jsonStr = await streamToString(res.Body as Readable);
                const data = JSON.parse(jsonStr);
                return {
                    status: "COMPLETED",
                    transcript: data.results.transcripts?.[0]?.transcript ?? "[Transcript not found]"
                };
            } catch (err) {
                console.error(`Error fetching/parsing transcript from S3: ${err}`);
                return { status: "COMPLETED", transcript: "[Error reading transcript: unable to fetch or parse]" };
            }
        }

        return { status: j.TranscriptionJobStatus ?? "UNKNOWN" };
    }
}
