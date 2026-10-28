/** Extract a local video frame before upload; no media is sent to an external service. */
export function videoPoster(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video'), url = URL.createObjectURL(file);
        let done = false;
        const finish = (error?: Error, blob?: Blob) => {
            if (done)
                return;
            done = true;
            clearTimeout(timeout);
            video.pause();
            video.removeAttribute('src');
            video.load();
            URL.revokeObjectURL(url);
            if (blob)
                resolve(blob);
            else
                reject(error || new Error('无法提取视频封面，请手工上传图片封面'));
        };
        const timeout = window.setTimeout(() => finish(new Error('视频封面提取超时，请手工上传封面')), 10000);
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        video.onloadedmetadata = () => { video.currentTime = Math.min(.2, Math.max(0, video.duration / 2)); };
        video.onseeked = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = Math.min(1280, video.videoWidth);
                canvas.height = Math.round(video.videoHeight * canvas.width / video.videoWidth);
                const context = canvas.getContext('2d');
                if (!context || !canvas.width || !canvas.height)
                    throw new Error('无法读取视频画面');
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(blob => finish(undefined, blob || undefined), 'image/jpeg', .85);
            }
            catch (error) {
                finish(error instanceof Error ? error : new Error('提取封面失败'));
            }
        };
        video.onerror = () => finish(new Error('浏览器无法解码该视频，请更换格式或手工上传封面'));
        video.src = url;
    });
}
