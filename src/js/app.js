class TattooAnimation {
    constructor(canvasSelector, options = {}) {
        this.canvas = document.querySelector(canvasSelector);
        this.ctx = this.canvas.getContext("2d");
        this.dpr = window.devicePixelRatio || 1;

        const defaultOptions = {
            fps: 3,
            imageUrls: []
        };

        this.options = { ...defaultOptions, ...options };
        this.FPS = this.options.fps;
        this.FRAME_INTERVAL = 1000 / this.FPS;
        this.imagePaths = this.options.imageUrls;
        this.frames = [];
        this.currentFrameIndex = 0;
        this.lastTimestamp = 0;
        this.isPaused = false;

        this.boundAnimate = this.animate.bind(this);

        this.resizeCanvas();
        window.addEventListener("resize", () => this.resizeCanvas());

        this.addInteractionListeners();
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

    async preloadAndStartAnimation() {
        try {
            // Загрузим только первый кадр и сразу его покажем
            const firstImage = await this.loadImage(this.imagePaths[0]);
            this.drawFrame(firstImage);

            // Параллельно загрузим все изображения
            const images = await Promise.all(this.imagePaths.map(path => this.loadImage(path)));
            this.frames = images;

            // Начинаем анимацию после полной загрузки
            this.animate(); // 🟢 ЗАПУСКАЕМ анимацию через setTimeout
        } catch (err) {
            console.error("Error loading animation frames:", err);
        }
    }

    animate() {
        if (this.isPaused || this.frames.length === 0) {
            this.animationTimer = setTimeout(() => this.animate(), this.FRAME_INTERVAL);
            return;
        }

        this.drawFrame(this.frames[this.currentFrameIndex]);
        this.currentFrameIndex = (this.currentFrameIndex + 1) % this.frames.length;

        this.animationTimer = setTimeout(() => this.animate(), this.FRAME_INTERVAL);
    }

    addInteractionListeners() {
        // Мышь
        this.canvas.addEventListener("mousedown", () => this.isPaused = true);
        this.canvas.addEventListener("mouseup", () => this.isPaused = false);
        this.canvas.addEventListener("mouseleave", () => this.isPaused = false); // если мышь вышла — снимаем паузу

        // Сенсорные устройства
        this.canvas.addEventListener("touchstart", () => this.isPaused = true, { passive: true });
        this.canvas.addEventListener("touchend", () => this.isPaused = false);
        this.canvas.addEventListener("touchcancel", () => this.isPaused = false); // например, если палец ушел за экран
    }
}

// Запуск после загрузки DOM
window.addEventListener('DOMContentLoaded', () => {
    // Определите количество кадров здесь, например, 25
    const numberOfFrames = 25; // <--- Здесь вы задаете количество кадров

    const imageUrls = Array.from({ length: numberOfFrames }, (_, i) => `assets/images/slides/${i}.jpg`);

    const tattoo = new TattooAnimation('#tattoo-canvas', {
        imageUrls: imageUrls
    });
});
