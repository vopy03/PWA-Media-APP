/**
 * MediaAnalyzer - клас для аналізу структури медіа файлів
 * Розпізнає серіали, фільми, сезони та епізоди
 */
class MediaAnalyzer {
  constructor() {
    this.videoExtensions = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'];
    this.seasonPatterns = [
      /season\s*(\d+)/i,
      /s(\d+)/i,
      /сезон\s*(\d+)/i
    ];
    this.episodePatterns = [
      /episode\s*(\d+)/i,
      /e(\d+)/i,
      /ep\s*(\d+)/i,
      /серия\s*(\d+)/i,
      /серія\s*(\d+)/i
    ];
    this.episodeSeasonPatterns = [
      /s(\d{1,2})e(\d{1,2})/i,
      /(\d{1,2})x(\d{1,2})/i,
      /сезон\s*(\d+)\s*серия\s*(\d+)/i
    ];
  }

  /**
   * Перевірка чи є файл відео
   */
  isVideoFile(fileName) {
    const extension = this.getFileExtension(fileName);
    return this.videoExtensions.includes(extension.toLowerCase());
  }

  /**
   * Отримання розширення файлу
   */
  getFileExtension(fileName) {
    return fileName.substring(fileName.lastIndexOf('.'));
  }

  /**
   * Отримання назви файлу без розширення
   */
  getFileNameWithoutExtension(fileName) {
    return fileName.substring(0, fileName.lastIndexOf('.'));
  }

  /**
   * Аналіз структури папки для визначення типу контенту
   */
  async analyzeDirectoryStructure(directoryHandle, maxDepth = 3) {
    console.log(`[MediaAnalyzer] Аналіз структури папки: ${directoryHandle.name}`);
    
    const analysis = {
      type: 'unknown',
      movies: [],
      series: [],
      totalFiles: 0,
      totalDirectories: 0
    };

    try {
      const contents = await this.scanDirectory(directoryHandle, maxDepth);
      
      // Підрахунок файлів та папок
      analysis.totalFiles = contents.files.length;
      analysis.totalDirectories = contents.directories.length;
      
      // Перевіряємо чи є папки Movies та Serials
      const moviesDir = contents.directories.find(dir => 
        dir.name.toLowerCase() === 'movies' || 
        dir.name.toLowerCase() === 'фільми'
      );
      
      const serialsDir = contents.directories.find(dir => 
        dir.name.toLowerCase() === 'serials' || 
        dir.name.toLowerCase() === 'series' || 
        dir.name.toLowerCase() === 'серіали'
      );
      
      if (moviesDir && serialsDir) {
        // Структура з окремими папками для фільмів та серіалів
        analysis.type = 'organized';
        analysis.movies = await this.extractMoviesFromDirectory(moviesDir.handle);
        analysis.series = await this.extractSeriesFromDirectory(serialsDir.handle);
      } else {
        // Змішана структура
        if (this.isMovieDirectory(contents)) {
          analysis.type = 'movies';
          analysis.movies = await this.extractMovies(contents.files);
        } else if (this.isSeriesDirectory(contents)) {
          analysis.type = 'series';
          analysis.series = await this.extractSeries(contents.directories);
        } else if (this.isMixedDirectory(contents)) {
          analysis.type = 'mixed';
          analysis.movies = await this.extractMovies(contents.files);
          analysis.series = await this.extractSeries(contents.directories);
        }
      }
      
      console.log(`[MediaAnalyzer] Аналіз завершено. Тип: ${analysis.type}`);
      return analysis;
    } catch (error) {
      console.error('[MediaAnalyzer] Помилка аналізу структури:', error);
      throw error;
    }
  }

  /**
   * Сканування папки рекурсивно
   */
  async scanDirectory(directoryHandle, maxDepth, currentDepth = 0) {
    const result = {
      files: [],
      directories: [],
      path: directoryHandle.name
    };

    if (currentDepth >= maxDepth) {
      return result;
    }

    for await (const entry of directoryHandle.values()) {
      if (entry.kind === 'file' && this.isVideoFile(entry.name)) {
        result.files.push({
          name: entry.name,
          handle: entry,
          path: result.path
        });
      } else if (entry.kind === 'directory') {
        result.directories.push({
          name: entry.name,
          handle: entry,
          path: result.path
        });
      }
    }

    // Рекурсивно скануємо підпапки
    for (const subdir of result.directories) {
      const subResult = await this.scanDirectory(subdir.handle, maxDepth, currentDepth + 1);
      result.files.push(...subResult.files);
      result.directories.push(...subResult.directories);
    }

    return result;
  }

