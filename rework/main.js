// Імпорт класів
import { FileSystemManager } from './FileSystemManager.js';
import { ProfileManager } from './ProfileManager.js';
import { MediaAnalyzer } from './MediaAnalyzer.js';
import { UIManager } from './UIManager.js';
import { MediaApp } from './MediaApp.js';
import { CacheManager } from './CacheManager.js';

// Глобальні змінні для доступу з консолі
window.FileSystemManager = FileSystemManager;
window.ProfileManager = ProfileManager;
window.MediaAnalyzer = MediaAnalyzer;
window.UIManager = UIManager;
window.MediaApp = MediaApp;
window.CacheManager = CacheManager;

let mediaApp = null;

// Ініціалізація додатку
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Main] Запуск додатку...');
  
  const container = document.getElementById('app-container');
  if (!container) {
    console.error('[Main] Контейнер додатку не знайдено');
    return;
  }
  
  try {
    // Створюємо головний клас додатку
    mediaApp = new MediaApp();
    
    // Робимо доступним глобально для тестування
    window.mediaApp = mediaApp;
    
    // Ініціалізуємо додаток
    await mediaApp.initialize();
    
    console.log('[Main] Додаток ініціалізовано');
    
  } catch (error) {
    console.error('[Main] Помилка ініціалізації додатку:', error);
    
    // Показуємо помилку користувачу
    const appContainer = document.getElementById('app-container');
    if (appContainer) {
      appContainer.innerHTML = `
        <div class="error-container">
          <h2>Помилка запуску додатку</h2>
          <p>${error.message}</p>
          <button onclick="location.reload()">Перезавантажити</button>
        </div>
      `;
    }
  }
});

// Очищення при закритті сторінки
window.addEventListener('beforeunload', () => {
  if (mediaApp) {
    mediaApp.destroy();
  }
});

// Глобальні функції для тестування
window.testFileSystem = async () => {
  if (!mediaApp) {
    console.error('Додаток не ініціалізовано');
    return;
  }
  
  console.log('FileSystemManager:', mediaApp.fileSystemManager);
  console.log('ProfileManager:', mediaApp.profileManager);
  console.log('MediaAnalyzer:', mediaApp.mediaAnalyzer);
  console.log('UIManager:', mediaApp.uiManager);
};

window.testChooseDirectory = async () => {
  if (!mediaApp) {
    console.error('Додаток не ініціалізовано');
    return;
  }
  
  try {
    await mediaApp.chooseDirectory();
  } catch (error) {
    console.error('Помилка вибору папки:', error);
  }
};

window.testLoadProfiles = async () => {
  if (!mediaApp) {
    console.error('Додаток не ініціалізовано');
    return;
  }
  
  try {
    const profiles = await mediaApp.profileManager.getAllProfiles();
    console.log('Профілі:', profiles);
  } catch (error) {
    console.error('Помилка завантаження профілів:', error);
  }
};

// Функція для очищення бази даних (для виправлення помилок)
window.clearFileSystemDatabase = async () => {
  try {
    console.log('Очищення бази даних FileSystem...');
    await idb.deleteDB('FileHandles');
    console.log('База даних FileHandles видалена');
    
    // Перезавантажуємо сторінку
    location.reload();
  } catch (error) {
    console.error('Помилка очищення бази даних:', error);
  }
};

// Функція для діагностики проблем з дозволами
window.diagnosePermissions = async () => {
  console.log('=== ДІАГНОСТИКА ДОЗВОЛІВ ===');
  console.log('User Agent:', navigator.userAgent);
  console.log('Це мобільний пристрій:', /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
  console.log('Chrome версія:', navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'Невідома');
  
  if (mediaApp && mediaApp.fileSystemManager) {
    console.log('FileSystemManager ініціалізовано:', mediaApp.fileSystemManager.isInitialized);
    console.log('Коренева папка:', mediaApp.fileSystemManager.rootDirectoryName);
    
    if (mediaApp.fileSystemManager.rootHandle) {
      try {
        const permission = await mediaApp.fileSystemManager.rootHandle.queryPermission({ mode: 'read' });
        console.log('Поточний дозвіл:', permission);
      } catch (error) {
        console.error('Помилка перевірки дозволу:', error);
      }
    }
  }
  
  // Перевіряємо IndexedDB
  try {
    const db = await idb.openDB('FileHandles', 2);
    const handle = await db.get('handles', 'savedDirectory');
    const info = await db.get('directoryInfo', 'savedDirectory');
    
    console.log('Handle в IndexedDB:', handle ? 'Знайдено' : 'Не знайдено');
    console.log('Інформація в IndexedDB:', info);
  } catch (error) {
    console.error('Помилка доступу до IndexedDB:', error);
  }
  
  console.log('=== КІНЕЦЬ ДІАГНОСТИКИ ===');
};

// Функція для тестування збереження дозволів
window.testPermissionPersistence = async () => {
  console.log('=== ТЕСТ ЗБЕРЕЖЕННЯ ДОЗВОЛІВ ===');
  
  if (!mediaApp || !mediaApp.fileSystemManager) {
    console.error('FileSystemManager не ініціалізовано');
    return;
  }
  
  try {
    // Спробуємо вибрати папку
    console.log('1. Вибір папки...');
    const handle = await mediaApp.fileSystemManager.chooseRootDirectory();
    console.log('Папка вибрана:', handle.name);
    
    // Перевіряємо дозвіл
    console.log('2. Перевірка дозволу...');
    const permission = await handle.queryPermission({ mode: 'read' });
    console.log('Дозвіл після вибору:', permission);
    
    // Зберігаємо handle
    console.log('3. Збереження handle...');
    await mediaApp.fileSystemManager.saveDirectoryHandle(handle);
    console.log('Handle збережено');
    
    // Перезавантажуємо сторінку через 3 секунди
    console.log('4. Перезавантаження через 3 секунди...');
    setTimeout(() => {
      console.log('Перезавантаження...');
      location.reload();
    }, 3000);
    
  } catch (error) {
    console.error('Помилка тестування:', error);
  }
}; 

// Функція для тестування кешу
window.testCache = () => {
  if (!mediaApp) {
    console.error('Додаток не ініціалізовано');
    return;
  }
  
  const cacheInfo = mediaApp.cacheManager.getCacheInfo();
  console.log('Інформація про кеш:', cacheInfo);
  
  if (cacheInfo.hasData) {
    console.log('Кешовані дані:', mediaApp.cacheManager.getCachedData());
  }
};

// Функція для очищення кешу
window.clearCache = () => {
  if (!mediaApp) {
    console.error('Додаток не ініціалізовано');
    return;
  }
  
  mediaApp.cacheManager.clearCache();
  console.log('Кеш очищено');
}; 