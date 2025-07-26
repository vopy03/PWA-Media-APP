/**
 * FileSystemManager - клас для роботи з File System Access API
 * Надає зручні методи для роботи з файлами та папками
 */
class FileSystemManager {
  constructor() {
    this.rootHandle = null;
    this.permissionCheckInterval = null;
    this.onPermissionChange = null; // callback для зміни дозволів
  }

  /**
   * Ініціалізація - завантаження збереженого handle
   */
  async initialize() {
    console.log('[FileSystemManager] Ініціалізація...');
    try {
      const savedHandle = await this.loadDirectoryHandle();
      if (savedHandle) {
        this.rootHandle = savedHandle;
        console.log('[FileSystemManager] Збережений handle відновлено:', savedHandle.name);
        this.startPermissionCheck();
        return true;
      }
      console.log('[FileSystemManager] Збережений handle не знайдено');
      return false;
    } catch (error) {
      console.error('[FileSystemManager] Помилка ініціалізації:', error);
      return false;
    }
  }

  /**
   * Вибір кореневої папки
   */
  async chooseRootDirectory() {
    console.log('[FileSystemManager] Вибір кореневої папки...');
    try {
      const handle = await window.showDirectoryPicker();
      this.rootHandle = handle;
      console.log('[FileSystemManager] Папку вибрано:', handle.name);
      
      await this.saveDirectoryHandle(handle);
      this.startPermissionCheck();
      
      return handle;
    } catch (error) {
      console.error('[FileSystemManager] Помилка вибору папки:', error);
      throw error;
    }
  }

  /**
   * Отримання списку всіх файлів та папок у кореневій директорії
   */
  async getRootContents() {
    if (!this.rootHandle) {
      throw new Error('Коренева папка не вибрана');
    }

    const contents = [];
    for await (const entry of this.rootHandle.values()) {
      contents.push({
        name: entry.name,
        kind: entry.kind,
        handle: entry
      });
    }
    
    console.log('[FileSystemManager] Знайдено елементів у корені:', contents.length);
    return contents;
  }

  /**
   * Отримання списку файлів з конкретної папки
   */
  async getFilesFromDirectory(directoryHandle) {
    const files = [];
    for await (const entry of directoryHandle.values()) {
      if (entry.kind === 'file') {
        files.push({
          name: entry.name,
          handle: entry
        });
      }
    }
    return files;
  }

  /**
   * Отримання списку папок з конкретної директорії
   */
  async getDirectoriesFromDirectory(directoryHandle) {
    const directories = [];
    for await (const entry of directoryHandle.values()) {
      if (entry.kind === 'directory') {
        directories.push({
          name: entry.name,
          handle: entry
        });
      }
    }
    return directories;
  }

  /**
   * Пошук папки за назвою в кореневій директорії
   */
  async findDirectory(directoryName) {
    if (!this.rootHandle) {
      throw new Error('Коренева папка не вибрана');
    }

    try {
      const handle = await this.rootHandle.getDirectoryHandle(directoryName);
      return {
        name: handle.name,
        handle: handle
      };
    } catch (error) {
      console.log(`[FileSystemManager] Папку "${directoryName}" не знайдено`);
      return null;
    }
  }

  /**
   * Пошук файлу за назвою в конкретній папці
   */
  async findFile(directoryHandle, fileName) {
    try {
      const handle = await directoryHandle.getFileHandle(fileName);
      return {
        name: handle.name,
        handle: handle
      };
    } catch (error) {
      console.log(`[FileSystemManager] Файл "${fileName}" не знайдено`);
      return null;
    }
  }

  /**
   * Отримання об'єкта File з FileHandle
   */
  async getFile(fileHandle) {
    return await fileHandle.getFile();
  }

  /**
   * Перевірка чи є файл відео (за розширенням)
   */
  isVideoFile(fileName) {
    const videoExtensions = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'];
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    return videoExtensions.includes(extension);
  }

  /**
   * Отримання всіх відео файлів з папки
   */
  async getVideoFiles(directoryHandle) {
    const allFiles = await this.getFilesFromDirectory(directoryHandle);
    return allFiles.filter(file => this.isVideoFile(file.name));
  }

