class TattooAnimation {
    constructor(canvasSelector, options = {}) {
        this.canvas = document.querySelector(canvasSelector);
        this.ctx = this.canvas.getContext("2d");
        this.dpr = window.devicePixelRatio || 1;

        const defaultOptions = {
            fps: 3,
            imagePathPattern: index => `assets/images/slides/${index}.jpg`,
            maxFramesToCheck: 100
        };

        this.options = { ...defaultOptions, ...options };
        this.FPS = this.options.fps;
        this.FRAME_INTERVAL = 1000 / this.FPS;
        this.frames = [];
        this.currentFrameIndex = 0;
        this.lastTimestamp = 0;
        this.isPaused = false;

        this.boundAnimate = this.animate.bind(this);

        this.resizeCanvas();
        window.addEventListener("resize", () => this.resizeCanvas());

        this.addInteractionListeners();
        this.loadAllFramesAndStart();
    }

    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const newWidth = rect.width * this.dpr;
        const newHeight = rect.height * this.dpr;

        if (this.canvas.width === newWidth && this.canvas.height === newHeight) return;

        this.canvas.width = newWidth;
        this.canvas.height = newHeight;
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Image not found: ${src}`));
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
            drawHeight = canvasHeight;
            drawWidth = img.width * (canvasHeight / img.height);
            offsetX = (canvasWidth - drawWidth) / 2;
            offsetY = 0;
        } else {
            drawWidth = canvasWidth;
            drawHeight = img.height * (canvasWidth / img.width);
            offsetX = 0;
            offsetY = (canvasHeight - drawHeight) / 2;
        }

        this.ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    }

    async loadAllFramesAndStart() {
        const frames = [];
        for (let i = 0; i < this.options.maxFramesToCheck; i++) {
            const path = this.options.imagePathPattern(i);
            try {
                const img = await this.loadImage(path);
                frames.push(img);
            } catch (err) {
                console.warn(`Stopped loading at missing frame: ${path}`);
                break; // остановка при первой ошибке
            }
        }

        if (frames.length === 0) {
            console.error("No frames loaded.");
            return;
        }

        this.frames = frames;
        this.drawFrame(this.frames[0]);
        requestAnimationFrame(this.boundAnimate);
    }

    animate(timestamp) {
        if (!this.lastTimestamp) this.lastTimestamp = timestamp;

        const elapsed = timestamp - this.lastTimestamp;

        if (!this.isPaused && this.frames.length > 0 && elapsed >= this.FRAME_INTERVAL) {
            this.drawFrame(this.frames[this.currentFrameIndex]);
            this.currentFrameIndex = (this.currentFrameIndex + 1) % this.frames.length;
            this.lastTimestamp = timestamp;
        }

        requestAnimationFrame(this.boundAnimate);
    }

    addInteractionListeners() {
        this.canvas.addEventListener("mousedown", () => this.isPaused = true);
        this.canvas.addEventListener("mouseup", () => this.isPaused = false);
        this.canvas.addEventListener("mouseleave", () => this.isPaused = false);

        this.canvas.addEventListener("touchstart", () => this.isPaused = true, { passive: true });
        this.canvas.addEventListener("touchend", () => this.isPaused = false);
        this.canvas.addEventListener("touchcancel", () => this.isPaused = false);
    }
}

const tattoo = new TattooAnimation('#tattoo-canvas', {
    imagePathPattern: index => `assets/images/slides/${index}.jpg`,
    maxFramesToCheck: 100
});