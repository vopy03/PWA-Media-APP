/**
 * MediaApp - головний клас додатку
 * Об'єднує всі компоненти та керує загальною логікою
 */
class MediaApp {
  constructor() {
    this.fileSystemManager = new FileSystemManager();
    this.profileManager = new ProfileManager();
    this.mediaAnalyzer = new MediaAnalyzer();
    this.uiManager = new UIManager(document.getElementById('app-container'));
    this.cacheManager = new CacheManager();
    
    this.mediaData = { movies: [], series: [] };
    this.currentState = 'initializing';
    
    // Встановлюємо обробники подій
    this.uiManager.setItemClickHandler((action, data) => this.handleItemClick(action, data));
    this.uiManager.setProfileSelectHandler((profileName, createNew = false) => {
      if (createNew) {
        this.createProfile(profileName);
      } else {
        this.selectProfile(profileName);
      }
    });
  }

  /**
   * Ініціалізація додатку
   */
  async initialize() {
    console.log('[MediaApp] Ініціалізація додатку...');
    
    try {
      this.currentState = 'initializing';
      this.uiManager.showLoading('Ініціалізація...');
      
      // Ініціалізуємо CacheManager
      await this.cacheManager.initialize();
      
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
      
      // Перевіряємо дозволи після ініціалізації
      if (fsInitialized && this.fileSystemManager.rootHandle) {
        const permission = await this.fileSystemManager.rootHandle.queryPermission({ mode: 'read' });
        console.log('[MediaApp] Поточний дозвіл після ініціалізації:', permission);
        
        if (permission === 'prompt' && this.isMobileDevice()) {
          // На мобільних пристроях показуємо повідомлення з кнопкою відновлення
          this.handlePermissionChange(permission);
          return; // Зупиняємо ініціалізацію
        }
      }
      
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
          <h3>📱 Увага для мобільних пристроїв</h3>
          <p>На мобільних пристроях дозволи можуть скидатися після закриття браузера. Для кращої роботи:</p>
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
      if (this.cacheManager.isCacheValid()) {
        console.log('[MediaApp] Використовуємо кешовані дані');
        this.mediaData = this.cacheManager.getCachedData();
        this.showMediaCatalog(); // Показуємо каталог з кешем
        
        // Завжди запускаємо фонове оновлення для відновлення FileSystemHandle
        this.updateMediaDataInBackground();
        return;
      }
      
      if (this.cacheManager.getCachedData() && !this.cacheManager.isUpdating()) {
        console.log('[MediaApp] Показуємо застарілий кеш, оновлюємо на фоні');
        this.mediaData = this.cacheManager.getCachedData();
        this.showMediaCatalog(); // Показуємо каталог з кешем
        this.updateMediaDataInBackground();
        return;
      }
      
      this.uiManager.showLoading('Завантаження медіа...');
      await this.loadMediaDataFromSource();
    } catch (error) {
      console.error('[MediaApp] Помилка завантаження медіа:', error);
      throw error;
    }
  }



  /**
   * Завантаження медіа даних з джерела
   */
  async loadMediaDataFromSource() {
    console.log('[MediaApp] Завантаження медіа даних з джерела...');
    try {
      const data = await this.mediaAnalyzer.analyzeDirectoryStructure(this.fileSystemManager.rootHandle);
      
      // Завантажуємо прогрес для кожного елемента
      data.movies = await this.loadMoviesWithProgress(data.movies);
      data.series = await this.loadSeriesWithProgress(data.series);
      
      // Завантажуємо останнє переглянуте
      data.lastWatched = await this.profileManager.getLastWatched();
      
      this.mediaData = data;
      
      // Зберігаємо в кеш
      this.cacheManager.setCachedData(data);
      
      console.log(`[MediaApp] Завантажено: ${data.movies.length} фільмів, ${data.series.length} серіалів`);
    } catch (error) {
      console.error('[MediaApp] Помилка завантаження з джерела:', error);
      throw error;
    }
  }

