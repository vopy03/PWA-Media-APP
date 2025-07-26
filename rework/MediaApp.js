/**
 * MediaApp - головний клас додатку
 * Об'єднує всі компоненти та керує загальною логікою
 */
class MediaApp {
  constructor(container) {
    this.container = container;
    this.currentState = 'initializing';
    
    // Ініціалізація менеджерів
    this.fileSystemManager = new FileSystemManager();
    this.profileManager = new ProfileManager();
    this.mediaAnalyzer = new MediaAnalyzer();
    this.uiManager = new UIManager(container);
    
    // Налаштування callback'ів
    this.setupCallbacks();
    
    // Стан додатку
    this.currentProfile = null;
    this.mediaData = {
      movies: [],
      series: [],
      lastWatched: null
    };
  }

  /**
   * Ініціалізація додатку
   */
  async initialize() {
    console.log('[MediaApp] Ініціалізація додатку...');
    
    try {
      this.currentState = 'initializing';
      this.uiManager.showLoading('Ініціалізація...');
      
      // Ініціалізація профілів
      const profileInitialized = await this.profileManager.initialize();
      if (!profileInitialized) {
        throw new Error('Не вдалося ініціалізувати систему профілів');
      }
      
      // Ініціалізація файлової системи
      const fsInitialized = await this.fileSystemManager.initialize();
      
      // Налаштування перевірки дозволів
      this.fileSystemManager.onPermissionChange = (permission) => {
        this.handlePermissionChange(permission);
      };
      
      // Визначення наступного кроку
      if (!fsInitialized) {
        this.currentState = 'no-directory';
        this.showDirectorySelector();
      } else if (!this.profileManager.getCurrentProfile()) {
        this.currentState = 'no-profile';
        this.showProfileSelector();
      } else {
        this.currentState = 'ready';
        await this.loadCurrentProfile();
        await this.loadMediaData();
        this.showMediaCatalog();
      }
      
      console.log('[MediaApp] Ініціалізація завершена');
      
    } catch (error) {
      console.error('[MediaApp] Помилка ініціалізації:', error);
      this.uiManager.showError('Помилка ініціалізації', error.message);
    }
  }

  /**
   * Налаштування callback'ів
   */
  setupCallbacks() {
    // UI callbacks
    this.uiManager.setItemClickHandler((type, path) => {
      this.handleItemClick(type, path);
    });
    
    this.uiManager.setProfileSelectHandler((profileName, createNew = false) => {
      this.handleProfileSelect(profileName, createNew);
    });
  }

  /**
   * Обробка зміни дозволів
   */
  handlePermissionChange(permission) {
    console.log('[MediaApp] Зміна дозволів:', permission);
    
    if (permission === 'denied') {
      this.currentState = 'no-permission';
      this.uiManager.showError(
        'Доступ до папки відхилено',
        'Будь ласка, виберіть папку знову та надайте дозвіл на доступ.'
      );
    } else if (permission === 'prompt') {
      // На мобільних пристроях показуємо спеціальне повідомлення з кнопкою відновлення
      if (this.isMobileDevice()) {
        this.uiManager.showError(
          'Потрібно підтвердити доступ',
          'На мобільних пристроях дозволи можуть скидатися після закриття браузера. Натисніть "Відновити доступ" щоб підтвердити дозвіл до збереженої папки.',
          'retry-mobile-permission'
        );
      } else {
        console.log('[MediaApp] Потрібно підтвердити доступ до папки');
      }
    }
  }

