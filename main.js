import { FileSystemManager } from './filesystem.js';
import { ProfileManager } from './profile.js';
import { VideoCatalogManager } from './videocatalog.js';

const fs = new FileSystemManager();
var appDataHandle = null;
var profileManager = null;
var currentProfile = null;
var currentProfileHistory = {};
var videoCatalog = null;

function setCurrentProfile(name) {
  currentProfile = name;
  localStorage.setItem('lastProfile', name);
}
function getLastProfile() {
  return localStorage.getItem('lastProfile');
}

async function init() {
  console.log('[main] init()');
  // ОТРИМУЄМО appDataHandle через вибрану медіа-папку
  let appDataHandle = await fs.getFolderHandle('mediaDir');
  if (!appDataHandle) { console.log('[main] No appDataHandle'); return; }
  appDataHandle = await fs.ensureAppDataFolder(appDataHandle);
  profileManager = new ProfileManager(appDataHandle);
  window.profileManager = profileManager;
  const lastProfile = getLastProfile();
  if (lastProfile) {
    console.log('[main] Using last profile:', lastProfile);
    currentProfile = lastProfile;
    window.currentProfile = currentProfile;
    currentProfileHistory = await profileManager.loadProfile(currentProfile);
    showProfileSwitcher();
    await startApp();
  } else {
    console.log('[main] No last profile, showing selector');
    showProfileSelector(profileManager, async (profileName) => {
      setCurrentProfile(profileName);
      window.currentProfile = profileName;
      currentProfileHistory = await profileManager.loadProfile(profileName);
      showProfileSwitcher();
      await startApp();
    });
  }
}

async function startApp() {
  console.log('[main] startApp() for profile', currentProfile);
  if (!window.currentProfileHistory) window.currentProfileHistory = {};
  if (!window.currentProfileHistory.movies) window.currentProfileHistory.movies = {};
  if (!window.currentProfileHistory.series) window.currentProfileHistory.series = {};
  const mediaList = document.getElementById('mediaList') || document.getElementById('video-root');
  if (!mediaList) {
    console.error('Не знайдено контейнер для рендеру каталогу!');
    return;
  }
  videoCatalog = new VideoCatalogManager(mediaList, fs, profileManager, currentProfile);
  showResumeButton();
  const dirHandle = await fs.getFolderHandle('mediaDir');
  if (!dirHandle) {
    mediaList.innerHTML = '<p>Не вдалося отримати доступ до папки. Оберіть її знову.</p>';
    return;
  }
  let serialsHandle = null, moviesHandle = null;
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'directory' && entry.name === 'Serials') serialsHandle = entry;
    if (entry.kind === 'directory' && entry.name === 'Movies') moviesHandle = entry;
  }
  if (moviesHandle) {
    console.log('[main] showVideoList (movies)');
    videoCatalog.showVideoList(moviesHandle);
  }
  if (serialsHandle) {
    console.log('[main] showSeriesRoot (serials)');
    videoCatalog.showSeriesRoot(serialsHandle);
  }
}

// --- UI для вибору профілю ---
function showProfileSelector(profileManager, onProfileSelected) {
  console.log('[main] showProfileSelector()');
  const container = document.createElement('div');
  container.style.background = '#222';
  container.style.padding = '2rem';
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100vw';
  container.style.height = '100vh';
  container.style.zIndex = '1000';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';

  const title = document.createElement('h2');
  title.textContent = 'Оберіть профіль';
  container.appendChild(title);

  const select = document.createElement('select');
  select.style.fontSize = '1.2rem';
  select.style.marginBottom = '1rem';
  container.appendChild(select);

  const input = document.createElement('input');
  input.placeholder = 'Новий профіль';
  input.style.fontSize = '1.2rem';
  input.style.marginBottom = '1rem';
  container.appendChild(input);

  const btn = document.createElement('button');
  btn.textContent = 'Увійти';
  btn.style.fontSize = '1.2rem';
  btn.onclick = async () => {
    let name = input.value.trim() || select.value;
    if (!name) {
      alert('Введіть ім’я профілю або виберіть існуючий!');
      return;
    }
    document.body.removeChild(container);
    onProfileSelected(name);
  };
  container.appendChild(btn);

  // Завантажити список профілів
  (async () => {
    try {
      const profiles = await profileManager.getProfiles();
      for (const profName of profiles) {
        const opt = document.createElement('option');
        opt.value = profName;
        opt.textContent = profName;
        select.appendChild(opt);
      }
    } catch (e) {
      console.error('Не вдалося завантажити профілі:', e);
    }
  })();

  document.body.appendChild(container);
}

