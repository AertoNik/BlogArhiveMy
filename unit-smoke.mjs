import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const html = readFileSync(new URL('../outputs/index.html', import.meta.url), 'utf8');
const match = html.match(/<script>\s*([\s\S]*?)<\/script>/);
if (!match) throw new Error('Встроенный script не найден.');

let source = match[1];
source = source.replace(
  /\s*initializeApplication\(\);\s*\}\)\(\);\s*$/,
  `\n  globalThis.__retroTest = { CONFIG, THEMES, SCENES, POST_DECORATION_STYLES, POST_STICKERS, EMOTION_REASONS, DEFAULT_CUSTOM_THEME, CHAPTER_COLORS, ACHIEVEMENTS, state, normalizeProfile, normalizeCustomTheme, normalizeSettings, normalizeMeta, normalizeChapter, normalizeFutureLetter, normalizeAchievements, safeHexColor, mixHex, isDarkHex, migratePost, constrainStats, createDemoPosts, filteredPosts, postFingerprint, simulateActivity, writingStreak, roomProgress, moodCategory, monthKey, buildMonthlyJournal, buildMuseumExhibits, diaryAgeInfo, letterIsDue, achievementRuleMet, evaluateAchievements, validateBackupStructure, buildBackup, applyImport };\n  })();`
);

const deterministicMath = Object.create(Math);
deterministicMath.random = () => 0.5;
class TestFileReader {
  readAsDataURL(blob) {
    blob.arrayBuffer().then(buffer => {
      this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;
      this.onload?.();
    }).catch(error => {
      this.error = error;
      this.onerror?.();
    });
  }
}
const context = {
  console,
  Date,
  Intl,
  Map,
  Set,
  Promise,
  Blob,
  URL,
  Uint8Array,
  JSON,
  Object,
  Array,
  String,
  Number,
  Boolean,
  RegExp,
  Error,
  Math: deterministicMath,
  crypto: webcrypto,
  structuredClone,
  FileReader: TestFileReader,
  atob,
  btoa,
  setTimeout,
  clearTimeout
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: 'index-inline.js' });
const api = context.__retroTest;
if (!api) throw new Error('Тестовый API не создан.');

const assert = (condition, message) => { if (!condition) throw new Error(message); };

const profile = api.normalizeProfile({ name: '<script>alert(1)</script>', handle: '@ hello world ', followers: -20, bio: 42 });
assert(profile.name.includes('<script>'), 'Текст профиля должен храниться как текст, без исполнения.');
assert(profile.handle === '_hello_world', 'Короткое имя не нормализовано.');
assert(profile.followers === 0, 'Отрицательные подписчики не исправлены.');
assert(typeof profile.bio === 'string', 'Повреждённое описание не восстановлено.');

const themed = api.normalizeSettings({ theme: 'vampire' });
assert(themed.theme === 'vampire' && api.THEMES.vampire.tone === 'dark', 'Новая тёмная тема не нормализуется.');
assert(api.normalizeSettings({ theme: 'unknown' }).theme === 'classic', 'Неизвестная тема не заменяется безопасной темой.');
const customSettings = api.normalizeSettings({ theme: 'custom', scene: 'fireflies', sceneIntensity: 'high', agingEnabled: false, customTheme: { name: '  Ночная библиотека  ', page: '#010203', panel: 'red', ink: '#FDFDFD', accent: '#aa55cc', header: '#222244', pattern: 'stars', font: 'serif', radius: 99 } });
assert(customSettings.theme === 'custom' && customSettings.scene === 'fireflies' && customSettings.agingEnabled === false, 'Новые настройки интерфейса не сохраняются.');
assert(customSettings.customTheme.name === 'Ночная библиотека' && customSettings.customTheme.panel === api.DEFAULT_CUSTOM_THEME.panel && customSettings.customTheme.radius === 22, 'Конструктор темы не очищает повреждённые значения.');
assert(api.normalizeSettings({ scene: 'storm', sceneIntensity: 'extreme' }).scene === 'none', 'Неизвестная фоновая сцена не заменяется безопасным значением.');
assert(api.mixHex('#000000', '#ffffff', .5) === '#808080' && api.isDarkHex('#111111') && !api.isDarkHex('#fefefe'), 'Цветовые функции конструктора работают неверно.');
assert(api.normalizeMeta({ welcomeSeen: true }).welcomeSeen === true, 'Статус ознакомительного письма не сохраняется.');

