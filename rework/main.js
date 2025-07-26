// Імпорт класів
import { FileSystemManager } from './FileSystemManager.js';
import { ProfileManager } from './ProfileManager.js';
import { MediaAnalyzer } from './MediaAnalyzer.js';
import { UIManager } from './UIManager.js';
import { MediaApp } from './MediaApp.js';

// Глобальні змінні для доступу з консолі
window.FileSystemManager = FileSystemManager;
window.ProfileManager = ProfileManager;
window.MediaAnalyzer = MediaAnalyzer;
window.UIManager = UIManager;
window.MediaApp = MediaApp;

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
    mediaApp = new MediaApp(container);
    
    // Робимо доступним глобально для тестування
    window.mediaApp = mediaApp;
    
    // Ініціалізуємо додаток
    await mediaApp.initialize();
    
    console.log('[Main] Додаток ініціалізовано');
    
  } catch (error) {
    console.error('[Main] Помилка ініціалізації додатку:', error);
    
    // Показуємо помилку користувачу
    container.innerHTML = `
      <div class="error-container">
        <h2>Помилка запуску додатку</h2>
        <p>${error.message}</p>
        <button onclick="location.reload()">Перезавантажити</button>
      </div>
    `;
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