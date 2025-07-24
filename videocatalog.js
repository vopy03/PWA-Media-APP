export class VideoCatalogManager {
  constructor(mediaListElement, fsManager, profileManager, currentProfile) {
    this.mediaList = mediaListElement;
    this.fs = fsManager;
    this.profile = profileManager;
    this.currentProfile = currentProfile;
  }

  async showSeriesRoot(dirHandle) {
    console.log('[VideoCatalog] showSeriesRoot');
    this.mediaList.innerHTML = '';
    // --- Діагностика ---
    let foundAny = false;
    for await (const entry of dirHandle.values()) {
      console.log('Serials level1:', entry.name, entry.kind);
      if (entry.kind === 'directory' && entry.name !== '.media-app-data') {
        let hasSeason = false;
        for await (const sub of entry.values()) {
          console.log('  Subfolder:', sub.name, sub.kind);
          if (sub.kind === 'directory' && /Season\s*\d+/i.test(sub.name)) {
            hasSeason = true;
            break;
          }
        }
        if (hasSeason) {
          console.log('  => Серіал:', entry.name);
          foundAny = true;
          const card = document.createElement('div');
          card.className = 'media-card';
          card.innerHTML = `
            <div class="title">${entry.name}</div>
            <div class="type">Серіал</div>
          `;
          card.onclick = () => this.showSeasons(entry, entry, entry.name);
          this.mediaList.appendChild(card);
        } else {
          // Можливо, це категорія — шукаємо серіали на глибину 2
          for await (const sub of entry.values()) {
            if (sub.kind === 'directory') {
              let hasSeason2 = false;
              for await (const sub2 of sub.values()) {
                console.log('    Sub2:', sub2.name, sub2.kind);
                if (sub2.kind === 'directory' && /Season\s*\d+/i.test(sub2.name)) {
                  hasSeason2 = true;
                  break;
                }
              }
              if (hasSeason2) {
                console.log('  => Серіал (категорія):', sub.name);
                foundAny = true;
                const card = document.createElement('div');
                card.className = 'media-card';
                card.innerHTML = `
                  <div class=\"title\">${sub.name}</div>
                  <div class=\"type\">Серіал</div>
                `;
                card.onclick = () => this.showSeasons(sub, sub, sub.name);
                this.mediaList.appendChild(card);
              }
            }
          }
        }
      }
    }
    if (!foundAny) {
      this.mediaList.innerHTML = '<div style="padding:2rem;text-align:center;">Серіалів не знайдено</div>';
    }
  }

  async showSeasons(seriesHandle, rootHandle, seriesName) {
    console.log('[VideoCatalog] showSeasons', seriesName);
    this.mediaList.innerHTML = '';
    let seasons = [];
    for await (const entry of seriesHandle.values()) {
      if (entry.kind === 'directory' && /Season\s*\d+/i.test(entry.name)) {
        seasons.push(entry);
        const item = document.createElement('div');
        item.className = 'media-entry';
        item.style.cursor = 'pointer';
        item.textContent = entry.name;
        item.onclick = () => this.showEpisodes(entry, seriesHandle, seriesName, entry.name, seriesHandle);
        this.mediaList.appendChild(item);
      }
    }
    // --- Автоматичний перехід ---
    // 1. Якщо є історія перегляду — шукаємо останню переглянуту серію
    let lastSeason = null, lastEpisode = null, lastTime = 0;
    if (window.currentProfileHistory && window.currentProfileHistory.series && window.currentProfileHistory.series[seriesName]) {
      for (const seasonName in window.currentProfileHistory.series[seriesName]) {
        for (const epName in window.currentProfileHistory.series[seriesName][seasonName]) {
          const h = window.currentProfileHistory.series[seriesName][seasonName][epName];
          if (h && h.timestamp && h.timestamp > lastTime) {
            lastTime = h.timestamp;
            lastSeason = seasonName;
            lastEpisode = epName;
          }
        }
      }
    }
    if (lastSeason && lastEpisode) {
      // Переходимо на останню переглянуту серію
      setTimeout(() => {
        this.showEpisodes(
          seasons.find(s => s.name === lastSeason) || seasons[0],
          seriesHandle,
          seriesName,
          lastSeason,
          seriesHandle,
          lastEpisode
        );
      }, 100);
    } else if (seasons.length > 0) {
      // Переходимо на перший сезон і першу серію
      setTimeout(() => {
        this.showEpisodes(seasons[0], seriesHandle, seriesName, seasons[0].name, seriesHandle);
      }, 100);
    }
  }

  async showEpisodes(seasonHandle, rootHandle, seriesName, seasonName, seriesHandle, activeFileName = null) {
    console.log('[VideoCatalog] showEpisodes', seriesName, seasonName, activeFileName);
    console.log('[DEBUG] showEpisodes handles:', {
      seasonHandle,
      seriesHandle,
      seasonHandleName: seasonHandle && seasonHandle.name,
      seriesHandleName: seriesHandle && seriesHandle.name,
      seasonHandleKind: seasonHandle && seasonHandle.kind,
      seriesHandleKind: seriesHandle && seriesHandle.kind
    });
    this.mediaList.innerHTML = '';
    let episodes = [];
    let allSeasons = [];
    // Збираємо всі сезони
    for await (const entry of seriesHandle.values()) {
      if (entry.kind === 'directory' && /Season\s*\d+/i.test(entry.name)) {
        allSeasons.push(entry);
      }
    }
    // Збираємо всі серії сезону
    for await (const entry of seasonHandle.values()) {
      if (entry.kind === 'file' && entry.name.match(/\.(mp4|webm|ogg|mkv)$/i)) {
        episodes.push(entry);
      }
    }
    // Сортуємо серії та сезони
    episodes.sort((a, b) => a.name.localeCompare(b.name, undefined, {sensitivity: 'base'}));
    allSeasons.sort((a, b) => a.name.localeCompare(b.name, undefined, {sensitivity: 'base'}));
    // --- Горизонтальний список серій сезону ---
    if (episodes.length > 0) {
      const episodesNav = document.createElement('div');
      episodesNav.className = 'episodes-grid';
      episodes.forEach((ep, idx) => {
        // --- Відображення статусу перегляду ---
        let watched = false, lastTime = 0;
        if (window.currentProfileHistory && window.currentProfileHistory.series && window.currentProfileHistory.series[seriesName] && window.currentProfileHistory.series[seriesName][seasonName] && window.currentProfileHistory.series[seriesName][seasonName][ep.name]) {
          watched = window.currentProfileHistory.series[seriesName][seasonName][ep.name].watched;
          lastTime = window.currentProfileHistory.series[seriesName][seasonName][ep.name].lastTime;
        }
        const btn = document.createElement('button');
        btn.className = 'episode-btn' + (ep.name === activeFileName ? ' active' : '');
        btn.textContent = (watched ? '✅ ' : '') + `Серія ${idx + 1}` + (lastTime ? ` (${this.formatTime(lastTime)})` : '');
        btn.onclick = () => this.showEpisodes(seasonHandle, seriesHandle, seriesName, seasonName, seriesHandle, ep.name);
        episodesNav.appendChild(btn);
      });
      this.mediaList.appendChild(episodesNav);
    }
    // --- Горизонтальний список сезонів серіалу ---
    if (allSeasons.length > 0) {
      const seasonsNav = document.createElement('div');
      seasonsNav.className = 'seasons-grid';
      allSeasons.forEach(season => {
        const btn = document.createElement('button');
        btn.className = 'season-btn' + (season.name === seasonName ? ' active' : '');
        btn.textContent = this.getSeasonNumber(season.name) + ' сезон';
        btn.onclick = () => this.showEpisodes(season, seriesHandle, seriesName, season.name, seriesHandle);
        seasonsNav.appendChild(btn);
      });
      this.mediaList.appendChild(seasonsNav);
    }
    // --- Якщо вибрана серія, одразу показати відео ---
    if (activeFileName) {
      const entry = episodes.find(e => e.name === activeFileName);
      if (entry) {
        this.showEpisodeVideo(seasonHandle, seriesHandle, seriesName, seasonName, entry, episodes, allSeasons, seriesHandle);
      }
    }
  }

  // --- Допоміжні функції для номерів ---
  getEpisodeNumber(name) {
    const m = name.match(/E(\d{2})/i);
    return m ? parseInt(m[1], 10) : name;
  }
  getSeasonNumber(name) {
    const m = name.match(/Season\s*(\d+)/i);
    return m ? parseInt(m[1], 10) : name;
  }

  // --- Допоміжна функція для короткого підпису S1E12 ---
  getShortEpisodeLabel(seasonName, episodeName) {
    const s = this.getSeasonNumber(seasonName);
    const e = this.getEpisodeNumber(episodeName);
    if (typeof s === 'number' && typeof e === 'number') {
      return `S${s}E${e}`;
    }
    return episodeName;
  }

  async showEpisodeVideo(seasonHandle, rootHandle, seriesName, seasonName, entry, episodes, allSeasons, seriesHandle, resumeTime = null) {
    console.log('[VideoCatalog] showEpisodeVideo', seriesName, seasonName, entry && entry.name, resumeTime);
    this.mediaList.innerHTML = '';
    // Назва серії
    const title = document.createElement('div');
    title.textContent = `${seriesName} / ${seasonName} / ${entry.name}`;
    title.style.marginBottom = '1rem';
    title.style.fontWeight = 'bold';
    this.mediaList.appendChild(title);
    // Відео
    const file = await entry.getFile();
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.className = 'video-js vjs-default-skin';
    video.setAttribute('controls', '');
    video.setAttribute('preload', 'auto');
    video.setAttribute('data-setup', '{}');
    video.src = url;
    // --- Відновлення часу перегляду ---
    if (resumeTime) {
      video.currentTime = resumeTime;
    } else if (
      window.currentProfileHistory &&
      window.currentProfileHistory.series &&
      window.currentProfileHistory.series[seriesName] &&
      window.currentProfileHistory.series[seriesName][seasonName] &&
      window.currentProfileHistory.series[seriesName][seasonName][entry.name] &&
      window.currentProfileHistory.series[seriesName][seasonName][entry.name].lastTime > 0
    ) {
      video.currentTime = window.currentProfileHistory.series[seriesName][seasonName][entry.name].lastTime;
    }
    this.mediaList.appendChild(video);

    // --- Горизонтальні списки серій і сезонів ---
    if (episodes && episodes.length > 0) {
      const episodesNav = document.createElement('div');
      episodesNav.className = 'episodes-grid';
      episodes.forEach((ep, idx) => {
        let watched = false, lastTime = 0;
        if (window.currentProfileHistory && window.currentProfileHistory.series && window.currentProfileHistory.series[seriesName] && window.currentProfileHistory.series[seriesName][seasonName] && window.currentProfileHistory.series[seriesName][seasonName][ep.name]) {
          watched = window.currentProfileHistory.series[seriesName][seasonName][ep.name].watched;
          lastTime = window.currentProfileHistory.series[seriesName][seasonName][ep.name].lastTime;
        }
        const btn = document.createElement('button');
        btn.className = 'episode-btn' + (ep.name === entry.name ? ' active' : '');
        btn.textContent = (watched ? '✅ ' : '') + `Серія ${idx + 1}` + (lastTime ? ` (${this.formatTime(lastTime)})` : '');
        btn.onclick = () => this.showEpisodes(seasonHandle, seriesHandle, seriesName, seasonName, seriesHandle, ep.name);
        episodesNav.appendChild(btn);
      });
      this.mediaList.appendChild(episodesNav);
    }
    if (allSeasons && allSeasons.length > 0) {
      const seasonsNav = document.createElement('div');
      seasonsNav.className = 'seasons-grid';
      allSeasons.forEach(season => {
        const btn = document.createElement('button');
        btn.className = 'season-btn' + (season.name === seasonName ? ' active' : '');
        btn.textContent = this.getSeasonNumber(season.name) + ' сезон';
        btn.onclick = () => this.showEpisodes(season, seriesHandle, seriesName, season.name, seriesHandle);
        seasonsNav.appendChild(btn);
      });
      this.mediaList.appendChild(seasonsNav);
    }
    console.log('[VideoCatalog] video', video);
    // --- Збереження статусу перегляду ---
    video.addEventListener('timeupdate', () => {
      if (!window.currentProfileHistory) return;
      if (!window.currentProfileHistory.series) window.currentProfileHistory.series = {};
      if (!window.currentProfileHistory.series[seriesName]) window.currentProfileHistory.series[seriesName] = {};
      if (!window.currentProfileHistory.series[seriesName][seasonName]) window.currentProfileHistory.series[seriesName][seasonName] = {};
      const duration = video.duration || 0;
      const left = duration - video.currentTime;
      window.currentProfileHistory.series[seriesName][seasonName][entry.name] = {
        watched: (duration > 0 && left < 30),
        lastTime: video.currentTime,
        timestamp: Date.now()
      };
      this.saveProfileThrottled();
    });
    // Зберігати при паузі, завершенні, закритті сторінки
    ['pause', 'ended'].forEach(ev => video.addEventListener(ev, () => this.saveProfileThrottled()));
    window.addEventListener('beforeunload', () => this.saveProfileThrottled());
  }

  async showVideoList(dirHandle) {
    console.log('[VideoCatalog] showVideoList');
    this.mediaList.innerHTML = '';
    let files = [];
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file' && entry.name.match(/\.(mp4|webm|ogg|mkv)$/i)) {
        files.push(entry);
      }
    }
    files.forEach(entry => {
      // --- Відображення статусу перегляду ---
      let watched = false, lastTime = 0;
      if (window.currentProfileHistory && window.currentProfileHistory.movies && window.currentProfileHistory.movies[entry.name]) {
        watched = window.currentProfileHistory.movies[entry.name].watched;
        lastTime = window.currentProfileHistory.movies[entry.name].lastTime;
      }
      const card = document.createElement('div');
      card.className = 'media-card';
      card.innerHTML = `
        <div class="title">${entry.name}</div>
        <div class="type">Фільм</div>
        <div class="status">${watched ? '✅ Переглянуто' : (lastTime ? '⏺️ Не завершено' : '')}</div>
      `;
      card.onclick = () => this.showMovieVideo(dirHandle, entry);
      this.mediaList.appendChild(card);
    });
  }

  async showMovieVideo(dirHandle, entry, resumeTime = null) {
    console.log('[VideoCatalog] showMovieVideo', entry && entry.name, resumeTime);
    this.mediaList.innerHTML = '';
    const title = document.createElement('div');
    title.textContent = entry.name;
    title.style.marginBottom = '1rem';
    title.style.fontWeight = 'bold';
    this.mediaList.appendChild(title);
    const file = await entry.getFile();
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.className = 'video-js vjs-default-skin';
    video.setAttribute('controls', '');
    video.setAttribute('preload', 'auto');
    video.setAttribute('data-setup', '{}');
    video.src = url;
    if (resumeTime) video.currentTime = resumeTime;
    this.mediaList.appendChild(video);
    // Кнопка назад
    const backBtn = document.createElement('button');
    backBtn.textContent = '⬅️ Назад до списку фільмів';
    backBtn.onclick = () => this.showVideoList(dirHandle);
    this.mediaList.appendChild(backBtn);
    // --- Збереження статусу перегляду ---
    video.addEventListener('timeupdate', () => {
      if (!window.currentProfileHistory.movies) window.currentProfileHistory.movies = {};
      const duration = video.duration || 0;
      const left = duration - video.currentTime;
      window.currentProfileHistory.movies[entry.name] = {
        watched: (duration > 0 && left < 30),
        lastTime: video.currentTime,
        timestamp: Date.now()
      };
      this.saveProfileThrottled();
    });
    ['pause', 'ended'].forEach(ev => video.addEventListener(ev, () => this.saveProfileThrottled()));
    window.addEventListener('beforeunload', () => this.saveProfileThrottled());
  }

  async resumeLastWatched(type, data) {
    console.log('[VideoCatalog] resumeLastWatched', type, data);
    if (type === 'movie') {
      const moviesHandle = await this.fs.getFolderHandle('movies');
      for await (const entry of moviesHandle.values()) {
        if (entry.kind === 'file' && entry.name === data.fileName) {
          this.showMovieVideo(moviesHandle, entry, data.time);
          return;
        }
      }
      alert('Фільм не знайдено!');
    } else if (type === 'series') {
      const seriesHandle = await this.fs.getFolderHandle('series');
      let found = false;
      for await (const seriesEntry of seriesHandle.values()) {
        if (seriesEntry.kind === 'directory' && seriesEntry.name === data.seriesName) {
          for await (const seasonEntry of seriesEntry.values()) {
            if (seasonEntry.kind === 'directory' && seasonEntry.name === data.seasonName) {
              let episodes = [];
              let allSeasons = [];
              for await (const entry of seriesEntry.values()) {
                if (entry.kind === 'directory' && /Season\s*\d+/i.test(entry.name)) {
                  allSeasons.push(entry);
                }
              }
              for await (const entry of seasonEntry.values()) {
                if (entry.kind === 'file' && entry.name.match(/\.(mp4|webm|ogg|mkv)$/i)) {
                  episodes.push(entry);
                }
              }
              // --- Знаходимо останню переглянуту серію ---
              let lastWatched = null;
              if (window.currentProfileHistory && window.currentProfileHistory.series && window.currentProfileHistory.series[data.seriesName] && window.currentProfileHistory.series[data.seriesName][data.seasonName]) {
                let maxTime = 0;
                for (const epName in window.currentProfileHistory.series[data.seriesName][data.seasonName]) {
                  const epData = window.currentProfileHistory.series[data.seriesName][data.seasonName][epName];
                  if (epData && epData.lastTime > maxTime) {
                    maxTime = epData.lastTime;
                    lastWatched = { name: epName, ...epData };
                  }
                }
              }
              let fileHandle = null;
              if (lastWatched) {
                fileHandle = episodes.find(e => e.name === lastWatched.name);
                if (fileHandle) {
                  this.showEpisodeVideo(seasonEntry, seriesEntry, data.seriesName, data.seasonName, fileHandle, episodes, allSeasons, seriesEntry, lastWatched.lastTime);
                  found = true;
                  break;
                }
              } else {
                // Якщо не знайдено — шукаємо за data.fileName
                fileHandle = episodes.find(e => e.name === data.fileName);
                if (fileHandle) {
                  this.showEpisodeVideo(seasonEntry, seriesEntry, data.seriesName, data.seasonName, fileHandle, episodes, allSeasons, seriesEntry, data.time);
                  found = true;
                  break;
                }
              }
            }
          }
        }
      }
      if (!found) alert('Серію не знайдено у профілі!');
    }
  }

  formatTime(sec) {
    sec = Math.floor(sec);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // --- Throttle для saveProfile ---
  saveProfileThrottled() {
    const now = Date.now();
    if (!this._lastSave || now - this._lastSave > 10000) {
      if (this.profile && this.currentProfile) {
        this.profile.saveProfile(this.currentProfile, window.currentProfileHistory);
        this._lastSave = now;
      }
    }
  }
} 