  /**
   * Оновлення медіа даних на фоні
   */
  async updateMediaDataInBackground() {
    console.log('[MediaApp] Оновлення медіа даних на фоні...');
    this.cacheManager.setUpdatingStatus(true);
    
    try {
      const data = await this.mediaAnalyzer.analyzeDirectoryStructure(this.fileSystemManager.rootHandle);
      
      // Завантажуємо прогрес для кожного елемента
      data.movies = await this.loadMoviesWithProgress(data.movies);
      data.series = await this.loadSeriesWithProgress(data.series);
      
      // Завантажуємо останнє переглянуте
      data.lastWatched = await this.profileManager.getLastWatched();
      
      // Порівнюємо з поточними даними
      const hasChanges = this.hasDataChanges(data);
      
      if (hasChanges) {
        console.log('[MediaApp] Виявлено зміни в даних, оновлюємо каталог');
        this.mediaData = data;
        this.cacheManager.setCachedData(data); // Оновлюємо timestamp
        
        // Оновлюємо UI
        this.showMediaCatalog();
      } else {
        console.log('[MediaApp] Змін не виявлено, оновлюємо тільки дані без зміни timestamp');
        this.cacheManager.updateDataWithoutTimestamp(data); // Не оновлюємо timestamp
      }
      
      console.log('[MediaApp] Фонове оновлення завершено');
    } catch (error) {
      console.error('[MediaApp] Помилка фонового оновлення:', error);
    } finally {
      this.cacheManager.setUpdatingStatus(false);
      // Оновлюємо UI щоб прибрати індикатор оновлення
      this.showMediaCatalog();
    }
  }