  /**
   * Рекурсивний пошук всіх відео файлів у папці та підпапках
   */
  async getAllVideoFiles(directoryHandle, maxDepth = 3, currentDepth = 0) {
    if (currentDepth >= maxDepth) return [];

    const videos = [];
    
    // Спочатку додаємо відео з поточної папки
    const currentVideos = await this.getVideoFiles(directoryHandle);
    videos.push(...currentVideos.map(video => ({
      ...video,
      path: directoryHandle.name
    })));

    // Потім рекурсивно обходимо підпапки
    const subdirectories = await this.getDirectoriesFromDirectory(directoryHandle);
    for (const subdir of subdirectories) {
      const subVideos = await this.getAllVideoFiles(subdir.handle, maxDepth, currentDepth + 1);
      videos.push(...subVideos.map(video => ({
        ...video,
        path: `${directoryHandle.name}/${video.path}`
      })));
    }

    return videos;
  }

  /**
   * Збереження handle в IndexedDB
   */
  async saveDirectoryHandle(handle) {
    console.log('[FileSystemManager] Зберігаємо handle в IndexedDB...');
    try {
      const db = await idb.openDB('FileHandles', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('handles')) {
            db.createObjectStore('handles');
          }
        },
      });
      await db.put('handles', handle, 'savedDirectory');
      console.log('[FileSystemManager] Handle збережено в IndexedDB');
    } catch (error) {
      console.error('[FileSystemManager] Помилка збереження handle:', error);
      throw error;
    }
  }

  /**
   * Завантаження handle з IndexedDB
   */
  async loadDirectoryHandle() {
    console.log('[FileSystemManager] Завантажуємо handle з IndexedDB...');
    try {
      const db = await idb.openDB('FileHandles', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('handles')) {
            db.createObjectStore('handles');
          }
        },
      });
      const handle = await db.get('handles', 'savedDirectory');
      if (handle) {
        console.log('[FileSystemManager] Handle знайдено в IndexedDB:', handle.name);
        // Перевіряємо чи досі маємо доступ
        try {
          await handle.requestPermission({ mode: 'read' });
          console.log('[FileSystemManager] Доступ до папки підтверджено');
          return handle;
        } catch (error) {
          console.warn('[FileSystemManager] Немає доступу до збереженої папки:', error);
          return null;
        }
      }
      console.log('[FileSystemManager] Handle не знайдено в IndexedDB');
      return null;
    } catch (error) {
      console.error('[FileSystemManager] Помилка завантаження handle:', error);
      return null;
    }
  }

  /**
   * Перевірка дозволів доступу
   */
  async checkPermission() {
    if (!this.rootHandle) {
      console.log('[FileSystemManager] Немає handle для перевірки дозволів');
      return 'no-handle';
    }

    try {
      const permission = await this.rootHandle.queryPermission({ mode: 'read' });
      console.log('[FileSystemManager] Поточний дозвіл:', permission);
      
      if (this.onPermissionChange) {
        this.onPermissionChange(permission);
      }
      
      return permission;
    } catch (error) {
      console.error('[FileSystemManager] Помилка перевірки дозволу:', error);
      return 'error';
    }
  }

  /**
   * Запуск періодичної перевірки дозволів
   */
  startPermissionCheck(intervalMs = 30000) {
    if (this.permissionCheckInterval) {
      this.stopPermissionCheck();
    }
    
    console.log(`[FileSystemManager] Запускаємо періодичну перевірку дозволів (кожні ${intervalMs/1000} секунд)`);
    this.permissionCheckInterval = setInterval(() => {
      this.checkPermission();
    }, intervalMs);
    
    // Перша перевірка одразу
    this.checkPermission();
  }

  /**
   * Зупинка періодичної перевірки дозволів
   */
  stopPermissionCheck() {
    if (this.permissionCheckInterval) {
      console.log('[FileSystemManager] Зупиняємо періодичну перевірку дозволів');
      clearInterval(this.permissionCheckInterval);
      this.permissionCheckInterval = null;
    }
  }

  /**
   * Очищення ресурсів
   */
  destroy() {
    this.stopPermissionCheck();
    this.rootHandle = null;
  }

  /**
   * Геттер для перевірки чи ініціалізовано
   */
  get isInitialized() {
    return this.rootHandle !== null;
  }

  /**
   * Геттер для отримання назви кореневої папки
   */
  get rootDirectoryName() {
    return this.rootHandle ? this.rootHandle.name : null;
  }
}

// Експорт для використання як модуль
export { FileSystemManager }; 