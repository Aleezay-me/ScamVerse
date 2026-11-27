import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'scamverse.db');
export const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reset_code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      level INTEGER NOT NULL DEFAULT 1,
      total_points INTEGER NOT NULL DEFAULT 0,
      streak_days INTEGER NOT NULL DEFAULT 1,
      last_active_date TEXT NOT NULL DEFAULT (date('now')),
      preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'ur')),
      bio TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('fake_inbox', 'digital_detective', 'timed_challenge', 'consequence')),
      description TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      points_reward INTEGER NOT NULL DEFAULT 10,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS scenarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      mode TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      region_tag TEXT NOT NULL DEFAULT 'Pakistan & Global',
      payload_json TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_scenarios_mode ON scenarios(mode);

    CREATE TABLE IF NOT EXISTS user_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      scenario_id INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
      mission_mode TEXT NOT NULL,
      selected_answer_json TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      points_awarded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, scenario_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_answers_user ON user_answers(user_id);

    CREATE TABLE IF NOT EXISTS challenge_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      total_answered INTEGER NOT NULL,
      correct_count INTEGER NOT NULL,
      accuracy INTEGER NOT NULL,
      points_earned INTEGER NOT NULL,
      rating TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_challenge_runs_user ON challenge_runs(user_id);

    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      criteria_type TEXT NOT NULL,
      criteria_threshold INTEGER NOT NULL,
      icon_key TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_achievements (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
      awarded_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, achievement_id)
    );

    CREATE TABLE IF NOT EXISTS report_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS suspicious_number_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_code TEXT NOT NULL UNIQUE,
      normalized_phone TEXT NOT NULL,
      country_code TEXT NOT NULL,
      display_phone TEXT NOT NULL,
      category_slug TEXT NOT NULL REFERENCES report_categories(slug),
      description TEXT NOT NULL,
      incident_date TEXT NOT NULL,
      evidence_filename TEXT,
      evidence_data_private TEXT,
      reporter_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      moderation_status TEXT NOT NULL DEFAULT 'under_review' CHECK (moderation_status IN ('under_review', 'moderated_report', 'rejected')),
      moderation_note TEXT NOT NULL DEFAULT '',
      flag_count INTEGER NOT NULL DEFAULT 0,
      is_sample INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_reports_phone ON suspicious_number_reports(normalized_phone);
    CREATE INDEX IF NOT EXISTS idx_reports_status ON suspicious_number_reports(moderation_status);

    CREATE TABLE IF NOT EXISTS report_flags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL REFERENCES suspicious_number_reports(id) ON DELETE CASCADE,
      flagger_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS learning_modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      title_ur TEXT NOT NULL,
      summary TEXT NOT NULL,
      summary_ur TEXT NOT NULL,
      content_json TEXT NOT NULL,
      points_reward INTEGER NOT NULL DEFAULT 15,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS learning_progress (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      module_id INTEGER NOT NULL REFERENCES learning_modules(id) ON DELETE CASCADE,
      quiz_score INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, module_id)
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'en',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      source_mode TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);

    CREATE TABLE IF NOT EXISTS daily_activity (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      activity_date TEXT NOT NULL,
      points_earned INTEGER NOT NULL DEFAULT 0,
      missions_completed INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, activity_date)
    );

    CREATE TABLE IF NOT EXISTS sample_leaderboard_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_name TEXT NOT NULL UNIQUE,
      level INTEGER NOT NULL,
      total_points INTEGER NOT NULL,
      completed_challenges INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function calculateLevel(points: number): number {
  return Math.max(1, Math.floor(points / 75) + 1);
}