  /**
   * Перевірка чи це мобільний пристрій
   */
  isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /**
   * Показ селектора папки з попередженням для мобільних
   */
  async showDirectorySelector() {
    console.log('[MediaApp] Показ селектора папки');
    
    let warningMessage = '';
    if (this.isMobileDevice()) {
      warningMessage = `
        <div class="mobile-warning">
          <h3>📱 Оптимізація для мобільних пристроїв</h3>
          <p>Для кращої роботи на мобільних пристроях:</p>
          <ul>
            <li>Додайте сайт на головний екран для швидкого доступу</li>
            <li>Якщо доступ зникне - натисніть "Відновити доступ"</li>
            <li>Програма запам'ятає ваш вибір для наступних запусків</li>
          </ul>
        </div>
      `;
    }
    
    this.container.innerHTML = `
      <div class="directory-selector">
        <h2 class="selector-title">Виберіть папку з медіа</h2>
        <p class="selector-description">
          Виберіть папку, яка містить ваші фільми та серіали.
          Програма запам'ятає ваш вибір для наступних запусків.
        </p>
        ${warningMessage}
        <button id="choose-directory-btn" class="choose-directory-btn">
          Вибрати папку
        </button>
      </div>
    `;
    
    // Додаємо обробник події
    const chooseBtn = this.container.querySelector('#choose-directory-btn');
    chooseBtn.addEventListener('click', async () => {
      await this.chooseDirectory();
    });
  }

  /**
   * Вибір папки
   */
  async chooseDirectory() {
    try {
      this.uiManager.showLoading('Вибір папки...');
      
      const handle = await this.fileSystemManager.chooseRootDirectory();
      
      // Після вибору папки показуємо селектор профілів
      this.currentState = 'no-profile';
      this.showProfileSelector();
      
    } catch (error) {
      console.error('[MediaApp] Помилка вибору папки:', error);
      
      if (error.name === 'AbortError') {
        this.showDirectorySelector(); // Повертаємося до селектора
      } else {
        this.uiManager.showError('Помилка вибору папки', error.message);
      }
    }
  }

  /**
   * Показ селектора профілів
   */
  async showProfileSelector() {
    console.log('[MediaApp] Показ селектора профілів');
    
    try {
      const profiles = await this.profileManager.getAllProfiles();
      const currentProfile = this.profileManager.getCurrentProfile();
      
      this.uiManager.renderProfileSelector(profiles, currentProfile);
      
    } catch (error) {
      console.error('[MediaApp] Помилка завантаження профілів:', error);
      this.uiManager.showError('Помилка завантаження профілів', error.message);
    }
  }

  /**
   * Обробка вибору профілю
   */
  async handleProfileSelect(profileName, createNew = false) {
    console.log(`[MediaApp] Вибрано профіль: ${profileName} (новий: ${createNew})`);
    
    try {
      let profile;
      
      if (createNew) {
        profile = await this.profileManager.createProfile(profileName);
      } else {
        await this.profileManager.setCurrentProfile(profileName);
        profile = this.profileManager.getCurrentProfile();
      }
      
      this.currentProfile = profile;
      
      // Завантажуємо медіа дані та показуємо каталог
      this.currentState = 'ready';
      await this.loadMediaData();
      this.showMediaCatalog();
      
    } catch (error) {
      console.error('[MediaApp] Помилка вибору профілю:', error);
      this.uiManager.showError('Помилка вибору профілю', error.message);
    }
  }

  /**
   * Завантаження поточного профілю
   */
  async loadCurrentProfile() {
    this.currentProfile = this.profileManager.getCurrentProfile();
    if (!this.currentProfile) {
      throw new Error('Поточний профіль не знайдено');
    }
    
    console.log(`[MediaApp] Завантажено профіль: ${this.currentProfile.name}`);
  }

  /**
   * Завантаження медіа даних
   */
  async loadMediaData() {
    console.log('[MediaApp] Завантаження медіа даних...');
    
    try {
      this.uiManager.showLoading('Завантаження медіа...');
      
      // Аналізуємо структуру папки
      const analysis = await this.mediaAnalyzer.analyzeDirectoryStructure(
        this.fileSystemManager.rootHandle
      );
      
      // Завантажуємо прогрес для кожного елемента
      this.mediaData.movies = await this.loadMoviesWithProgress(analysis.movies);
      this.mediaData.series = await this.loadSeriesWithProgress(analysis.series);
      this.mediaData.lastWatched = await this.profileManager.getLastWatched();
      
      console.log(`[MediaApp] Завантажено: ${this.mediaData.movies.length} фільмів, ${this.mediaData.series.length} серіалів`);
      
    } catch (error) {
      console.error('[MediaApp] Помилка завантаження медіа:', error);
      throw error;
    }
  }

