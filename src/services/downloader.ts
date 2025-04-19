import { execa } from "execa";
import * as tmp from "tmp-promise";
import { cfg } from "../config.js";

export interface Downloader {
    fetch(args: { source: "youtube" | "x" | "url"; url: string }): Promise<string>;
}

export class YtDlpDownloader implements Downloader {
    async fetch(args: { source: "youtube" | "x" | "url"; url: string }): Promise<string> {
        const { path: out } = await tmp.file({ postfix: ".mp4", dir: cfg.TMP_DIR });
        await execa("yt-dlp", [
            "--quiet",
            "--no-warnings",
            "-o", out,
            args.url
        ], {
            stdout: "ignore",  // MCP: avoid JSON parse errors
            stderr: "inherit"
        });
        return out;
    }
}