  /**
   * Визначення чи є папка з фільмами
   */
  isMovieDirectory(contents) {
    // Якщо більше 50% файлів - це фільми
    const videoFiles = contents.files.filter(file => this.isVideoFile(file.name));
    const potentialMovies = videoFiles.filter(file => this.isMovieFile(file.name));
    
    return potentialMovies.length > 0 && potentialMovies.length >= videoFiles.length * 0.5;
  }

  /**
   * Визначення чи є папка з серіалами
   */
  isSeriesDirectory(contents) {
    // Перевіряємо чи є папки з назвами серіалів
    const seriesDirectories = contents.directories.filter(dir => 
      this.isSeriesName(dir.name)
    );
    
    return seriesDirectories.length > 0;
  }

  /**
   * Визначення чи є змішана папка
   */
  isMixedDirectory(contents) {
    return this.isMovieDirectory(contents) && this.isSeriesDirectory(contents);
  }

  /**
   * Визначення чи є файл фільмом
   */
  isMovieFile(fileName) {
    const name = this.getFileNameWithoutExtension(fileName).toLowerCase();
    
    // Фільм якщо немає паттернів серіалів
    return !this.hasEpisodePattern(name) && !this.hasSeasonPattern(name);
  }

  /**
   * Визначення чи є назва серіалом
   */
  isSeriesName(name) {
    const lowerName = name.toLowerCase();
    
    // Виключаємо загальні папки
    const excludePatterns = [
      /^movies?$/i,
      /^series?$/i,
      /^serials?$/i,
      /^tv$/i,
      /^фільми$/i,
      /^серіали$/i,
      /^сезон/i,
      /^season/i
    ];
    
    if (excludePatterns.some(pattern => pattern.test(lowerName))) {
      return false;
    }
    
    // Серіал якщо назва не схожа на номер сезону
    if (this.isSeasonNumber(name)) {
      return false;
    }
    
    // Додаткові перевірки для серіалів
    // Серіал якщо в назві є слово "Season" або "Сезон"
    const seasonPatterns = [
      /season\s*\d+/i,
      /сезон\s*\d+/i,
      /s\d+/i
    ];
    
    if (seasonPatterns.some(pattern => pattern.test(name))) {
      return true;
    }
    
    // Серіал якщо назва містить типові слова серіалів
    const seriesKeywords = [
      'rookie', 'breaking', 'game', 'thrones', 'office', 'friends',
      'rookie', 'breaking', 'game', 'thrones', 'office', 'friends'
    ];
    
    if (seriesKeywords.some(keyword => lowerName.includes(keyword))) {
      return true;
    }
    
    // Якщо назва довша за 3 символи і не схожа на файл
    return name.length > 3 && !name.includes('.');
  }

  /**
   * Перевірка чи є номер сезону
   */
  isSeasonNumber(name) {
    return /^season\s*\d+$/i.test(name) || /^s\d+$/i.test(name) || /^сезон\s*\d+$/i.test(name);
  }

  /**
   * Перевірка чи є паттерн епізоду
   */
  hasEpisodePattern(name) {
    return this.episodePatterns.some(pattern => pattern.test(name)) ||
           this.episodeSeasonPatterns.some(pattern => pattern.test(name));
  }

  /**
   * Перевірка чи є паттерн сезону
   */
  hasSeasonPattern(name) {
    return this.seasonPatterns.some(pattern => pattern.test(name));
  }

  /**
   * Витягування інформації про фільми
   */
  async extractMovies(files) {
    const movies = [];
    
    for (const file of files) {
      if (this.isMovieFile(file.name)) {
        const movieInfo = this.parseMovieInfo(file.name);
        movies.push({
          ...file,
          ...movieInfo,
          type: 'movie'
        });
      }
    }
    
    return movies.sort((a, b) => a.title.localeCompare(b.title));
  }

  /**
   * Витягування фільмів з окремої папки
   */
  async extractMoviesFromDirectory(moviesDirectoryHandle) {
    console.log(`[MediaAnalyzer] Витягування фільмів з папки: ${moviesDirectoryHandle.name}`);
    
    const contents = await this.scanDirectory(moviesDirectoryHandle, 2);
    return await this.extractMovies(contents.files);
  }

