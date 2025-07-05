// Импорт необходимых модулей Gulp и плагинов
import { src, dest, watch, series, parallel } from 'gulp';

// Импорт Sass: dart-sass как основной движок, gulp-sass как обертка Gulp
import * as dartSass from 'sass'; // <-- Это правильный импорт
import gulpSass from 'gulp-sass';
const sass = gulpSass(dartSass); // Инициализируем gulp-sass с dart-sass

import concat from 'gulp-concat';
import sourcemaps from 'gulp-sourcemaps';

// Импорт autoprefixer как PostCSS-плагина (не gulp-плагина)
import autoprefixer from 'autoprefixer';
import fileInclude from 'gulp-file-include';
import plumber from 'gulp-plumber';
import terser from 'gulp-terser';
import babel from 'gulp-babel';

// Импорт BrowserSync и создание его экземпляра
import browserSync from 'browser-sync';
const bs = browserSync.create();

import ttf2woff2 from 'gulp-ttf2woff2';

// Правильный импорт для 'del' (использует именованный экспорт deleteAsync)
import { deleteAsync } from 'del';

// Импорт PostCSS и cssnano (cssnano также является PostCSS-плагином)
import postcss from 'gulp-postcss';
import cssnano from 'cssnano';

import fs from 'fs'; // Для работы с файловой системой (fonts)
import fse from 'fs-extra'; // Импортируем fs-extra для копирования ассетов

// --- Настройки путей ---
const paths = {
  src: 'src/',
  build: 'build/',
  styles: 'src/scss/**/*.scss',
  js: 'src/js/app.js',
  componentsJs: 'src/components/**/*.js',
  html: 'src/**/*.html',
  fonts: 'src/fonts/**/*.ttf',
  // Пути для папки assets
  assets: 'src/assets', // Изменено на путь к папке, так как fs-extra копирует папки
  buildCss: 'build/css/',
  buildJs: 'build/js/',
  buildFonts: 'build/fonts/',
  buildAssets: 'build/assets/' // Место назначения для файлов assets в билде
};

// --- Задача: Очистка папки сборки ---
// Используем deleteAsync из 'del', которая возвращает Promise
async function clean() {
  console.log('Очистка папки сборки...');
  return deleteAsync(paths.build);
}

// --- Задача: CSS стили (Sass -> Autoprefix -> PostCSS (cssnano) -> Concat) ---
function style() {
  console.log('Компиляция стилей...');
  // Определяем плагины PostCSS
  const plugins = [
    autoprefixer({ cascade: false }), // Используем импортированный PostCSS-плагин autoprefixer
    cssnano({ preset: 'default' })    // Используем PostCSS-плагин cssnano
  ];

  return src(paths.styles, { sourcemaps: true })
    .pipe(plumber()) // Обработка ошибок в потоке
    .pipe(sass({ outputStyle: 'expanded' }).on('error', sass.logError)) // Компиляция Sass
    .pipe(postcss(plugins)) // Применение PostCSS плагинов
    .pipe(concat('style.min.css')) // Объединение в один файл
    .pipe(dest(paths.buildCss, { sourcemaps: '.' })) // Запись в папку сборки
    .pipe(bs.stream()); // Обновление BrowserSync
}

// --- НОВАЯ ЗАДАЧА: Копирование ассетов с использованием fs-extra ---
async function copyAssets() {
  console.log('Копирование ассетов с использованием fs-extra...');
  try {
    // Убедимся, что целевая папка существует
    await fse.ensureDir(paths.buildAssets);
    // Копируем содержимое папки assets в buildAssets
    // { overwrite: true } - перезаписывает файлы, если они уже существуют
    // { recursive: true } - копирует папки и их содержимое
    await fse.copy(paths.assets, paths.buildAssets, { overwrite: true });
    console.log('Ассеты успешно скопированы с помощью fs-extra.');
    bs.reload(); // Перезагружаем BrowserSync после копирования
  } catch (err) {
    console.error('Ошибка при копировании ассетов с помощью fs-extra:', err);
    // Продолжаем выполнение Gulp, чтобы не блокировать другие задачи
  }
}

// --- Задача: Конвертация TTF в WOFF2 ---
function ttf() {
  console.log('Конвертация шрифтов TTF в WOFF2...');
  return src(paths.fonts)
    .pipe(plumber())
    .pipe(ttf2woff2())
    .pipe(dest(paths.buildFonts));
}