const normalizedChapter = api.normalizeChapter({ id: 'chapter-test', name: '  Лето  ', color: '#bad' });
assert(normalizedChapter.name === 'Лето' && normalizedChapter.color === api.CHAPTER_COLORS[0].value, 'Глава жизни нормализуется неверно.');
const normalizedLetter = api.normalizeFutureLetter({ id: 'letter-test', title: '  Будущему мне  ', body: 'Текст', createdAt: '2026-01-01', openAt: '2027-01-01' });
assert(normalizedLetter.title === 'Будущему мне' && api.letterIsDue(normalizedLetter, new Date('2026-06-01').getTime()) === false, 'Письмо в будущее нормализуется неверно.');
assert(api.moodCategory('❤️ Влюблённое') === 'love' && api.moodCategory('🦇 Мрачное') === 'dark', 'Цветовая категория настроения определяется неверно.');

const migrated = api.migratePost({
  id: 'p1', createdAt: 'bad date', text: '<img src=x onerror=alert(1)>', privacy: 'wrong', chapterId: 'chapter-test', imageIds: ['a'],
  stats: { views: 3, likes: 99, dislikes: -4, saves: 7 }
});
assert(migrated.privacy === 'public', 'Приватность не нормализована.');
assert(migrated.stats.likes === 3 && migrated.stats.dislikes === 0 && migrated.stats.saves === 3, 'Статистика не ограничена просмотрами.');
assert(!Number.isNaN(new Date(migrated.createdAt).getTime()), 'Повреждённая дата не восстановлена.');
assert(migrated.chapterId === 'chapter-test', 'Связь публикации с главой потеряна при миграции.');
const emotionalLegacyPost = api.migratePost({ id: 'legacy-emotion', createdAt: '2026-01-01', text: 'Старая запись', mood: '🌙 Мечтательное', emotionIntensity: 9, emotionReason: 'invalid', decoration: { style: 'unknown', sticker: 'script' }, stats: {} });
assert(emotionalLegacyPost.emotionIntensity === 5 && emotionalLegacyPost.emotionReason === '', 'Сила или причина эмоции не нормализована.');
assert(emotionalLegacyPost.decoration.style === 'classic' && emotionalLegacyPost.decoration.sticker === 'none', 'Повреждённое украшение публикации не исправлено.');

api.state.memoryMode = true;
api.state.profile = api.normalizeProfile({ name: 'Тест', handle: 'test', followers: 10 });
api.state.settings = api.normalizeSettings({ simulationEnabled: true, simulationSpeed: 'fast' });
api.state.meta = api.normalizeMeta({ lastSimulationAt: new Date(Date.now() - 2 * 86400000).toISOString(), demoSeeded: true });
api.state.chapters = [normalizedChapter];
api.state.futureLetters = [normalizedLetter];
api.state.achievements = [];
api.state.posts = [{
  id: 'sim-1', createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), updatedAt: null,
  text: 'Длинная тестовая публикация '.repeat(20), mood: '', privacy: 'public', imageIds: ['image-1'],
  pinned: false, demo: false, stats: { views: 1, likes: 0, dislikes: 0, saves: 0 }, reaction: null, savedByMe: false
}];
const beforeViews = api.state.posts[0].stats.views;
await api.simulateActivity(Date.now(), true);
const afterStats = api.state.posts[0].stats;
assert(afterStats.views >= beforeViews, 'Симуляция уменьшила просмотры.');
assert(afterStats.likes <= afterStats.views && afterStats.dislikes <= afterStats.views && afterStats.saves <= afterStats.views, 'Симуляция нарушила ограничения статистики.');
assert(afterStats.likes >= afterStats.dislikes, 'При детерминированном тесте дизлайков оказалось больше лайков.');

const original = { id: 'same-a', createdAt: '2026-01-01T10:00:00.000Z', text: 'Одинаковый текст', mood: '', privacy: 'public' };
const duplicate = { ...original, id: 'same-b' };
assert(api.postFingerprint(original) === api.postFingerprint(duplicate), 'Дубликаты с разными ID не распознаются.');

