const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const config = require('./config');

const dbPath = path.resolve(__dirname, config.DB_PATH);

// Initialize database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Initialize database tables synchronously
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create favorites table
      db.run(`
        CREATE TABLE IF NOT EXISTS favorites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tmdb_id INTEGER NOT NULL,
          media_type TEXT NOT NULL CHECK(media_type IN ('movie', 'tv')),
          title TEXT NOT NULL,
          poster_path TEXT,
          backdrop_path TEXT,
          overview TEXT,
          release_date TEXT,
          vote_average REAL,
          vote_count INTEGER,
          genres TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(tmdb_id, media_type)
        )
      `);

      // Create custom lists table
      db.run(`
        CREATE TABLE IF NOT EXISTS lists (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create list_items table (many-to-many relationship)
      db.run(`
        CREATE TABLE IF NOT EXISTS list_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          list_id INTEGER NOT NULL,
          tmdb_id INTEGER NOT NULL,
          media_type TEXT NOT NULL CHECK(media_type IN ('movie', 'tv')),
          title TEXT NOT NULL,
          poster_path TEXT,
          backdrop_path TEXT,
          overview TEXT,
          release_date TEXT,
          vote_average REAL,
          vote_count INTEGER,
          genres TEXT,
          added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (list_id) REFERENCES lists (id) ON DELETE CASCADE,
          UNIQUE(list_id, tmdb_id, media_type)
        )
      `);

      // Create user settings table
      db.run(`
        CREATE TABLE IF NOT EXISTS user_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create watch history table
      db.run(`
        CREATE TABLE IF NOT EXISTS watch_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tmdb_id INTEGER NOT NULL,
          media_type TEXT NOT NULL CHECK(media_type IN ('movie', 'tv')),
          title TEXT NOT NULL,
          season_number INTEGER,
          episode_number INTEGER,
          episode_title TEXT,
          watched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(tmdb_id, media_type, season_number, episode_number)
        )
      `);

      // Insert default "Favorites" list if it doesn't exist
      db.run(`
        INSERT OR IGNORE INTO lists (name, description) 
        VALUES ('Favorites', 'Your favorite movies and TV shows')
      `);

      // Insert default lobster settings
      const defaultSettings = [
        ['lobster_quality', '1080'],
        ['lobster_provider', 'Vidcloud'],
        ['lobster_language', 'english'],
        ['lobster_player', 'mpv'],
        ['lobster_image_preview', 'false'],
        ['lobster_external_menu', 'false'],
        ['lobster_debug', 'false']
      ];

      const stmt = db.prepare(`
        INSERT OR IGNORE INTO user_settings (key, value) VALUES (?, ?)
      `);

      defaultSettings.forEach(([key, value]) => {
        stmt.run(key, value);
      });

      stmt.finalize((err) => {
        if (err) {
          console.error('Error initializing database:', err);
          reject(err);
        } else {
          console.log('Database tables initialized');
          resolve();
        }
      });
    });
  });
}

module.exports = { db, initializeDatabase }; 