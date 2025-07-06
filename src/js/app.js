class TattooAnimation {
    constructor(canvasSelector, options = {}) {
        this.canvas = document.querySelector(canvasSelector);
        this.ctx = this.canvas.getContext("2d");
        this.dpr = window.devicePixelRatio || 1;

        this.parentElement = this.canvas.closest('.hero__preview'); 
        if (!this.parentElement) {
            console.error('Родительский элемент .hero__preview не найден для канваса.');
        }

        const defaultOptions = {
            fps: 3,
            imagePathPattern: index => `assets/images/slides/${index}.jpg`,
            maxFramesToCheck: 100,
            maxCanvasLogicalWidth: 1000, 
            maxCanvasLogicalHeight: 1000 
        };

        this.options = { ...defaultOptions, ...options };
        this.FPS = this.options.fps;
        this.FRAME_INTERVAL = 1000 / this.FPS;
        this.frames = [];
        this.currentFrameIndex = 0;
        this.lastTimestamp = 0;
        this.isIntersecting = false;
        this.animationFrameId = null;
        this.boundAnimate = this.animate.bind(this);

        this.resizeCanvas();
        window.addEventListener("resize", () => this.resizeCanvas());

        this.setupIntersectionObserver();
        this.loadAllFramesAndStart();
    }

    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();

        let newWidth = Math.min(rect.width, this.options.maxCanvasLogicalWidth) * this.dpr;
        let newHeight = Math.min(rect.height, this.options.maxCanvasLogicalHeight) * this.dpr;

        const currentImage = this.frames[this.currentFrameIndex];
        if (currentImage) {
            const imgRatio = currentImage.width / currentImage.height;
            const canvasRenderRatio = newWidth / newHeight;

            if (imgRatio > canvasRenderRatio) {
                newHeight = newWidth / imgRatio;
            } else {
                newWidth = newHeight * imgRatio;
            }
        }

        if (this.canvas.width === newWidth && this.canvas.height === newHeight) return;

        this.canvas.width = newWidth;
        this.canvas.height = newHeight;
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        if (this.isIntersecting && this.frames.length > 0) {
            this.drawFrame(this.frames[this.currentFrameIndex]);
        }
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
        const promises = [];

        for (let i = 0; i < this.options.maxFramesToCheck; i++) {
            const path = this.options.imagePathPattern(i);
            promises.push(this.loadImage(path)); 
        }

        const results = await Promise.allSettled(promises);

        const frames = [];
        let loadedCount = 0;

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result.status === 'fulfilled') {
                frames.push(result.value);
                loadedCount++;
            } else {
                console.warn(`Stopped loading at missing frame: ${this.options.imagePathPattern(i)}`, result.reason);
                break; 
            }
        }

        if (loadedCount === 0) {
            console.error("Не удалось загрузить ни одного кадра.");
            return;
        }

        this.frames = frames;
        this.drawFrame(this.frames[0]);

        if (this.parentElement) {
            this.parentElement.classList.add('is-ready');
        }

        if (this.isIntersecting) {
            this.animationFrameId = requestAnimationFrame(this.boundAnimate);
        }
    }

    animate(timestamp) {
        if (this.isIntersecting && this.frames.length > 0) {
            if (!this.lastTimestamp) this.lastTimestamp = timestamp;

            const elapsed = timestamp - this.lastTimestamp;

            if (elapsed >= this.FRAME_INTERVAL) {
                this.drawFrame(this.frames[this.currentFrameIndex]);
                this.currentFrameIndex = (this.currentFrameIndex + 1) % this.frames.length;
                this.lastTimestamp = timestamp;
            }
        }

        if (this.isIntersecting) {
            this.animationFrameId = requestAnimationFrame(this.boundAnimate);
        } else {
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
        }
    }

    setupIntersectionObserver() {
        if (!('IntersectionObserver' in window)) {
            this.isIntersecting = true;
            console.warn('IntersectionObserver не поддерживается.');
            return;
        }

        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                this.isIntersecting = entry.isIntersecting;
                if (this.isIntersecting && !this.animationFrameId) {
                    this.lastTimestamp = 0;
                    this.animationFrameId = requestAnimationFrame(this.boundAnimate);
                } else if (!this.isIntersecting && this.animationFrameId) {
                    cancelAnimationFrame(this.animationFrameId);
                    this.animationFrameId = null;
                }
            });
        }, observerOptions);

        observer.observe(this.canvas);
    }
}

// Инициализация
const tattoo = new TattooAnimation('#tattoo-canvas', {
    imagePathPattern: index => `assets/images/slides/${index}.jpg`,
    maxFramesToCheck: 20,
    maxCanvasLogicalWidth: 1000,
    maxCanvasLogicalHeight: 1000
});
