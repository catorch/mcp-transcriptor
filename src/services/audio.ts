import ffmpeg from "fluent-ffmpeg";

export interface AudioExtractor {
    extract(videoPath: string): Promise<string>;
}

export class FfmpegExtractor implements AudioExtractor {
    async extract(videoPath: string) {
        const audio = `${videoPath}.wav`;
        await new Promise<void>((resolve, reject) =>
            ffmpeg(videoPath)
                .noVideo()
                .audioCodec("pcm_s16le")
                .save(audio)
                .on("end", () => resolve())
                .on("error", (err: Error) => reject(err))
        );
        return audio;
    }
}