api.state.posts = [
  { ...api.migratePost({ id: 'filter-1', createdAt: '2026-01-01T10:00:00.000Z', text: 'Важная заметка', imageIds: [], stats: { views: 5, likes: 1 } }), savedByMe: false },
  { ...api.migratePost({ id: 'filter-2', createdAt: '2026-01-02T10:00:00.000Z', text: 'Фото дня', imageIds: ['photo'], stats: { views: 40, likes: 12, saves: 4 } }), savedByMe: true }
];
api.state.filters = { search: 'важная', sort: 'new', photos: false, saved: false, archiveDate: null, chapterId: null };
assert(api.filteredPosts().length === 1 && api.filteredPosts()[0].id === 'filter-1', 'Поиск по тексту работает неверно.');
api.state.filters = { search: '', sort: 'popular', photos: true, saved: true, archiveDate: null, chapterId: null };
assert(api.filteredPosts().length === 1 && api.filteredPosts()[0].id === 'filter-2', 'Фильтры фото/сохранённых работают неверно.');

api.state.posts[0].chapterId = 'chapter-test';
api.state.filters = { search: '', sort: 'new', photos: false, saved: false, archiveDate: null, chapterId: 'chapter-test' };
assert(api.filteredPosts().length === 1 && api.filteredPosts()[0].id === 'filter-1', 'Фильтр главы жизни работает неверно.');
assert(api.writingStreak([
  { createdAt: '2026-07-03T10:00:00.000Z' }, { createdAt: '2026-07-02T10:00:00.000Z' }, { createdAt: '2026-07-01T10:00:00.000Z' }
]) === 3, 'Серия дней рассчитана неверно.');

const journalStatePosts = api.state.posts;
api.state.posts = [
  api.migratePost({ id: 'journal-1', createdAt: '2026-07-01T10:00:00.000Z', text: 'Первая история месяца', mood: '😊 Радостное', chapterId: 'chapter-test', imageIds: ['photo'], stats: { views: 8, likes: 2 } }),
  api.migratePost({ id: 'journal-2', createdAt: '2026-07-02T10:00:00.000Z', text: 'Вторая история месяца', mood: '😊 Радостное', emotionIntensity: 5, chapterId: 'chapter-test', imageIds: [], pinned: true, decoration: { style: 'paper', sticker: 'star' }, stats: { views: 4, likes: 1 } })
];
const journal = api.buildMonthlyJournal(new Date('2026-07-15T10:00:00.000Z'));
assert(journal.posts.length === 2 && journal.topMood === '😊 Радостное' && journal.photoCount === 1, 'Журнал месяца собран неверно.');
assert(journal.averageIntensity === 4, 'Средняя сила эмоции в журнале рассчитана неверно.');
const exhibits = api.buildMuseumExhibits();
assert(exhibits.length === 2 && exhibits[0].post.id === 'journal-2', 'Музей не выделяет значимое закреплённое воспоминание.');
api.state.profile.createdAt = '2025-01-01T00:00:00.000Z';
assert(api.diaryAgeInfo(new Date('2026-07-01T00:00:00.000Z').getTime()).stage === 4, 'Возраст дневника не достигает стадии реликвии по времени.');
await api.evaluateAchievements(false);
assert(api.state.achievements.some(item => item.id === 'first-page') && api.state.achievements.some(item => item.id === 'chapter-one'), 'Марки не открываются по выполненным условиям.');
api.state.posts = journalStatePosts;