  /**
   * Завантаження фільмів з прогресом
   */
  async loadMoviesWithProgress(movies) {
    const moviesWithProgress = [];
    
    for (const movie of movies) {
      const progress = await this.profileManager.getWatchProgress(`${movie.path}/${movie.name}`);
      moviesWithProgress.push({
        ...movie,
        progress: progress
      });
    }
    
    return moviesWithProgress;
  }

  /**
   * Завантаження серіалів з прогресом
   */
  async loadSeriesWithProgress(series) {
    const seriesWithProgress = [];
    
    for (const seriesItem of series) {
      // Завантажуємо прогрес для кожного епізоду
      for (const season of seriesItem.seasons) {
        for (const episode of season.episodes) {
          const progress = await this.profileManager.getWatchProgress(`${episode.path}/${episode.name}`);
          episode.progress = progress;
        }
      }
      
      // Розраховуємо загальний прогрес серіалу
      const totalEpisodes = seriesItem.totalEpisodes;
      const watchedEpisodes = seriesItem.seasons.reduce((sum, season) => {
        return sum + season.episodes.filter(ep => ep.progress && ep.progress.completed).length;
      }, 0);
      
      seriesItem.progress = {
        watched: watchedEpisodes,
        total: totalEpisodes,
        percentage: totalEpisodes > 0 ? Math.round((watchedEpisodes / totalEpisodes) * 100) : 0
      };
      
      seriesWithProgress.push(seriesItem);
    }
    
    return seriesWithProgress;
  }

  /**
   * Показ каталогу медіа
   */
  showMediaCatalog() {
    console.log('[MediaApp] Показ каталогу медіа');
    this.uiManager.renderMediaCatalog(
      this.mediaData.movies,
      this.mediaData.series,
      this.mediaData.lastWatched
    );
  }

  /**
   * Обробка кліків по елементам
   */
  handleItemClick(action, data = null) {
    console.log('[MediaApp] Обробка кліку:', action, data);
    
    switch (action) {
      case 'retry-access':
        this.retryAccess();
        break;
      case 'retry-mobile-permission':
        this.retryMobilePermission();
        break;
      case 'choose-new-directory':
        this.showDirectorySelector();
        break;
      case 'play-video':
        this.playVideo(data);
        break;
      case 'select-profile':
        this.selectProfile(data);
        break;
      case 'create-profile':
        this.createProfile(data);
        break;
      case 'clear-history':
        this.clearHistory();
        break;
      case 'back-to-catalog':
        this.showMediaCatalog();
        break;
      default:
        console.warn('[MediaApp] Невідома дія:', action);
    }
  }

  /**
   * Відновлення доступу для мобільних пристроїв
   */
  async retryMobilePermission() {
    console.log('[MediaApp] Спроба відновлення доступу на мобільному...');
    
    try {
      this.uiManager.showLoading('Відновлення доступу...');
      
      // Спробуємо завантажити збережений handle
      const handle = await this.fileSystemManager.loadDirectoryHandle();
      
      if (handle) {
        // Запитуємо дозвіл через взаємодію користувача
        console.log('[MediaApp] Запитуємо дозвіл через взаємодію користувача...');
        const permission = await handle.requestPermission({ mode: 'read' });
        
        if (permission === 'granted') {
          console.log('[MediaApp] Дозвіл надано! Відновлюємо доступ...');
          this.fileSystemManager.rootHandle = handle;
          await this.loadMediaData();
          this.showMediaCatalog();
          return;
        } else {
          console.log('[MediaApp] Дозвіл відхилено:', permission);
        }
      }
      
      // Якщо не вдалося відновити, показуємо селектор
      console.log('[MediaApp] Не вдалося відновити доступ, показуємо селектор...');
      this.showDirectorySelector();
      
    } catch (error) {
      console.error('[MediaApp] Помилка відновлення доступу:', error);
      this.showDirectorySelector();
    }
  }

  /**
   * Спроба відновлення доступу
   */
  async retryAccess() {
    console.log('[MediaApp] Спроба відновлення доступу...');
    
    try {
      this.uiManager.showLoading('Відновлення доступу...');
      
      // Спробуємо завантажити handle знову
      const initialized = await this.fileSystemManager.initialize();
      
      if (initialized) {
        // Якщо вдалося відновити доступ, завантажуємо дані
        await this.loadMediaData();
        this.showMediaCatalog();
      } else {
        // Якщо не вдалося, показуємо селектор папки
        this.showDirectorySelector();
      }
    } catch (error) {
      console.error('[MediaApp] Помилка відновлення доступу:', error);
      this.showDirectorySelector();
    }
  }

