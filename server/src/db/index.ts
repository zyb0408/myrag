import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { SCHEMA, MIGRATION } from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'ragflow-chat.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Run schema
    db.exec(SCHEMA);

    // Run migration for existing databases that lack user_id column
    try {
      const tableInfo = db.prepare("PRAGMA table_info(conversations)").all() as any[];
      const hasUserId = tableInfo.some((col: any) => col.name === 'user_id');
      if (!hasUserId) {
        console.log('Running migration: adding user_id column to conversations');
        db.exec(MIGRATION);
      }
    } catch {
      // Table doesn't exist yet — schema will create it
    }

    // Seed admin user if users table is empty
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
    if (userCount.count === 0) {
      console.log('Seeding default admin user...');
      const hash = bcrypt.hashSync('admin123', 10);
      db.prepare(
        'INSERT INTO users (id, username, password_hash, display_name, must_reset_password, is_active, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(uuidv4(), 'admin', hash, '管理员', 1, 1, 1, new Date().toISOString());
      console.log('Default admin created: username=admin, password=admin123');
    }
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}

export function queryAll<T = any>(sql: string, params: any[] = []): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | undefined {
  return getDb().prepare(sql).get(...params) as T | undefined;
}

export function execute(sql: string, params: any[] = []): void {
  getDb().prepare(sql).run(...params);
}