  /**
   * Перевірка чи є зміни в даних
   */
  hasDataChanges(newData) {
    if (!this.mediaData) return true;
    
    // Порівнюємо кількість фільмів
    if (this.mediaData.movies.length !== newData.movies.length) {
      console.log('[MediaApp] Зміна кількості фільмів:', this.mediaData.movies.length, '→', newData.movies.length);
      return true;
    }
    
    // Порівнюємо кількість серіалів
    if (this.mediaData.series.length !== newData.series.length) {
      console.log('[MediaApp] Зміна кількості серіалів:', this.mediaData.series.length, '→', newData.series.length);
      return true;
    }
    
    // Порівнюємо назви фільмів
    const oldMovieNames = this.mediaData.movies.map(m => m.name).sort();
    const newMovieNames = newData.movies.map(m => m.name).sort();
    if (JSON.stringify(oldMovieNames) !== JSON.stringify(newMovieNames)) {
      console.log('[MediaApp] Зміна в фільмах');
      return true;
    }
    
    // Порівнюємо назви серіалів
    const oldSeriesNames = this.mediaData.series.map(s => s.title).sort();
    const newSeriesNames = newData.series.map(s => s.title).sort();
    if (JSON.stringify(oldSeriesNames) !== JSON.stringify(newSeriesNames)) {
      console.log('[MediaApp] Зміна в серіалах');
      return true;
    }
    
    return false;
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
    console.log('[MediaApp] lastWatched:', this.mediaData.lastWatched);
    this.currentState = 'ready';
    this.uiManager.renderMediaCatalog(
      this.mediaData.movies || [], 
      this.mediaData.series || [], 
      this.mediaData.lastWatched,
      this.cacheManager.isUpdating()
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
      case 'refresh-cache':
        this.refreshCache();
        break;
      case 'show-series':
        this.showSeries(data.path);
        break;
      case 'series':
        this.showSeries(data);
        break;
      case 'play-video':
        this.playVideo(data);
        break;
      case 'movie':
        this.playMovie(data);
        break;
      case 'episode':
        this.playEpisode(data);
        break;
      case 'resume':
        this.resumeLastWatched(data);
        break;
      case 'back':
        this.goBack();
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
   * Оновлення кешу
   */
  async refreshCache() {
    console.log('[MediaApp] Оновлення кешу...');
    this.cacheManager.clearCache();
    this.uiManager.showLoading('Оновлення каталогу...');
    
    try {
      await this.loadMediaDataFromSource();
      this.showMediaCatalog();
      console.log('[MediaApp] Кеш оновлено');
    } catch (error) {
      console.error('[MediaApp] Помилка оновлення кешу:', error);
      this.uiManager.showError('Помилка оновлення', error.message);
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
   * Відтворення відео (загальний метод)
   */
  async playVideo(data) {
    console.log('[MediaApp] Відтворення відео:', data);
    
    if (!data || !data.type || !data.path) {
      console.error('[MediaApp] Неправильні дані для відтворення:', data);
      return;
    }
    
    try {
      switch (data.type) {
        case 'movie':
          await this.playMovie(data.path);
          break;
        case 'series':
          await this.showSeries(data.path);
          break;
        case 'episode':
          await this.playEpisode(data.path);
          break;
        default:
          console.warn('[MediaApp] Невідомий тип відео:', data.type);
      }
    } catch (error) {
      console.error('[MediaApp] Помилка відтворення відео:', error);
      this.uiManager.showError('Помилка відтворення', error.message);
    }
  }

  /**
   * Відтворення фільму
   */
  async playMovie(path) {
    console.log(`[MediaApp] Відтворення фільму: ${path}`);
    console.log('[MediaApp] Доступні фільми:', this.mediaData.movies.map(m => ({
      title: m.title,
      path: m.path,
      name: m.name,
      fullPath: `${m.path}/${m.name}`
    })));
    
    // Знаходимо фільм
    const movie = this.mediaData.movies.find(m => `${m.path}/${m.name}` === path);
    if (!movie) {
      console.error('[MediaApp] Фільм не знайдено. Шукаємо:', path);
      console.error('[MediaApp] Доступні шляхи:', this.mediaData.movies.map(m => `${m.path}/${m.name}`));
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
    console.log('[MediaApp] Доступні серіали:', this.mediaData.series.map(s => ({
      title: s.title,
      path: s.path,
      originalName: s.originalName,
      fullPath: `${s.path}/${s.originalName}`
    })));
    
    // Знаходимо серіал
    const series = this.mediaData.series.find(s => `${s.path}/${s.originalName}` === path);
    if (!series) {
      console.error('[MediaApp] Серіал не знайдено. Шукаємо:', path);
      console.error('[MediaApp] Доступні шляхи:', this.mediaData.series.map(s => `${s.path}/${s.originalName}`));
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
    console.log('[MediaApp] Доступні серіали для пошуку епізоду:', this.mediaData.series.map(s => ({
      title: s.title,
      seasons: s.seasons.map(season => ({
        name: season.name,
        episodes: season.episodes.map(ep => ({
          name: ep.name,
          path: ep.path,
          fullPath: `${ep.path}/${ep.name}`
        }))
      }))
    })));
    
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
      console.error('[MediaApp] Епізод не знайдено. Шукаємо:', path);
      console.error('[MediaApp] Доступні епізоди:', this.mediaData.series.flatMap(s => 
        s.seasons.flatMap(season => 
          season.episodes.map(ep => `${ep.path}/${ep.name}`)
        )
      ));
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
    console.log('[MediaApp] Поточний view:', this.uiManager.currentView);
    
    if (this.uiManager.currentView === 'video-player' || 
        this.uiManager.currentView === 'series-page') {
      this.showMediaCatalog();
    } else if (this.uiManager.currentView === 'catalog') {
      this.showProfileSelector();
    } else {
      // За замовчуванням повертаємося до каталогу
      this.showMediaCatalog();
    }
  }

  /**
   * Налаштування відео плеєра
   */
  async setupVideoPlayer(fileHandle) {
    try {
      const file = await this.fileSystemManager.getFile(fileHandle);
      const videoElement = this.uiManager.container.querySelector('#video-element');
      
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
    
    // Перевіряємо валідність даних
    if (!currentTime || isNaN(currentTime) || !duration || isNaN(duration) || duration <= 0) {
      console.log('[MediaApp] Пропускаємо збереження - неповні або невалідні дані:', { currentTime, duration });
      return;
    }
    
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