import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import {
  db,
  initSchema,
  awardUserPoints,
  evaluateAndAwardBadges,
} from './src/server/db.ts';
import { seedDatabase } from './src/server/seed.ts';
import {
  attachOptionalAuth,
  clearSessionCookie,
  createRateLimiter,
  createSession,
  extractSessionToken,
  hashPassword,
  hashToken,
  normalizePhoneNumber,
  requireAdmin,
  requireAuth,
  setSessionCookie,
  validateEvidenceImage,
  verifyPassword,
} from './src/server/security.ts';
import type { AuthedRequest } from './src/server/security.ts';
import { askCyberCoach, convertCoachText } from './src/server/geminiCoach.ts';
import type {
  ConsequencePayload,
  DigitalDetectivePayload,
  FakeInboxPayload,
  LearningQuizQuestion,
  TimedChallengePayload,
} from './src/types/scamverse.ts';

initSchema();
seedDatabase();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.set('trust proxy', 1);
app.use(express.json({ limit: '3mb' }));

// Rate limiters
const authLimiter = createRateLimiter('auth', 20, 15 * 60 * 1000);
const reportLimiter = createRateLimiter('report', 12, 60 * 60 * 1000);
const coachLimiter = createRateLimiter('coach', 30, 10 * 60 * 1000);

// CSRF / custom header check for state-changing requests authenticated via cookie
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const authHeader = req.headers.authorization;
    const hasCookie = Boolean(req.headers.cookie);
    if (hasCookie && !authHeader) {
      const requestedWith = req.headers['x-requested-with'];
      const origin = req.headers.origin;
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const originMatchesHost =
        typeof origin === 'string' && typeof host === 'string' && origin.includes(host);
      if (requestedWith !== 'XMLHttpRequest' && !originMatchesHost) {
        res.status(403).json({ error: 'Invalid request origin header.' });
        return;
      }
    }
  }
  next();
});

// ==================== PUBLIC LANDING STATS ====================
app.get('/api/public/stats', (_req, res) => {
  const scenarioCount = (db.prepare('SELECT COUNT(*) as cnt FROM scenarios').get() as { cnt: number }).cnt;
  const moduleCount = (db.prepare('SELECT COUNT(*) as cnt FROM learning_modules').get() as { cnt: number }).cnt;
  const reportCount = (
    db
      .prepare("SELECT COUNT(*) as cnt FROM suspicious_number_reports WHERE moderation_status != 'rejected'")
      .get() as { cnt: number }
  ).cnt;
  const userCount = (db.prepare('SELECT COUNT(*) as cnt FROM users WHERE is_demo = 0').get() as { cnt: number }).cnt;

  res.json({
    scenarioCount,
    moduleCount,
    reportCount,
    userCount,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
  });
});

