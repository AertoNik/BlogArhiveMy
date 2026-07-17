import { readFileSync } from 'node:fs';

const path = new URL('../outputs/index.html', import.meta.url);
const html = readFileSync(path, 'utf8');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

check((html.match(/<!doctype html>/gi) || []).length === 1, 'Должен быть один doctype.');
check((html.match(/<style>/gi) || []).length === 1, 'CSS должен находиться в одном встроенном style.');
check((html.match(/<script>/gi) || []).length === 1, 'JavaScript должен находиться в одном встроенном script.');
check(!/(?:src|href)=["']https?:/i.test(html), 'Обнаружена внешняя зависимость.');
check(!/\binnerHTML\b/.test(html), 'Обнаружено использование innerHTML.');

const ids = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map(match => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
check(duplicateIds.length === 0, `Повторяющиеся id: ${[...new Set(duplicateIds)].join(', ')}`);

const idSet = new Set(ids);
for (const match of html.matchAll(/<label[^>]*\sfor=["']([^"']+)["']/g)) {
  check(idSet.has(match[1]), `label ссылается на отсутствующий id: ${match[1]}`);
}
for (const match of html.matchAll(/aria-labelledby=["']([^"']+)["']/g)) {
  for (const id of match[1].split(/\s+/)) check(idSet.has(id), `aria-labelledby ссылается на отсутствующий id: ${id}`);
}
for (const match of html.matchAll(/<img\b([^>]*)>/g)) {
  check(/\balt=["'][^"']*["']/.test(match[1]), `У статического img отсутствует alt: ${match[0].slice(0, 100)}`);
}
for (const match of html.matchAll(/<button\b([^>]*)>/g)) {
  check(/\btype=["']button["']/.test(match[1]) || /\btype=["']submit["']/.test(match[1]), `У button не указан type: ${match[0].slice(0, 100)}`);
}

const requiredIds = [
  'postForm', 'postText', 'postImages', 'imagePreview', 'profileSection', 'editProfileButton',
  'postFeed', 'pinnedFeed', 'searchPosts', 'sortPosts', 'filterPhotos', 'filterSaved',
  'themeSelect', 'simulationEnabled', 'simulationSpeed', 'tickerEnabled', 'soundEnabled',
  'exportButton', 'importButton', 'newBackupButton', 'resetButton', 'appModal', 'archiveCalendar', 'welcomeButton',
  'postChapter', 'chapterList', 'newChapterButton', 'futureLetterList', 'newFutureLetterButton',
  'diaryRoom', 'inspectRoomButton', 'stampPreview', 'openAchievementsButton', 'openMonthlyJournalButton', 'moodCalendarSummary',
  'customThemeButton', 'sceneSelect', 'sceneIntensity', 'ambientScene', 'agingEnabled', 'diaryAgeSummary',
  'memoryMuseumSection', 'openMemoryMuseumButton', 'postCardStyle', 'postSticker', 'emotionIntensity', 'emotionReason'
];
for (const id of requiredIds) check(idSet.has(id), `Отсутствует обязательный элемент #${id}`);

const requiredFunctions = [
  'openDatabase', 'migratePost', 'storeImage', 'simulateActivity', 'submitPost', 'startEditingPost',
  'deletePost', 'togglePin', 'toggleReaction', 'filteredPosts', 'buildBackup', 'applyImport',
  'resetAllData', 'renderFeed', 'refreshProfileInterface', 'openWelcomeLetter', 'initializeApplication',
  'normalizeChapter', 'normalizeFutureLetter', 'evaluateAchievements', 'renderFutureLetters',
  'renderDiaryRoom', 'renderChapters', 'buildMonthlyJournal', 'openMonthlyJournal', 'moodCategory',
  'normalizeCustomTheme', 'openCustomThemeBuilder', 'renderAmbientScene', 'buildMuseumExhibits',
  'openMemoryMuseum', 'diaryAgeInfo', 'renderDiaryAging', 'updateEmotionControls'
];
for (const name of requiredFunctions) check(new RegExp(`function\\s+${name}\\s*\\(`).test(html), `Отсутствует функция ${name}().`);

for (const requirement of ['@media (max-width: 760px)', '@media (max-width: 390px)', 'prefers-reduced-motion', "html[data-theme=\"xp\"]", "html[data-theme=\"dark\"]", 'indexedDB.open', 'localStorage.setItem', 'URL.createObjectURL']) {
  check(html.includes(requirement), `Не найден обязательный маркер: ${requirement}`);
}

for (const theme of ['vampire', 'detective', 'midnight', 'cyber', 'forest', 'ocean', 'autumn', 'lavender']) {
  check(html.includes(`html[data-theme="${theme}"]`), `Не найдены стили темы ${theme}.`);
  check(html.includes(`<option value="${theme}">`), `Тема ${theme} отсутствует в списке.`);
}

check((html.match(/<option value="[^"\n]+">/g) || []).length >= 30, 'Ожидался расширенный выбор тем и настроений.');
check(!/backdrop-filter\s*:/i.test(html), 'Тяжёлое размытие фона модального окна не удалено.');
check(html.includes('await refreshProfileInterface();'), 'Сохранение профиля по-прежнему может запускать тяжёлую перерисовку ленты.');
check(!/локальн|только на этом устройстве|реальных пользователей|из этого браузера|100%<br>LOCAL|NO<br>TRACKING/i.test(html), 'Остались пользовательские упоминания локальности или отсутствия реальных пользователей.');
for (const marker of ['Письма в будущее', 'Календарь настроений', 'Комната дневника', 'Главы жизни', 'Коллекция марок', 'Журнал месяца', 'Конструктор собственной темы', 'Музей воспоминаний', 'Живая фоновая сцена', 'Старение дневника', 'Сила эмоции', 'Украшение публикации']) {
  check(html.includes(marker), `Не найден новый раздел: ${marker}.`);
}

if (failures.length) {
  console.error(failures.map(item => `FAIL: ${item}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`OK: ${ids.length} уникальных id, обязательные элементы и функции на месте, внешних зависимостей нет.`);
}
