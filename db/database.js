import Database from 'better-sqlite3';

const db = new Database('osint.db');

export const initializeDatabase = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS searches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      query TEXT NOT NULL,
      result TEXT,
      created_at TEXT,
      UNIQUE(type, query, created_at)
    );

    CREATE INDEX IF NOT EXISTS idx_type ON searches(type);
    CREATE INDEX IF NOT EXISTS idx_query ON searches(query);
    CREATE INDEX IF NOT EXISTS idx_created_at ON searches(created_at);
  `);
};

export default db;