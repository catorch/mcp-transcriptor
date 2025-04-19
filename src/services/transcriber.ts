import {
    GetTranscriptionJobCommand,
    LanguageCode,
    StartTranscriptionJobCommand,
    TranscribeClient
} from "@aws-sdk/client-transcribe";

import { cfg } from "../config.js";

export class AwsTranscriber {
    private tx = new TranscribeClient({ region: cfg.AWS_REGION });

    async startJob(s3Uri: string, lang: string): Promise<string> {
        const jobId = `mcp-${Date.now()}`;
        await this.tx.send(new StartTranscriptionJobCommand({
            TranscriptionJobName: jobId,
            Media: { MediaFileUri: s3Uri },
            LanguageCode: lang as LanguageCode,
            OutputBucketName: cfg.TRANSCRIBE_BUCKET
        }));
        return jobId;
    }

    async getJobStatus(jobId: string): Promise<{ status: string; transcript?: string }> {
        const { TranscriptionJob: j } = await this.tx.send(
            new GetTranscriptionJobCommand({ TranscriptionJobName: jobId })
        );

        if (!j) throw new Error("No such job");

        if (j.TranscriptionJobStatus === "COMPLETED") {
            const resUri = j.Transcript?.TranscriptFileUri!;
            const data = await fetch(resUri).then(res => res.json());
            return { status: "COMPLETED", transcript: data.results.transcripts[0].transcript };
        }

        return { status: j.TranscriptionJobStatus ?? "UNKNOWN" };
    }
}
