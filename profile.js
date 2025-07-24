export class ProfileManager {
  constructor(appDataHandle) {
    this.appDataHandle = appDataHandle;
    console.log('[ProfileManager] created');
  }
  async getProfiles() {
    console.log('[ProfileManager] getProfiles');
    const profiles = [];
    try {
      const profilesHandle = await this.appDataHandle.getDirectoryHandle('profiles', { create: true });
      for await (const entry of profilesHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.json')) {
          profiles.push(entry.name.replace(/\.json$/, ''));
        }
      }
      console.log('[ProfileManager] found profiles:', profiles);
    } catch (e) {
      console.error('[ProfileManager] getProfiles ERROR:', e);
    }
    return profiles;
  }
  async saveProfile(name, data) {
    console.log('[ProfileManager] saveProfile', name, data);
    try {
      const profilesHandle = await this.appDataHandle.getDirectoryHandle('profiles', { create: true });
      const fileHandle = await profilesHandle.getFileHandle(name + '.json', { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(data));
      await writable.close();
      console.log('[ProfileManager] saveProfile SUCCESS', name);
    } catch (e) {
      console.error('[ProfileManager] saveProfile ERROR', name, e);
    }
  }
  async loadProfile(name) {
    console.log('[ProfileManager] loadProfile', name);
    try {
      const profilesHandle = await this.appDataHandle.getDirectoryHandle('profiles', { create: true });
      const fileHandle = await profilesHandle.getFileHandle(name + '.json', { create: false });
      const file = await fileHandle.getFile();
      const text = await file.text();
      console.log('[ProfileManager] loadProfile SUCCESS', name, text);
      return JSON.parse(text);
    } catch (e) {
      console.error('[ProfileManager] loadProfile ERROR', name, e);
      return {};
    }
  }
} 