// ==================== AUTHENTICATION ====================
app.post('/api/auth/register', authLimiter, (req, res) => {
  try {
    const fullName = typeof req.body.fullName === 'string' ? req.body.fullName.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const confirmPassword = typeof req.body.confirmPassword === 'string' ? req.body.confirmPassword : '';

    if (fullName.length < 2 || fullName.length > 80) {
      res.status(400).json({ error: 'Full name must be between 2 and 80 characters.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (password.length < 8 || password.length > 100) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }
    if (password !== confirmPassword) {
      res.status(400).json({ error: 'Password and confirmation do not match.' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = hashPassword(password);
    const result = db
      .prepare("INSERT INTO users (email, full_name, password_hash, role, is_demo) VALUES (?, ?, ?, 'user', 0)")
      .run(email, fullName, passwordHash);

    const userId = Number(result.lastInsertRowid);
    const displayName = fullName.split(' ')[0] || fullName;
    const today = new Date().toISOString().slice(0, 10);

    db.prepare(`
      INSERT INTO user_profiles (user_id, display_name, level, total_points, streak_days, last_active_date, preferred_language, bio)
      VALUES (?, ?, 1, 0, 1, ?, 'en', 'Digital Trust Learner')
    `).run(userId, displayName, today);

    const { token } = createSession(userId);
    setSessionCookie(res, req, token);

    const user = {
      id: userId,
      email,
      fullName,
      displayName,
      role: 'user' as const,
      isDemo: false,
      avatarUrl: null,
      level: 1,
      totalPoints: 0,
      streakDays: 1,
      preferredLanguage: 'en' as const,
      bio: 'Digital Trust Learner',
    };

    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Could not complete registration. Please try again.' });
  }
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const row = db
      .prepare(`
        SELECT u.id, u.email, u.full_name, u.password_hash, u.role, u.is_demo,
               p.display_name, p.avatar_url, p.level, p.total_points, p.streak_days,
               p.preferred_language, p.bio
        FROM users u
        JOIN user_profiles p ON p.user_id = u.id
        WHERE u.email = ?
      `)
      .get(email) as
      | {
          id: number;
          email: string;
          full_name: string;
          password_hash: string;
          role: 'user' | 'admin';
          is_demo: number;
          display_name: string;
          avatar_url: string | null;
          level: number;
          total_points: number;
          streak_days: number;
          preferred_language: 'en' | 'ur';
          bio: string;
        }
      | undefined;

    if (!row || !verifyPassword(password, row.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const { token } = createSession(row.id);
    setSessionCookie(res, req, token);

    res.json({
      token,
      user: {
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        displayName: row.display_name,
        role: row.role,
        isDemo: row.is_demo === 1,
        avatarUrl: row.avatar_url,
        level: row.level,
        totalPoints: row.total_points,
        streakDays: row.streak_days,
        preferredLanguage: row.preferred_language,
        bio: row.bio,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed due to a server error.' });
  }
});

app.post('/api/auth/demo', (_req, res) => {
  try {
    const demoEmail = `guest-${crypto.randomBytes(4).toString('hex')}@scamverse.local`;
    const passwordHash = hashPassword(crypto.randomBytes(16).toString('hex'));
    const result = db
      .prepare("INSERT INTO users (email, full_name, password_hash, role, is_demo) VALUES (?, 'Guest Analyst', ?, 'user', 1)")
      .run(demoEmail, passwordHash);

    const userId = Number(result.lastInsertRowid);
    const today = new Date().toISOString().slice(0, 10);

    db.prepare(`
      INSERT INTO user_profiles (user_id, display_name, level, total_points, streak_days, last_active_date, preferred_language, bio)
      VALUES (?, 'Guest Analyst', 1, 0, 1, ?, 'en', 'Interactive Guest Learner')
    `).run(userId, today);

    const { token } = createSession(userId);
    setSessionCookie(res, _req, token);

    res.json({
      token,
      user: {
        id: userId,
        email: demoEmail,
        fullName: 'Guest Analyst',
        displayName: 'Guest Analyst',
        role: 'user' as const,
        isDemo: true,
        avatarUrl: null,
        level: 1,
        totalPoints: 0,
        streakDays: 1,
        preferredLanguage: 'en' as const,
        bio: 'Interactive Guest Learner',
      },
    });
  } catch (err) {
    console.error('Guest session error:', err);
    res.status(500).json({ error: 'Could not start Guest Analyst session.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const token = extractSessionToken(req);
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  }
  clearSessionCookie(res, req);
  res.json({ ok: true });
});

app.get('/api/auth/me', attachOptionalAuth, (req: AuthedRequest, res) => {
  res.json({ user: req.authUser || null });
});

app.post('/api/auth/forgot-password', authLimiter, (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }

  const user = db.prepare('SELECT id, is_demo FROM users WHERE email = ?').get(email) as
    | { id: number; is_demo: number }
    | undefined;

  if (!user || user.is_demo === 1) {
    // Do not leak account existence, but clearly state simulated reset status
    res.json({
      message:
        'If a registered account matches this email, a reset verification code is issued when email delivery is configured.',
      previewEmailConfigured: false,
    });
    return;
  }

  const code = String(crypto.randomInt(100000, 999999));
  const codeHash = hashToken(code);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  db.prepare('INSERT INTO password_resets (user_id, reset_code_hash, expires_at) VALUES (?, ?, ?)').run(
    user.id,
    codeHash,
    expiresAt
  );

  // Never expose reset code over API when pretending email sent; explicitly clarify preview limitation
  res.json({
    message:
      'Password reset request recorded. External email delivery (SMTP) is not configured in this local preview environment; contact your administrator or register a new account to continue testing.',
    previewEmailConfigured: false,
  });
});

app.post('/api/auth/reset-password', authLimiter, (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';
  const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';

  if (!email || !code || newPassword.length < 8) {
    res.status(400).json({ error: 'Valid email, 6-digit code, and 8+ character password required.' });
    return;
  }

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
  if (!user) {
    res.status(400).json({ error: 'Invalid or expired reset code.' });
    return;
  }

  const resetRow = db
    .prepare(
      'SELECT id, reset_code_hash, expires_at, used FROM password_resets WHERE user_id = ? ORDER BY id DESC LIMIT 1'
    )
    .get(user.id) as
    | { id: number; reset_code_hash: string; expires_at: string; used: number }
    | undefined;

  if (
    !resetRow ||
    resetRow.used === 1 ||
    new Date(resetRow.expires_at).getTime() < Date.now() ||
    resetRow.reset_code_hash !== hashToken(code)
  ) {
    res.status(400).json({ error: 'Invalid or expired reset code.' });
    return;
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), user.id);
  db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(resetRow.id);
  res.json({ message: 'Password updated successfully. You may now sign in.' });
});

app.patch('/api/profile', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const displayName =
    typeof req.body.displayName === 'string' ? req.body.displayName.trim().slice(0, 40) : req.authUser!.displayName;
  const bio = typeof req.body.bio === 'string' ? req.body.bio.trim().slice(0, 160) : req.authUser!.bio;
  const preferredLanguage = req.body.preferredLanguage === 'ur' ? 'ur' : 'en';
  const avatarUrl =
    typeof req.body.avatarUrl === 'string' && req.body.avatarUrl.startsWith('/src/assets/images/')
      ? req.body.avatarUrl
      : req.authUser!.avatarUrl;

  if (displayName.length < 2) {
    res.status(400).json({ error: 'Display name must be at least 2 characters.' });
    return;
  }

  db.prepare(`
    UPDATE user_profiles
    SET display_name = ?, bio = ?, preferred_language = ?, avatar_url = ?
    WHERE user_id = ?
  `).run(displayName, bio, preferredLanguage, avatarUrl, userId);

  res.json({
    user: {
      ...req.authUser!,
      displayName,
      bio,
      preferredLanguage,
      avatarUrl,
    },
  });
});

// ==================== MISSIONS & SIMULATIONS ====================
app.get('/api/missions', attachOptionalAuth, (req: AuthedRequest, res) => {
  const mode = typeof req.query.mode === 'string' ? req.query.mode : '';
  const validModes = ['fake_inbox', 'digital_detective', 'timed_challenge', 'consequence'];
  if (mode && !validModes.includes(mode)) {
    res.status(400).json({ error: 'Invalid mission mode.' });
    return;
  }

  const missions = mode
    ? db.prepare('SELECT * FROM missions WHERE mode = ? ORDER BY sort_order').all(mode)
    : db.prepare('SELECT * FROM missions ORDER BY sort_order').all();

  const scenariosRaw = mode
    ? db.prepare('SELECT * FROM scenarios WHERE mode = ? ORDER BY sort_order').all(mode)
    : db.prepare('SELECT * FROM scenarios ORDER BY sort_order').all();

  const answerMap = new Map<number, { is_correct: number }>();
  if (req.authUser) {
    const answers = db
      .prepare('SELECT scenario_id, is_correct FROM user_answers WHERE user_id = ?')
      .all(req.authUser.id) as Array<{ scenario_id: number; is_correct: number }>;
    for (const a of answers) {
      answerMap.set(a.scenario_id, a);
    }
  }

  const scenarios = (
    scenariosRaw as Array<{
      id: number;
      mission_id: number;
      mode: string;
      title: string;
      category: string;
      region_tag: string;
      payload_json: string;
    }>
  ).map((s) => {
    const userAns = answerMap.get(s.id);
    const parsed = JSON.parse(s.payload_json);
    return {
      id: s.id,
      missionId: s.mission_id,
      mode: s.mode,
      title: s.title,
      category: s.category,
      regionTag: s.region_tag,
      payload: parsed,
      completed: Boolean(userAns),
      wasCorrect: userAns ? userAns.is_correct === 1 : null,
    };
  });

  res.json({ missions, scenarios });
});

app.post('/api/missions/fake-inbox/answer', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const scenarioId = Number(req.body.scenarioId);
  const choice = req.body.choice; // 'scam' | 'safe' | 'not_sure'

  if (!Number.isInteger(scenarioId) || !['scam', 'safe', 'not_sure'].includes(choice)) {
    res.status(400).json({ error: 'Valid scenarioId and choice (scam, safe, not_sure) are required.' });
    return;
  }

  const row = db
    .prepare("SELECT id, payload_json FROM scenarios WHERE id = ? AND mode = 'fake_inbox'")
    .get(scenarioId) as { id: number; payload_json: string } | undefined;

  if (!row) {
    res.status(404).json({ error: 'Scenario not found.' });
    return;
  }

  const payload = JSON.parse(row.payload_json) as FakeInboxPayload;
  const isCorrect =
    (payload.isScam && choice === 'scam') || (!payload.isScam && choice === 'safe');

  const alreadyAnswered = db
    .prepare('SELECT id, points_awarded FROM user_answers WHERE user_id = ? AND scenario_id = ?')
    .get(userId, scenarioId) as { id: number; points_awarded: number } | undefined;

  let pointsAwarded = 0;
  let scoreState = {
    totalPoints: req.authUser!.totalPoints,
    level: req.authUser!.level,
    newlyEarnedBadges: [] as Array<{ slug: string; name: string }>,
  };

  if (!alreadyAnswered) {
    pointsAwarded = isCorrect ? 10 : choice === 'not_sure' ? 2 : 0;
    db.prepare(`
      INSERT INTO user_answers (user_id, scenario_id, mission_mode, selected_answer_json, is_correct, points_awarded)
      VALUES (?, ?, 'fake_inbox', ?, ?, ?)
    `).run(userId, scenarioId, JSON.stringify({ choice }), isCorrect ? 1 : 0, pointsAwarded);
    scoreState = awardUserPoints(userId, pointsAwarded, 1);
  }

  res.json({
    isCorrect,
    alreadyCompleted: Boolean(alreadyAnswered),
    pointsAwarded,
    expectedClassification: payload.isScam ? 'scam' : 'safe',
    suspiciousPhrases: payload.suspiciousPhrases,
    redFlags: payload.redFlags,
    safeResponse: payload.safeResponse,
    explanation: payload.explanation,
    ...scoreState,
  });
});

app.post('/api/missions/detective/answer', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const scenarioId = Number(req.body.scenarioId);
  const selectedClueIds: string[] = Array.isArray(req.body.selectedClueIds)
    ? req.body.selectedClueIds.filter((id: unknown): id is string => typeof id === 'string')
    : [];

  if (!Number.isInteger(scenarioId) || selectedClueIds.length === 0) {
    res.status(400).json({ error: 'Select at least one clue before submitting your investigation.' });
    return;
  }

  const row = db
    .prepare("SELECT id, payload_json FROM scenarios WHERE id = ? AND mode = 'digital_detective'")
    .get(scenarioId) as { id: number; payload_json: string } | undefined;

  if (!row) {
    res.status(404).json({ error: 'Investigation case not found.' });
    return;
  }

  const payload = JSON.parse(row.payload_json) as DigitalDetectivePayload;
  const trueFlagIds = new Set(payload.clues.filter((c) => c.isRedFlag).map((c) => c.id));
  const selectedUnique = Array.from(new Set(selectedClueIds));

  let correctFlags = 0;
  let falsePositives = 0;
  for (const id of selectedUnique) {
    if (trueFlagIds.has(id)) {
      correctFlags += 1;
    } else {
      falsePositives += 1;
    }
  }

  const isCorrect = correctFlags >= Math.max(2, trueFlagIds.size - 1) && falsePositives <= 1;
  const alreadyAnswered = db
    .prepare('SELECT id FROM user_answers WHERE user_id = ? AND scenario_id = ?')
    .get(userId, scenarioId);

  let pointsAwarded = 0;
  let scoreState = {
    totalPoints: req.authUser!.totalPoints,
    level: req.authUser!.level,
    newlyEarnedBadges: [] as Array<{ slug: string; name: string }>,
  };

  if (!alreadyAnswered) {
    pointsAwarded = Math.max(0, correctFlags * 5 - falsePositives * 2);
    db.prepare(`
      INSERT INTO user_answers (user_id, scenario_id, mission_mode, selected_answer_json, is_correct, points_awarded)
      VALUES (?, ?, 'digital_detective', ?, ?, ?)
    `).run(userId, scenarioId, JSON.stringify({ selectedClueIds: selectedUnique }), isCorrect ? 1 : 0, pointsAwarded);
    scoreState = awardUserPoints(userId, pointsAwarded, 1);
  }

  res.json({
    alreadyCompleted: Boolean(alreadyAnswered),
    correctFlags,
    totalRedFlags: trueFlagIds.size,
    falsePositives,
    isCorrect,
    pointsAwarded,
    clues: payload.clues,
    summaryExplanation: payload.summaryExplanation,
    safetyRecommendations: payload.safetyRecommendations,
    ...scoreState,
  });
});

app.post('/api/missions/consequence/answer', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const scenarioId = Number(req.body.scenarioId);
  const optionId = typeof req.body.optionId === 'string' ? req.body.optionId : '';

  if (!Number.isInteger(scenarioId) || !optionId) {
    res.status(400).json({ error: 'Scenario and selected option are required.' });
    return;
  }

  const row = db
    .prepare("SELECT id, payload_json FROM scenarios WHERE id = ? AND mode = 'consequence'")
    .get(scenarioId) as { id: number; payload_json: string } | undefined;

  if (!row) {
    res.status(404).json({ error: 'Simulation scenario not found.' });
    return;
  }

  const payload = JSON.parse(row.payload_json) as ConsequencePayload;
  const chosen = payload.options.find((o) => o.id === optionId);
  if (!chosen) {
    res.status(400).json({ error: 'Selected option does not exist for this scenario.' });
    return;
  }

  const isCorrect = chosen.outcomeType === 'safe';
  const alreadyAnswered = db
    .prepare('SELECT id FROM user_answers WHERE user_id = ? AND scenario_id = ?')
    .get(userId, scenarioId);

  let pointsAwarded = 0;
  let scoreState = {
    totalPoints: req.authUser!.totalPoints,
    level: req.authUser!.level,
    newlyEarnedBadges: [] as Array<{ slug: string; name: string }>,
  };

  if (!alreadyAnswered) {
    pointsAwarded = Math.max(0, chosen.pointsDelta);
    db.prepare(`
      INSERT INTO user_answers (user_id, scenario_id, mission_mode, selected_answer_json, is_correct, points_awarded)
      VALUES (?, ?, 'consequence', ?, ?, ?)
    `).run(userId, scenarioId, JSON.stringify({ optionId }), isCorrect ? 1 : 0, pointsAwarded);
    scoreState = awardUserPoints(userId, pointsAwarded, 1);
  }

  const safestOption = payload.options.find((o) => o.id === payload.safestOptionId);

  res.json({
    alreadyCompleted: Boolean(alreadyAnswered),
    chosenOption: chosen,
    safestOption,
    debrief: payload.debrief,
    pointsAwarded,
    isCorrect,
    ...scoreState,
  });
});

app.post('/api/missions/timed-challenge/submit', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];

  if (answers.length === 0 || answers.length > 30) {
    res.status(400).json({ error: 'Invalid challenge submission.' });
    return;
  }

  const scenarioRows = db
    .prepare("SELECT id, payload_json FROM scenarios WHERE mode = 'timed_challenge'")
    .all() as Array<{ id: number; payload_json: string }>;
  const truthMap = new Map<number, TimedChallengePayload>();
  for (const r of scenarioRows) {
    truthMap.set(r.id, JSON.parse(r.payload_json) as TimedChallengePayload);
  }

  let correctCount = 0;
  let totalAnswered = 0;
  const seen = new Set<number>();

  for (const item of answers) {
    const sid = Number(item?.scenarioId);
    const chosenScam = item?.choice;
    if (!Number.isInteger(sid) || typeof chosenScam !== 'boolean' || seen.has(sid)) continue;
    const truth = truthMap.get(sid);
    if (!truth) continue;
    seen.add(sid);
    totalAnswered += 1;
    if (truth.isScam === chosenScam) {
      correctCount += 1;
    }
  }

  const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
  const rating =
    accuracy >= 90 && correctCount >= 7
      ? 'Master Cyber Analyst'
      : accuracy >= 75 && correctCount >= 5
      ? 'Cyber Sentinel'
      : accuracy >= 55
      ? 'Alert Defender'
      : 'Trust Novice';

  // Anti-farming: cap timed challenge point awards to max 3 rewarded runs per day
  const today = new Date().toISOString().slice(0, 10);
  const todaysRuns = (
    db
      .prepare("SELECT COUNT(*) as cnt FROM challenge_runs WHERE user_id = ? AND date(created_at) = ?")
      .get(userId, today) as { cnt: number }
  ).cnt;

  const rawPoints = correctCount * 3 + (accuracy >= 80 && correctCount >= 5 ? 10 : 0);
  const pointsEarned = todaysRuns < 3 ? rawPoints : 0;

  db.prepare(`
    INSERT INTO challenge_runs (user_id, total_answered, correct_count, accuracy, points_earned, rating)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, totalAnswered, correctCount, accuracy, pointsEarned, rating);

  const scoreState = awardUserPoints(userId, pointsEarned, pointsEarned > 0 ? 1 : 0);

  res.json({
    totalAnswered,
    correctCount,
    accuracy,
    pointsEarned,
    dailyCapReached: todaysRuns >= 3,
    rating,
    ...scoreState,
  });
});

// ==================== NUMBERGUARD ====================
app.get('/api/numberguard/categories', (_req, res) => {
  const categories = db.prepare('SELECT id, slug, label FROM report_categories ORDER BY id').all();
  res.json({ categories });
});

app.get('/api/numberguard/recent', (_req, res) => {
  const rows = db
    .prepare(`
      SELECT r.normalized_phone, r.display_phone, COUNT(*) as report_count,
             MAX(r.incident_date) as latest_incident,
             MAX(CASE WHEN r.moderation_status = 'moderated_report' THEN 2 WHEN r.moderation_status = 'under_review' THEN 1 ELSE 0 END) as status_rank,
             MAX(r.is_sample) as is_sample,
             GROUP_CONCAT(DISTINCT c.label) as categories
      FROM suspicious_number_reports r
      JOIN report_categories c ON c.slug = r.category_slug
      WHERE r.moderation_status != 'rejected'
      GROUP BY r.normalized_phone
      ORDER BY MAX(r.created_at) DESC
      LIMIT 10
    `)
    .all() as Array<{
    normalized_phone: string;
    display_phone: string;
    report_count: number;
    latest_incident: string;
    status_rank: number;
    is_sample: number;
    categories: string;
  }>;

  res.json({
    summaries: rows.map((r) => ({
      normalizedPhone: r.normalized_phone,
      displayPhone: r.display_phone,
      reportCount: r.report_count,
      latestIncident: r.latest_incident,
      statusLabel: r.status_rank === 2 ? 'Moderated report' : 'Under review',
      isSample: r.is_sample === 1,
      categories: r.categories ? r.categories.split(',') : [],
    })),
  });
});

app.get('/api/numberguard/search', (req, res) => {
  const countryCodeRaw = typeof req.query.countryCode === 'string' ? req.query.countryCode : '+92';
  const phoneRaw = typeof req.query.phone === 'string' ? req.query.phone : '';

  const parsed = normalizePhoneNumber(countryCodeRaw, phoneRaw);
  if (!parsed.valid) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  // Never expose private evidence or reporter user identity
  const rows = db
    .prepare(`
      SELECT r.id, r.reference_code, r.category_slug, c.label as category_label,
             r.description, r.incident_date, r.moderation_status, r.flag_count,
             r.is_sample, r.created_at
      FROM suspicious_number_reports r
      JOIN report_categories c ON c.slug = r.category_slug
      WHERE r.normalized_phone = ? AND r.moderation_status != 'rejected'
      ORDER BY r.created_at DESC
    `)
    .all(parsed.normalized) as Array<{
    id: number;
    reference_code: string;
    category_slug: string;
    category_label: string;
    description: string;
    incident_date: string;
    moderation_status: string;
    flag_count: number;
    is_sample: number;
    created_at: string;
  }>;

  const categoryCountMap = new Map<string, { slug: string; label: string; count: number }>();
  for (const r of rows) {
    const cur = categoryCountMap.get(r.category_slug) || {
      slug: r.category_slug,
      label: r.category_label,
      count: 0,
    };
    cur.count += 1;
    categoryCountMap.set(r.category_slug, cur);
  }

  const hasModerated = rows.some((r) => r.moderation_status === 'moderated_report');
  const hasUnderReview = rows.some((r) => r.moderation_status === 'under_review');

  const status =
    rows.length === 0
      ? 'no_reports'
      : hasModerated
      ? 'moderated_report'
      : hasUnderReview
      ? 'under_review'
      : 'community_reports_submitted';

  const statusLabel =
    status === 'no_reports'
      ? 'No community reports found'
      : status === 'moderated_report'
      ? 'Moderated community report'
      : status === 'under_review'
      ? 'Community reports submitted — Under review'
      : 'Community reports submitted';

  res.json({
    normalizedPhone: parsed.normalized,
    displayPhone: parsed.displayPhone,
    totalReports: rows.length,
    status,
    statusLabel,
    mostRecentReportDate: rows[0]?.incident_date || null,
    categories: Array.from(categoryCountMap.values()),
    reports: rows.map((r) => ({
      id: r.id,
      referenceCode: r.reference_code,
      categorySlug: r.category_slug,
      categoryLabel: r.category_label,
      description: r.description,
      incidentDate: r.incident_date,
      moderationStatus: r.moderation_status,
      flagCount: r.flag_count,
      isSample: r.is_sample === 1,
      createdAt: r.created_at,
    })),
    recommendations: [
      'Never share OTPs, ATM PINs, or mobile wallet MPINs with any caller.',
      'Caller IDs and phone numbers can be spoofed, reassigned, or shared—verify through official bank or company helplines.',
      'Do not send advance processing fees to personal numbers or unverified payment links.',
    ],
    disclaimer:
      'NumberGuard summaries reflect unverified user-submitted allegations for awareness only, not proof of guilt or criminal liability. Phone numbers can be spoofed or reassigned over time.',
  });
});

app.post('/api/numberguard/report', requireAuth, reportLimiter, (req: AuthedRequest, res) => {
  try {
    const countryCodeRaw = typeof req.body.countryCode === 'string' ? req.body.countryCode : '+92';
    const phoneRaw = typeof req.body.phone === 'string' ? req.body.phone : '';
    const categorySlug = typeof req.body.categorySlug === 'string' ? req.body.categorySlug : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const incidentDate = typeof req.body.incidentDate === 'string' ? req.body.incidentDate : '';

    const parsedPhone = normalizePhoneNumber(countryCodeRaw, phoneRaw);
    if (!parsedPhone.valid) {
      res.status(400).json({ error: parsedPhone.error });
      return;
    }

    const cat = db.prepare('SELECT slug FROM report_categories WHERE slug = ?').get(categorySlug);
    if (!cat) {
      res.status(400).json({ error: 'Select a valid scam category.' });
      return;
    }

    if (description.length < 15 || description.length > 800) {
      res.status(400).json({ error: 'Description must be between 15 and 800 characters.' });
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(incidentDate)) {
      res.status(400).json({ error: 'Please select a valid incident date (YYYY-MM-DD).' });
      return;
    }

    const evidenceCheck = validateEvidenceImage(req.body.evidenceDataUrl);
    if (!evidenceCheck.valid) {
      res.status(400).json({ error: evidenceCheck.error });
      return;
    }

    const evidenceFilename =
      evidenceCheck.sanitized && typeof req.body.evidenceFilename === 'string'
        ? req.body.evidenceFilename.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 60)
        : null;

    const referenceCode = `NG-${new Date().getFullYear()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}${crypto.randomInt(10, 99)}`;

    const insertRes = db
      .prepare(`
        INSERT INTO suspicious_number_reports (
          reference_code, normalized_phone, country_code, display_phone,
          category_slug, description, incident_date, evidence_filename,
          evidence_data_private, reporter_user_id, moderation_status, is_sample
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'under_review', 0)
      `)
      .run(
        referenceCode,
        parsedPhone.normalized,
        parsedPhone.countryCode,
        parsedPhone.displayPhone,
        categorySlug,
        description,
        incidentDate,
        evidenceFilename,
        evidenceCheck.sanitized,
        req.authUser!.id
      );

    res.status(201).json({
      id: Number(insertRes.lastInsertRowid),
      referenceCode,
      normalizedPhone: parsedPhone.normalized,
      displayPhone: parsedPhone.displayPhone,
      moderationStatus: 'under_review',
      message: 'Report submitted safely for moderation review. Private evidence attachments are never displayed publicly.',
    });
  } catch (err) {
    console.error('Report submission error:', err);
    res.status(500).json({ error: 'Could not save report. Please try again.' });
  }
});

app.post('/api/numberguard/reports/:id/flag', requireAuth, reportLimiter, (req: AuthedRequest, res) => {
  const reportId = Number(req.params.id);
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';

  if (!Number.isInteger(reportId) || reason.length < 5 || reason.length > 300) {
    res.status(400).json({ error: 'Provide a clear reason (5–300 characters) to flag a report.' });
    return;
  }

  const report = db.prepare('SELECT id FROM suspicious_number_reports WHERE id = ?').get(reportId);
  if (!report) {
    res.status(404).json({ error: 'Report not found.' });
    return;
  }

  db.prepare('INSERT INTO report_flags (report_id, flagger_user_id, reason) VALUES (?, ?, ?)').run(
    reportId,
    req.authUser!.id,
    reason
  );
  db.prepare("UPDATE suspicious_number_reports SET flag_count = flag_count + 1, updated_at = datetime('now') WHERE id = ?").run(
    reportId
  );

  res.json({ ok: true, message: 'Report flagged for moderator inspection.' });
});

// ==================== AI CYBER COACH ====================
app.get('/api/coach/history', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const session = db
    .prepare('SELECT id, language FROM chat_sessions WHERE user_id = ? ORDER BY id DESC LIMIT 1')
    .get(userId) as { id: number; language: 'en' | 'ur' } | undefined;

  if (!session) {
    res.json({ messages: [], language: req.authUser!.preferredLanguage });
    return;
  }

  const messages = db
    .prepare('SELECT id, role, content, source_mode as sourceMode, created_at as createdAt FROM chat_messages WHERE session_id = ? ORDER BY id ASC')
    .all(session.id);

  res.json({ messages, language: session.language });
});

app.post('/api/coach/ask', requireAuth, coachLimiter, async (req: AuthedRequest, res) => {
  try {
    const userId = req.authUser!.id;
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    const language = req.body.language === 'ur' ? 'ur' : 'en';

    if (message.length < 2 || message.length > 1500) {
      res.status(400).json({ error: 'Please enter a question between 2 and 1500 characters.' });
      return;
    }

    let session = db
      .prepare('SELECT id FROM chat_sessions WHERE user_id = ? ORDER BY id DESC LIMIT 1')
      .get(userId) as { id: number } | undefined;

    if (!session) {
      const created = db
        .prepare("INSERT INTO chat_sessions (user_id, title, language) VALUES (?, 'Cyber Coach Session', ?)")
        .run(userId, language);
      session = { id: Number(created.lastInsertRowid) };
    } else {
      db.prepare('UPDATE chat_sessions SET language = ? WHERE id = ?').run(language, session.id);
    }

    const history = db
      .prepare('SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY id ASC')
      .all(session.id) as Array<{ role: 'user' | 'assistant'; content: string }>;

    db.prepare("INSERT INTO chat_messages (session_id, role, content, source_mode) VALUES (?, 'user', ?, 'user')").run(
      session.id,
      message
    );

    const coachResult = await askCyberCoach({ message, language, history });

    const assistantInsert = db
      .prepare("INSERT INTO chat_messages (session_id, role, content, source_mode) VALUES (?, 'assistant', ?, ?)")
      .run(session.id, coachResult.reply, coachResult.sourceMode);

    res.json({
      id: Number(assistantInsert.lastInsertRowid),
      reply: coachResult.reply,
      sourceMode: coachResult.sourceMode,
      isLiveAI: coachResult.sourceMode === 'live_gemini',
      fallbackReason: coachResult.fallbackReason || null,
    });
  } catch (err) {
    console.error('Coach error:', err);
    res.status(500).json({ error: 'Cyber Coach encountered an error processing your request.' });
  }
});

app.post('/api/coach/ask-public', coachLimiter, async (req, res) => {
  try {
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    const language = req.body.language === 'ur' ? 'ur' : 'en';
    const rawHistory = Array.isArray(req.body.history) ? req.body.history : [];

    if (message.length < 2 || message.length > 1200) {
      res.status(400).json({ error: 'Please enter a question between 2 and 1200 characters.' });
      return;
    }

    const history = rawHistory
      .slice(-6)
      .filter(
        (item: unknown): item is { role: 'user' | 'assistant'; content: string } =>
          Boolean(
            item &&
              typeof item === 'object' &&
              ((item as { role?: unknown }).role === 'user' ||
                (item as { role?: unknown }).role === 'assistant') &&
              typeof (item as { content?: unknown }).content === 'string'
          )
      );

    const coachResult = await askCyberCoach({ message, language, history });

    res.json({
      reply: coachResult.reply,
      sourceMode: coachResult.sourceMode,
      isLiveAI: coachResult.sourceMode === 'live_gemini',
      fallbackReason: coachResult.fallbackReason || null,
    });
  } catch (err) {
    console.error('Public coach error:', err);
    res.status(500).json({ error: 'Cyber Coach could not process your question right now.' });
  }
});

app.post('/api/coach/convert', coachLimiter, async (req, res) => {
  try {
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    const targetLanguage = req.body.targetLanguage === 'ur' ? 'ur' : 'en';

    if (text.length < 1 || text.length > 1500) {
      res.status(400).json({ error: 'Enter 1 to 1500 characters to convert.' });
      return;
    }

    const result = await convertCoachText({ text, targetLanguage });
    res.json(result);
  } catch (err) {
    console.error('Coach convert error:', err);
    res.status(500).json({ error: 'Unable to convert text right now.' });
  }
});

app.delete('/api/coach/history', requireAuth, (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM chat_sessions WHERE user_id = ?').run(req.authUser!.id);
  res.json({ ok: true });
});

// ==================== LEARNING CENTRE ====================
app.get('/api/learn/modules', attachOptionalAuth, (req: AuthedRequest, res) => {
  const rows = db.prepare('SELECT * FROM learning_modules ORDER BY sort_order ASC').all() as Array<{
    id: number;
    slug: string;
    title: string;
    title_ur: string;
    summary: string;
    summary_ur: string;
    content_json: string;
    points_reward: number;
  }>;

  const progressMap = new Map<number, { completed: number; quiz_score: number }>();
  if (req.authUser) {
    const progressRows = db
      .prepare('SELECT module_id, completed, quiz_score FROM learning_progress WHERE user_id = ?')
      .all(req.authUser.id) as Array<{ module_id: number; completed: number; quiz_score: number }>;
    for (const p of progressRows) {
      progressMap.set(p.module_id, p);
    }
  }

  res.json({
    modules: rows.map((m) => {
      const p = progressMap.get(m.id);
      return {
        id: m.id,
        slug: m.slug,
        title: m.title,
        titleUr: m.title_ur,
        summary: m.summary,
        summaryUr: m.summary_ur,
        pointsReward: m.points_reward,
        completed: p ? p.completed === 1 : false,
        quizScore: p ? p.quiz_score : null,
        content: JSON.parse(m.content_json),
      };
    }),
  });
});

app.post('/api/learn/modules/:id/submit', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const moduleId = Number(req.params.id);
  const selectedIndices = Array.isArray(req.body.answers) ? req.body.answers : [];

  const mod = db
    .prepare('SELECT id, content_json, points_reward FROM learning_modules WHERE id = ?')
    .get(moduleId) as { id: number; content_json: string; points_reward: number } | undefined;

  if (!mod) {
    res.status(404).json({ error: 'Learning module not found.' });
    return;
  }

  const content = JSON.parse(mod.content_json) as { quiz: LearningQuizQuestion[] };
  if (selectedIndices.length !== content.quiz.length) {
    res.status(400).json({ error: 'Please answer every quiz question before submitting.' });
    return;
  }

  let correctCount = 0;
  const questionResults = content.quiz.map((q, idx) => {
    const chosen = Number(selectedIndices[idx]);
    const isCorrect = chosen === q.correctIndex;
    if (isCorrect) correctCount += 1;
    return {
      id: q.id,
      isCorrect,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      explanationUr: q.explanationUr,
    };
  });

  const passed = correctCount >= Math.ceil(content.quiz.length / 2);
  const existing = db
    .prepare('SELECT completed FROM learning_progress WHERE user_id = ? AND module_id = ?')
    .get(userId, moduleId) as { completed: number } | undefined;

  let pointsAwarded = 0;
  let scoreState = {
    totalPoints: req.authUser!.totalPoints,
    level: req.authUser!.level,
    newlyEarnedBadges: [] as Array<{ slug: string; name: string }>,
  };

  if (passed && (!existing || existing.completed === 0)) {
    pointsAwarded = mod.points_reward;
    db.prepare(`
      INSERT INTO learning_progress (user_id, module_id, quiz_score, completed)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(user_id, module_id) DO UPDATE SET quiz_score = excluded.quiz_score, completed = 1, completed_at = datetime('now')
    `).run(userId, moduleId, correctCount);
    scoreState = awardUserPoints(userId, pointsAwarded, 1);
  } else if (!existing) {
    db.prepare(`
      INSERT INTO learning_progress (user_id, module_id, quiz_score, completed)
      VALUES (?, ?, ?, 0)
    `).run(userId, moduleId, correctCount);
  }

  res.json({
    correctCount,
    totalQuestions: content.quiz.length,
    passed,
    alreadyCompleted: Boolean(existing && existing.completed === 1),
    pointsAwarded,
    questionResults,
    ...scoreState,
  });
});

// ==================== DASHBOARD, ACHIEVEMENTS & LEADERBOARD ====================
const DAILY_TIPS = [
  {
    title: 'Never Enter Your PIN to Receive Funds',
    body: 'On JazzCash, Easypaisa, or banking apps, entering a PIN or scanning a payment QR only authorizes outgoing transfers—never incoming payouts.',
    category: 'Digital Payments',
  },
  {
    title: 'Read Domains Right-to-Left Before the First Slash',
    body: 'In "https://bank-pk.verify-login.invalid/home", the real site owner is "verify-login.invalid", not the bank name.',
    category: 'Phishing Defense',
  },
  {
    title: 'Pause Before Acting on 2-Hour Deadlines',
    body: 'Urgency is a deliberate psychological trigger used to prevent you from calling an official helpline or consulting a friend.',
    category: 'Social Engineering',
  },
];

app.get('/api/progress/dashboard', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  evaluateAndAwardBadges(userId);

  const profileRow = db
    .prepare(`
      SELECT u.id, u.email, u.full_name, u.role, u.is_demo,
             p.display_name, p.avatar_url, p.level, p.total_points, p.streak_days,
             p.preferred_language, p.bio
      FROM users u JOIN user_profiles p ON p.user_id = u.id WHERE u.id = ?
    `)
    .get(userId) as {
    id: number;
    email: string;
    full_name: string;
    role: 'user' | 'admin';
    is_demo: number;
    display_name: string;
    avatar_url: string | null;
    level: number;
    total_points: number;
    streak_days: number;
    preferred_language: 'en' | 'ur';
    bio: string;
  };

  const completedMissions = (
    db.prepare('SELECT COUNT(*) as cnt FROM user_answers WHERE user_id = ?').get(userId) as { cnt: number }
  ).cnt;
  const correctMissions = (
    db.prepare('SELECT COUNT(*) as cnt FROM user_answers WHERE user_id = ? AND is_correct = 1').get(userId) as { cnt: number }
  ).cnt;
  const totalAvailableScenarios = (
    db.prepare("SELECT COUNT(*) as cnt FROM scenarios WHERE mode != 'timed_challenge'").get() as { cnt: number }
  ).cnt;

  const completedModules = (
    db.prepare('SELECT COUNT(*) as cnt FROM learning_progress WHERE user_id = ? AND completed = 1').get(userId) as { cnt: number }
  ).cnt;
  const totalModules = (db.prepare('SELECT COUNT(*) as cnt FROM learning_modules').get() as { cnt: number }).cnt;

  const accuracyPercent = completedMissions > 0 ? Math.round((correctMissions / completedMissions) * 100) : 0;

  // Build last 7 days chart series from daily_activity
  const activityRows = db
    .prepare('SELECT activity_date, points_earned, missions_completed FROM daily_activity WHERE user_id = ?')
    .all(userId) as Array<{ activity_date: string; points_earned: number; missions_completed: number }>;
  const actMap = new Map(activityRows.map((a) => [a.activity_date, a]));

  const weeklyProgress: Array<{ date: string; label: string; points: number; missions: number }> = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86400000);
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    const found = actMap.get(iso);
    weeklyProgress.push({
      date: iso,
      label,
      points: found ? found.points_earned : 0,
      missions: found ? found.missions_completed : 0,
    });
  }

  const badges = db
    .prepare(`
      SELECT a.id, a.slug, a.name, a.description, a.criteria_type as criteriaType,
             a.criteria_threshold as criteriaThreshold, a.icon_key as iconKey,
             ua.awarded_at as awardedAt
      FROM achievements a
      LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = ?
      ORDER BY a.id ASC
    `)
    .all(userId) as Array<{
    id: number;
    slug: string;
    name: string;
    description: string;
    criteriaType: string;
    criteriaThreshold: number;
    iconKey: string;
    awardedAt: string | null;
  }>;

  const recentAnswers = db
    .prepare(`
      SELECT ua.id, s.title, ua.mission_mode, ua.points_awarded, ua.is_correct, ua.created_at
      FROM user_answers ua
      JOIN scenarios s ON s.id = ua.scenario_id
      WHERE ua.user_id = ?
      ORDER BY ua.id DESC LIMIT 6
    `)
    .all(userId) as Array<{
    id: number;
    title: string;
    mission_mode: string;
    points_awarded: number;
    is_correct: number;
    created_at: string;
  }>;

  const modeLabels: Record<string, string> = {
    fake_inbox: 'Fake Inbox',
    digital_detective: 'Digital Detective',
    consequence: 'Consequence Sim',
  };

  const dayIndex = new Date().getDate() % DAILY_TIPS.length;

  res.json({
    profile: {
      id: profileRow.id,
      email: profileRow.email,
      fullName: profileRow.full_name,
      displayName: profileRow.display_name,
      role: profileRow.role,
      isDemo: profileRow.is_demo === 1,
      avatarUrl: profileRow.avatar_url,
      level: profileRow.level,
      totalPoints: profileRow.total_points,
      streakDays: profileRow.streak_days,
      preferredLanguage: profileRow.preferred_language,
      bio: profileRow.bio,
    },
    stats: {
      totalPoints: profileRow.total_points,
      level: profileRow.level,
      nextLevelPoints: profileRow.level * 75,
      completedMissions,
      totalAvailableScenarios,
      accuracyPercent,
      streakDays: profileRow.streak_days,
      completedModules,
      totalModules,
    },
    weeklyProgress,
    badges: badges.map((b) => ({
      ...b,
      earned: Boolean(b.awardedAt),
    })),
    recentActivity: recentAnswers.map((a) => ({
      id: `ans-${a.id}`,
      title: a.title,
      modeLabel: modeLabels[a.mission_mode] || a.mission_mode,
      points: a.points_awarded,
      isCorrect: a.is_correct === 1,
      createdAt: a.created_at,
    })),
    dailyTip: DAILY_TIPS[dayIndex],
  });
});

app.get('/api/progress/leaderboard', attachOptionalAuth, (req: AuthedRequest, res) => {
  const period = req.query.period === 'weekly' ? 'weekly' : 'all';

  let realRows: Array<{
    userId: number;
    displayName: string;
    level: number;
    totalPoints: number;
    completedChallenges: number;
  }> = [];

  if (period === 'weekly') {
    const sevenDaysAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    realRows = db
      .prepare(`
        SELECT u.id as userId, p.display_name as displayName, p.level,
               COALESCE(SUM(da.points_earned), 0) as totalPoints,
               COALESCE(SUM(da.missions_completed), 0) as completedChallenges
        FROM users u
        JOIN user_profiles p ON p.user_id = u.id
        LEFT JOIN daily_activity da ON da.user_id = u.id AND da.activity_date >= ?
        WHERE u.is_demo = 0 OR u.id = ?
        GROUP BY u.id
        HAVING totalPoints > 0 OR u.id = ?
        ORDER BY totalPoints DESC
        LIMIT 20
      `)
      .all(sevenDaysAgo, req.authUser?.id ?? -1, req.authUser?.id ?? -1) as typeof realRows;
  } else {
    realRows = db
      .prepare(`
        SELECT u.id as userId, p.display_name as displayName, p.level, p.total_points as totalPoints,
               (SELECT COUNT(*) FROM user_answers ua WHERE ua.user_id = u.id) +
               (SELECT COUNT(*) FROM challenge_runs cr WHERE cr.user_id = u.id) as completedChallenges
        FROM users u
        JOIN user_profiles p ON p.user_id = u.id
        WHERE u.is_demo = 0 OR u.id = ?
        ORDER BY p.total_points DESC
        LIMIT 20
      `)
      .all(req.authUser?.id ?? -1) as typeof realRows;
  }

  const combined: Array<{
    displayName: string;
    level: number;
    totalPoints: number;
    completedChallenges: number;
    isCurrentUser: boolean;
    isSample: boolean;
  }> = realRows.map((r) => ({
    displayName: r.displayName,
    level: r.level,
    totalPoints: r.totalPoints,
    completedChallenges: r.completedChallenges,
    isCurrentUser: req.authUser ? r.userId === req.authUser.id : false,
    isSample: false,
  }));

  // Include clearly marked sample entries if fewer than 6 real learners exist
  if (combined.length < 6) {
    const samples = db
      .prepare('SELECT display_name as displayName, level, total_points as totalPoints, completed_challenges as completedChallenges FROM sample_leaderboard_entries ORDER BY total_points DESC')
      .all() as Array<{
      displayName: string;
      level: number;
      totalPoints: number;
      completedChallenges: number;
    }>;

    for (const s of samples) {
      combined.push({
        displayName: s.displayName,
        level: s.level,
        totalPoints: period === 'weekly' ? Math.round(s.totalPoints * 0.45) : s.totalPoints,
        completedChallenges: period === 'weekly' ? Math.max(1, Math.round(s.completedChallenges * 0.45)) : s.completedChallenges,
        isCurrentUser: false,
        isSample: true,
      });
    }
  }

  combined.sort((a, b) => b.totalPoints - a.totalPoints);

  res.json({
    period,
    entries: combined.slice(0, 15).map((entry, idx) => ({
      rank: idx + 1,
      ...entry,
    })),
  });
});

// ==================== ADMIN MODERATION ====================
function getAdminConfigPasscodeHash(): string | null {
  const row = db.prepare("SELECT value FROM admin_config WHERE key = 'admin_passcode_hash'").get() as
    | { value: string }
    | undefined;
  return row ? row.value : null;
}

app.get('/api/admin/status', attachOptionalAuth, (req: AuthedRequest, res) => {
  const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
  const claimedHash = getAdminConfigPasscodeHash();
  const envConfigured = envPasscode.length > 0;
  const requiresBootstrap = !envConfigured && !claimedHash;

  res.json({
    envConfigured,
    requiresBootstrap,
    isCurrentUserAdmin: req.authUser?.role === 'admin',
  });
});

app.post('/api/admin/bootstrap', requireAuth, authLimiter, (req: AuthedRequest, res) => {
  const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
  if (envPasscode.length > 0) {
    res.status(400).json({ error: 'Admin passcode is already managed via server environment.' });
    return;
  }
  const existingHash = getAdminConfigPasscodeHash();
  if (existingHash) {
    res.status(409).json({ error: 'Admin passcode has already been claimed.' });
    return;
  }

  const passcode = typeof req.body.passcode === 'string' ? req.body.passcode.trim() : '';
  if (passcode.length < 8 || passcode.length > 64) {
    res.status(400).json({ error: 'Choose an admin passcode of 8 to 64 characters.' });
    return;
  }

  // Atomic one-time claim
  const insertRes = db
    .prepare("INSERT OR IGNORE INTO admin_config (key, value) VALUES ('admin_passcode_hash', ?)")
    .run(hashPassword(passcode));

  if (insertRes.changes === 0) {
    res.status(409).json({ error: 'Admin passcode was already claimed.' });
    return;
  }

  db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(req.authUser!.id);
  res.json({ ok: true, message: 'Admin passcode configured and moderation access unlocked for this session.' });
});

app.post('/api/admin/unlock', requireAuth, authLimiter, (req: AuthedRequest, res) => {
  const passcode = typeof req.body.passcode === 'string' ? req.body.passcode.trim() : '';
  if (!passcode) {
    res.status(400).json({ error: 'Admin passcode is required.' });
    return;
  }

  const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
  let authorized = false;

  if (envPasscode.length > 0) {
    const a = Buffer.from(passcode);
    const b = Buffer.from(envPasscode);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      authorized = true;
    }
  } else {
    const claimedHash = getAdminConfigPasscodeHash();
    if (claimedHash && verifyPassword(passcode, claimedHash)) {
      authorized = true;
    }
  }

  if (!authorized) {
    res.status(403).json({ error: 'Invalid admin passcode.' });
    return;
  }

  db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(req.authUser!.id);
  res.json({ ok: true, message: 'Administrator moderation access verified.' });
});

app.get('/api/admin/reports', requireAdmin, (_req, res) => {
  const reports = db
    .prepare(`
      SELECT r.id, r.reference_code as referenceCode, r.normalized_phone as normalizedPhone,
             r.display_phone as displayPhone, r.category_slug as categorySlug,
             c.label as categoryLabel, r.description, r.incident_date as incidentDate,
             r.moderation_status as moderationStatus, r.moderation_note as moderationNote,
             r.flag_count as flagCount, r.is_sample as isSample,
             r.evidence_filename as evidenceFilename,
             (r.evidence_data_private IS NOT NULL) as hasEvidence,
             r.created_at as createdAt
      FROM suspicious_number_reports r
      JOIN report_categories c ON c.slug = r.category_slug
      ORDER BY r.flag_count DESC, r.created_at DESC
    `)
    .all();

  const metrics = {
    totalUsers: (db.prepare('SELECT COUNT(*) as cnt FROM users WHERE is_demo = 0').get() as { cnt: number }).cnt,
    totalAnswers: (db.prepare('SELECT COUNT(*) as cnt FROM user_answers').get() as { cnt: number }).cnt,
    pendingReports: (
      db.prepare("SELECT COUNT(*) as cnt FROM suspicious_number_reports WHERE moderation_status = 'under_review'").get() as {
        cnt: number;
      }
    ).cnt,
    flaggedReports: (
      db.prepare('SELECT COUNT(*) as cnt FROM suspicious_number_reports WHERE flag_count > 0').get() as { cnt: number }
    ).cnt,
  };

  res.json({ reports, metrics });
});

app.patch('/api/admin/reports/:id', requireAdmin, (req, res) => {
  const reportId = Number(req.params.id);
  const status = req.body.moderationStatus;
  const note = typeof req.body.moderationNote === 'string' ? req.body.moderationNote.trim().slice(0, 300) : '';

  if (!Number.isInteger(reportId) || !['under_review', 'moderated_report', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'Valid report ID and moderation status required.' });
    return;
  }

  const updateRes = db
    .prepare("UPDATE suspicious_number_reports SET moderation_status = ?, moderation_note = ?, updated_at = datetime('now') WHERE id = ?")
    .run(status, note, reportId);

  if (updateRes.changes === 0) {
    res.status(404).json({ error: 'Report not found.' });
    return;
  }

  res.json({ ok: true });
});

app.delete('/api/admin/reports/:id', requireAdmin, (req, res) => {
  const reportId = Number(req.params.id);
  if (!Number.isInteger(reportId)) {
    res.status(400).json({ error: 'Invalid report ID.' });
    return;
  }
  const del = db.prepare('DELETE FROM suspicious_number_reports WHERE id = ?').run(reportId);
  if (del.changes === 0) {
    res.status(404).json({ error: 'Report not found.' });
    return;
  }
  res.json({ ok: true });
});

// ==================== VITE / STATIC SERVING ====================
async function startServer() {
  const distDir = path.resolve(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distDir);

  if (isProd) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ScamVerse server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ScamVerse server:', err);
  process.exit(1);
});