export function awardUserPoints(userId: number, pointsDelta: number, missionIncrement = 1): {
  totalPoints: number;
  level: number;
  newlyEarnedBadges: Array<{ slug: string; name: string }>;
} {
  const today = new Date().toISOString().slice(0, 10);
  const profile = db
    .prepare('SELECT total_points, streak_days, last_active_date FROM user_profiles WHERE user_id = ?')
    .get(userId) as { total_points: number; streak_days: number; last_active_date: string } | undefined;

  if (!profile) {
    return { totalPoints: 0, level: 1, newlyEarnedBadges: [] };
  }

  let nextStreak = profile.streak_days;
  let streakBonus = 0;

  if (profile.last_active_date !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (profile.last_active_date === yesterday) {
      nextStreak = profile.streak_days + 1;
      streakBonus = 5;
    } else {
      nextStreak = 1;
    }
  }

  const nextPoints = Math.max(0, profile.total_points + pointsDelta + streakBonus);
  const nextLevel = calculateLevel(nextPoints);

  db.prepare(`
    UPDATE user_profiles
    SET total_points = ?, level = ?, streak_days = ?, last_active_date = ?
    WHERE user_id = ?
  `).run(nextPoints, nextLevel, nextStreak, today, userId);

  db.prepare(`
    INSERT INTO daily_activity (user_id, activity_date, points_earned, missions_completed)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, activity_date) DO UPDATE SET
      points_earned = points_earned + excluded.points_earned,
      missions_completed = missions_completed + excluded.missions_completed
  `).run(userId, today, Math.max(0, pointsDelta + streakBonus), missionIncrement);

  const newlyEarnedBadges = evaluateAndAwardBadges(userId);
  return { totalPoints: nextPoints, level: nextLevel, newlyEarnedBadges };
}

export function evaluateAndAwardBadges(userId: number): Array<{ slug: string; name: string }> {
  const inboxCorrect = (
    db
      .prepare("SELECT COUNT(*) as cnt FROM user_answers WHERE user_id = ? AND mission_mode = 'fake_inbox' AND is_correct = 1")
      .get(userId) as { cnt: number }
  ).cnt;

  const detectiveCorrect = (
    db
      .prepare("SELECT COUNT(*) as cnt FROM user_answers WHERE user_id = ? AND mission_mode = 'digital_detective' AND is_correct = 1")
      .get(userId) as { cnt: number }
  ).cnt;

  const challengeBest = (
    db
      .prepare('SELECT COALESCE(MAX(correct_count), 0) as best FROM challenge_runs WHERE user_id = ?')
      .get(userId) as { best: number }
  ).best;

  const modulesDone = (
    db
      .prepare('SELECT COUNT(*) as cnt FROM learning_progress WHERE user_id = ? AND completed = 1')
      .get(userId) as { cnt: number }
  ).cnt;

  const totalPoints = (
    db
      .prepare('SELECT total_points FROM user_profiles WHERE user_id = ?')
      .get(userId) as { total_points: number } | undefined
  )?.total_points ?? 0;

  const allBadges = db
    .prepare('SELECT id, slug, name, criteria_type, criteria_threshold FROM achievements')
    .all() as Array<{
    id: number;
    slug: string;
    name: string;
    criteria_type: string;
    criteria_threshold: number;
  }>;

  const newlyEarned: Array<{ slug: string; name: string }> = [];

  for (const badge of allBadges) {
    let qualified = false;
    if (badge.criteria_type === 'fake_inbox_correct' && inboxCorrect >= badge.criteria_threshold) {
      qualified = true;
    } else if (badge.criteria_type === 'detective_cases' && detectiveCorrect >= badge.criteria_threshold) {
      qualified = true;
    } else if (badge.criteria_type === 'challenge_correct' && challengeBest >= badge.criteria_threshold) {
      qualified = true;
    } else if (badge.criteria_type === 'learning_modules' && modulesDone >= badge.criteria_threshold) {
      qualified = true;
    } else if (badge.criteria_type === 'total_points' && totalPoints >= badge.criteria_threshold) {
      qualified = true;
    }

    if (qualified) {
      const existing = db
        .prepare('SELECT 1 FROM user_achievements WHERE user_id = ? AND achievement_id = ?')
        .get(userId, badge.id);
      if (!existing) {
        db.prepare('INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)').run(userId, badge.id);
        newlyEarned.push({ slug: badge.slug, name: badge.name });
      }
    }
  }

  return newlyEarned;
}
