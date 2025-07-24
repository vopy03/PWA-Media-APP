export class FileSystemManager {
  constructor() { console.log('[FileSystemManager] created'); }

  async ensureAppDataFolder(parentHandle) {
    console.log('[FileSystemManager] ensureAppDataFolder');
    let appDataHandle = await parentHandle.getDirectoryHandle('.media-app-data', { create: true });
    await appDataHandle.getDirectoryHandle('covers', { create: true });
    await appDataHandle.getDirectoryHandle('meta', { create: true });
    await appDataHandle.getDirectoryHandle('profiles', { create: true });
    return appDataHandle;
  }

  async saveFolderHandle(key, handle) {
    console.log('[FileSystemManager] saveFolderHandle', key);
    const db = await this.openDB();
    const tx = db.transaction('folders', 'readwrite');
    tx.objectStore('folders').put(handle, key);
    return tx.complete;
  }
  async getFolderHandle(key) {
    console.log('[FileSystemManager] getFolderHandle', key);
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction('folders').objectStore('folders').get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  openDB() {
    console.log('[FileSystemManager] openDB');
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('media-manager-db', 1);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('folders')) {
          db.createObjectStore('folders');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
} 