  /**
   * Відтворення фільму
   */
  async playMovie(path) {
    console.log(`[MediaApp] Відтворення фільму: ${path}`);
    
    // Знаходимо фільм
    const movie = this.mediaData.movies.find(m => `${m.path}/${m.name}` === path);
    if (!movie) {
      throw new Error('Фільм не знайдено');
    }
    
    // Показуємо плеєр
    this.uiManager.renderVideoPlayer({
      title: movie.title,
      path: path,
      currentTime: movie.progress ? movie.progress.position : 0
    });
    
    // TODO: Реалізувати відтворення відео
    this.setupVideoPlayer(movie.handle);
  }

  /**
   * Показ серіалу
   */
  async showSeries(path) {
    console.log(`[MediaApp] Показ серіалу: ${path}`);
    
    // Знаходимо серіал
    const series = this.mediaData.series.find(s => `${s.path}/${s.originalName}` === path);
    if (!series) {
      throw new Error('Серіал не знайдено');
    }
    
    // Показуємо сторінку серіалу
    this.uiManager.renderSeriesPage(series);
  }

  /**
   * Відтворення епізоду
   */
  async playEpisode(path) {
    console.log(`[MediaApp] Відтворення епізоду: ${path}`);
    
    // Знаходимо епізод в серіалах
    let episode = null;
    for (const series of this.mediaData.series) {
      for (const season of series.seasons) {
        episode = season.episodes.find(ep => `${ep.path}/${ep.name}` === path);
        if (episode) break;
      }
      if (episode) break;
    }
    
    if (!episode) {
      throw new Error('Епізод не знайдено');
    }
    
    // Показуємо плеєр
    this.uiManager.renderVideoPlayer({
      title: `${episode.episodeLabel} - ${episode.title || 'Епізод'}`,
      path: path,
      currentTime: episode.progress ? episode.progress.position : 0
    });
    
    // TODO: Реалізувати відтворення відео
    this.setupVideoPlayer(episode.handle);
  }

  /**
   * Відновлення останнього переглянутого
   */
  async resumeLastWatched(path) {
    console.log(`[MediaApp] Відновлення: ${path}`);
    
    // Знаходимо тип контенту за шляхом
    const movie = this.mediaData.movies.find(m => `${m.path}/${m.name}` === path);
    if (movie) {
      await this.playMovie(path);
      return;
    }
    
    // Шукаємо в серіалах
    for (const series of this.mediaData.series) {
      for (const season of series.seasons) {
        const episode = season.episodes.find(ep => `${ep.path}/${ep.name}` === path);
        if (episode) {
          await this.playEpisode(path);
          return;
        }
      }
    }
    
    throw new Error('Контент не знайдено');
  }

  /**
   * Повернення назад
   */
  goBack() {
    console.log('[MediaApp] Повернення назад');
    
    if (this.uiManager.currentView === 'video-player' || 
        this.uiManager.currentView === 'series-page') {
      this.showMediaCatalog();
    } else if (this.uiManager.currentView === 'media-catalog') {
      this.showProfileSelector();
    }
  }

  /**
   * Налаштування відео плеєра
   */
  async setupVideoPlayer(fileHandle) {
    try {
      const file = await this.fileSystemManager.getFile(fileHandle);
      const videoElement = this.container.querySelector('#video-element');
      
      if (videoElement) {
        const url = URL.createObjectURL(file);
        videoElement.src = url;
        
        // Налаштування подій плеєра з throttling
        let lastSaveTime = 0;
        const saveInterval = 5000; // Зберігаємо кожні 5 секунд
        
        videoElement.addEventListener('timeupdate', () => {
          const now = Date.now();
          if (now - lastSaveTime >= saveInterval) {
            this.savePlaybackProgress(fileHandle, videoElement.currentTime, videoElement.duration);
            lastSaveTime = now;
          }
        });
        
        videoElement.addEventListener('ended', () => {
          this.markAsCompleted(fileHandle);
        });
        
        // Відновлення позиції
        const fullPath = this.getFullPath(fileHandle);
        const progress = await this.profileManager.getWatchProgress(fullPath);
        if (progress && progress.position > 0) {
          videoElement.currentTime = progress.position;
        }
      }
    } catch (error) {
      console.error('[MediaApp] Помилка налаштування плеєра:', error);
    }
  }

