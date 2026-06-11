// @ts-check
'use strict';

/**
 * User accounts for the self-hosted "My Cloud" GDevelop server.
 *
 * Zero third-party deps: passwords are hashed with scrypt (Node crypto) and
 * sessions are stateless HMAC-SHA256 JWTs signed with a server secret. Users
 * are stored in <dataDir>/users.json.
 *
 * This is intentionally simple (no email verification, no password reset) — it
 * exists to give a self-hoster per-user private projects, not to be a full IdP.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const USERS_INDEX_FILE = 'users.json';
const SECRET_FILE = 'auth-secret.key';
const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

const base64url = buf =>
  Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const base64urlJson = obj => base64url(Buffer.from(JSON.stringify(obj), 'utf8'));

const fromBase64url = str => {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
};

const timingSafeEqualStr = (a, b) => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
};

/** Create the auth subsystem rooted at dataDir. */
const createAuth = (dataDir, { tokenSecret } = {}) => {
  const usersPath = path.join(dataDir, USERS_INDEX_FILE);

  // Resolve a stable signing secret: explicit env > persisted file > generated.
  const resolveSecret = () => {
    if (tokenSecret) return tokenSecret;
    const secretPath = path.join(dataDir, SECRET_FILE);
    try {
      return fs.readFileSync(secretPath, 'utf8').trim();
    } catch (error) {
      const generated = crypto.randomBytes(48).toString('hex');
      try {
        fs.writeFileSync(secretPath, generated, { mode: 0o600 });
      } catch (writeError) {
        // If we can't persist, the in-memory secret still works for this run.
      }
      return generated;
    }
  };
  const secret = resolveSecret();

  let writeQueue = Promise.resolve();
  const withLock = task => {
    const run = writeQueue.then(() => task());
    writeQueue = run.then(() => undefined, () => undefined);
    return run;
  };

  const readUsers = () => {
    try {
      const parsed = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      if (error.code === 'ENOENT') return {};
      throw error;
    }
  };

  const writeUsers = users => {
    const tmp = usersPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(users, null, 2));
    fs.renameSync(tmp, usersPath);
  };

  const normalizeEmail = email =>
    String(email || '')
      .trim()
      .toLowerCase();

  const hashPassword = (password, salt) =>
    new Promise((resolve, reject) => {
      crypto.scrypt(password, salt, 64, (err, derived) => {
        if (err) reject(err);
        else resolve(derived.toString('hex'));
      });
    });

  const signToken = payloadExtra => {
    const header = { alg: 'HS256', typ: 'JWT' };
    const nowSeconds = Math.floor(Date.now() / 1000);
    const payload = {
      ...payloadExtra,
      iat: nowSeconds,
      exp: nowSeconds + TOKEN_TTL_SECONDS,
    };
    const signingInput = `${base64urlJson(header)}.${base64urlJson(payload)}`;
    const signature = base64url(
      crypto.createHmac('sha256', secret).update(signingInput).digest()
    );
    return `${signingInput}.${signature}`;
  };

  /** Verify a JWT string. Returns the payload, or null if invalid/expired. */
  const verifyToken = token => {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const expected = base64url(
      crypto
        .createHmac('sha256', secret)
        .update(`${headerB64}.${payloadB64}`)
        .digest()
    );
    if (!timingSafeEqualStr(signatureB64, expected)) return null;
    let payload;
    try {
      payload = JSON.parse(fromBase64url(payloadB64).toString('utf8'));
    } catch (error) {
      return null;
    }
    if (!payload || typeof payload !== 'object') return null;
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  };

  const publicUser = user => ({
    id: user.id,
    email: user.email,
    username: user.username || '',
    createdAt: user.createdAt,
  });

  return {
    verifyToken,
    publicUser,

    /** Register a new user. Throws { statusCode } on validation/conflict. */
    async register({ email, password, username }) {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
        throw Object.assign(new Error('A valid email is required.'), {
          statusCode: 400,
        });
      }
      if (!password || String(password).length < 6) {
        throw Object.assign(
          new Error('Password must be at least 6 characters.'),
          { statusCode: 400 }
        );
      }

      return withLock(async () => {
        const users = readUsers();
        if (
          Object.keys(users).some(
            id => users[id].email === normalizedEmail
          )
        ) {
          throw Object.assign(
            new Error('An account with this email already exists.'),
            { statusCode: 409 }
          );
        }
        const id = crypto.randomUUID();
        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = await hashPassword(password, salt);
        const user = {
          id,
          email: normalizedEmail,
          username: (username || '').trim(),
          salt,
          passwordHash,
          createdAt: new Date().toISOString(),
        };
        users[id] = user;
        writeUsers(users);
        return { user: publicUser(user), token: signToken({ sub: id }) };
      });
    },

    /** Log in. Throws { statusCode: 401 } on bad credentials. */
    async login({ email, password }) {
      const normalizedEmail = normalizeEmail(email);
      const users = readUsers();
      const user = Object.keys(users)
        .map(id => users[id])
        .find(u => u.email === normalizedEmail);
      const invalid = Object.assign(new Error('Invalid email or password.'), {
        statusCode: 401,
      });
      if (!user) {
        // Still hash to reduce timing oracle for user enumeration.
        await hashPassword(password || '', 'dummy-salt');
        throw invalid;
      }
      const candidate = await hashPassword(password || '', user.salt);
      if (!timingSafeEqualStr(candidate, user.passwordHash)) throw invalid;
      return { user: publicUser(user), token: signToken({ sub: user.id }) };
    },

    /** Resolve a bearer token to a public user, or null. */
    async getUserFromToken(token) {
      const payload = verifyToken(token);
      if (!payload || !payload.sub) return null;
      const users = readUsers();
      const user = users[payload.sub];
      return user ? publicUser(user) : null;
    },
  };
};

module.exports = { createAuth, TOKEN_TTL_SECONDS };
