class TattooAnimation {
    constructor(canvasSelector, options = {}) {
        this.canvas = document.querySelector(canvasSelector);
        this.ctx = this.canvas.getContext("2d");
        this.dpr = window.devicePixelRatio || 1;

        const defaultOptions = {
            fps: 1,
            imageUrls: []
        };

        this.options = { ...defaultOptions, ...options };
        this.FPS = this.options.fps;
        this.FRAME_INTERVAL = 1000 / this.FPS;
        this.imagePaths = this.options.imageUrls;
        this.frames = [];
        this.currentFrameIndex = 0;
        this.lastTimestamp = 0;

        this.boundAnimate = this.animate.bind(this);

        this.resizeCanvas();
        window.addEventListener("resize", () => this.resizeCanvas());
        this.preloadAndStartAnimation();
    }

    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * this.dpr;
        this.canvas.height = rect.height * this.dpr;
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
            img.src = src;
        });
    }

    drawFrame(img) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const canvasWidth = this.canvas.width / this.dpr;
        const canvasHeight = this.canvas.height / this.dpr;

        const imgRatio = img.width / img.height;
        const canvasRatio = canvasWidth / canvasHeight;

        let drawWidth, drawHeight, offsetX, offsetY;

        if (imgRatio > canvasRatio) {
            // Изображение шире канваса — обрезаем по ширине
            drawHeight = canvasHeight;
            drawWidth = img.width * (canvasHeight / img.height);
            offsetX = (canvasWidth - drawWidth) / 2;
            offsetY = 0;
        } else {
            // Изображение выше канваса — обрезаем по высоте
            drawWidth = canvasWidth;
            drawHeight = img.height * (canvasWidth / img.width);
            offsetX = 0;
            offsetY = (canvasHeight - drawHeight) / 2;
        }

        this.ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    }


    preloadAndStartAnimation() {
        Promise.all(this.imagePaths.map(path => this.loadImage(path)))
            .then(images => {
                this.frames = images;
                this.drawFrame(this.frames[0]);
                requestAnimationFrame(this.boundAnimate);
            })
            .catch(err => console.error("Error loading animation frames:", err));
    }

    animate(timestamp) {
        if (!this.lastTimestamp) this.lastTimestamp = timestamp;
        const delta = timestamp - this.lastTimestamp;
        if (delta >= this.FRAME_INTERVAL) {
            this.drawFrame(this.frames[this.currentFrameIndex]);
            this.currentFrameIndex = (this.currentFrameIndex + 1) % this.frames.length;
            this.lastTimestamp = timestamp - (delta % this.FRAME_INTERVAL);
        }
        requestAnimationFrame(this.boundAnimate);
    }
}

// Запуск после загрузки DOM
window.addEventListener('DOMContentLoaded', () => {
    const tattoo = new TattooAnimation('#tattoo-canvas', {
        imageUrls: Array.from({ length: 14 }, (_, i) => `assets/images/slides/${i + 1}.jpg`)
    });
});