// --- Кнопка для зміни профілю ---
function showProfileSwitcher() {
  console.log('[main] showProfileSwitcher()');
  let btn = document.getElementById('profile-switch-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'profile-switch-btn';
    btn.style.position = 'fixed';
    btn.style.top = '10px';
    btn.style.right = '10px';
    btn.style.zIndex = '2000';
    btn.style.background = '#1976d2';
    btn.style.color = '#fff';
    btn.style.fontWeight = 'bold';
    btn.style.borderRadius = '6px';
    btn.style.padding = '0.5rem 1rem';
    btn.style.border = 'none';
    document.body.appendChild(btn);
  }
  btn.textContent = 'Профіль: ' + currentProfile + ' (змінити)';
  btn.onclick = () => {
    showProfileSelector(profileManager, async (profileName) => {
      setCurrentProfile(profileName);
      currentProfileHistory = await profileManager.loadProfile(profileName);
      btn.textContent = 'Профіль: ' + currentProfile + ' (змінити)';
      await startApp();
    });
  };
}

function showResumeButton() {
  console.log('[main] showResumeButton()');
  const resumeContainer = document.getElementById('resumeContainer') || (() => {
    const d = document.createElement('div');
    d.id = 'resumeContainer';
    document.body.prepend(d);
    return d;
  })();
  resumeContainer.innerHTML = '';
  const lastMovie = currentProfileHistory['movie'];
  const lastSeries = currentProfileHistory['series'];
}
function formatTime(sec) {
  sec = Math.floor(sec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// --- Навігація: підсвічування активної сторінки та вибір папки ---
(function navHighlightAndChooseFolder() {
  const path = window.location.pathname;
  if (document.getElementById('nav-catalog')) {
    if (path.endsWith('index.html')) document.getElementById('nav-catalog').classList.add('active');
    if (path.endsWith('profile.html')) document.getElementById('nav-profile').classList.add('active');
  }
  const navChoose = document.getElementById('nav-choose-folder');
  if (navChoose) {
    navChoose.onclick = async () => {
      const dirHandle = await window.showDirectoryPicker();
      localStorage.setItem('mediaDir', await getHandleId(dirHandle));
      await saveHandleToIndexedDB('mediaDir', dirHandle);
      // location.reload();
      // --- одразу ініціалізуємо додаток ---
      if (typeof init === 'function') {
        await init();
      } else if (typeof startApp === 'function') {
        await startApp();
      }
    };
  }
})();

// --- Блокування інтерфейсу, якщо не вибрана папка ---
(function blockIfNoMediaDir() {
  if (!localStorage.getItem('mediaDirId')) {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(30,30,30,0.97)';
    overlay.style.zIndex = 9999;
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.innerHTML = '<h2 style="color:#fff;margin-bottom:2rem;">Оберіть медіа-папку для початку роботи</h2>';
    const btn = document.createElement('button');
    btn.textContent = 'Вибрати папку';
    btn.className = 'nav-link';
    btn.style.fontSize = '1.3rem';
    btn.onclick = async () => {
      const dirHandle = await window.showDirectoryPicker();
      const id = await getHandleId(dirHandle);
      localStorage.setItem('mediaDirId', id);
      await saveHandleToIndexedDB('mediaDir', dirHandle);
      overlay.remove();
      // Після вибору папки — переходимо до вибору профілю
      window.location = 'profile.html';
    };
    overlay.appendChild(btn);
    document.body.appendChild(overlay);
    // Блокуємо прокрутку
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
})();

// --- Головна логіка для index.html ---
function getShortEpisodeLabel(seasonName, episodeName) {
  const s = (() => { const m = seasonName && seasonName.match(/Season\s*(\d+)/i); return m ? parseInt(m[1], 10) : null; })();
  const e = (() => { const m = episodeName && episodeName.match(/E(\d{2})/i); return m ? parseInt(m[1], 10) : null; })();
  if (typeof s === 'number' && typeof e === 'number') return `S${s}E${e}`;
  return episodeName;
}
if (window.location.pathname.endsWith('index.html')) {
  (async () => {
    // --- Завантаження історії профілю ---
    const lastProfile = localStorage.getItem('lastProfile');
    if (!lastProfile) {
      // Якщо профіль не вибрано
      const historyBlock = document.createElement('div');
      historyBlock.className = 'history-block container';
      historyBlock.innerHTML = '<h2>Історія перегляду</h2><div>Профіль не вибрано</div>';
      const header = document.querySelector('header');
      if (header) header.insertAdjacentElement('afterend', historyBlock);
      else document.body.prepend(historyBlock);
      return;
    }
    // ініціалізуємо файлову систему та менеджер профілів
    const { FileSystemManager } = await import('./filesystem.js');
    const { ProfileManager } = await import('./profile.js');
    const fs = new FileSystemManager();
    let appDataHandle = await fs.getFolderHandle('mediaDir');
    if (!appDataHandle) {
      const historyBlock = document.createElement('div');
      historyBlock.className = 'history-block container';
      historyBlock.innerHTML = '<h2>Історія перегляду</h2><div>Оберіть медіа-папку для початку роботи!</div>';
      const header = document.querySelector('header');
      if (header) header.insertAdjacentElement('afterend', historyBlock);
      else document.body.prepend(historyBlock);
      return;
    }
    appDataHandle = await fs.ensureAppDataFolder(appDataHandle);
    const profileManager = new ProfileManager(appDataHandle);
    window.currentProfileHistory = await profileManager.loadProfile(lastProfile);
    // Debug: вивід історії у консоль
    console.log('[DEBUG] currentProfileHistory:', window.currentProfileHistory);
    // --- Рендеримо блок історії ---
    const historyBlock = document.createElement('div');
    historyBlock.className = 'history-block container';
    historyBlock.innerHTML = '<h2>Історія перегляду</h2>';
    let historyItems = [];
    try {
      const hist = window.currentProfileHistory;
      if (!hist || (!hist.movies && !hist.series)) {
        historyBlock.innerHTML += '<div>Профіль не вибрано або історія порожня</div>';
      } else {
        // Фільми
        if (hist.movies) {
          for (const name in hist.movies) {
            if (hist.movies[name].lastTime > 0) {
              historyItems.push({
                type: 'movie',
                name,
                time: hist.movies[name].lastTime,
                watched: hist.movies[name].watched
              });
            }
          }
        }
        // Серіали
        if (hist.series) {
          for (const series in hist.series) {
            for (const season in hist.series[series]) {
              for (const ep in hist.series[series][season]) {
                const h = hist.series[series][season][ep];
                if (h.lastTime > 0) {
                  historyItems.push({
                    type: 'series',
                    series,
                    season,
                    ep,
                    time: h.lastTime,
                    watched: h.watched
                  });
                }
              }
            }
          }
        }
        // Сортуємо за timestamp (останній перегляд): найсвіжіше перше
        historyItems.sort((a, b) => {
          if (b.timestamp && a.timestamp) return b.timestamp - a.timestamp;
          if (b.timestamp) return 1;
          if (a.timestamp) return -1;
          return b.time - a.time;
        });
        // Обрізаємо до 5 після сортування
        historyItems = historyItems.slice(0, 5);
        // Реверсуємо: найсвіжіше буде першим у grid
        // historyItems.reverse();
        // Рендеримо у цьому ж порядку
        if (historyItems.length === 0) {
          historyBlock.innerHTML += '<div>Немає історії перегляду</div>';
        } else {
          const grid = document.createElement('div');
          grid.className = 'history-grid';
          historyItems.forEach((item, idx) => {
            let url = '';
            let title = '';
            let meta = '';
            let dateStr = '';
            if (item.timestamp) {
              const d = new Date(item.timestamp);
              dateStr = d.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            }
            if (item.type === 'movie') {
              url = `video.html?type=movie&file=${encodeURIComponent(item.name)}`;
              title = item.name;
              meta = 'Фільм';
            } else {
              // Використовуємо getShortEpisodeLabel для короткого параметра
              const shortEp = getShortEpisodeLabel(item.season, item.ep);
              url = `video.html?type=series&series=${encodeURIComponent(item.series)}&episode=${encodeURIComponent(shortEp)}`;
              title = item.series;
              meta = `Сезон: ${item.season.match(/\d+/)?.[0] || item.season}, Серія: ${item.ep.match(/E(\d+)/i)?.[1] || item.ep}`;
            }
            const a = document.createElement('a');
            a.className = 'history-item';
            a.href = url;
            a.title = title;
            a.innerHTML = `
              <span class="history-status">${item.watched ? '✅' : '⏺️'}</span>
              <span class="history-title">${title}</span>
              <span class="history-meta">${meta}</span>
              <span class="history-meta">${formatTime(item.time)}${dateStr ? ' • ' + dateStr : ''}</span>
              ${idx === 0 ? '<span class="history-last-label">Останнє</span>' : ''}
            `;
            grid.appendChild(a);
          });
          historyBlock.appendChild(grid);
        }
      }
    } catch(e) {
      historyBlock.innerHTML += '<div>Не вдалося завантажити історію</div>';
    }
    const header = document.querySelector('header');
    if (header) {
      header.insertAdjacentElement('afterend', historyBlock);
    } else {
      document.body.prepend(historyBlock);
    }
    // --- Рендеримо каталог ---
    const grid = document.getElementById('media-grid');
    grid.innerHTML = '';
    // Створюємо відеокаталог з profileManager
    window.videoCatalog = new (await import('./videocatalog.js')).VideoCatalogManager(grid, fs, profileManager, lastProfile);
    const dirHandle = await fs.getFolderHandle('mediaDir');
    if (!dirHandle) {
      grid.innerHTML = '<p>Не вдалося отримати доступ до папки. Оберіть її знову.</p>';
      localStorage.removeItem('mediaDir');
      return;
    }
    let serialsHandle = null, moviesHandle = null;
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'directory' && entry.name === 'Serials') serialsHandle = entry;
      if (entry.kind === 'directory' && entry.name === 'Movies') moviesHandle = entry;
    }
    // Рендеримо серіали
    if (serialsHandle) {
      const section = document.createElement('section');
      section.className = 'media-section';
      const h = document.createElement('h2');
      h.textContent = 'Серіали';
      section.appendChild(h);
      const serialsGrid = document.createElement('div');
      serialsGrid.className = 'media-grid';
      section.appendChild(serialsGrid);
      grid.appendChild(section);
      // Тимчасово підміняємо mediaList для VideoCatalogManager
      const origMediaList = window.videoCatalog.mediaList;
      window.videoCatalog.mediaList = serialsGrid;
      await window.videoCatalog.showSeriesRoot(serialsHandle);
      window.videoCatalog.mediaList = origMediaList;
    }
    // Рендеримо фільми
    if (moviesHandle) {
      const section = document.createElement('section');
      section.className = 'media-section';
      const h = document.createElement('h2');
      h.textContent = 'Фільми';
      section.appendChild(h);
      const moviesGrid = document.createElement('div');
      moviesGrid.className = 'media-grid';
      section.appendChild(moviesGrid);
      grid.appendChild(section);
      const origMediaList = window.videoCatalog.mediaList;
      window.videoCatalog.mediaList = moviesGrid;
      await window.videoCatalog.showVideoList(moviesHandle);
      window.videoCatalog.mediaList = origMediaList;
    }
  })();
}
// --- Логіка для video.html ---
if (window.location.pathname.endsWith('video.html')) {
  (async () => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    const seriesName = params.get('series');
    const fileName = params.get('file');
    const seasonName = params.get('season');
    const episodeShort = params.get('episode');
    const root = document.getElementById('video-root');
    // ініціалізуємо файлову систему та менеджер профілів
    const { FileSystemManager } = await import('./filesystem.js');
    const { ProfileManager } = await import('./profile.js');
    const fs = new FileSystemManager();
    let appDataHandle = await fs.getFolderHandle('mediaDir');
    if (!appDataHandle) {
      root.innerHTML = '<p>Не вдалося отримати доступ до папки. Поверніться на головну.</p>';
      return;
    }
    appDataHandle = await fs.ensureAppDataFolder(appDataHandle);
    const profileManager = new ProfileManager(appDataHandle);
    const currentProfile = localStorage.getItem('lastProfile');
    const currentProfileHistory = await profileManager.loadProfile(currentProfile);
    window.profileManager = profileManager;
    window.currentProfile = currentProfile;
    window.currentProfileHistory = currentProfileHistory;
    // Створюємо VideoCatalogManager
    const vcm = new (await import('./videocatalog.js')).VideoCatalogManager(root, fs, profileManager, currentProfile);
    // --- Допоміжна функція для короткого підпису S1E1 ---
    function getShortEpisodeLabel(seasonName, episodeName) {
      const s = (() => { const m = seasonName && seasonName.match(/Season\s*(\d+)/i); return m ? parseInt(m[1], 10) : null; })();
      const e = (() => { const m = episodeName && episodeName.match(/E(\d{2})/i); return m ? parseInt(m[1], 10) : null; })();
      if (typeof s === 'number' && typeof e === 'number') return `S${s}E${e}`;
      return episodeName;
    }
    if (type === 'movie' && fileName) {
      let dirHandle = await fs.getFolderHandle('mediaDir');
      if (!dirHandle) {
        root.innerHTML = '<p>Не вдалося отримати доступ до папки. Поверніться на головну.</p>';
        return;
      }
      let moviesHandle = null;
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'directory' && entry.name === 'Movies') moviesHandle = entry;
      }
      if (!moviesHandle) {
        root.innerHTML = '<p>Папку "Movies" не знайдено у вибраній медіа-папці.</p>';
        return;
      }
      for await (const entry of moviesHandle.values()) {
        if (entry.kind === 'file' && entry.name === fileName) {
          vcm.showMovieVideo(moviesHandle, entry);
          return;
        }
      }
      root.innerHTML = '<p>Фільм не знайдено.</p>';
    } else if (type === 'series' && seriesName) {
      let dirHandle = await fs.getFolderHandle('mediaDir');
      if (!dirHandle) {
        root.innerHTML = '<p>Не вдалося отримати доступ до папки. Поверніться на головну.';
        return;
      }
      let serialsHandle = null;
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'directory' && entry.name === 'Serials') serialsHandle = entry;
      }
      if (!serialsHandle) {
        root.innerHTML = '<p>Папку "Serials" не знайдено у вибраній медіа-папці.</p>';
        return;
      }
      for await (const seriesEntry of serialsHandle.values()) {
        if (seriesEntry.kind === 'directory' && seriesEntry.name === seriesName) {
          // Збираємо всі сезони
          let seasons = [];
          for await (const seasonEntry of seriesEntry.values()) {
            if (seasonEntry.kind === 'directory' && /Season\s*\d+/i.test(seasonEntry.name)) {
              seasons.push(seasonEntry);
            }
          }
          // Парсимо episode=S1E1
          let targetSeason = seasons[0];
          let targetEpisode = null;
          if (episodeShort) {
            for (const season of seasons) {
              for await (const epEntry of season.values()) {
                if (epEntry.kind === 'file' && getShortEpisodeLabel(season.name, epEntry.name) === episodeShort) {
                  targetSeason = season;
                  targetEpisode = epEntry;
                  break;
                }
              }
              if (targetEpisode) break;
            }
          }
          // Якщо не знайдено — дефолтний перший
          if (!targetEpisode) {
            for await (const epEntry of targetSeason.values()) {
              if (epEntry.kind === 'file') {
                targetEpisode = epEntry;
                break;
              }
            }
          }
          // Збираємо всі епізоди сезону
          let episodes = [];
          for await (const epEntry of targetSeason.values()) {
            if (epEntry.kind === 'file' && epEntry.name.match(/\.(mp4|webm|ogg|mkv)$/i)) {
              episodes.push(epEntry);
            }
          }
          // Збираємо всі сезони
          let allSeasons = [];
          for await (const seasonEntry of seriesEntry.values()) {
            if (seasonEntry.kind === 'directory' && /Season\s*\d+/i.test(seasonEntry.name)) {
              allSeasons.push(seasonEntry);
            }
          }
          vcm.showEpisodeVideo(targetSeason, seriesEntry, seriesName, targetSeason.name, targetEpisode, episodes, allSeasons, seriesEntry);
          return;
        }
      }
      root.innerHTML = '<p>Серіал не знайдено.</p>';
    } else {
      root.innerHTML = '<p>Невірний тип або параметри відео.</p>';
    }
  })();
}
// --- Функції для IndexedDB (збереження/отримання handle) ---
async function saveHandleToIndexedDB(key, handle) {
  const db = await window.indexedDB.open('media-manager-db', 1);
  return new Promise((resolve, reject) => {
    db.onsuccess = () => {
      const tx = db.result.transaction('folders', 'readwrite');
      tx.objectStore('folders').put(handle, key);
      tx.oncomplete = resolve;
      tx.onerror = reject;
    };
    db.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders');
      }
    };
  });
}
async function getHandleFromIndexedDB(key) {
  const db = await window.indexedDB.open('media-manager-db', 1);
  return new Promise((resolve, reject) => {
    db.onsuccess = () => {
      const tx = db.result.transaction('folders');
      const req = tx.objectStore('folders').get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = reject;
    };
    db.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders');
      }
    };
  });
}
async function getHandleId(handle) {
  // Для File System Access API: handle.name + kind
  return handle.name + ':' + handle.kind;
}

init(); 