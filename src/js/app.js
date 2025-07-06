class TattooAnimation {
    constructor(canvasSelector, options = {}) {
        this.canvas = document.querySelector(canvasSelector);
        this.ctx = this.canvas.getContext("2d");
        this.dpr = window.devicePixelRatio || 1;

        // Определяем родительский элемент для добавления класса 'is-ready'
        this.parentElement = this.canvas.closest('.hero__preview'); 
        if (!this.parentElement) {
            console.error('Родительский элемент .hero__preview не найден для канваса. Фолбэк-логика может работать некорректно.');
        }

        const defaultOptions = {
            fps: 3,
            imagePathPattern: index => `assets/images/slides/${index}.jpg`,
            maxFramesToCheck: 100,
            // Добавляем опции для ограничения размера канваса на мобильных в логических пикселях (до DPR)
            maxCanvasLogicalWidth: 1000, 
            maxCanvasLogicalHeight: 1000 
        };

        this.options = { ...defaultOptions, ...options };
        this.FPS = this.options.fps;
        this.FRAME_INTERVAL = 1000 / this.FPS;
        this.frames = [];
        this.currentFrameIndex = 0;
        this.lastTimestamp = 0;
        this.isPaused = false;
        this.isIntersecting = false; // Флаг для отслеживания видимости канваса
        this.animationFrameId = null; // Для хранения ID requestAnimationFrame

        this.boundAnimate = this.animate.bind(this);

        this.resizeCanvas();
        window.addEventListener("resize", () => this.resizeCanvas());

        this.addInteractionListeners();
        this.setupIntersectionObserver(); // Настраиваем IntersectionObserver
        this.loadAllFramesAndStart();
    }

    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();

        // Ограничиваем размеры канваса для предотвращения чрезмерной нагрузки
        // Берем меньшее из двух: фактический CSS-размер или заданный максимальный логический размер
        let newWidth = Math.min(rect.width, this.options.maxCanvasLogicalWidth) * this.dpr;
        let newHeight = Math.min(rect.height, this.options.maxCanvasLogicalHeight) * this.dpr;

        // Важно: Сохраняем соотношение сторон изображения, чтобы избежать искажений при ресайзе.
        // Это необходимо, так как родительский контейнер имеет aspect-ratio и object-fit: cover в CSS
        const currentImage = this.frames[this.currentFrameIndex];
        if (currentImage) {
            const imgRatio = currentImage.width / currentImage.height;
            const canvasRenderRatio = newWidth / newHeight; // Соотношение сторон, которое будет у внутреннего канваса

            // Если соотношение сторон изображения не соответствует соотношению сторон канваса,
            // корректируем один из размеров, чтобы изображение помещалось с сохранением пропорций
            // и при этом "покрывало" всю область (аналогично object-fit: cover)
            if (imgRatio > canvasRenderRatio) { // Изображение шире относительно своей высоты, чем канвас
                newHeight = newWidth / imgRatio;
            } else { // Изображение выше относительно своей ширины, чем канвас
                newWidth = newHeight * imgRatio;
            }
        }

        // Предотвращаем излишние перерисовки, если внутренние размеры канваса не изменились
        if (this.canvas.width === newWidth && this.canvas.height === newHeight) return;

        this.canvas.width = newWidth;
        this.canvas.height = newHeight;
        
        // Устанавливаем трансформацию для DPR, чтобы рисовать в логических пикселях
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        // Перерисовываем текущий кадр после изменения размера, если канвас виден и кадры загружены
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
        // Очищаем весь канвас перед отрисовкой нового кадра
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Получаем логические размеры канваса (фактические размеры элемента на странице)
        const canvasWidth = this.canvas.width / this.dpr;
        const canvasHeight = this.canvas.height / this.dpr;

        // Рассчитываем соотношения сторон для изображения и канваса
        const imgRatio = img.width / img.height;
        const canvasRatio = canvasWidth / canvasHeight;

        let drawWidth, drawHeight, offsetX, offsetY;

        // Логика object-fit: cover для размещения изображения
        if (imgRatio > canvasRatio) {
            // Изображение шире, чем канвас: масштабируем по высоте канваса
            drawHeight = canvasHeight;
            drawWidth = img.width * (canvasHeight / img.height);
            offsetX = (canvasWidth - drawWidth) / 2; // Центрируем по горизонтали
            offsetY = 0;
        } else {
            // Изображение выше, чем канвас: масштабируем по ширине канваса
            drawWidth = canvasWidth;
            drawHeight = img.height * (canvasWidth / img.width);
            offsetX = 0;
            offsetY = (canvasHeight - drawHeight) / 2; // Центрируем по вертикали
        }

        // Отрисовываем изображение на канвасе
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
                break; // Остановка при первой ошибке загрузки изображения
            }
        }

        if (frames.length === 0) {
            console.error("Не удалось загрузить ни одного кадра. Фолбэк-изображение останется видимым.");
            // Если кадры не загружены, класс 'is-ready' не добавляется,
            // и фолбэк-изображение остается видимым.
            return;
        }

        this.frames = frames;
        this.drawFrame(this.frames[0]); // Рисуем первый кадр сразу после загрузки

        // НОВОЕ: Добавляем класс 'is-ready' к родительскому элементу, 
        // чтобы скрыть img и показать canvas
        if (this.parentElement) {
            this.parentElement.classList.add('is-ready');
        }
        
        // Запускаем анимацию только если канвас уже виден
        if (this.isIntersecting) {
            this.animationFrameId = requestAnimationFrame(this.boundAnimate);
        }
    }

    animate(timestamp) {
        // Проверяем, что канвас виден, не на паузе и есть загруженные кадры
        if (this.isIntersecting && !this.isPaused && this.frames.length > 0) {
            if (!this.lastTimestamp) this.lastTimestamp = timestamp;

            const elapsed = timestamp - this.lastTimestamp;

            if (elapsed >= this.FRAME_INTERVAL) {
                this.drawFrame(this.frames[this.currentFrameIndex]);
                this.currentFrameIndex = (this.currentFrameIndex + 1) % this.frames.length;
                this.lastTimestamp = timestamp; // Обновляем lastTimestamp только после отрисовки
            }
        }

        // Продолжаем запрашивать следующий кадр только если канвас виден
        if (this.isIntersecting) {
            this.animationFrameId = requestAnimationFrame(this.boundAnimate);
        } else {
            // Если канвас не виден, отменяем текущий requestAnimationFrame, чтобы остановить анимацию
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
        }
    }

    // Метод для настройки Intersection Observer
    setupIntersectionObserver() {
        // Проверка поддержки IntersectionObserver API
        if (!('IntersectionObserver' in window)) {
            // Если API не поддерживается, предполагаем, что канвас всегда виден
            this.isIntersecting = true;
            console.warn('IntersectionObserver не поддерживается. Анимация может работать непрерывно.');
            return;
        }

        const observerOptions = {
            root: null, // viewport как корневой элемент для наблюдения
            rootMargin: '0px',
            threshold: 0.1 // Срабатывает, когда 10% канваса становится видимым
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                this.isIntersecting = entry.isIntersecting;
                if (this.isIntersecting) {
                    // Если канвас стал видимым и анимация еще не запущена
                    if (!this.animationFrameId) {
                        this.lastTimestamp = 0; // Сбрасываем таймер для плавного старта анимации
                        this.animationFrameId = requestAnimationFrame(this.boundAnimate);
                    }
                } else {
                    // Если канвас стал невидимым, останавливаем requestAnimationFrame
                    if (this.animationFrameId) {
                        cancelAnimationFrame(this.animationFrameId);
                        this.animationFrameId = null;
                    }
                }
            });
        }, observerOptions);

        observer.observe(this.canvas); // Начинаем наблюдать за канвасом
    }

    addInteractionListeners() {
        // Приостановка/возобновление анимации по нажатию/отпусканию мыши
        this.canvas.addEventListener("mousedown", () => this.isPaused = true);
        this.canvas.addEventListener("mouseup", () => this.isPaused = false);
        this.canvas.addEventListener("mouseleave", () => this.isPaused = false);

        // Приостановка/возобновление анимации по касанию/отпусканию на тач-устройствах
        // passive: false необходимо для использования preventDefault()
        this.canvas.addEventListener("touchstart", (e) => {
            e.preventDefault(); // Предотвращаем прокрутку или масштабирование страницы при касании канваса
            this.isPaused = true;
        }, { passive: false }); 
        this.canvas.addEventListener("touchend", () => this.isPaused = false);
        this.canvas.addEventListener("touchcancel", () => this.isPaused = false);
    }
}

// Инициализация класса TattooAnimation
// Убедитесь, что #tattoo-canvas существует в вашем HTML
const tattoo = new TattooAnimation('#tattoo-canvas', {
    imagePathPattern: index => `assets/images/slides/${index}.jpg`,
    maxFramesToCheck: 100,
    // Ограничения на максимальный логический размер канваса (до DPR)
    maxCanvasLogicalWidth: 1000, 
    maxCanvasLogicalHeight: 1000 
});