  /**
   * Витягування серіалів з окремої папки
   */
  async extractSeriesFromDirectory(serialsDirectoryHandle) {
    console.log(`[MediaAnalyzer] Витягування серіалів з папки: ${serialsDirectoryHandle.name}`);
    
    const contents = await this.scanDirectory(serialsDirectoryHandle, 3);
    const series = [];
    
    for (const dir of contents.directories) {
      if (this.isSeriesName(dir.name)) {
        const seriesInfo = await this.analyzeSeries(dir);
        series.push(seriesInfo);
      }
    }
    
    return series.sort((a, b) => a.title.localeCompare(b.title));
  }

  /**
   * Витягування інформації про серіали (для змішаної структури)
   */
  async extractSeries(directories) {
    const series = [];
    
    for (const dir of directories) {
      if (this.isSeriesName(dir.name)) {
        const seriesInfo = await this.analyzeSeries(dir);
        series.push(seriesInfo);
      }
    }
    
    return series.sort((a, b) => a.title.localeCompare(b.title));
  }

  /**
   * Аналіз серіалу
   */
  async analyzeSeries(seriesDirectory) {
    console.log(`[MediaAnalyzer] Аналіз серіалу: ${seriesDirectory.name}`);
    
    const seriesInfo = {
      title: this.cleanSeriesTitle(seriesDirectory.name),
      originalName: seriesDirectory.name,
      handle: seriesDirectory.handle,
      path: seriesDirectory.path,
      type: 'series',
      seasons: [],
      totalEpisodes: 0
    };

    try {
      // Скануємо папку серіалу
      const contents = await this.scanDirectory(seriesDirectory.handle, 3);
      
      // Знаходимо сезони
      const seasonDirectories = contents.directories.filter(dir => 
        this.isSeasonDirectory(dir.name)
      );
      
      // Якщо є папки сезонів
      if (seasonDirectories.length > 0) {
        for (const seasonDir of seasonDirectories) {
          const seasonInfo = await this.analyzeSeason(seasonDir);
          seriesInfo.seasons.push(seasonInfo);
        }
      } else {
        // Якщо немає папок сезонів, шукаємо епізоди безпосередньо
        const episodes = await this.extractEpisodes(contents.files);
        if (episodes.length > 0) {
          seriesInfo.seasons.push({
            name: 'Season 1',
            number: 1,
            episodes: episodes,
            totalEpisodes: episodes.length
          });
        }
      }
      
      // Підрахунок загальної кількості епізодів
      seriesInfo.totalEpisodes = seriesInfo.seasons.reduce((sum, season) => 
        sum + season.totalEpisodes, 0
      );
      
      console.log(`[MediaAnalyzer] Серіал "${seriesInfo.title}" має ${seriesInfo.seasons.length} сезонів, ${seriesInfo.totalEpisodes} епізодів`);
      
    } catch (error) {
      console.error(`[MediaAnalyzer] Помилка аналізу серіалу "${seriesDirectory.name}":`, error);
    }
    
    return seriesInfo;
  }

  /**
   * Аналіз сезону
   */
  async analyzeSeason(seasonDirectory) {
    const seasonNumber = this.extractSeasonNumber(seasonDirectory.name);
    const seasonInfo = {
      name: seasonDirectory.name,
      number: seasonNumber,
      handle: seasonDirectory.handle,
      episodes: [],
      totalEpisodes: 0
    };

    try {
      const contents = await this.scanDirectory(seasonDirectory.handle, 1);
      seasonInfo.episodes = await this.extractEpisodes(contents.files);
      seasonInfo.totalEpisodes = seasonInfo.episodes.length;
      
      console.log(`[MediaAnalyzer] Сезон ${seasonNumber}: ${seasonInfo.totalEpisodes} епізодів`);
    } catch (error) {
      console.error(`[MediaAnalyzer] Помилка аналізу сезону "${seasonDirectory.name}":`, error);
    }
    
    return seasonInfo;
  }

