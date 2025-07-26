/**
 * Менеджер кешування для медіа даних
 */
export class CacheManager {
  constructor() {
    this.cache = {
      data: null,
      timestamp: null,
      cacheDuration: 5 * 60 * 1000, // 5 хвилин
      isUpdating: false
    };
    this.dbName = 'MediaCache';
    this.dbVersion = 1;
  }

  /**
   * Ініціалізація бази даних
   */
  async initialize() {
    try {
      this.db = await idb.openDB(this.dbName, this.dbVersion, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('cache')) {
            db.createObjectStore('cache');
          }
        },
      });
      
      // Завантажуємо кеш з IndexedDB
      await this.loadCacheFromStorage();
      console.log('[CacheManager] База даних ініціалізована');
    } catch (error) {
      console.error('[CacheManager] Помилка ініціалізації:', error);
    }
  }

  /**
   * Перевірка чи кеш валідний
   */
  isCacheValid() {
    if (!this.cache.data || !this.cache.timestamp) {
      return false;
    }
    
    const now = Date.now();
    const cacheAge = now - this.cache.timestamp;
    
    return cacheAge < this.cache.cacheDuration;
  }

  /**
   * Отримання кешованих даних
   */
  getCachedData() {
    return this.cache.data ? { ...this.cache.data } : null;
  }

  /**
   * Збереження даних в кеш
   */
  setCachedData(data) {
    this.cache.data = { ...data };
    this.cache.timestamp = Date.now();
    this.cache.isUpdating = false;
    console.log('[CacheManager] Дані збережено в кеш');
    
    // Зберігаємо в IndexedDB
    this.saveCacheToStorage();
  }

  /**
   * Оновлення даних без зміни timestamp
   */
  updateDataWithoutTimestamp(data) {
    this.cache.data = { ...data };
    this.cache.isUpdating = false;
    console.log('[CacheManager] Дані оновлено без зміни timestamp');
    
    // Зберігаємо в IndexedDB
    this.saveCacheToStorage();
  }

  /**
   * Очищення кешу
   */
  clearCache() {
    this.cache.data = null;
    this.cache.timestamp = null;
    this.cache.isUpdating = false;
    console.log('[CacheManager] Кеш очищено');
  }

  /**
   * Встановлення статусу оновлення
   */
  setUpdatingStatus(isUpdating) {
    this.cache.isUpdating = isUpdating;
    console.log(`[CacheManager] Статус оновлення: ${isUpdating}`);
  }

  /**
   * Отримання статусу оновлення
   */
  isUpdating() {
    return this.cache.isUpdating;
  }

  /**
   * Отримання інформації про кеш
   */
  getCacheInfo() {
    if (!this.cache.data || !this.cache.timestamp) {
      return { hasData: false, age: null, isValid: false };
    }
    
    const now = Date.now();
    const age = now - this.cache.timestamp;
    const isValid = age < this.cache.cacheDuration;
    
    return {
      hasData: true,
      age: age,
      ageFormatted: this.formatAge(age),
      isValid: isValid,
      isUpdating: this.cache.isUpdating
    };
  }

  /**
   * Форматування віку кешу
   */
  formatAge(ageMs) {
    const seconds = Math.floor(ageMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}г ${minutes % 60}хв тому`;
    } else if (minutes > 0) {
      return `${minutes}хв тому`;
    } else {
      return `${seconds}с тому`;
    }
  }

  /**
   * Встановлення тривалості кешу
   */
  setCacheDuration(durationMs) {
    this.cache.cacheDuration = durationMs;
    console.log(`[CacheManager] Тривалість кешу встановлено: ${durationMs}ms`);
  }

  /**
   * Збереження кешу в IndexedDB
   */
  async saveCacheToStorage() {
    if (!this.db) return;
    
    try {
      // Серіалізуємо дані, виключаючи FileSystemHandle
      const serializedData = this.serializeData(this.cache.data);
      
      if (!serializedData) {
        console.warn('[CacheManager] Пропускаємо збереження - не вдалося серіалізувати дані');
        return;
      }
      
      const cacheEntry = {
        data: serializedData,
        timestamp: this.cache.timestamp,
        cacheDuration: this.cache.cacheDuration
      };
      
      console.log('[CacheManager] Зберігаємо кеш:', cacheEntry);
      
      await this.db.put('cache', cacheEntry, 'mediaData');
      console.log('[CacheManager] Кеш збережено в IndexedDB');
    } catch (error) {
      console.error('[CacheManager] Помилка збереження кешу:', error);
    }
  }

  /**
   * Серіалізація даних для збереження
   */
  serializeData(data) {
    if (!data) return null;
    
    try {
      const serialized = { ...data };
      
      // Видаляємо FileSystemHandle з фільмів
      if (serialized.movies) {
        serialized.movies = serialized.movies.map(movie => {
          const { handle, ...movieData } = movie;
          return movieData;
        });
      }
      
      // Видаляємо FileSystemHandle з серіалів
      if (serialized.series) {
        serialized.series = serialized.series.map(series => {
          const { handle, ...seriesData } = series;
          if (seriesData.seasons) {
            seriesData.seasons = seriesData.seasons.map(season => {
              const { handle, ...seasonData } = season;
              if (seasonData.episodes) {
                seasonData.episodes = seasonData.episodes.map(episode => {
                  const { handle, ...episodeData } = episode;
                  return episodeData;
                });
              }
              return seasonData;
            });
          }
          return seriesData;
        });
      }
      
      // Тестуємо серіалізацію
      JSON.stringify(serialized);
      console.log('[CacheManager] Дані успішно серіалізовані');
      
      return serialized;
    } catch (error) {
      console.error('[CacheManager] Помилка серіалізації:', error);
      console.error('[CacheManager] Проблемні дані:', data);
      return null;
    }
  }

  /**
   * Завантаження кешу з IndexedDB
   */
  async loadCacheFromStorage() {
    if (!this.db) return;
    
    try {
      const stored = await this.db.get('cache', 'mediaData');
      if (stored) {
        this.cache.data = stored.data;
        this.cache.timestamp = stored.timestamp;
        this.cache.cacheDuration = stored.cacheDuration;
        console.log('[CacheManager] Кеш завантажено з IndexedDB');
        console.log('[CacheManager] Timestamp кешу:', new Date(stored.timestamp).toLocaleString());
      }
    } catch (error) {
      console.error('[CacheManager] Помилка завантаження кешу:', error);
    }
  }
} 