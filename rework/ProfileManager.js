/**
 * ProfileManager - клас для управління профілями користувачів
 * Зберігає історію перегляду та налаштування для кожного профілю
 */
class ProfileManager {
  constructor() {
    this.currentProfile = null;
    this.dbName = 'MediaProfiles';
    this.dbVersion = 1;
  }

  /**
   * Ініціалізація бази даних
   */
  async initialize() {
    console.log('[ProfileManager] Ініціалізація бази даних...');
    try {
      this.db = await idb.openDB(this.dbName, this.dbVersion, {
        upgrade(db) {
          // Store для профілів
          if (!db.objectStoreNames.contains('profiles')) {
            db.createObjectStore('profiles', { keyPath: 'name' });
          }
          
          // Store для історії перегляду
          if (!db.objectStoreNames.contains('watchHistory')) {
            const historyStore = db.createObjectStore('watchHistory', { keyPath: 'id', autoIncrement: true });
            historyStore.createIndex('profile', 'profile', { unique: false });
            historyStore.createIndex('mediaPath', 'mediaPath', { unique: false });
            historyStore.createIndex('timestamp', 'timestamp', { unique: false });
          }
          
          // Store для налаштувань
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
          }
        }
      });
      
      console.log('[ProfileManager] База даних ініціалізована');
      
      // Завантажуємо останній використаний профіль
      await this.loadLastProfile();
      
      return true;
    } catch (error) {
      console.error('[ProfileManager] Помилка ініціалізації:', error);
      return false;
    }
  }

  /**
   * Створення нового профілю
   */
  async createProfile(name) {
    console.log(`[ProfileManager] Створення профілю: ${name}`);
    
    if (!name || name.trim() === '') {
      throw new Error('Назва профілю не може бути порожньою');
    }

    const profileName = name.trim();
    
    // Перевіряємо чи профіль вже існує
    const existingProfile = await this.getProfile(profileName);
    if (existingProfile) {
      throw new Error(`Профіль "${profileName}" вже існує`);
    }

    const profile = {
      name: profileName,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      settings: {
        autoResume: true,
        defaultVolume: 0.8,
        playbackSpeed: 1.0
      }
    };

    try {
      await this.db.put('profiles', profile);
      console.log(`[ProfileManager] Профіль "${profileName}" створено`);
      
      // Встановлюємо як поточний
      await this.setCurrentProfile(profileName);
      
      return profile;
    } catch (error) {
      console.error('[ProfileManager] Помилка створення профілю:', error);
      throw error;
    }
  }

  /**
   * Отримання профілю за назвою
   */
  async getProfile(name) {
    try {
      return await this.db.get('profiles', name);
    } catch (error) {
      console.error(`[ProfileManager] Помилка отримання профілю "${name}":`, error);
      return null;
    }
  }

  /**
   * Отримання всіх профілів
   */
  async getAllProfiles() {
    try {
      const profiles = await this.db.getAll('profiles');
      return profiles.sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
    } catch (error) {
      console.error('[ProfileManager] Помилка отримання профілів:', error);
      return [];
    }
  }

  /**
   * Встановлення поточного профілю
   */
  async setCurrentProfile(name) {
    console.log(`[ProfileManager] Встановлення поточного профілю: ${name}`);
    
    const profile = await this.getProfile(name);
    if (!profile) {
      throw new Error(`Профіль "${name}" не знайдено`);
    }

    this.currentProfile = profile;
    
    // Оновлюємо lastUsed
    profile.lastUsed = new Date().toISOString();
    await this.db.put('profiles', profile);
    
    // Зберігаємо в localStorage для швидкого доступу
    localStorage.setItem('lastProfile', name);
    
    console.log(`[ProfileManager] Поточний профіль встановлено: ${name}`);
    return profile;
  }

  /**
   * Отримання поточного профілю
   */
  getCurrentProfile() {
    return this.currentProfile;
  }

  /**
   * Завантаження останнього використаного профілю
   */
  async loadLastProfile() {
    const lastProfileName = localStorage.getItem('lastProfile');
    if (lastProfileName) {
      try {
        await this.setCurrentProfile(lastProfileName);
        return true;
      } catch (error) {
        console.warn('[ProfileManager] Не вдалося завантажити останній профіль:', error);
        localStorage.removeItem('lastProfile');
        return false;
      }
    }
    return false;
  }

  /**
   * Додавання запису в історію перегляду
   */
  async addToHistory(mediaPath, position = 0, duration = 0, type = 'unknown') {
    if (!this.currentProfile) {
      console.warn('[ProfileManager] Немає активного профілю для збереження історії');
      return;
    }

    // Перевіряємо валідність даних
    if (!mediaPath || !position || isNaN(position) || !duration || isNaN(duration) || duration <= 0) {
      console.log('[ProfileManager] Пропускаємо збереження - неповні або невалідні дані:', { mediaPath, position, duration });
      return;
    }

    console.log(`[ProfileManager] Додавання в історію: ${mediaPath} (${position}s/${duration}s)`);
    
    const historyEntry = {
      profile: this.currentProfile.name,
      mediaPath: mediaPath,
      position: position,
      duration: duration,
      type: type, // 'movie', 'series', 'episode'
      timestamp: new Date().toISOString(),
      completed: position >= duration * 0.9 // Вважаємо завершеним якщо переглянуто 90%
    };

    try {
      await this.db.add('watchHistory', historyEntry);
      console.log('[ProfileManager] Запис додано в історію');
    } catch (error) {
      console.error('[ProfileManager] Помилка додавання в історію:', error);
    }
  }

  /**
   * Отримання історії перегляду для поточного профілю
   */
  async getWatchHistory(limit = 50) {
    if (!this.currentProfile) {
      return [];
    }

    try {
      const transaction = this.db.transaction('watchHistory', 'readonly');
      const store = transaction.objectStore('watchHistory');
      const index = store.index('profile');
      
      const history = await index.getAll(this.currentProfile.name);
      
      // Сортуємо за часом (новіші спочатку) та обмежуємо кількість
      return history
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
    } catch (error) {
      console.error('[ProfileManager] Помилка отримання історії:', error);
      return [];
    }
  }

  /**
   * Отримання останнього переглянутого контенту
   */
  async getLastWatched() {
    const history = await this.getWatchHistory(1);
    return history.length > 0 ? history[0] : null;
  }

  /**
   * Отримання прогресу перегляду для конкретного файлу
   */
  async getWatchProgress(mediaPath) {
    if (!this.currentProfile) {
      return null;
    }

    try {
      const transaction = this.db.transaction('watchHistory', 'readonly');
      const store = transaction.objectStore('watchHistory');
      const index = store.index('mediaPath');
      
      const entries = await index.getAll(mediaPath);
      
      // Фільтруємо по поточному профілю та беремо останній запис
      const profileEntries = entries.filter(entry => entry.profile === this.currentProfile.name);
      
      return profileEntries.length > 0 ? profileEntries[profileEntries.length - 1] : null;
    } catch (error) {
      console.error('[ProfileManager] Помилка отримання прогресу:', error);
      return null;
    }
  }

  /**
   * Очищення історії перегляду для поточного профілю
   */
  async clearHistory() {
    if (!this.currentProfile) {
      return;
    }

    console.log(`[ProfileManager] Очищення історії для профілю: ${this.currentProfile.name}`);
    
    try {
      const transaction = this.db.transaction('watchHistory', 'readwrite');
      const store = transaction.objectStore('watchHistory');
      const index = store.index('profile');
      
      const keys = await index.getAllKeys(this.currentProfile.name);
      
      for (const key of keys) {
        await store.delete(key);
      }
      
      console.log(`[ProfileManager] Історію очищено (${keys.length} записів)`);
    } catch (error) {
      console.error('[ProfileManager] Помилка очищення історії:', error);
      throw error;
    }
  }

  /**
   * Очищення історії для конкретного серіалу
   */
  async clearSeriesHistory(seriesPath) {
    if (!this.currentProfile) {
      return;
    }

    console.log(`[ProfileManager] Очищення історії серіалу: ${seriesPath}`);
    
    try {
      const transaction = this.db.transaction('watchHistory', 'readwrite');
      const store = transaction.objectStore('watchHistory');
      const index = store.index('mediaPath');
      
      const entries = await index.getAll(seriesPath);
      const profileEntries = entries.filter(entry => entry.profile === this.currentProfile.name);
      
      for (const entry of profileEntries) {
        await store.delete(entry.id);
      }
      
      console.log(`[ProfileManager] Історію серіалу очищено (${profileEntries.length} записів)`);
    } catch (error) {
      console.error('[ProfileManager] Помилка очищення історії серіалу:', error);
      throw error;
    }
  }

  /**
   * Видалення профілю
   */
  async deleteProfile(name) {
    console.log(`[ProfileManager] Видалення профілю: ${name}`);
    
    try {
      // Видаляємо профіль
      await this.db.delete('profiles', name);
      
      // Видаляємо всю історію профілю
      const transaction = this.db.transaction('watchHistory', 'readwrite');
      const store = transaction.objectStore('watchHistory');
      const index = store.index('profile');
      
      const keys = await index.getAllKeys(name);
      for (const key of keys) {
        await store.delete(key);
      }
      
      // Якщо це був поточний профіль, очищаємо його
      if (this.currentProfile && this.currentProfile.name === name) {
        this.currentProfile = null;
        localStorage.removeItem('lastProfile');
      }
      
      console.log(`[ProfileManager] Профіль "${name}" видалено`);
    } catch (error) {
      console.error('[ProfileManager] Помилка видалення профілю:', error);
      throw error;
    }
  }

  /**
   * Оновлення налаштувань профілю
   */
  async updateProfileSettings(name, settings) {
    const profile = await this.getProfile(name);
    if (!profile) {
      throw new Error(`Профіль "${name}" не знайдено`);
    }

    profile.settings = { ...profile.settings, ...settings };
    await this.db.put('profiles', profile);
    
    // Оновлюємо поточний профіль якщо потрібно
    if (this.currentProfile && this.currentProfile.name === name) {
      this.currentProfile = profile;
    }
    
    console.log(`[ProfileManager] Налаштування профілю "${name}" оновлено`);
  }

  /**
   * Отримання статистики профілю
   */
  async getProfileStats(name) {
    const profile = await this.getProfile(name);
    if (!profile) {
      return null;
    }

    try {
      const transaction = this.db.transaction('watchHistory', 'readonly');
      const store = transaction.objectStore('watchHistory');
      const index = store.index('profile');
      
      const history = await index.getAll(name);
      
      const stats = {
        totalWatched: history.length,
        totalTime: history.reduce((sum, entry) => sum + entry.position, 0),
        completed: history.filter(entry => entry.completed).length,
        lastWatched: history.length > 0 ? history[history.length - 1].timestamp : null,
        movies: history.filter(entry => entry.type === 'movie').length,
        series: history.filter(entry => entry.type === 'series' || entry.type === 'episode').length
      };
      
      return stats;
    } catch (error) {
      console.error('[ProfileManager] Помилка отримання статистики:', error);
      return null;
    }
  }
}

// Експорт для використання як модуль
export { ProfileManager }; 