  /**
   * Отримання повного шляху до файлу
   */
  getFullPath(fileHandle) {
    // Шукаємо файл в наших даних для отримання повного шляху
    const fileName = fileHandle.name;
    
    // Спочатку шукаємо в фільмах
    const movie = this.mediaData.movies.find(m => m.name === fileName);
    if (movie) {
      return `${movie.path}/${movie.name}`;
    }
    
    // Потім шукаємо в серіалах
    for (const series of this.mediaData.series) {
      for (const season of series.seasons) {
        const episode = season.episodes.find(ep => ep.name === fileName);
        if (episode) {
          return `${episode.path}/${episode.name}`;
        }
      }
    }
    
    // Якщо не знайдено, повертаємо назву файлу як fallback
    console.warn(`[MediaApp] Повний шлях для файлу "${fileName}" не знайдено`);
    return fileName;
  }

  /**
   * Визначення типу відео
   */
  getVideoType(fileHandle) {
    const fileName = fileHandle.name;
    
    // Спочатку шукаємо в фільмах
    const movie = this.mediaData.movies.find(m => m.name === fileName);
    if (movie) {
      return 'movie';
    }
    
    // Потім шукаємо в серіалах
    for (const series of this.mediaData.series) {
      for (const season of series.seasons) {
        const episode = season.episodes.find(ep => ep.name === fileName);
        if (episode) {
          return 'episode';
        }
      }
    }
    
    // Якщо не знайдено, спробуємо визначити за назвою файлу
    if (this.hasEpisodePattern(fileName)) {
      return 'episode';
    }
    
    return 'movie'; // За замовчуванням
  }

  /**
   * Перевірка чи є паттерн епізоду в назві файлу
   */
  hasEpisodePattern(fileName) {
    const episodePatterns = [
      /s\d{1,2}e\d{1,2}/i,
      /season\s*\d+\s*episode\s*\d+/i,
      /сезон\s*\d+\s*серия\s*\d+/i,
      /episode\s*\d+/i,
      /серия\s*\d+/i
    ];
    
    return episodePatterns.some(pattern => pattern.test(fileName));
  }

  /**
   * Збереження прогресу відтворення
   */
  async savePlaybackProgress(fileHandle, currentTime, duration) {
    if (!this.currentProfile) return;
    
    try {
      const fullPath = this.getFullPath(fileHandle);
      const videoType = this.getVideoType(fileHandle);
      
      console.log(`[MediaApp] Зберігаємо прогрес для: ${fullPath} (тип: ${videoType})`);
      
      await this.profileManager.addToHistory(
        fullPath,
        currentTime,
        duration,
        videoType
      );
    } catch (error) {
      console.error('[MediaApp] Помилка збереження прогресу:', error);
    }
  }

  /**
   * Позначення як завершено
   */
  async markAsCompleted(fileHandle) {
    if (!this.currentProfile) return;
    
    try {
      const fullPath = this.getFullPath(fileHandle);
      const progress = await this.profileManager.getWatchProgress(fullPath);
      if (progress) {
        progress.completed = true;
        // TODO: Оновити запис в базі
      }
    } catch (error) {
      console.error('[MediaApp] Помилка позначення як завершено:', error);
    }
  }

  /**
   * Очищення ресурсів
   */
  destroy() {
    console.log('[MediaApp] Очищення ресурсів...');
    
    this.fileSystemManager.destroy();
    this.uiManager.clear();
    
    // Очищення URL об'єктів
    const videoElement = this.container.querySelector('#video-element');
    if (videoElement && videoElement.src) {
      URL.revokeObjectURL(videoElement.src);
    }
  }
}

// Експорт для використання як модуль
export { MediaApp }; 