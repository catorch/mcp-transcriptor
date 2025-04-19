import { execa } from "execa";
import { promises as fs } from "fs";
import * as path from "path";
import * as tmp from "tmp-promise";
import { cfg } from "../config.js";

export interface Downloader {
    fetch(args: { source: "youtube" | "x" | "url"; url: string }): Promise<string>;
}

export class YtDlpDownloader implements Downloader {
    async fetch(args: { source: "youtube" | "x" | "url"; url: string }): Promise<string> {
        const { path: dirPath } = await tmp.dir({ unsafeCleanup: true, dir: cfg.TMP_DIR });
        const outputTemplate = path.join(dirPath, "%(title)s.%(ext)s");

        await execa("yt-dlp", [
            "--quiet",
            "--no-warnings",
            "--no-playlist",
            "-f", "mp4",
            "-o", outputTemplate,
            args.url
        ], {
            stdout: "ignore",
            stderr: "inherit"
        });

        // Find the .mp4 file that was just created
        const files = await fs.readdir(dirPath);
        const mp4File = files.find(f => f.endsWith(".mp4"));

        if (!mp4File) {
            throw new Error(`❌ yt-dlp completed but no .mp4 file was found in ${dirPath}`);
        }

        return path.join(dirPath, mp4File);
    }
}