// --- Задача: Генерация SCSS с @font-face правилами ---
function fonts(done) {
  console.log('Генерация SCSS для шрифтов...');
  const fontFacePath = 'src/scss/_local-fonts.scss';
  fs.writeFile(fontFacePath, '', () => {}); // Очищаем файл перед записью

  fs.readdir(paths.buildFonts, (err, items) => {
    if (items) {
      let c_fontname;
      for (let i = 0; i < items.length; i++) {
        let fontname = items[i].split('.')[0];
        let fontExt = items[i].split('.')[1];

        if (c_fontname !== fontname && (fontExt === 'woff' || fontExt === 'woff2')) {
          fs.appendFile(fontFacePath, `@include font-face("${fontname}", "${fontname}", 400);\r\n`, () => {});
          console.log(`\x1b[47m\x1b[30mAdded new font: \x1b[1m${fontname}\x1b[0m\n\x1b[43m\x1b[30mPlease, move mixin call from \x1b[36msrc/scss/_local-fonts.scss\x1b[30m to \x1b[36msrc/scss/global/_fonts.scss\x1b[30m and then change it!\x1b[0m`);
        }
        c_fontname = fontname;
      }
    }
  });
  done();
}

// --- Задача: Сборка JS для продакшена (Babel + Terser + Concat) ---
function build_js() {
  console.log('Сборка JS для продакшена...');
  // paths.js указывает на src/js/app.js
  return src([paths.componentsJs, paths.js], { sourcemaps: true })
    .pipe(plumber())
    .pipe(babel({
      presets: ['@babel/preset-env']
    }))
    .pipe(terser())
    .pipe(concat('main.min.js'))
    .pipe(dest(paths.buildJs, { sourcemaps: '.' }));
}

// --- Задача: Сборка JS для разработки (Sourcemaps + Concat) ---
function dev_js() {
  console.log('Сборка JS для разработки...');
  // paths.js указывает на src/js/app.js
  return src([paths.componentsJs, paths.js], { sourcemaps: true })
    .pipe(plumber())
    .pipe(terser()) // Минификация JS для dev, можно убрать для скорости
    .pipe(concat('main.min.js'))
    .pipe(dest(paths.buildJs, { sourcemaps: '.' }))
    .pipe(bs.stream());
}

// --- Задача: HTML (File Include) ---
function html() {
  console.log('Обработка HTML...');
  return src([paths.html, `!${paths.src}components/**/*.html`])
    .pipe(plumber())
    .pipe(fileInclude({ prefix: '@@', basepath: '@file' }))
    .pipe(dest(paths.build))
    .pipe(bs.stream());
}

// --- Задача: Инициализация BrowserSync для HTML ---
function bs_html() {
  console.log('Запуск BrowserSync...');
  bs.init({
    server: {
      baseDir: paths.build,
    },
    browser: 'default',
    logPrefix: 'BS-HTML:',
    logLevel: 'info',
    logConnections: true,
    logFileChanges: true,
    open: true
  });
}

// --- Задача: Наблюдение за файлами ---
function watching() {
  console.log('Запуск наблюдения за файлами...');
  watch(paths.html, html);
  watch(paths.styles, style);
  watch([paths.js, paths.componentsJs], dev_js);
  watch(paths.fonts, series(ttf, fonts));
  // Изменено наблюдение для ассетов, теперь оно вызывает copyAssets
  watch(paths.assets + '/**/*', copyAssets); // Добавляем /*** для наблюдения за содержимым папки
}

// --- Экспорт задач Gulp ---
export { clean, style, ttf, fonts, build_js, dev_js, html, bs_html, watching, copyAssets }; // Экспортируем новую задачу copyAssets

// --- Основные задачи ---

// Дефолтная задача (для разработки HTML-сайтов)
// npm start
export default series(
  clean,
  parallel(ttf, fonts, style, dev_js, html, copyAssets), // Используем copyAssets
  parallel(bs_html, watching)
);

// Задача для продакшн сборки (без вотчера и BrowserSync)
// npm run build
export const build = series(
  clean,
  parallel(ttf, fonts, style, build_js, html, copyAssets) // Используем copyAssets
);
