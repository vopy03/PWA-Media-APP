/**
 * UIManager - клас для управління інтерфейсом користувача
 * Надає методи для рендерингу різних компонентів UI
 */
class UIManager {
  constructor(container) {
    this.container = container;
    this.currentView = null;
    this.onItemClick = null;
    this.onProfileSelect = null;
  }

  /**
   * Встановлення callback для кліків по елементам
   */
  setItemClickHandler(handler) {
    this.onItemClick = handler;
  }

  /**
   * Встановлення callback для вибору профілю
   */
  setProfileSelectHandler(handler) {
    this.onProfileSelect = handler;
  }

  /**
   * Очищення контейнера
   */
  clear() {
    this.container.innerHTML = '';
    this.currentView = null;
  }

  /**
   * Показ повідомлення про завантаження
   */
  showLoading(message = 'Завантаження...') {
    this.clear();
    this.container.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p class="loading-text">${message}</p>
      </div>
    `;
  }

  /**
   * Показ повідомлення про помилку
   */
  showError(message, details = null) {
    this.clear();
    this.container.innerHTML = `
      <div class="error-container">
        <div class="error-icon">❌</div>
        <h3 class="error-title">Помилка</h3>
        <p class="error-message">${message}</p>
        ${details ? `<details class="error-details"><summary>Деталі</summary><pre>${details}</pre></details>` : ''}
      </div>
    `;
  }

  /**
   * Показ повідомлення про порожній стан
   */
  showEmpty(message = 'Нічого не знайдено') {
    this.clear();
    this.container.innerHTML = `
      <div class="empty-container">
        <div class="empty-icon">📁</div>
        <p class="empty-text">${message}</p>
      </div>
    `;
  }

  /**
   * Рендеринг селектора профілів
   */
  renderProfileSelector(profiles, currentProfile = null) {
    this.clear();
    this.currentView = 'profile-selector';
    
    this.container.innerHTML = `
      <div class="profile-selector">
        <h2 class="profile-title">Виберіть профіль</h2>
        
        <div class="profile-list">
          ${profiles.map(profile => `
            <div class="profile-item ${currentProfile && currentProfile.name === profile.name ? 'active' : ''}" 
                 data-profile="${profile.name}">
              <div class="profile-avatar">${profile.name.charAt(0).toUpperCase()}</div>
              <div class="profile-info">
                <h3 class="profile-name">${profile.name}</h3>
                <p class="profile-last-used">Останній раз: ${this.formatDate(profile.lastUsed)}</p>
              </div>
              <button class="profile-delete-btn" data-profile="${profile.name}" title="Видалити профіль">🗑️</button>
            </div>
          `).join('')}
        </div>
        
        <div class="profile-create">
          <input type="text" id="new-profile-name" placeholder="Назва нового профілю" class="profile-input">
          <button id="create-profile-btn" class="profile-create-btn">Створити профіль</button>
        </div>
      </div>
    `;

    // Додаємо обробники подій
    this.addProfileEventListeners();
  }

  /**
   * Рендеринг каталогу медіа
   */
  renderMediaCatalog(movies, series, lastWatched = null) {
    this.clear();
    this.currentView = 'media-catalog';
    
    this.container.innerHTML = `
      <div class="media-catalog">
        ${lastWatched ? this.renderLastWatched(lastWatched) : ''}
        
        <div class="media-section">
          <h2 class="section-title">🎬 Фільми (${movies.length})</h2>
          <div class="media-grid movies-grid">
            ${movies.map(movie => this.renderMovieCard(movie)).join('')}
          </div>
        </div>
        
        <div class="media-section">
          <h2 class="section-title">📺 Серіали (${series.length})</h2>
          <div class="media-grid series-grid">
            ${series.map(seriesItem => this.renderSeriesCard(seriesItem)).join('')}
          </div>
        </div>
      </div>
    `;

    // Додаємо обробники подій
    this.addMediaEventListeners();
  }

  /**
   * Рендеринг картки фільму
   */
  renderMovieCard(movie) {
    const progress = movie.progress ? this.calculateProgress(movie.progress) : null;
    
    return `
      <div class="media-card movie-card" data-type="movie" data-path="${movie.path}/${movie.name}">
        <div class="media-thumbnail">
          <div class="media-icon">🎬</div>
          ${progress ? `<div class="progress-bar"><div class="progress-fill" style="width: ${progress}%"></div></div>` : ''}
        </div>
        <div class="media-info">
          <h3 class="media-title">${movie.title}</h3>
          ${movie.year ? `<p class="media-year">${movie.year}</p>` : ''}
          ${progress ? `<p class="media-progress">Переглянуто: ${progress}%</p>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Рендеринг картки серіалу
   */
  renderSeriesCard(series) {
    const progress = series.progress ? this.calculateProgress(series.progress) : null;
    
    return `
      <div class="media-card series-card" data-type="series" data-path="${series.path}/${series.originalName}">
        <div class="media-thumbnail">
          <div class="media-icon">📺</div>
          ${progress ? `<div class="progress-bar"><div class="progress-fill" style="width: ${progress}%"></div></div>` : ''}
        </div>
        <div class="media-info">
          <h3 class="media-title">${series.title}</h3>
          <p class="media-episodes">${series.totalEpisodes} епізодів</p>
          <p class="media-seasons">${series.seasons.length} сезонів</p>
          ${progress ? `<p class="media-progress">Переглянуто: ${progress}%</p>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Рендеринг останнього переглянутого
   */
  renderLastWatched(lastWatched) {
    // Перевіряємо чи є всі необхідні дані
    if (!lastWatched || !lastWatched.mediaPath || !lastWatched.position || !lastWatched.duration) {
      console.warn('[UIManager] Неповні дані для останнього переглянутого:', lastWatched);
      return '';
    }
    
    return `
      <div class="last-watched-section">
        <h2 class="section-title">🕒 Останнє переглянуте</h2>
        <div class="last-watched-card" data-path="${lastWatched.mediaPath}">
          <div class="last-watched-thumbnail">
            <div class="media-icon">${lastWatched.type === 'movie' ? '🎬' : '📺'}</div>
            <div class="last-watched-badge">Останнє</div>
          </div>
          <div class="last-watched-info">
            <h3 class="last-watched-title">${this.getMediaTitle(lastWatched)}</h3>
            <p class="last-watched-progress">
              ${this.formatTime(lastWatched.position)} / ${this.formatTime(lastWatched.duration)}
            </p>
            <p class="last-watched-date">${this.formatDate(lastWatched.timestamp)}</p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Рендеринг сторінки серіалу
   */
  renderSeriesPage(series) {
    this.clear();
    this.currentView = 'series-page';
    
    this.container.innerHTML = `
      <div class="series-page">
        <div class="series-header">
          <button class="back-btn" data-action="back">← Назад</button>
          <h1 class="series-title">${series.title}</h1>
          <p class="series-info">${series.seasons.length} сезонів • ${series.totalEpisodes} епізодів</p>
        </div>
        
        <div class="seasons-container">
          ${series.seasons.map(season => this.renderSeason(season)).join('')}
        </div>
      </div>
    `;

    // Додаємо обробники подій
    this.addSeriesEventListeners();
  }

  /**
   * Рендеринг сезону
   */
  renderSeason(season) {
    return `
      <div class="season-section">
        <h2 class="season-title">${season.name}</h2>
        <div class="episodes-grid">
          ${season.episodes.map(episode => this.renderEpisode(episode)).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Рендеринг епізоду
   */
  renderEpisode(episode) {
    const progress = episode.progress ? this.calculateProgress(episode.progress) : null;
    
    return `
      <div class="episode-card" data-type="episode" data-path="${episode.path}/${episode.name}">
        <div class="episode-thumbnail">
          <div class="episode-number">${episode.episodeLabel}</div>
          ${progress ? `<div class="progress-bar"><div class="progress-fill" style="width: ${progress}%"></div></div>` : ''}
        </div>
        <div class="episode-info">
          <h3 class="episode-title">${episode.title || episode.episodeLabel}</h3>
          ${progress ? `<p class="episode-progress">Переглянуто: ${progress}%</p>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Рендеринг плеєра відео
   */
  renderVideoPlayer(videoInfo) {
    this.clear();
    this.currentView = 'video-player';
    
    this.container.innerHTML = `
      <div class="video-player-container">
        <div class="video-header">
          <button class="back-btn" data-action="back">← Назад</button>
          <h1 class="video-title">${videoInfo.title}</h1>
        </div>
        
        <div class="video-player">
          <video id="video-element" controls>
            <source src="" type="video/mp4">
            Ваш браузер не підтримує відео.
          </video>
        </div>
        
        <div class="video-controls">
          <div class="video-info">
            <p class="video-path">${videoInfo.path}</p>
            <p class="video-progress">Прогрес: ${this.formatTime(videoInfo.currentTime || 0)}</p>
          </div>
        </div>
      </div>
    `;

    // Додаємо обробники подій
    this.addVideoEventListeners();
  }

  /**
   * Додавання обробників подій для профілів
   */
  addProfileEventListeners() {
    // Клік по профілю
    this.container.querySelectorAll('.profile-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('profile-delete-btn')) return;
        
        const profileName = item.dataset.profile;
        if (this.onProfileSelect) {
          this.onProfileSelect(profileName);
        }
      });
    });

    // Видалення профілю
    this.container.querySelectorAll('.profile-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const profileName = btn.dataset.profile;
        if (confirm(`Видалити профіль "${profileName}"?`)) {
          // TODO: Додати callback для видалення
        }
      });
    });

    // Створення нового профілю
    const createBtn = this.container.querySelector('#create-profile-btn');
    const nameInput = this.container.querySelector('#new-profile-name');
    
    if (createBtn && nameInput) {
      createBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (name) {
          if (this.onProfileSelect) {
            this.onProfileSelect(name, true); // true = створити новий
          }
        }
      });
    }
  }

  /**
   * Додавання обробників подій для медіа
   */
  addMediaEventListeners() {
    // Клік по картці медіа
    this.container.querySelectorAll('.media-card').forEach(card => {
      card.addEventListener('click', () => {
        const type = card.dataset.type;
        const path = card.dataset.path;
        
        if (this.onItemClick) {
          this.onItemClick(type, path);
        }
      });
    });

    // Клік по останньому переглянутому
    const lastWatchedCard = this.container.querySelector('.last-watched-card');
    if (lastWatchedCard) {
      lastWatchedCard.addEventListener('click', () => {
        const path = lastWatchedCard.dataset.path;
        if (this.onItemClick) {
          this.onItemClick('resume', path);
        }
      });
    }
  }

  /**
   * Додавання обробників подій для серіалу
   */
  addSeriesEventListeners() {
    // Кнопка "Назад"
    const backBtn = this.container.querySelector('.back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (this.onItemClick) {
          this.onItemClick('back');
        }
      });
    }

    // Клік по епізоду
    this.container.querySelectorAll('.episode-card').forEach(card => {
      card.addEventListener('click', () => {
        const type = card.dataset.type;
        const path = card.dataset.path;
        
        if (this.onItemClick) {
          this.onItemClick(type, path);
        }
      });
    });
  }

  /**
   * Додавання обробників подій для відео
   */
  addVideoEventListeners() {
    // Кнопка "Назад"
    const backBtn = this.container.querySelector('.back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (this.onItemClick) {
          this.onItemClick('back');
        }
      });
    }
  }

  /**
   * Розрахунок прогресу перегляду
   */
  calculateProgress(progress) {
    if (!progress || !progress.duration) return 0;
    return Math.round((progress.position / progress.duration) * 100);
  }

  /**
   * Форматування часу
   */
  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Форматування дати
   */
  formatDate(dateString) {
    if (!dateString) {
      return 'Невідома дата';
    }
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Невідома дата';
      }
      
      return date.toLocaleDateString('uk-UA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.warn('[UIManager] Помилка форматування дати:', error);
      return 'Невідома дата';
    }
  }

  /**
   * Отримання назви медіа для відображення
   */
  getMediaTitle(watchInfo) {
    // Перевіряємо чи є mediaPath
    if (!watchInfo || !watchInfo.mediaPath) {
      return 'Невідомий контент';
    }
    
    // Отримуємо назву з шляху
    const pathParts = watchInfo.mediaPath.split('/');
    const fileName = pathParts[pathParts.length - 1];
    
    // Якщо є назва файлу, видаляємо розширення
    if (fileName) {
      const lastDotIndex = fileName.lastIndexOf('.');
      if (lastDotIndex > 0) {
        return fileName.substring(0, lastDotIndex);
      }
      return fileName;
    }
    
    return 'Невідомий контент';
  }

  /**
   * Оновлення прогресу в картці
   */
  updateProgress(path, progress) {
    const card = this.container.querySelector(`[data-path="${path}"]`);
    if (card) {
      const progressBar = card.querySelector('.progress-fill');
      const progressText = card.querySelector('.media-progress, .episode-progress');
      
      if (progressBar) {
        const percentage = this.calculateProgress(progress);
        progressBar.style.width = `${percentage}%`;
      }
      
      if (progressText) {
        const percentage = this.calculateProgress(progress);
        progressText.textContent = `Переглянуто: ${percentage}%`;
      }
    }
  }
}

// Експорт для використання як модуль
export { UIManager }; 