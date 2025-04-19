import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";
import { cfg } from "../config.js";

export interface Storage {
    upload(localPath: string): Promise<string>; // returns s3:// URI
}
export class S3Storage implements Storage {
    private s3 = new S3Client({ region: cfg.AWS_REGION });
    async upload(localPath: string) {
        const Key = path.basename(localPath);
        await this.s3.send(
            new PutObjectCommand({ Bucket: cfg.TRANSCRIBE_BUCKET, Key, Body: fs.createReadStream(localPath) })
        );
        return `s3://${cfg.TRANSCRIBE_BUCKET}/${Key}`;
    }
}
