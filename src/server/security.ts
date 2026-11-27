import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db.ts';
import type { AuthUser, UserRole } from '../types/scamverse.ts';

export const SESSION_COOKIE_NAME = 'sv_session';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSession(userId: number): { token: string; expiresAt: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
    tokenHash,
    userId,
    expiresAt
  );
  return { token, expiresAt };
}

export function setSessionCookie(res: Response, req: Request, token: string): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${7 * 24 * 60 * 60}`,
  ];
  if (isHttps) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res: Response, req: Request): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const parts = [`${SESSION_COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'Max-Age=0'];
  if (isHttps) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function extractSessionToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME] || null;
}

export function getUserFromSessionToken(token: string | null): AuthUser | null {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const row = db
    .prepare(`
      SELECT u.id, u.email, u.full_name, u.role, u.is_demo, s.expires_at,
             p.display_name, p.avatar_url, p.level, p.total_points, p.streak_days,
             p.preferred_language, p.bio
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      JOIN user_profiles p ON p.user_id = u.id
      WHERE s.token_hash = ?
    `)
    .get(tokenHash) as
    | {
        id: number;
        email: string;
        full_name: string;
        role: UserRole;
        is_demo: number;
        expires_at: string;
        display_name: string;
        avatar_url: string | null;
        level: number;
        total_points: number;
        streak_days: number;
        preferred_language: 'en' | 'ur';
        bio: string;
      }
    | undefined;

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return null;
  }

  return {
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
  };
}

export interface AuthedRequest extends Request {
  authUser?: AuthUser;
}

export function attachOptionalAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const token = extractSessionToken(req);
  const user = getUserFromSessionToken(token);
  if (user) {
    req.authUser = user;
  }
  next();
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = extractSessionToken(req);
  const user = getUserFromSessionToken(token);
  if (!user) {
    res.status(401).json({ error: 'Authentication required. Please sign in or continue as a Guest Analyst.' });
    return;
  }
  req.authUser = user;
  next();
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = extractSessionToken(req);
  const user = getUserFromSessionToken(token);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Administrator privileges required for moderation access.' });
    return;
  }
  req.authUser = user;
  next();
}

// Sliding window rate limiter
const rateBuckets = new Map<string, number[]>();

export function createRateLimiter(bucketPrefix: string, maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${bucketPrefix}:${ip}`;
    const now = Date.now();
    const cutoff = now - windowMs;
    const timestamps = (rateBuckets.get(key) || []).filter((t) => t > cutoff);
    if (timestamps.length >= maxRequests) {
      res.status(429).json({
        error: 'Too many requests in a short window. Please wait a moment before trying again.',
      });
      return;
    }
    timestamps.push(now);
    rateBuckets.set(key, timestamps);
    next();
  };
}

export function normalizePhoneNumber(countryCodeRaw: string, phoneRaw: string): {
  valid: boolean;
  normalized: string;
  countryCode: string;
  displayPhone: string;
  error?: string;
} {
  const ccDigits = countryCodeRaw.replace(/\D/g, '');
  const rawDigits = phoneRaw.replace(/[\s\-().]/g, '');

  if (!ccDigits || ccDigits.length < 1 || ccDigits.length > 4) {
    return {
      valid: false,
      normalized: '',
      countryCode: '',
      displayPhone: '',
      error: 'Enter a valid country code (e.g. +92 or +1).',
    };
  }

  let subscriber = rawDigits;
  if (subscriber.startsWith('+')) {
    subscriber = subscriber.slice(1);
  }
  if (subscriber.startsWith('00' + ccDigits)) {
    subscriber = subscriber.slice(2 + ccDigits.length);
  } else if (subscriber.startsWith(ccDigits) && subscriber.length > 9) {
    subscriber = subscriber.slice(ccDigits.length);
  }
  if (subscriber.startsWith('0') && subscriber.length >= 10) {
    subscriber = subscriber.slice(1);
  }

  if (!/^\d{7,12}$/.test(subscriber)) {
    return {
      valid: false,
      normalized: '',
      countryCode: `+${ccDigits}`,
      displayPhone: '',
      error: 'Phone number must contain 7 to 12 digits after the country code.',
    };
  }

  const normalized = `+${ccDigits}${subscriber}`;
  const displayPhone = `+${ccDigits} ${subscriber.slice(0, 3)} ${subscriber.slice(3)}`;
  return {
    valid: true,
    normalized,
    countryCode: `+${ccDigits}`,
    displayPhone,
  };
}

export function validateEvidenceImage(dataUrl: unknown): {
  valid: boolean;
  sanitized: string | null;
  error?: string;
} {
  if (dataUrl === undefined || dataUrl === null || dataUrl === '') {
    return { valid: true, sanitized: null };
  }
  if (typeof dataUrl !== 'string') {
    return { valid: false, sanitized: null, error: 'Invalid attachment format.' };
  }
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    return {
      valid: false,
      sanitized: null,
      error: 'Only PNG, JPEG, or WebP screenshot images are accepted.',
    };
  }
  const base64Body = match[2];
  const byteLength = Math.floor((base64Body.length * 3) / 4);
  if (byteLength > 1.5 * 1024 * 1024) {
    return {
      valid: false,
      sanitized: null,
      error: 'Screenshot attachment must be 1.5 MB or smaller.',
    };
  }
  return { valid: true, sanitized: dataUrl };
}