const validBackup = {
  format: api.CONFIG.backupFormat,
  version: api.CONFIG.backupVersion,
  createdAt: new Date().toISOString(),
  profile: { name: 'Копия', handle: 'copy', followers: 2 },
  settings: { theme: 'custom', scene: 'rain', sceneIntensity: 'low', agingEnabled: true, customTheme: { name: 'Копия темы', page: '#101010', panel: '#202020', ink: '#eeeeee', accent: '#cc88ff', header: '#442266', pattern: 'grid', font: 'mono', radius: 6 } },
  meta: {},
  chapters: [{ id: 'backup-chapter', name: 'Глава копии', description: '', color: '#5b78b5', createdAt: new Date().toISOString() }],
  futureLetters: [{ id: 'backup-letter', title: 'Письмо', body: 'Будущее', createdAt: '2026-01-01T10:00:00.000Z', openAt: '2027-01-01T10:00:00.000Z', openedAt: null }],
  achievements: [{ id: 'first-page', unlockedAt: new Date().toISOString() }],
  posts: [{
    id: 'backup-post', createdAt: '2026-01-02T10:00:00.000Z', updatedAt: null,
    text: 'Из копии', mood: '🕯 Загадочное', emotionIntensity: 4, emotionReason: 'event', decoration: { style: 'parchment', sticker: 'moon' }, chapterId: 'backup-chapter', privacy: 'public', imageIds: ['backup-image'], pinned: false,
    stats: { views: 2, likes: 1, dislikes: 0, saves: 0 }, reaction: null, savedByMe: false
  }],
  images: [{ id: 'backup-image', name: 'tiny.png', type: 'image/png', createdAt: new Date().toISOString(), dataUrl: 'data:image/png;base64,iVBORw0KGgo=' }]
};
assert(api.validateBackupStructure(validBackup), 'Корректная копия не прошла проверку.');
await api.applyImport(validBackup, 'replace');
assert(api.state.memory.posts.size === 1, 'Импорт с заменой не сохранил публикацию.');
assert(api.state.memory.images.size === 1, 'Импорт с заменой не сохранил изображение.');
assert(api.state.memory.records.get('profile').value.name === 'Копия', 'Импорт с заменой не сохранил профиль.');
assert(api.state.memory.records.get('chapters').value.length === 1 && api.state.memory.records.get('futureLetters').value.length === 1, 'Импорт не сохранил главы или письма.');

api.state.posts = [...api.state.memory.posts.values()];
api.state.meta = api.normalizeMeta(api.state.memory.records.get('meta').value);
api.state.chapters = api.state.memory.records.get('chapters').value.map(api.normalizeChapter);
api.state.futureLetters = api.state.memory.records.get('futureLetters').value.map(api.normalizeFutureLetter);
api.state.achievements = api.normalizeAchievements(api.state.memory.records.get('achievements').value);
const mergeBackup = structuredClone(validBackup);
mergeBackup.posts = [
  { ...structuredClone(validBackup.posts[0]), id: 'same-content-new-id' },
  { ...structuredClone(validBackup.posts[0]), id: 'new-merge-post', createdAt: '2026-02-03T10:00:00.000Z', text: 'Новая запись при объединении', imageIds: [] }
];
await api.applyImport(mergeBackup, 'merge');
assert(api.state.memory.posts.size === 2, 'Объединение не исключило дубль или не добавило новую запись.');
api.state.posts = [...api.state.memory.posts.values()];
api.state.profile = api.normalizeProfile(api.state.memory.records.get('profile').value);
api.state.settings = api.normalizeSettings(api.state.memory.records.get('settings').value);
api.state.meta = api.normalizeMeta(api.state.memory.records.get('meta').value);
const exportedBackup = await api.buildBackup();
assert(exportedBackup.posts.length === 2 && exportedBackup.images.length === 1, 'Экспорт не включил все публикации и изображения.');
assert(exportedBackup.chapters.length >= 1 && exportedBackup.futureLetters.length >= 1 && exportedBackup.achievements.length >= 1, 'Экспорт не включил новые системы дневника.');
assert(exportedBackup.settings.theme === 'custom' && exportedBackup.settings.scene === 'rain' && exportedBackup.posts[0].emotionIntensity === 4 && exportedBackup.posts[0].decoration.style === 'parchment', 'Экспорт потерял визуальные настройки или эмоциональные данные.');
assert(api.validateBackupStructure(exportedBackup), 'Созданная экспортом копия не проходит собственную проверку.');

let duplicateRejected = false;
try {
  api.validateBackupStructure({ ...validBackup, posts: [validBackup.posts[0], { ...validBackup.posts[0] }] });
} catch {
  duplicateRejected = true;
}
assert(duplicateRejected, 'Копия с повторяющимися ID не была отклонена.');

console.log('OK: темы, сцены, музей, украшения, эмоции, старение, публикации и резервные копии прошли smoke-тесты.');