  /**
   * Витягування епізодів з файлів
   */
  async extractEpisodes(files) {
    const episodes = [];
    
    for (const file of files) {
      if (this.isVideoFile(file.name)) {
        const episodeInfo = this.parseEpisodeInfo(file.name);
        if (episodeInfo) {
          episodes.push({
            ...file,
            ...episodeInfo,
            type: 'episode'
          });
        }
      }
    }
    
    return episodes.sort((a, b) => {
      // Спочатку сортуємо за сезоном, потім за епізодом
      if (a.season !== b.season) {
        return a.season - b.season;
      }
      return a.episode - b.episode;
    });
  }

  /**
   * Визначення чи є папка сезоном
   */
  isSeasonDirectory(name) {
    // Різні формати сезонів
    const seasonPatterns = [
      /^season\s*\d+/i,
      /^сезон\s*\d+/i,
      /^s\d+/i,
      /season\s*\d+/i,
      /сезон\s*\d+/i,
      /\(\d{4}-\d{4}\)/i, // Формат (2022-2023)
      /\(\d{4}\)/i, // Формат (2022)
      /web-dl/i,
      /hdtv/i,
      /bluray/i
    ];
    
    return seasonPatterns.some(pattern => pattern.test(name));
  }

  /**
   * Витягування номера сезону
   */
  extractSeasonNumber(name) {
    // Спочатку шукаємо явний номер сезону
    const seasonMatch = name.match(/season\s*(\d+)/i) || 
                       name.match(/сезон\s*(\d+)/i) || 
                       name.match(/s(\d+)/i);
    
    if (seasonMatch) {
      return parseInt(seasonMatch[1]);
    }
    
    // Якщо немає явного номера, шукаємо в роках
    const yearMatch = name.match(/\((\d{4})/);
    if (yearMatch) {
      // Використовуємо рік як номер сезону (за замовчуванням)
      return parseInt(yearMatch[1]);
    }
    
    // Якщо нічого не знайдено, повертаємо 1
    return 1;
  }

  /**
   * Парсинг інформації про фільм
   */
  parseMovieInfo(fileName) {
    const name = this.getFileNameWithoutExtension(fileName);
    
    return {
      title: this.cleanTitle(name),
      originalName: fileName,
      year: this.extractYear(name)
    };
  }

  /**
   * Парсинг інформації про епізод
   */
  parseEpisodeInfo(fileName) {
    const name = this.getFileNameWithoutExtension(fileName);
    
    // Спочатку перевіряємо комбіновані паттерни (S01E02)
    for (const pattern of this.episodeSeasonPatterns) {
      const match = name.match(pattern);
      if (match) {
        return {
          title: this.cleanEpisodeTitle(name),
          originalName: fileName,
          season: parseInt(match[1]),
          episode: parseInt(match[2]),
          episodeLabel: `S${match[1].padStart(2, '0')}E${match[2].padStart(2, '0')}`
        };
      }
    }
    
    // Якщо не знайдено комбінований паттерн, шукаємо окремі
    const seasonMatch = name.match(/season\s*(\d+)/i) || name.match(/s(\d+)/i);
    const episodeMatch = name.match(/episode\s*(\d+)/i) || name.match(/e(\d+)/i);
    
    if (seasonMatch && episodeMatch) {
      return {
        title: this.cleanEpisodeTitle(name),
        originalName: fileName,
        season: parseInt(seasonMatch[1]),
        episode: parseInt(episodeMatch[1]),
        episodeLabel: `S${seasonMatch[1].padStart(2, '0')}E${episodeMatch[1].padStart(2, '0')}`
      };
    }
    
    return null; // Не епізод
  }

  /**
   * Очищення назви фільму
   */
  cleanTitle(name) {
    return name
      .replace(/[._-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Очищення назви серіалу
   */
  cleanSeriesTitle(name) {
    return this.cleanTitle(name);
  }

  /**
   * Очищення назви епізоду
   */
  cleanEpisodeTitle(name) {
    // Видаляємо паттерни сезонів та епізодів
    let cleaned = name;
    
    // Видаляємо комбіновані паттерни
    this.episodeSeasonPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });
    
    // Видаляємо окремі паттерни
    this.seasonPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });
    
    this.episodePatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });
    
    return this.cleanTitle(cleaned);
  }

  /**
   * Витягування року з назви
   */
  extractYear(name) {
    const yearMatch = name.match(/(19|20)\d{2}/);
    return yearMatch ? parseInt(yearMatch[0]) : null;
  }
}

// Експорт для використання як модуль
export { MediaAnalyzer }; 