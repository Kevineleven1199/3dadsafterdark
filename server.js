const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.isAbsolute(process.env.DATA_DIR || '')
  ? String(process.env.DATA_DIR)
  : path.join(__dirname, process.env.DATA_DIR || 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');
const REMOTE_VIEWING_IMAGE_DIR = path.join(DATA_DIR, 'remote-viewing-images');
const COMMUNITY_VIEWING_IMAGE_DIR = path.join(DATA_DIR, 'community-viewing-images');
const DATABASE_URL = process.env.DATABASE_URL || '';
const DATABASE_STORE_KEY = safeTrim(process.env.DATABASE_STORE_KEY || 'signalscope-main', 100) || 'signalscope-main';
const DATABASE_SSL = String(process.env.DATABASE_SSL || '').toLowerCase();

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const OPENAI_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini';
const OPENAI_JUDGE_MODEL = process.env.OPENAI_JUDGE_MODEL || 'gpt-4o-mini';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_BASE_URL = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1').replace(/\/$/, '');
const ANTHROPIC_TEXT_MODEL = process.env.ANTHROPIC_TEXT_MODEL || 'claude-3-5-sonnet-latest';
const ANTHROPIC_JUDGE_MODEL = process.env.ANTHROPIC_JUDGE_MODEL || ANTHROPIC_TEXT_MODEL;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE_URL = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
const OPENROUTER_TEXT_MODEL = process.env.OPENROUTER_TEXT_MODEL || 'anthropic/claude-3.5-sonnet';
const OPENROUTER_JUDGE_MODEL = process.env.OPENROUTER_JUDGE_MODEL || OPENROUTER_TEXT_MODEL;
const OPENROUTER_IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL || 'openai/gpt-image-1';
const OPENROUTER_APP_NAME = process.env.OPENROUTER_APP_NAME || 'SignalScope';
const OPENROUTER_APP_URL = process.env.OPENROUTER_APP_URL || 'https://signalscope.local';

const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

const X_API_BASE_URL = (process.env.X_API_BASE_URL || 'https://api.x.com').replace(/\/$/, '');
const X_API_KEY = process.env.X_API_KEY || '';
const X_API_KEY_SECRET = process.env.X_API_KEY_SECRET || '';
const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN || '';
const X_ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET || '';
const X_AUTOPOST_ENABLED = String(process.env.X_AUTOPOST_ENABLED || '').toLowerCase() === 'true';
const X_AUTOPOST_INTERVAL_MS = Math.max(60_000, Number(process.env.X_AUTOPOST_INTERVAL_MS || 15 * 60 * 1000));
const PROVIDER_TIMEOUT_MS = Math.max(5_000, Number(process.env.PROVIDER_TIMEOUT_MS || 30_000));
const PARALLEL_DYNAMIC_GENERATE_HOUR_UTC = clampNumber(
  Number(process.env.PARALLEL_DYNAMIC_GENERATE_HOUR_UTC || 8),
  0,
  23
);
const PARALLEL_DYNAMIC_GENERATE_MINUTE_UTC = clampNumber(
  Number(process.env.PARALLEL_DYNAMIC_GENERATE_MINUTE_UTC || 55),
  0,
  59
);
const PARALLEL_PRELOAD_DEFAULT_DAYS = clampNumber(Number(process.env.PARALLEL_PRELOAD_DEFAULT_DAYS || 365), 1, 730);

const PARALLEL_TRACK_DYNAMIC = 'dynamic';
const PARALLEL_TRACK_PRELOADED = 'preloaded';
const MAX_COMMUNITY_UPLOAD_BYTES = 8 * 1024 * 1024;
const DEFAULT_JSON_BODY_BYTES = 1_000_000;
const COMMUNITY_UPLOAD_JSON_BODY_BYTES = 12 * 1024 * 1024;
const DEFAULT_TENANT_THEME = {
  brand: '#7cc4ff',
  accent: '#91ff6a',
  glow: 'rgba(145, 255, 106, 0.2)'
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8'
};

const LEGACY_TEMPLATE_TENANT_SLUGS = new Set([
  'cold-case-streamers',
  'podcast-receipts-guild',
  'meme-intel-exchange'
]);

function nowIso() {
  return new Date().toISOString();
}

function dateKeyUtc(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function parseRoundDate(roundDate) {
  const parsed = new Date(`${roundDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid round date');
  }
  return parsed;
}

function nextDateKey(roundDate) {
  const parsed = parseRoundDate(roundDate);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return dateKeyUtc(parsed);
}

function revealAtForRoundDate(roundDate) {
  return `${nextDateKey(roundDate)}T00:00:00.000Z`;
}

function dynamicGenerateAtForRoundDate(roundDate) {
  const hour = String(PARALLEL_DYNAMIC_GENERATE_HOUR_UTC).padStart(2, '0');
  const minute = String(PARALLEL_DYNAMIC_GENERATE_MINUTE_UTC).padStart(2, '0');
  return `${roundDate}T${hour}:${minute}:00.000Z`;
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = String(storedHash || '').split(':');
  if (!salt || !hash) {
    return false;
  }

  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function safeTrim(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function parseTags(rawTags) {
  if (Array.isArray(rawTags)) {
    return rawTags
      .map((item) => safeTrim(item, 32).replace(/^#/, '').toLowerCase())
      .filter(Boolean)
      .slice(0, 8);
  }

  return String(rawTags || '')
    .split(',')
    .map((item) => safeTrim(item, 32).replace(/^#/, '').toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

function hostnameFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch (_error) {
    return 'external-link';
  }
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isRemoteViewingReady() {
  return availablePromptProviders().length > 0 && availableImageProviders().length > 0;
}

function hasXCredentials() {
  return Boolean(X_API_KEY && X_API_KEY_SECRET && X_ACCESS_TOKEN && X_ACCESS_TOKEN_SECRET);
}

function availablePromptProviders() {
  const providers = [];
  if (ANTHROPIC_API_KEY) {
    providers.push('anthropic');
  }
  if (OPENROUTER_API_KEY) {
    providers.push('openrouter');
  }
  if (OPENAI_API_KEY) {
    providers.push('openai');
  }
  return providers;
}

function availableImageProviders() {
  const providers = [];
  if (OPENROUTER_API_KEY) {
    providers.push('openrouter');
  }
  if (OPENAI_API_KEY) {
    providers.push('openai');
  }
  return providers;
}

function buildFailoverOrder() {
  return {
    prompt: availablePromptProviders(),
    image: availableImageProviders(),
    judge: availablePromptProviders()
  };
}

function normalizeErrorMessage(error, fallback) {
  const message = safeTrim(error && error.message ? error.message : '', 420);
  return message || fallback;
}

async function fetchWithTimeout(url, options, timeoutMs = PROVIDER_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function createEmptySeedData() {
  const createdAt = nowIso();

  return {
    meta: {
      schemaVersion: 3,
      templateDataPurged: true,
      initializedAt: createdAt
    },
    nextIds: {
      user: 1,
      tenant: 2,
      channel: 3,
      post: 1,
      comment: 1,
      case: 1,
      task: 1,
      room: 1,
      remoteRound: 1,
      remotePrediction: 1,
      remoteReserve: 1,
      remoteParallelRound: 1,
      remoteParallelPrediction: 1,
      communityRound: 1,
      communityPrediction: 1
    },
    users: [],
    sessions: [],
    tenants: [
      {
        id: 1,
        slug: 'signalscope-global',
        name: 'SignalScope Global',
        tagline: 'Create investigations and build your own intel network.',
        description:
          'Core shared tenant for live investigations, remote-viewing rounds, and collaborative evidence tracking.',
        theme: { ...DEFAULT_TENANT_THEME },
        createdBy: null,
        createdAt
      }
    ],
    memberships: [],
    channels: [
      { id: 1, tenantId: 1, name: '#general' },
      { id: 2, tenantId: 1, name: '#remote-viewing' }
    ],
    posts: [],
    comments: [],
    cases: [],
    tasks: [],
    rooms: [],
    remoteViewingRounds: [],
    remoteViewingPredictions: [],
    remoteViewingReserveItems: [],
    remoteViewingParallelRounds: [],
    remoteViewingParallelPredictions: [],
    communityViewingRounds: [],
    communityViewingPredictions: []
  };
}

function maxId(items) {
  return items.reduce((max, item) => {
    const id = Number(item && item.id);
    if (!Number.isFinite(id)) {
      return max;
    }
    return Math.max(max, id);
  }, 0);
}

function ensureDefaultTenant(data) {
  if (Array.isArray(data.tenants) && data.tenants.length > 0) {
    return;
  }

  const createdAt = nowIso();
  const tenantId = 1;
  data.tenants = [
    {
      id: tenantId,
      slug: 'signalscope-global',
      name: 'SignalScope Global',
      tagline: 'Create investigations and build your own intel network.',
      description:
        'Core shared tenant for live investigations, remote-viewing rounds, and collaborative evidence tracking.',
      theme: { ...DEFAULT_TENANT_THEME },
      createdBy: null,
      createdAt
    }
  ];

  if (!Array.isArray(data.channels)) {
    data.channels = [];
  }

  data.channels.push(
    { id: 1, tenantId, name: '#general' },
    { id: 2, tenantId, name: '#remote-viewing' }
  );
}

function removeLegacyTemplateData(data) {
  if (!data.meta) {
    data.meta = {};
  }

  if (data.meta.templateDataPurged) {
    return;
  }

  const templateTenantIds = new Set(
    (data.tenants || [])
      .filter((tenant) => LEGACY_TEMPLATE_TENANT_SLUGS.has(String(tenant.slug || '').trim()))
      .map((tenant) => tenant.id)
  );

  const removedPostIds = new Set(
    (data.posts || []).filter((post) => templateTenantIds.has(post.tenantId)).map((post) => post.id)
  );
  const removedCaseIds = new Set(
    (data.cases || []).filter((caseItem) => templateTenantIds.has(caseItem.tenantId)).map((caseItem) => caseItem.id)
  );

  data.tenants = (data.tenants || []).filter((tenant) => !templateTenantIds.has(tenant.id));
  data.memberships = (data.memberships || []).filter(
    (membership) => !templateTenantIds.has(membership.tenantId)
  );
  data.channels = (data.channels || []).filter((channel) => !templateTenantIds.has(channel.tenantId));
  data.posts = (data.posts || []).filter((post) => !templateTenantIds.has(post.tenantId));
  data.comments = (data.comments || []).filter((comment) => !removedPostIds.has(comment.postId));
  data.cases = (data.cases || []).filter((caseItem) => !templateTenantIds.has(caseItem.tenantId));
  data.tasks = (data.tasks || []).filter((task) => !removedCaseIds.has(task.caseId));
  data.rooms = (data.rooms || []).filter((room) => !templateTenantIds.has(room.tenantId));
  const removedCommunityRoundIds = new Set(
    (data.communityViewingRounds || [])
      .filter((round) => templateTenantIds.has(round.tenantId))
      .map((round) => round.id)
  );
  data.communityViewingRounds = (data.communityViewingRounds || []).filter(
    (round) => !templateTenantIds.has(round.tenantId)
  );
  data.communityViewingPredictions = (data.communityViewingPredictions || []).filter(
    (prediction) => !templateTenantIds.has(prediction.tenantId) && !removedCommunityRoundIds.has(prediction.roundId)
  );

  const removedLocalUserIds = new Set(
    (data.users || [])
      .filter((user) => String(user.email || '').toLowerCase().endsWith('@signalscope.local'))
      .map((user) => user.id)
  );

  data.users = (data.users || []).filter((user) => !removedLocalUserIds.has(user.id));
  data.sessions = (data.sessions || []).filter((session) => !removedLocalUserIds.has(session.userId));
  data.memberships = (data.memberships || []).filter((membership) => !removedLocalUserIds.has(membership.userId));
  data.communityViewingRounds = (data.communityViewingRounds || []).filter(
    (round) => !removedLocalUserIds.has(round.createdBy)
  );
  data.communityViewingPredictions = (data.communityViewingPredictions || []).filter(
    (prediction) => !removedLocalUserIds.has(prediction.userId)
  );
  const keptCommunityRoundIds = new Set((data.communityViewingRounds || []).map((round) => round.id));
  data.communityViewingPredictions = (data.communityViewingPredictions || []).filter((prediction) =>
    keptCommunityRoundIds.has(prediction.roundId)
  );

  ensureDefaultTenant(data);
  data.meta.templateDataPurged = true;
}

function refreshTenantThemes(data) {
  const tenants = Array.isArray(data.tenants) ? data.tenants : [];
  tenants.forEach((tenant) => {
    if (!tenant || typeof tenant !== 'object') {
      return;
    }

    const theme = tenant.theme && typeof tenant.theme === 'object' ? tenant.theme : {};
    const legacyDefaultTheme =
      String(theme.brand || '').toLowerCase() === '#0b3a53' &&
      String(theme.accent || '').toLowerCase() === '#d07a2f';

    if (tenant.slug === 'signalscope-global' && (legacyDefaultTheme || !theme.brand || !theme.accent)) {
      tenant.theme = { ...DEFAULT_TENANT_THEME };
      return;
    }

    if (!theme.brand || !theme.accent) {
      tenant.theme = {
        brand: theme.brand || DEFAULT_TENANT_THEME.brand,
        accent: theme.accent || DEFAULT_TENANT_THEME.accent,
        glow: theme.glow || DEFAULT_TENANT_THEME.glow
      };
      return;
    }

    tenant.theme = {
      brand: theme.brand,
      accent: theme.accent,
      glow: theme.glow || DEFAULT_TENANT_THEME.glow
    };
  });
}

function normalizeStore(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};

  data.meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
  data.nextIds = data.nextIds && typeof data.nextIds === 'object' ? data.nextIds : {};

  data.users = Array.isArray(data.users) ? data.users : [];
  data.sessions = Array.isArray(data.sessions) ? data.sessions : [];
  data.tenants = Array.isArray(data.tenants) ? data.tenants : [];
  data.memberships = Array.isArray(data.memberships) ? data.memberships : [];
  data.channels = Array.isArray(data.channels) ? data.channels : [];
  data.posts = Array.isArray(data.posts) ? data.posts : [];
  data.comments = Array.isArray(data.comments) ? data.comments : [];
  data.cases = Array.isArray(data.cases) ? data.cases : [];
  data.tasks = Array.isArray(data.tasks) ? data.tasks : [];
  data.rooms = Array.isArray(data.rooms) ? data.rooms : [];
  data.remoteViewingRounds = Array.isArray(data.remoteViewingRounds) ? data.remoteViewingRounds : [];
  data.remoteViewingPredictions = Array.isArray(data.remoteViewingPredictions)
    ? data.remoteViewingPredictions
    : [];
  data.remoteViewingReserveItems = Array.isArray(data.remoteViewingReserveItems)
    ? data.remoteViewingReserveItems
    : [];
  data.remoteViewingParallelRounds = Array.isArray(data.remoteViewingParallelRounds)
    ? data.remoteViewingParallelRounds
    : [];
  data.remoteViewingParallelPredictions = Array.isArray(data.remoteViewingParallelPredictions)
    ? data.remoteViewingParallelPredictions
    : [];
  data.communityViewingRounds = Array.isArray(data.communityViewingRounds) ? data.communityViewingRounds : [];
  data.communityViewingPredictions = Array.isArray(data.communityViewingPredictions)
    ? data.communityViewingPredictions
    : [];

  removeLegacyTemplateData(data);
  ensureDefaultTenant(data);
  refreshTenantThemes(data);

  const nextIds = {
    user: maxId(data.users) + 1,
    tenant: maxId(data.tenants) + 1,
    channel: maxId(data.channels) + 1,
    post: maxId(data.posts) + 1,
    comment: maxId(data.comments) + 1,
    case: maxId(data.cases) + 1,
    task: maxId(data.tasks) + 1,
    room: maxId(data.rooms) + 1,
    remoteRound: maxId(data.remoteViewingRounds) + 1,
    remotePrediction: maxId(data.remoteViewingPredictions) + 1,
    remoteReserve: maxId(data.remoteViewingReserveItems) + 1,
    remoteParallelRound: maxId(data.remoteViewingParallelRounds) + 1,
    remoteParallelPrediction: maxId(data.remoteViewingParallelPredictions) + 1,
    communityRound: maxId(data.communityViewingRounds) + 1,
    communityPrediction: maxId(data.communityViewingPredictions) + 1
  };

  Object.keys(nextIds).forEach((key) => {
    data.nextIds[key] = Math.max(Number(data.nextIds[key] || 1), nextIds[key]);
  });

  data.meta.schemaVersion = 3;
  return data;
}

function ensureDataStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(REMOTE_VIEWING_IMAGE_DIR, { recursive: true });
  fs.mkdirSync(COMMUNITY_VIEWING_IMAGE_DIR, { recursive: true });

  if (!fs.existsSync(DATA_FILE)) {
    const seed = createEmptySeedData();
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2), 'utf8');
    return seed;
  }

  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const normalized = normalizeStore(parsed);
    fs.writeFileSync(DATA_FILE, JSON.stringify(normalized, null, 2), 'utf8');
    return normalized;
  } catch (error) {
    console.error('Failed to load datastore. Recreating from empty seed.', error);
    const seed = createEmptySeedData();
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2), 'utf8');
    return seed;
  }
}

function maybeLoadLocalSeedForDatabase() {
  if (!fs.existsSync(DATA_FILE)) {
    return createEmptySeedData();
  }

  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return normalizeStore(JSON.parse(raw));
  } catch (error) {
    console.error('Failed to parse local store.json for database migration. Creating empty seed.', error);
    return createEmptySeedData();
  }
}

function databaseSslConfig() {
  if (DATABASE_SSL === 'true' || DATABASE_SSL === '1' || DATABASE_SSL === 'require') {
    return { rejectUnauthorized: false };
  }
  if (DATABASE_SSL === 'false' || DATABASE_SSL === '0' || DATABASE_SSL === 'disable') {
    return false;
  }
  if (DATABASE_URL.includes('sslmode=require')) {
    return { rejectUnauthorized: false };
  }
  return false;
}

let pgPool = null;
let store = createEmptySeedData();
let storageBackend = 'file';
let persistQueue = Promise.resolve();

function createPgPool() {
  if (pgPool) {
    return pgPool;
  }

  const { Pool } = require('pg');
  const ssl = databaseSslConfig();
  pgPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: ssl || undefined
  });
  return pgPool;
}

async function ensureDatabaseStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(REMOTE_VIEWING_IMAGE_DIR, { recursive: true });
  fs.mkdirSync(COMMUNITY_VIEWING_IMAGE_DIR, { recursive: true });

  const pool = createPgPool();
  await pool.query(
    `CREATE TABLE IF NOT EXISTS signalscope_store (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );

  const existing = await pool.query('SELECT payload FROM signalscope_store WHERE id = $1 LIMIT 1', [DATABASE_STORE_KEY]);
  if (existing.rows[0] && existing.rows[0].payload) {
    const normalized = normalizeStore(existing.rows[0].payload);
    await pool.query('UPDATE signalscope_store SET payload = $2::jsonb, updated_at = NOW() WHERE id = $1', [
      DATABASE_STORE_KEY,
      JSON.stringify(normalized)
    ]);
    return normalized;
  }

  const seed = maybeLoadLocalSeedForDatabase();
  await pool.query(
    'INSERT INTO signalscope_store (id, payload, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (id) DO NOTHING',
    [DATABASE_STORE_KEY, JSON.stringify(seed)]
  );
  return seed;
}

async function initializeStore() {
  if (DATABASE_URL) {
    try {
      store = await ensureDatabaseStore();
      storageBackend = 'postgres';
      return;
    } catch (error) {
      console.error('Database store initialization failed. Falling back to file store.', error);
    }
  }

  store = ensureDataStore();
  storageBackend = 'file';
}

function persistStoreToPostgres(snapshot) {
  if (!pgPool) {
    return;
  }

  persistQueue = persistQueue
    .catch(() => {
      // Keep queue alive after previous failure.
    })
    .then(() =>
      pgPool.query(
        `INSERT INTO signalscope_store (id, payload, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
        [DATABASE_STORE_KEY, snapshot]
      )
    )
    .catch((error) => {
      console.error('Failed to persist store to Postgres:', error);
    });
}

function persistStore() {
  if (storageBackend === 'postgres' && pgPool) {
    persistStoreToPostgres(JSON.stringify(store));
    return;
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function nextId(type) {
  const current = Number(store.nextIds[type] || 1);
  store.nextIds[type] = current + 1;
  return current;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

function parseJsonBody(req, maxBytes = DEFAULT_JSON_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let raw = '';
    const maxBodySize = clampNumber(Number(maxBytes) || DEFAULT_JSON_BODY_BYTES, 1_000, 20 * 1024 * 1024);

    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > maxBodySize) {
        reject(new Error('Payload too large'));
      }
    });

    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (_error) {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', () => {
      reject(new Error('Unable to read request body'));
    });
  });
}

function extractAuthToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return null;
  }
  return header.slice('Bearer '.length).trim();
}

function findSession(token) {
  if (!token) {
    return null;
  }

  const index = store.sessions.findIndex((item) => item.token === token);
  if (index === -1) {
    return null;
  }

  const session = store.sessions[index];
  if (Date.now() - new Date(session.createdAt).getTime() > SESSION_TTL_MS) {
    store.sessions.splice(index, 1);
    persistStore();
    return null;
  }

  session.lastSeenAt = nowIso();
  return session;
}

function getAuthContext(req) {
  const token = extractAuthToken(req);
  const session = findSession(token);
  if (!session) {
    return { token: null, session: null, user: null };
  }

  const user = store.users.find((entry) => entry.id === session.userId) || null;
  if (!user) {
    return { token, session: null, user: null };
  }

  return { token, session, user };
}

function requireAuth(req, res) {
  const auth = getAuthContext(req);
  if (!auth.user || !auth.session) {
    sendError(res, 401, 'Authentication required');
    return null;
  }

  return auth;
}

function userResponse(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

function tenantMembership(userId, tenantId) {
  return store.memberships.find((item) => item.userId === userId && item.tenantId === tenantId) || null;
}

function ensureMembership(userId, tenantId, role = 'member') {
  const existing = tenantMembership(userId, tenantId);
  if (existing) {
    return existing;
  }

  const membership = {
    userId,
    tenantId,
    role,
    joinedAt: nowIso()
  };

  store.memberships.push(membership);
  return membership;
}

function serializeStats(tenantId) {
  const members = store.memberships.filter((item) => item.tenantId === tenantId).length;
  const openCases = store.cases.filter((item) => item.tenantId === tenantId && item.state !== 'closed').length;
  const recentUserIds = new Set();
  const since = Date.now() - 72 * 60 * 60 * 1000;

  store.posts
    .filter((item) => item.tenantId === tenantId && new Date(item.createdAt).getTime() >= since)
    .forEach((item) => {
      recentUserIds.add(item.authorId);
    });

  store.comments.forEach((item) => {
    const post = store.posts.find((entry) => entry.id === item.postId);
    if (post && post.tenantId === tenantId && new Date(item.createdAt).getTime() >= since) {
      recentUserIds.add(item.authorId);
    }
  });

  const activeWatchers = Math.max(3, recentUserIds.size * 5 + Math.ceil(members * 0.6));

  return {
    members: `${members.toLocaleString()} members`,
    active: `${activeWatchers.toLocaleString()} online`,
    cases: `${openCases.toLocaleString()} open`
  };
}

function serializeTenantSummary(tenant, userId = null) {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    tagline: tenant.tagline,
    description: tenant.description,
    theme: tenant.theme,
    stats: serializeStats(tenant.id),
    membership: userId ? tenantMembership(userId, tenant.id)?.role || null : null
  };
}

function deriveHotTags(tenantId) {
  const counts = new Map();
  store.posts
    .filter((post) => post.tenantId === tenantId)
    .forEach((post) => {
      post.tags.forEach((tag) => {
        const normalized = `#${String(tag).replace(/^#/, '')}`;
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      });
    });

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag]) => tag);

  if (ranked.length > 0) {
    return ranked;
  }

  return ['#first-investigation', '#remote-viewing'];
}

function serializeComment(comment) {
  const author = store.users.find((user) => user.id === comment.authorId);
  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt,
    authorName: author ? author.name : 'Unknown'
  };
}

function serializePost(post) {
  const author = store.users.find((user) => user.id === post.authorId);
  const comments = store.comments
    .filter((comment) => comment.postId === post.id)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return {
    id: post.id,
    tenantId: post.tenantId,
    type: post.type,
    title: post.title,
    summary: post.summary,
    url: post.url,
    source: post.source,
    tags: post.tags,
    clues: post.clues,
    upvotes: post.upvotes,
    comments: comments.length,
    latestComments: comments.slice(-3).map((item) => serializeComment(item)),
    status: post.status,
    createdAt: post.createdAt,
    authorName: author ? author.name : 'Unknown'
  };
}

function sortedTenantPosts(tenantId, filter, sort) {
  const filtered = store.posts.filter((post) => {
    if (post.tenantId !== tenantId) {
      return false;
    }

    if (!filter || filter === 'all') {
      return true;
    }

    return post.type === filter;
  });

  const score = (post) => {
    const commentCount = store.comments.filter((item) => item.postId === post.id).length;
    return post.upvotes + commentCount * 1.35 + post.clues * 2.1;
  };

  const sorted = [...filtered];
  if (sort === 'new') {
    sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (sort === 'clues') {
    sorted.sort((a, b) => b.clues - a.clues);
  } else {
    sorted.sort((a, b) => score(b) - score(a));
  }

  return sorted.map((post) => serializePost(post));
}

function serializeCase(caseItem) {
  const checklist = store.tasks
    .filter((task) => task.caseId === caseItem.id)
    .map((task) => ({
      id: task.id,
      label: task.label,
      done: task.done
    }));

  return {
    id: caseItem.id,
    title: caseItem.title,
    ownerLabel: caseItem.ownerLabel,
    state: caseItem.state,
    checklist
  };
}

function serializeRoom(room) {
  return {
    id: room.id,
    name: room.name,
    topic: room.topic,
    schedule: room.schedule,
    attendees: room.attendees
  };
}

function serializeInvestigators(tenantId) {
  const tenantUserIds = new Set(
    store.memberships.filter((item) => item.tenantId === tenantId).map((item) => item.userId)
  );

  const points = new Map();

  const addPoints = (userId, value) => {
    if (!tenantUserIds.has(userId)) {
      return;
    }
    points.set(userId, (points.get(userId) || 0) + value);
  };

  store.posts
    .filter((post) => post.tenantId === tenantId)
    .forEach((post) => {
      addPoints(post.authorId, 30 + Math.floor(post.upvotes / 10));
    });

  store.comments.forEach((comment) => {
    const post = store.posts.find((item) => item.id === comment.postId);
    if (post && post.tenantId === tenantId) {
      addPoints(comment.authorId, 12);
    }
  });

  const caseIds = new Set(store.cases.filter((item) => item.tenantId === tenantId).map((item) => item.id));
  store.tasks
    .filter((task) => caseIds.has(task.caseId) && task.done && task.updatedBy)
    .forEach((task) => {
      addPoints(task.updatedBy, 8);
    });

  return [...tenantUserIds]
    .map((userId) => {
      const user = store.users.find((entry) => entry.id === userId);
      const membership = tenantMembership(userId, tenantId);
      return {
        name: user ? user.name : 'Unknown',
        role: membership?.role === 'owner' ? 'Tenant Owner' : 'Investigator',
        score: `${(points.get(userId) || 0).toLocaleString()} pts`
      };
    })
    .sort((a, b) => {
      const aPoints = Number(a.score.replace(/[^0-9]/g, ''));
      const bPoints = Number(b.score.replace(/[^0-9]/g, ''));
      return bPoints - aPoints;
    })
    .slice(0, 6);
}

function serializeTenantDetail(tenant, userId = null) {
  return {
    ...serializeTenantSummary(tenant, userId),
    channels: store.channels.filter((channel) => channel.tenantId === tenant.id).map((channel) => channel.name),
    hotTags: deriveHotTags(tenant.id),
    rooms: store.rooms.filter((room) => room.tenantId === tenant.id).map((room) => serializeRoom(room)),
    cases: store.cases.filter((caseItem) => caseItem.tenantId === tenant.id).map((caseItem) => serializeCase(caseItem)),
    investigators: serializeInvestigators(tenant.id)
  };
}

function randomThemeFromName(name) {
  const themes = [
    { brand: '#7cc4ff', accent: '#91ff6a', glow: 'rgba(145, 255, 106, 0.2)' },
    { brand: '#78b8ff', accent: '#ffd36a', glow: 'rgba(120, 184, 255, 0.18)' },
    { brand: '#9ab8ff', accent: '#89ffe1', glow: 'rgba(137, 255, 225, 0.18)' },
    { brand: '#c6a8ff', accent: '#9ff67f', glow: 'rgba(159, 246, 127, 0.2)' },
    { brand: '#78d2ff', accent: '#ffca92', glow: 'rgba(120, 210, 255, 0.18)' }
  ];

  const hash = String(name)
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  return themes[hash % themes.length];
}

function resolvePath(urlPath) {
  const sanitizedPath = decodeURIComponent(urlPath.split('?')[0]);
  const target = sanitizedPath === '/' ? '/index.html' : sanitizedPath;
  const absolutePath = path.normalize(path.join(PUBLIC_DIR, target));

  if (!absolutePath.startsWith(PUBLIC_DIR)) {
    return null;
  }

  return absolutePath;
}

async function callOpenAi(endpoint, payload) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for remote viewing engines');
  }

  const response = await fetchWithTimeout(`${OPENAI_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const raw = await response.text();
  let parsed = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch (_error) {
      parsed = {};
    }
  }

  if (!response.ok) {
    const message = parsed?.error?.message || raw || `OpenAI request failed with status ${response.status}`;
    throw new Error(`OpenAI API error: ${message}`);
  }

  return parsed;
}

async function callAnthropicMessages(payload) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const response = await fetchWithTimeout(`${ANTHROPIC_BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const raw = await response.text();
  let parsed = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch (_error) {
      parsed = {};
    }
  }

  if (!response.ok) {
    const message = parsed?.error?.message || parsed?.error?.type || raw;
    throw new Error(`Anthropic API error: ${message || `status ${response.status}`}`);
  }

  const contentItem = Array.isArray(parsed.content)
    ? parsed.content.find((item) => item && item.type === 'text')
    : null;
  const content = contentItem?.text || '';
  if (!content.trim()) {
    throw new Error('Anthropic returned empty text content');
  }

  return { raw: parsed, content };
}

async function callOpenRouterChat(payload) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const response = await fetchWithTimeout(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': OPENROUTER_APP_URL,
      'X-Title': OPENROUTER_APP_NAME
    },
    body: JSON.stringify(payload)
  });

  const raw = await response.text();
  let parsed = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch (_error) {
      parsed = {};
    }
  }

  if (!response.ok) {
    const message = parsed?.error?.message || raw;
    throw new Error(`OpenRouter API error: ${message || `status ${response.status}`}`);
  }

  const content = parsed?.choices?.[0]?.message?.content;
  if (!content || !String(content).trim()) {
    throw new Error('OpenRouter returned empty chat content');
  }

  return { raw: parsed, content: String(content) };
}

async function callOpenRouterImage(payload) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const response = await fetchWithTimeout(`${OPENROUTER_BASE_URL}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': OPENROUTER_APP_URL,
      'X-Title': OPENROUTER_APP_NAME
    },
    body: JSON.stringify(payload)
  });

  const raw = await response.text();
  let parsed = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch (_error) {
      parsed = {};
    }
  }

  if (!response.ok) {
    const message = parsed?.error?.message || raw;
    throw new Error(`OpenRouter image API error: ${message || `status ${response.status}`}`);
  }

  return parsed;
}

async function withProviderFailover(calls, failurePrefix) {
  const failures = [];

  for (const call of calls) {
    try {
      return await call.run();
    } catch (error) {
      failures.push(`${call.provider}: ${normalizeErrorMessage(error, 'unknown error')}`);
    }
  }

  throw new Error(`${failurePrefix}. ${failures.join(' | ')}`);
}

function extractJsonObject(content) {
  const trimmed = String(content || '').trim();
  if (!trimmed) {
    throw new Error('Model returned empty content');
  }

  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('Model output was not valid JSON');
    }

    return JSON.parse(match[0]);
  }
}

function extractSvgMarkup(content) {
  const text = String(content || '').trim();
  const start = text.indexOf('<svg');
  const end = text.lastIndexOf('</svg>');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model did not return valid SVG markup');
  }

  let svg = text.slice(start, end + 6).trim();
  svg = svg.replace(/<script[\s\S]*?<\/script>/gi, '');

  if (!svg.includes('xmlns=')) {
    svg = svg.replace('<svg', '<svg xmlns=\"http://www.w3.org/2000/svg\"');
  }

  return svg;
}

async function generateRemoteViewingSvg(prompt) {
  const systemInstruction =
    'Generate an original SVG image scene based on the user prompt. Return SVG markup only, no prose, no code fences. Use viewBox 0 0 1024 1024. Use layered shapes, gradients, and clear objects matching the scene.';
  const userInstruction = `Create an SVG for this remote-viewing target prompt: ${prompt}`;

  const { content, provider, model } = await withProviderFailover(
    [
      {
        provider: 'anthropic',
        run: async () => {
          const result = await callAnthropicMessages({
            model: ANTHROPIC_TEXT_MODEL,
            max_tokens: 2000,
            temperature: 0.8,
            system: systemInstruction,
            messages: [{ role: 'user', content: userInstruction }]
          });
          return { content: result.content, provider: 'anthropic', model: ANTHROPIC_TEXT_MODEL };
        }
      },
      {
        provider: 'openrouter',
        run: async () => {
          const result = await callOpenRouterChat({
            model: OPENROUTER_TEXT_MODEL,
            temperature: 0.8,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: userInstruction }
            ]
          });
          return { content: result.content, provider: 'openrouter', model: OPENROUTER_TEXT_MODEL };
        }
      },
      {
        provider: 'openai',
        run: async () => {
          const payload = await callOpenAi('/chat/completions', {
            model: OPENAI_TEXT_MODEL,
            temperature: 0.8,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: userInstruction }
            ]
          });
          return {
            content: payload?.choices?.[0]?.message?.content || '',
            provider: 'openai',
            model: OPENAI_TEXT_MODEL
          };
        }
      }
    ].filter((entry) => {
      if (entry.provider === 'anthropic') {
        return Boolean(ANTHROPIC_API_KEY);
      }
      if (entry.provider === 'openrouter') {
        return Boolean(OPENROUTER_API_KEY);
      }
      return Boolean(OPENAI_API_KEY);
    }),
    'SVG fallback generation failed across all providers'
  );

  return {
    svg: extractSvgMarkup(content),
    provider,
    model
  };
}

async function generateRemoteViewingTarget(roundDate) {
  const entropy = crypto.randomBytes(8).toString('hex');
  const systemInstruction =
    'You design remote-viewing targets. Return JSON only with keys: title, prompt. Title should be short. Prompt should describe a vivid, specific scene with clear objects, location, action, and atmosphere.';
  const userInstruction = `Create a unique remote-viewing target for UTC day ${roundDate}. Use entropy token ${entropy}. Keep prompt under 360 characters.`;

  const { content, provider, model } = await withProviderFailover(
    [
      {
        provider: 'anthropic',
        run: async () => {
          const result = await callAnthropicMessages({
            model: ANTHROPIC_TEXT_MODEL,
            max_tokens: 500,
            temperature: 1,
            system: systemInstruction,
            messages: [{ role: 'user', content: userInstruction }]
          });
          return { content: result.content, provider: 'anthropic', model: ANTHROPIC_TEXT_MODEL };
        }
      },
      {
        provider: 'openrouter',
        run: async () => {
          const result = await callOpenRouterChat({
            model: OPENROUTER_TEXT_MODEL,
            temperature: 1,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: userInstruction }
            ]
          });
          return { content: result.content, provider: 'openrouter', model: OPENROUTER_TEXT_MODEL };
        }
      },
      {
        provider: 'openai',
        run: async () => {
          const payload = await callOpenAi('/chat/completions', {
            model: OPENAI_TEXT_MODEL,
            temperature: 1,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: userInstruction }
            ]
          });
          return {
            content: payload?.choices?.[0]?.message?.content || '',
            provider: 'openai',
            model: OPENAI_TEXT_MODEL
          };
        }
      }
    ].filter((entry) => {
      if (entry.provider === 'anthropic') {
        return Boolean(ANTHROPIC_API_KEY);
      }
      if (entry.provider === 'openrouter') {
        return Boolean(OPENROUTER_API_KEY);
      }
      return Boolean(OPENAI_API_KEY);
    }),
    'Remote-viewing prompt generation failed across all providers'
  );

  const parsed = extractJsonObject(content);

  const title = safeTrim(parsed.title, 120);
  const prompt = safeTrim(parsed.prompt, 500);

  if (!title || !prompt) {
    throw new Error('Prompt generator did not return valid title/prompt');
  }

  return { title, prompt, provider, model };
}

async function downloadImageBuffer(url) {
  const response = await fetchWithTimeout(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Failed to download generated image (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function generateRemoteViewingImageFile(roundDate, roundId, prompt) {
  try {
    const imageResult = await withProviderFailover(
      [
        {
          provider: 'openrouter',
          run: async () => {
            const payload = await callOpenRouterImage({
              model: OPENROUTER_IMAGE_MODEL,
              prompt,
              size: '1024x1024'
            });
            return { payload, provider: 'openrouter', model: OPENROUTER_IMAGE_MODEL };
          }
        },
        {
          provider: 'openai',
          run: async () => {
            const payload = await callOpenAi('/images/generations', {
              model: OPENAI_IMAGE_MODEL,
              prompt,
              size: '1024x1024'
            });
            return { payload, provider: 'openai', model: OPENAI_IMAGE_MODEL };
          }
        }
      ].filter((entry) =>
        entry.provider === 'openrouter' ? Boolean(OPENROUTER_API_KEY) : Boolean(OPENAI_API_KEY)
      ),
      'Remote-viewing image generation failed across all providers'
    );

    const item = imageResult.payload?.data?.[0];
    if (!item) {
      throw new Error('Image generator returned no image data');
    }

    let buffer = null;
    if (item.b64_json) {
      buffer = Buffer.from(item.b64_json, 'base64');
    } else if (item.url) {
      buffer = await downloadImageBuffer(item.url);
    }

    if (!buffer || buffer.length === 0) {
      throw new Error('Generated image buffer was empty');
    }

    fs.mkdirSync(REMOTE_VIEWING_IMAGE_DIR, { recursive: true });
    const filename = `${roundDate}-${roundId}.png`;
    const absolutePath = path.join(REMOTE_VIEWING_IMAGE_DIR, filename);
    fs.writeFileSync(absolutePath, buffer);

    return {
      filename,
      revisedPrompt: safeTrim(item.revised_prompt || '', 500),
      provider: imageResult.provider,
      model: imageResult.model,
      format: 'png'
    };
  } catch (imageError) {
    const svgFallback = await generateRemoteViewingSvg(prompt);
    fs.mkdirSync(REMOTE_VIEWING_IMAGE_DIR, { recursive: true });
    const filename = `${roundDate}-${roundId}.svg`;
    const absolutePath = path.join(REMOTE_VIEWING_IMAGE_DIR, filename);
    fs.writeFileSync(absolutePath, svgFallback.svg, 'utf8');

    return {
      filename,
      revisedPrompt: '',
      provider: svgFallback.provider,
      model: svgFallback.model,
      format: 'svg',
      fallbackFrom: normalizeErrorMessage(imageError, 'image provider failure')
    };
  }
}

async function judgePredictionWithAi(predictionText, round) {
  const systemInstruction =
    'You score remote-viewing guesses. Return JSON only with keys: outcome, score, rationale. outcome must be win or loss. score must be integer 0-100. A win means meaningful overlap with target scene objects/location/action.';
  const userInstruction = `Target title: ${round.targetTitle}\nTarget prompt: ${round.targetPrompt}\nUser prediction: ${predictionText}\nReturn strict JSON.`;

  const { content, provider, model } = await withProviderFailover(
    [
      {
        provider: 'anthropic',
        run: async () => {
          const result = await callAnthropicMessages({
            model: ANTHROPIC_JUDGE_MODEL,
            max_tokens: 500,
            temperature: 0,
            system: systemInstruction,
            messages: [{ role: 'user', content: userInstruction }]
          });
          return { content: result.content, provider: 'anthropic', model: ANTHROPIC_JUDGE_MODEL };
        }
      },
      {
        provider: 'openrouter',
        run: async () => {
          const result = await callOpenRouterChat({
            model: OPENROUTER_JUDGE_MODEL,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: userInstruction }
            ]
          });
          return { content: result.content, provider: 'openrouter', model: OPENROUTER_JUDGE_MODEL };
        }
      },
      {
        provider: 'openai',
        run: async () => {
          const payload = await callOpenAi('/chat/completions', {
            model: OPENAI_JUDGE_MODEL,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: userInstruction }
            ]
          });
          return {
            content: payload?.choices?.[0]?.message?.content || '',
            provider: 'openai',
            model: OPENAI_JUDGE_MODEL
          };
        }
      }
    ].filter((entry) => {
      if (entry.provider === 'anthropic') {
        return Boolean(ANTHROPIC_API_KEY);
      }
      if (entry.provider === 'openrouter') {
        return Boolean(OPENROUTER_API_KEY);
      }
      return Boolean(OPENAI_API_KEY);
    }),
    'Remote-viewing judge failed across all providers'
  );

  const parsed = extractJsonObject(content);

  const outcome = String(parsed.outcome || '').toLowerCase() === 'win' ? 'win' : 'loss';
  const score = clampNumber(Number(parsed.score) || (outcome === 'win' ? 72 : 28), 0, 100);
  const rationale = safeTrim(parsed.rationale || 'No rationale provided.', 300);

  return { outcome, score, rationale, provider, model };
}

function isRoundRevealed(round, atMs = Date.now()) {
  return new Date(round.revealAt).getTime() <= atMs;
}

function getRoundByDate(roundDate) {
  return store.remoteViewingRounds.find((round) => round.roundDate === roundDate) || null;
}

function reserveInventorySummary() {
  const items = Array.isArray(store.remoteViewingReserveItems) ? store.remoteViewingReserveItems : [];
  const available = items.filter((item) => !item.usedAt && item.imageFilename && item.targetPrompt).length;
  const used = items.filter((item) => Boolean(item.usedAt)).length;

  return {
    total: items.length,
    available,
    used,
    recommended: 30
  };
}

function applyGeneratedPayloadToRound(round, roundDate, target, image) {
  round.targetTitle = target.title;
  round.targetPrompt = target.prompt;
  round.revisedPrompt = image.revisedPrompt;
  round.imageFilename = image.filename;
  round.imageFormat = image.format || 'png';
  round.imageFallbackNote = image.fallbackFrom || '';
  round.generatedAt = nowIso();
  round.revealAt = revealAtForRoundDate(roundDate);
  round.imageModel = image.model;
  round.promptModel = target.model;
  round.judgeModel = round.judgeModel || '';
  round.promptProvider = target.provider;
  round.imageProvider = image.provider;
  round.status = 'hidden';
  round.generationMode = 'live';
  round.reserveItemId = null;
  round.reserveUsedAt = '';
}

function claimReserveItemForRound(roundDate, sourceError) {
  const candidate = (store.remoteViewingReserveItems || []).find(
    (item) => !item.usedAt && item.imageFilename && item.targetPrompt
  );

  if (!candidate) {
    return null;
  }

  candidate.usedAt = nowIso();
  candidate.usedForRoundDate = roundDate;
  candidate.useReason = normalizeErrorMessage(sourceError, 'Primary generation failed');
  return candidate;
}

function applyReservePayloadToRound(round, roundDate, reserveItem, sourceError) {
  round.targetTitle = reserveItem.targetTitle;
  round.targetPrompt = reserveItem.targetPrompt;
  round.revisedPrompt = reserveItem.revisedPrompt || '';
  round.imageFilename = reserveItem.imageFilename;
  round.imageFormat = reserveItem.imageFormat || 'png';
  round.imageFallbackNote = `Reserve takeover: ${normalizeErrorMessage(sourceError, 'Primary generation failed')}`;
  round.generatedAt = nowIso();
  round.revealAt = revealAtForRoundDate(roundDate);
  round.imageModel = reserveItem.imageModel || '';
  round.promptModel = reserveItem.promptModel || '';
  round.judgeModel = round.judgeModel || '';
  round.promptProvider = reserveItem.promptProvider || null;
  round.imageProvider = reserveItem.imageProvider || null;
  round.status = 'hidden';
  round.generationMode = 'reserve';
  round.reserveItemId = reserveItem.id;
  round.reserveUsedAt = reserveItem.usedAt;
}

const generationLocks = new Map();
let scoringLock = null;

async function ensureRemoteViewingRound(roundDate) {
  const existing = getRoundByDate(roundDate);
  if (existing && existing.imageFilename && existing.targetPrompt) {
    return existing;
  }

  if (generationLocks.has(roundDate)) {
    return generationLocks.get(roundDate);
  }

  const lockPromise = (async () => {
    let round = getRoundByDate(roundDate);
    if (!round) {
      round = {
        id: nextId('remoteRound'),
        roundDate,
        targetTitle: '',
        targetPrompt: '',
        revisedPrompt: '',
        imageFilename: '',
        generatedAt: '',
        revealAt: revealAtForRoundDate(roundDate),
        imageModel: '',
        promptModel: '',
        judgeModel: '',
        status: 'generating',
        generationMode: '',
        reserveItemId: null,
        reserveUsedAt: '',
        createdAt: nowIso()
      };
      store.remoteViewingRounds.push(round);
      persistStore();
    }

    if (!isRemoteViewingReady()) {
      const providerError = new Error(
        'No usable remote-viewing engine providers are configured. Add ANTHROPIC_API_KEY and/or OPENROUTER_API_KEY (or OPENAI_API_KEY).'
      );
      const reserveItem = claimReserveItemForRound(roundDate, providerError);
      if (reserveItem) {
        applyReservePayloadToRound(round, roundDate, reserveItem, providerError);
        persistStore();
        return round;
      }

      store.remoteViewingRounds = store.remoteViewingRounds.filter((item) => item.id !== round.id);
      persistStore();
      throw new Error(
        'No usable provider chain and no reserve images are available. Refill reserve pool with /api/remote-viewing/reserve/frontload.'
      );
    }

    try {
      const target = await generateRemoteViewingTarget(roundDate);
      const image = await generateRemoteViewingImageFile(roundDate, round.id, target.prompt);

      applyGeneratedPayloadToRound(round, roundDate, target, image);

      persistStore();
      return round;
    } catch (error) {
      const reserveItem = claimReserveItemForRound(roundDate, error);
      if (reserveItem) {
        applyReservePayloadToRound(round, roundDate, reserveItem, error);
        persistStore();
        return round;
      }

      store.remoteViewingRounds = store.remoteViewingRounds.filter((item) => item.id !== round.id);
      persistStore();
      throw error;
    }
  })();

  generationLocks.set(roundDate, lockPromise);

  try {
    return await lockPromise;
  } finally {
    generationLocks.delete(roundDate);
  }
}

async function generateRemoteViewingReserveItem(itemId) {
  const generationToken = `reserve-${dateKeyUtc()}-${itemId}-${crypto.randomBytes(5).toString('hex')}`;
  const target = await generateRemoteViewingTarget(generationToken);
  const image = await generateRemoteViewingImageFile('reserve', `r${itemId}`, target.prompt);

  return {
    id: itemId,
    targetTitle: target.title,
    targetPrompt: target.prompt,
    revisedPrompt: image.revisedPrompt || '',
    imageFilename: image.filename,
    imageFormat: image.format || 'png',
    promptProvider: target.provider,
    imageProvider: image.provider,
    promptModel: target.model,
    imageModel: image.model,
    imageFallbackNote: image.fallbackFrom || '',
    createdAt: nowIso(),
    usedAt: '',
    usedForRoundDate: '',
    useReason: ''
  };
}

async function frontloadRemoteViewingReserveItems(targetAvailableCount) {
  if (!isRemoteViewingReady()) {
    throw new Error(
      'No usable provider chain. Configure ANTHROPIC_API_KEY and OPENROUTER_API_KEY (or OPENAI_API_KEY).'
    );
  }

  const requestedAvailable = clampNumber(Number(targetAvailableCount) || 30, 1, 120);
  const before = reserveInventorySummary();
  const required = Math.max(0, requestedAvailable - before.available);
  const generated = [];
  const failed = [];

  for (let index = 0; index < required; index += 1) {
    const reserveId = nextId('remoteReserve');
    try {
      const item = await generateRemoteViewingReserveItem(reserveId);
      store.remoteViewingReserveItems.push(item);
      generated.push({
        id: item.id,
        promptProvider: item.promptProvider || null,
        imageProvider: item.imageProvider || null,
        imageFormat: item.imageFormat || null
      });
      persistStore();
    } catch (error) {
      failed.push({
        reserveId,
        error: normalizeErrorMessage(error, 'Reserve image generation failed')
      });
      persistStore();
    }
  }

  const after = reserveInventorySummary();
  return {
    requestedAvailable,
    generatedCount: generated.length,
    existingAvailableCount: before.available,
    failedCount: failed.length,
    availableAfterCount: after.available,
    generated,
    failed
  };
}

function getParallelRoundByDate(roundDate, track) {
  return (
    store.remoteViewingParallelRounds.find((round) => round.roundDate === roundDate && round.track === track) || null
  );
}

function getParallelRoundById(roundId) {
  return store.remoteViewingParallelRounds.find((round) => round.id === roundId) || null;
}

function shouldGenerateDynamicRoundNow(round, forceGenerate = false) {
  if (!round) {
    return false;
  }

  if (forceGenerate) {
    return true;
  }

  if (!round.generateAt) {
    return true;
  }

  const generateAtMs = new Date(round.generateAt).getTime();
  if (!Number.isFinite(generateAtMs)) {
    return true;
  }

  return Date.now() >= generateAtMs;
}

function parallelGenerationToken(roundDate, track, roundId) {
  return `${roundDate}-${track}-${roundId}`;
}

function createParallelRoundShell(roundDate, track) {
  const round = {
    id: nextId('remoteParallelRound'),
    track,
    roundDate,
    targetTitle: '',
    targetPrompt: '',
    revisedPrompt: '',
    imageFilename: '',
    generatedAt: '',
    generateAt: track === PARALLEL_TRACK_DYNAMIC ? dynamicGenerateAtForRoundDate(roundDate) : nowIso(),
    revealAt: revealAtForRoundDate(roundDate),
    imageModel: '',
    promptModel: '',
    judgeModel: '',
    status: track === PARALLEL_TRACK_DYNAMIC ? 'awaiting-generation' : 'generating',
    generationMode: '',
    reserveItemId: null,
    reserveUsedAt: '',
    createdAt: nowIso()
  };

  store.remoteViewingParallelRounds.push(round);
  persistStore();
  return round;
}

const parallelGenerationLocks = new Map();
let parallelScoringLock = null;

async function ensureParallelRound(roundDate, track, options = {}) {
  if (track !== PARALLEL_TRACK_DYNAMIC && track !== PARALLEL_TRACK_PRELOADED) {
    throw new Error('Unsupported parallel remote-viewing track');
  }

  let existing = getParallelRoundByDate(roundDate, track);
  if (existing && existing.imageFilename && existing.targetPrompt) {
    return existing;
  }

  const lockKey = `${track}:${roundDate}`;
  if (parallelGenerationLocks.has(lockKey)) {
    return parallelGenerationLocks.get(lockKey);
  }

  const lockPromise = (async () => {
    let round = getParallelRoundByDate(roundDate, track);
    if (!round) {
      round = createParallelRoundShell(roundDate, track);
    }

    const forceGenerate = options.forceGenerate === true;
    const shouldGenerateNow =
      track === PARALLEL_TRACK_PRELOADED || shouldGenerateDynamicRoundNow(round, forceGenerate);

    if (!shouldGenerateNow) {
      if (round.status !== 'awaiting-generation') {
        round.status = 'awaiting-generation';
        persistStore();
      }
      return round;
    }

    if (round.imageFilename && round.targetPrompt) {
      return round;
    }

    if (!isRemoteViewingReady()) {
      const providerError = new Error(
        'No usable remote-viewing provider chain is configured for parallel generation.'
      );
      const reserveItem = claimReserveItemForRound(roundDate, providerError);
      if (reserveItem) {
        applyReservePayloadToRound(round, roundDate, reserveItem, providerError);
        round.track = track;
        persistStore();
        return round;
      }

      round.status = 'generation-failed';
      round.generationError = normalizeErrorMessage(providerError, 'Parallel generation failed');
      persistStore();
      throw providerError;
    }

    try {
      const target = await generateRemoteViewingTarget(parallelGenerationToken(roundDate, track, round.id));
      const image = await generateRemoteViewingImageFile(
        roundDate,
        `parallel-${track}-${round.id}`,
        target.prompt
      );
      applyGeneratedPayloadToRound(round, roundDate, target, image);
      round.track = track;
      round.generateAt = track === PARALLEL_TRACK_DYNAMIC ? dynamicGenerateAtForRoundDate(roundDate) : round.generateAt;
      delete round.generationError;
      persistStore();
      return round;
    } catch (error) {
      const reserveItem = claimReserveItemForRound(roundDate, error);
      if (reserveItem) {
        applyReservePayloadToRound(round, roundDate, reserveItem, error);
        round.track = track;
        persistStore();
        return round;
      }

      round.status = 'generation-failed';
      round.generationError = normalizeErrorMessage(error, 'Parallel generation failed');
      persistStore();
      throw error;
    }
  })();

  parallelGenerationLocks.set(lockKey, lockPromise);
  try {
    return await lockPromise;
  } finally {
    parallelGenerationLocks.delete(lockKey);
  }
}

function getLatestRevealedParallelRound(track) {
  const nowMs = Date.now();
  return (
    store.remoteViewingParallelRounds
      .filter(
        (round) =>
          round.track === track && round.imageFilename && round.targetPrompt && isRoundRevealed(round, nowMs)
      )
      .sort((a, b) => new Date(b.roundDate).getTime() - new Date(a.roundDate).getTime())[0] || null
  );
}

function parallelRecordForUser(userId, track) {
  const resolved = store.remoteViewingParallelPredictions.filter(
    (prediction) =>
      prediction.userId === userId &&
      prediction.track === track &&
      (prediction.outcome === 'win' || prediction.outcome === 'loss')
  );

  const wins = resolved.filter((prediction) => prediction.outcome === 'win').length;
  const losses = resolved.filter((prediction) => prediction.outcome === 'loss').length;
  const total = wins + losses;

  return {
    wins,
    losses,
    total,
    winRate: total > 0 ? `${Math.round((wins / total) * 100)}%` : '0%'
  };
}

function parallelLeaderboard(track, limit = 10) {
  const scoreboard = new Map();

  const increment = (userId, field) => {
    if (!scoreboard.has(userId)) {
      scoreboard.set(userId, { wins: 0, losses: 0 });
    }
    scoreboard.get(userId)[field] += 1;
  };

  store.remoteViewingParallelPredictions
    .filter((prediction) => prediction.track === track)
    .forEach((prediction) => {
      if (prediction.outcome === 'win') {
        increment(prediction.userId, 'wins');
      } else if (prediction.outcome === 'loss') {
        increment(prediction.userId, 'losses');
      }
    });

  return [...scoreboard.entries()]
    .map(([userId, tally]) => {
      const user = store.users.find((entry) => entry.id === userId);
      const total = tally.wins + tally.losses;
      return {
        userId,
        userName: user ? user.name : `User ${userId}`,
        wins: tally.wins,
        losses: tally.losses,
        total,
        winRate: total > 0 ? `${Math.round((tally.wins / total) * 100)}%` : '0%'
      };
    })
    .sort((a, b) => {
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }
      if (a.losses !== b.losses) {
        return a.losses - b.losses;
      }
      return a.userName.localeCompare(b.userName);
    })
    .slice(0, limit);
}

function serializeParallelRoundForDaily(round, userId = null, includeTarget = false) {
  if (!round) {
    return null;
  }

  const revealed = isRoundRevealed(round);
  const myPrediction =
    userId === null
      ? null
      : store.remoteViewingParallelPredictions.find(
          (prediction) =>
            prediction.roundId === round.id && prediction.track === round.track && prediction.userId === userId
        ) || null;

  return {
    id: round.id,
    track: round.track,
    roundDate: round.roundDate,
    generateAt: round.generateAt || null,
    revealAt: round.revealAt,
    status: revealed ? 'revealed' : round.status || 'hidden',
    submissionOpen: !revealed,
    generationScheduled: round.track === PARALLEL_TRACK_DYNAMIC && !round.imageFilename,
    generatedAt: round.generatedAt || null,
    promptProvider: round.promptProvider || null,
    imageProvider: round.imageProvider || null,
    judgeProvider: round.judgeProvider || null,
    promptModel: round.promptModel || null,
    imageModel: round.imageModel || null,
    judgeModel: round.judgeModel || null,
    imageFormat: round.imageFormat || null,
    imageFallbackNote: round.imageFallbackNote || null,
    generationMode: round.generationMode || 'live',
    reserveItemId: Number.isFinite(Number(round.reserveItemId)) ? Number(round.reserveItemId) : null,
    reserveUsedAt: round.reserveUsedAt || null,
    myPrediction: myPrediction ? serializePrediction(myPrediction) : null,
    imageUrl: includeTarget && revealed ? `/api/remote-viewing/parallel/rounds/${round.id}/image` : null,
    targetTitle: includeTarget && revealed ? round.targetTitle : null,
    targetPrompt: includeTarget && revealed ? round.targetPrompt : null
  };
}

function parallelTrackAggregate(track) {
  const resolved = store.remoteViewingParallelPredictions.filter(
    (prediction) =>
      prediction.track === track && (prediction.outcome === 'win' || prediction.outcome === 'loss')
  );

  const wins = resolved.filter((prediction) => prediction.outcome === 'win').length;
  const losses = resolved.filter((prediction) => prediction.outcome === 'loss').length;
  const total = wins + losses;
  const winRatePct = total > 0 ? Number(((wins / total) * 100).toFixed(2)) : 0;

  return {
    wins,
    losses,
    total,
    winRate: total > 0 ? `${Math.round(winRatePct)}%` : '0%',
    winRatePct
  };
}

async function scorePendingParallelPredictions() {
  if (!isRemoteViewingReady()) {
    return;
  }

  if (parallelScoringLock) {
    await parallelScoringLock;
    return;
  }

  parallelScoringLock = (async () => {
    const nowMs = Date.now();
    let changed = false;

    const revealedRounds = store.remoteViewingParallelRounds.filter(
      (round) => round.imageFilename && round.targetPrompt && isRoundRevealed(round, nowMs)
    );

    for (const round of revealedRounds) {
      round.status = 'revealed';
      const pendingPredictions = store.remoteViewingParallelPredictions.filter(
        (prediction) => prediction.roundId === round.id && !prediction.outcome
      );

      for (const prediction of pendingPredictions) {
        try {
          const judged = await judgePredictionWithAi(prediction.prediction, round);
          prediction.outcome = judged.outcome;
          prediction.score = judged.score;
          prediction.rationale = judged.rationale;
          prediction.scoredAt = nowIso();
          prediction.judgeProvider = judged.provider;
          prediction.judgeModel = judged.model;
          round.judgeProvider = judged.provider;
          round.judgeModel = judged.model;
          delete prediction.judgeError;
          changed = true;
        } catch (error) {
          prediction.judgeError = safeTrim(error.message, 300);
          prediction.scoreAttempts = Number(prediction.scoreAttempts || 0) + 1;
          prediction.lastScoreAttemptAt = nowIso();
          changed = true;
        }
      }
    }

    if (changed) {
      persistStore();
    }
  })();

  try {
    await parallelScoringLock;
  } finally {
    parallelScoringLock = null;
  }
}

async function frontloadParallelPreloadedRounds(days, startDate) {
  const start = startDate ? parseRoundDate(startDate) : parseRoundDate(dateKeyUtc());
  const totalDays = clampNumber(Number(days) || PARALLEL_PRELOAD_DEFAULT_DAYS, 1, 730);
  const generated = [];
  const existing = [];
  const failed = [];

  for (let offset = 0; offset < totalDays; offset += 1) {
    const targetDate = new Date(start.getTime());
    targetDate.setUTCDate(start.getUTCDate() + offset);
    const roundDate = dateKeyUtc(targetDate);

    try {
      const round = getParallelRoundByDate(roundDate, PARALLEL_TRACK_PRELOADED);
      if (round && round.imageFilename && round.targetPrompt) {
        existing.push(roundDate);
        continue;
      }

      const ensured = await ensureParallelRound(roundDate, PARALLEL_TRACK_PRELOADED, { forceGenerate: true });
      generated.push({
        roundDate,
        roundId: ensured.id,
        generationMode: ensured.generationMode || 'live',
        reserveItemId: Number.isFinite(Number(ensured.reserveItemId)) ? Number(ensured.reserveItemId) : null
      });
    } catch (error) {
      failed.push({
        roundDate,
        error: normalizeErrorMessage(error, 'Parallel preloaded generation failed')
      });
    }
  }

  return {
    requestedDays: totalDays,
    startDate: dateKeyUtc(start),
    generatedCount: generated.length,
    existingCount: existing.length,
    failedCount: failed.length,
    reserveTakeoverCount: generated.filter((entry) => entry.generationMode === 'reserve').length,
    generated,
    existing,
    failed
  };
}

async function ensureParallelTodayRounds() {
  const today = dateKeyUtc();
  let dynamicRound = getParallelRoundByDate(today, PARALLEL_TRACK_DYNAMIC);
  let preloadedRound = getParallelRoundByDate(today, PARALLEL_TRACK_PRELOADED);
  const errors = [];

  try {
    dynamicRound = await ensureParallelRound(today, PARALLEL_TRACK_DYNAMIC);
  } catch (error) {
    errors.push(`dynamic: ${normalizeErrorMessage(error, 'generation failed')}`);
  }

  try {
    preloadedRound = await ensureParallelRound(today, PARALLEL_TRACK_PRELOADED, { forceGenerate: true });
  } catch (error) {
    errors.push(`preloaded: ${normalizeErrorMessage(error, 'generation failed')}`);
  }

  return { dynamicRound, preloadedRound, errors };
}

async function buildParallelRemoteViewingPayload(userId = null) {
  const reserve = reserveInventorySummary();
  const providerReady = isRemoteViewingReady();
  let engineMessage = providerReady
    ? 'Parallel test tracks online.'
    : reserve.available > 0
      ? 'Provider chain degraded; reserve backup available for takeover.'
      : 'Provider chain unavailable and no reserve images are available.';

  const { dynamicRound, preloadedRound, errors } = await ensureParallelTodayRounds();
  if (errors.length > 0) {
    engineMessage = `${engineMessage} ${errors.join(' | ')}`;
  }

  if (providerReady) {
    try {
      await scorePendingParallelPredictions();
    } catch (error) {
      engineMessage = `${engineMessage} Scoring warning: ${normalizeErrorMessage(error, 'parallel scoring failed')}`;
    }
  }

  const dynamicRevealed = getLatestRevealedParallelRound(PARALLEL_TRACK_DYNAMIC);
  const preloadedRevealed = getLatestRevealedParallelRound(PARALLEL_TRACK_PRELOADED);
  const dynamicStats = parallelTrackAggregate(PARALLEL_TRACK_DYNAMIC);
  const preloadedStats = parallelTrackAggregate(PARALLEL_TRACK_PRELOADED);

  return {
    engine: {
      providerReady,
      reserve,
      message: engineMessage,
      dynamicGenerateAtUtc: `${String(PARALLEL_DYNAMIC_GENERATE_HOUR_UTC).padStart(2, '0')}:${String(
        PARALLEL_DYNAMIC_GENERATE_MINUTE_UTC
      ).padStart(2, '0')}`,
      preloadedDefaultDays: PARALLEL_PRELOAD_DEFAULT_DAYS
    },
    tracks: {
      dynamic: {
        today: serializeParallelRoundForDaily(dynamicRound, userId, false),
        revealed: serializeParallelRoundForDaily(dynamicRevealed, userId, true),
        record: userId === null ? { wins: 0, losses: 0, total: 0, winRate: '0%' } : parallelRecordForUser(userId, PARALLEL_TRACK_DYNAMIC),
        leaderboard: parallelLeaderboard(PARALLEL_TRACK_DYNAMIC, 8)
      },
      preloaded: {
        today: serializeParallelRoundForDaily(preloadedRound, userId, false),
        revealed: serializeParallelRoundForDaily(preloadedRevealed, userId, true),
        record:
          userId === null
            ? { wins: 0, losses: 0, total: 0, winRate: '0%' }
            : parallelRecordForUser(userId, PARALLEL_TRACK_PRELOADED),
        leaderboard: parallelLeaderboard(PARALLEL_TRACK_PRELOADED, 8)
      }
    },
    comparison: {
      dynamic: dynamicStats,
      preloaded: preloadedStats,
      deltaWinRatePct: Number((preloadedStats.winRatePct - dynamicStats.winRatePct).toFixed(2))
    }
  };
}

function serializePrediction(prediction) {
  return {
    id: prediction.id,
    prediction: prediction.prediction,
    createdAt: prediction.createdAt,
    outcome: prediction.outcome || 'pending',
    score: Number.isFinite(Number(prediction.score)) ? Number(prediction.score) : null,
    rationale: prediction.rationale || ''
  };
}

function remoteRecordForUser(userId) {
  const resolved = store.remoteViewingPredictions.filter(
    (prediction) => prediction.userId === userId && (prediction.outcome === 'win' || prediction.outcome === 'loss')
  );

  const wins = resolved.filter((prediction) => prediction.outcome === 'win').length;
  const losses = resolved.filter((prediction) => prediction.outcome === 'loss').length;
  const total = wins + losses;

  return {
    wins,
    losses,
    total,
    winRate: total > 0 ? `${Math.round((wins / total) * 100)}%` : '0%'
  };
}

function remoteLeaderboard(limit = 10) {
  const scoreboard = new Map();

  const increment = (userId, field) => {
    if (!scoreboard.has(userId)) {
      scoreboard.set(userId, { wins: 0, losses: 0 });
    }
    scoreboard.get(userId)[field] += 1;
  };

  store.remoteViewingPredictions.forEach((prediction) => {
    if (prediction.outcome === 'win') {
      increment(prediction.userId, 'wins');
    } else if (prediction.outcome === 'loss') {
      increment(prediction.userId, 'losses');
    }
  });

  return [...scoreboard.entries()]
    .map(([userId, tally]) => {
      const user = store.users.find((entry) => entry.id === userId);
      const total = tally.wins + tally.losses;
      return {
        userId,
        userName: user ? user.name : `User ${userId}`,
        wins: tally.wins,
        losses: tally.losses,
        total,
        winRate: total > 0 ? `${Math.round((tally.wins / total) * 100)}%` : '0%'
      };
    })
    .sort((a, b) => {
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }
      if (a.losses !== b.losses) {
        return a.losses - b.losses;
      }
      return a.userName.localeCompare(b.userName);
    })
    .slice(0, limit);
}

async function scorePendingRemotePredictions() {
  if (!isRemoteViewingReady()) {
    return;
  }

  if (scoringLock) {
    await scoringLock;
    return;
  }

  scoringLock = (async () => {
    const nowMs = Date.now();
    let changed = false;

    const revealedRounds = store.remoteViewingRounds.filter(
      (round) => round.imageFilename && round.targetPrompt && isRoundRevealed(round, nowMs)
    );

    for (const round of revealedRounds) {
      round.status = 'revealed';

      const pendingPredictions = store.remoteViewingPredictions.filter(
        (prediction) => prediction.roundId === round.id && !prediction.outcome
      );

      for (const prediction of pendingPredictions) {
        try {
          const judged = await judgePredictionWithAi(prediction.prediction, round);
          prediction.outcome = judged.outcome;
          prediction.score = judged.score;
          prediction.rationale = judged.rationale;
          prediction.scoredAt = nowIso();
          prediction.judgeProvider = judged.provider;
          prediction.judgeModel = judged.model;
          round.judgeProvider = judged.provider;
          round.judgeModel = judged.model;
          delete prediction.judgeError;
          changed = true;
        } catch (error) {
          prediction.judgeError = safeTrim(error.message, 300);
          prediction.scoreAttempts = Number(prediction.scoreAttempts || 0) + 1;
          prediction.lastScoreAttemptAt = nowIso();
          changed = true;
        }
      }
    }

    if (changed) {
      persistStore();
    }
  })();

  try {
    await scoringLock;
  } finally {
    scoringLock = null;
  }
}

function getLatestRevealedRound() {
  const nowMs = Date.now();

  return store.remoteViewingRounds
    .filter((round) => round.imageFilename && round.targetPrompt && isRoundRevealed(round, nowMs))
    .sort((a, b) => new Date(b.roundDate).getTime() - new Date(a.roundDate).getTime())[0] || null;
}

function serializeRoundForDaily(round, userId = null, includeTarget = false) {
  if (!round) {
    return null;
  }

  const nowMs = Date.now();
  const revealed = isRoundRevealed(round, nowMs);
  const myPrediction =
    userId === null
      ? null
      : store.remoteViewingPredictions.find(
          (prediction) => prediction.roundId === round.id && prediction.userId === userId
        ) || null;

  return {
    id: round.id,
    roundDate: round.roundDate,
    revealAt: round.revealAt,
    status: revealed ? 'revealed' : 'hidden',
    submissionOpen: !revealed,
    generatedAt: round.generatedAt || null,
    promptProvider: round.promptProvider || null,
    imageProvider: round.imageProvider || null,
    judgeProvider: round.judgeProvider || null,
    promptModel: round.promptModel || null,
    imageModel: round.imageModel || null,
    judgeModel: round.judgeModel || null,
    imageFormat: round.imageFormat || null,
    imageFallbackNote: round.imageFallbackNote || null,
    generationMode: round.generationMode || 'live',
    reserveItemId: Number.isFinite(Number(round.reserveItemId)) ? Number(round.reserveItemId) : null,
    reserveUsedAt: round.reserveUsedAt || null,
    xPost: round.xPost || null,
    myPrediction: myPrediction ? serializePrediction(myPrediction) : null,
    imageUrl: includeTarget && revealed ? `/api/remote-viewing/rounds/${round.id}/image` : null,
    targetTitle: includeTarget && revealed ? round.targetTitle : null,
    targetPrompt: includeTarget && revealed ? round.targetPrompt : null
  };
}

async function buildRemoteViewingDailyPayload(userId = null) {
  const failoverOrder = buildFailoverOrder();
  const providerReady = isRemoteViewingReady();
  const reserveBefore = reserveInventorySummary();
  let engineReady = providerReady || reserveBefore.available > 0;
  let engineMessage = providerReady
    ? 'Remote viewing engines online.'
    : reserveBefore.available > 0
      ? 'Provider chain degraded; reserve backup is online.'
      : 'No usable provider chain. Configure ANTHROPIC_API_KEY and OPENROUTER_API_KEY (or OPENAI_API_KEY).';

  let todayRound = getRoundByDate(dateKeyUtc());

  if (!todayRound && (providerReady || reserveBefore.available > 0)) {
    try {
      todayRound = await ensureRemoteViewingRound(dateKeyUtc());
    } catch (error) {
      engineReady = reserveInventorySummary().available > 0;
      engineMessage = normalizeErrorMessage(
        error,
        'Generation failed. Check provider quotas, billing, and model access.'
      );
    }
  }

  if (providerReady) {
    try {
      await scorePendingRemotePredictions();
    } catch (error) {
      engineReady = false;
      engineMessage = normalizeErrorMessage(
        error,
        'Scoring failed. Check provider quotas, billing, and model access.'
      );
    }
  }

  const revealedRound = getLatestRevealedRound();
  const reserveTakeoverInEffect = todayRound && todayRound.generationMode === 'reserve';
  if (reserveTakeoverInEffect) {
    engineMessage = `Primary generation failed, reserve image used for ${todayRound.roundDate}. ${engineMessage}`;
  }
  const reserve = reserveInventorySummary();

  return {
    engine: {
      provider: failoverOrder.prompt[0] || null,
      ready: engineReady,
      failoverOrder,
      configured: {
        anthropic: Boolean(ANTHROPIC_API_KEY),
        openrouter: Boolean(OPENROUTER_API_KEY),
        openai: Boolean(OPENAI_API_KEY)
      },
      defaults: {
        anthropicTextModel: ANTHROPIC_TEXT_MODEL,
        anthropicJudgeModel: ANTHROPIC_JUDGE_MODEL,
        openrouterTextModel: OPENROUTER_TEXT_MODEL,
        openrouterJudgeModel: OPENROUTER_JUDGE_MODEL,
        openrouterImageModel: OPENROUTER_IMAGE_MODEL,
        openaiTextModel: OPENAI_TEXT_MODEL,
        openaiJudgeModel: OPENAI_JUDGE_MODEL,
        openaiImageModel: OPENAI_IMAGE_MODEL
      },
      reserve,
      message: engineMessage,
      xAutoPostEnabled: X_AUTOPOST_ENABLED,
      xCredentialsReady: hasXCredentials()
    },
    today: serializeRoundForDaily(todayRound, userId, false),
    revealed: serializeRoundForDaily(revealedRound, userId, true),
    record: userId === null ? { wins: 0, losses: 0, total: 0, winRate: '0%' } : remoteRecordForUser(userId),
    leaderboard: remoteLeaderboard(12)
  };
}

function getRoundImageFile(round) {
  if (!round || !round.imageFilename) {
    return null;
  }

  return getStoredImageFile(round.imageFilename, REMOTE_VIEWING_IMAGE_DIR, round.imageFormat);
}

function detectImageContentType(extOrMime) {
  const normalized = String(extOrMime || '')
    .trim()
    .toLowerCase();

  if (normalized === 'image/jpeg' || normalized === '.jpeg' || normalized === '.jpg' || normalized === 'jpg') {
    return 'image/jpeg';
  }
  if (normalized === 'image/png' || normalized === '.png' || normalized === 'png') {
    return 'image/png';
  }
  if (normalized === 'image/webp' || normalized === '.webp' || normalized === 'webp') {
    return 'image/webp';
  }
  if (normalized === 'image/gif' || normalized === '.gif' || normalized === 'gif') {
    return 'image/gif';
  }
  if (normalized === 'image/svg+xml' || normalized === '.svg' || normalized === 'svg') {
    return 'image/svg+xml; charset=utf-8';
  }
  return 'application/octet-stream';
}

function getStoredImageFile(imageFilename, baseDir, imageFormatOrMime = '') {
  const filename = path.basename(String(imageFilename || ''));
  if (!filename) {
    return null;
  }

  const absolutePath = path.join(baseDir, filename);
  if (!absolutePath.startsWith(baseDir)) {
    return null;
  }

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  const stats = fs.statSync(absolutePath);
  if (!stats.isFile()) {
    return null;
  }

  const ext = path.extname(absolutePath).toLowerCase();
  const contentType = detectImageContentType(imageFormatOrMime || ext);

  return { absolutePath, contentType };
}

function parseCommunityImageDataUrl(dataUrl) {
  const raw = String(dataUrl || '').trim();
  const match = raw.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) {
    throw new Error('Image must be a PNG, JPG, WEBP, or GIF data URL');
  }

  const mimeType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  const base64Payload = match[2].replace(/\s+/g, '');
  const buffer = Buffer.from(base64Payload, 'base64');
  if (!buffer.length) {
    throw new Error('Uploaded image is empty');
  }

  if (buffer.length > MAX_COMMUNITY_UPLOAD_BYTES) {
    throw new Error('Uploaded image exceeds 8MB limit');
  }

  let extension = 'png';
  if (mimeType === 'image/jpeg') {
    extension = 'jpg';
  } else if (mimeType === 'image/webp') {
    extension = 'webp';
  } else if (mimeType === 'image/gif') {
    extension = 'gif';
  }

  return { buffer, mimeType, extension };
}

function getCommunityRoundById(roundId) {
  return store.communityViewingRounds.find((round) => round.id === roundId) || null;
}

function communityRoundIsRevealed(round, atMs = Date.now()) {
  return new Date(round.revealAt).getTime() <= atMs;
}

function serializeCommunityPrediction(prediction) {
  const user = store.users.find((entry) => entry.id === prediction.userId);
  return {
    id: prediction.id,
    userId: prediction.userId,
    userName: user ? user.name : `User ${prediction.userId}`,
    prediction: prediction.prediction,
    createdAt: prediction.createdAt,
    updatedAt: prediction.updatedAt || null
  };
}

function serializeCommunityRound(round, userId = null, includeImage = false) {
  if (!round) {
    return null;
  }

  const revealed = communityRoundIsRevealed(round);
  const createdByUser = store.users.find((entry) => entry.id === round.createdBy);
  const myPrediction =
    userId === null
      ? null
      : store.communityViewingPredictions.find(
          (prediction) => prediction.roundId === round.id && prediction.userId === userId
        ) || null;

  const predictions = revealed
    ? store.communityViewingPredictions
        .filter((prediction) => prediction.roundId === round.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((prediction) => serializeCommunityPrediction(prediction))
    : [];

  return {
    id: round.id,
    tenantId: round.tenantId,
    title: round.title,
    briefing: round.briefing || '',
    revealAt: round.revealAt,
    createdAt: round.createdAt,
    status: revealed ? 'revealed' : 'hidden',
    submissionOpen: !revealed,
    submissionCount: store.communityViewingPredictions.filter((prediction) => prediction.roundId === round.id).length,
    createdBy: createdByUser
      ? { id: createdByUser.id, name: createdByUser.name, email: createdByUser.email }
      : { id: round.createdBy, name: 'Unknown', email: '' },
    myPrediction: myPrediction ? serializeCommunityPrediction(myPrediction) : null,
    imageUrl: includeImage && revealed ? `/api/community-viewing/rounds/${round.id}/image` : null,
    predictions
  };
}

function buildCommunityViewingPayload(tenantId, userId = null) {
  const rounds = store.communityViewingRounds
    .filter((round) => round.tenantId === tenantId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const active = rounds.find((round) => !communityRoundIsRevealed(round)) || null;
  const revealed = rounds.find((round) => communityRoundIsRevealed(round)) || null;

  return {
    active: serializeCommunityRound(active, userId, false),
    revealed: serializeCommunityRound(revealed, userId, true),
    queue: rounds.slice(0, 8).map((round) => serializeCommunityRound(round, userId, false))
  };
}

function ensureRoundForPredictionSubmission() {
  const today = dateKeyUtc();
  return ensureRemoteViewingRound(today);
}

function fixedEncode(input) {
  return encodeURIComponent(input)
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function buildOAuth1Header(method, requestUrl) {
  const oauthParams = {
    oauth_consumer_key: X_API_KEY,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: X_ACCESS_TOKEN,
    oauth_version: '1.0'
  };

  const url = new URL(requestUrl);
  const normalizedUrl = `${url.protocol}//${url.host}${url.pathname}`;

  const allParams = [];
  Object.keys(oauthParams).forEach((key) => {
    allParams.push([fixedEncode(key), fixedEncode(oauthParams[key])]);
  });
  url.searchParams.forEach((value, key) => {
    allParams.push([fixedEncode(key), fixedEncode(value)]);
  });

  allParams.sort((a, b) => {
    if (a[0] === b[0]) {
      return a[1].localeCompare(b[1]);
    }
    return a[0].localeCompare(b[0]);
  });

  const parameterString = allParams.map(([k, v]) => `${k}=${v}`).join('&');
  const signatureBase = [
    method.toUpperCase(),
    fixedEncode(normalizedUrl),
    fixedEncode(parameterString)
  ].join('&');

  const signingKey = `${fixedEncode(X_API_KEY_SECRET)}&${fixedEncode(X_ACCESS_TOKEN_SECRET)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');
  oauthParams.oauth_signature = signature;

  const header = `OAuth ${Object.entries(oauthParams)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${fixedEncode(key)}=\"${fixedEncode(value)}\"`)
    .join(', ')}`;

  return header;
}

async function postToX(text) {
  if (!hasXCredentials()) {
    throw new Error('X credentials are missing. Set X_API_KEY, X_API_KEY_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET.');
  }

  const endpoint = `${X_API_BASE_URL}/2/tweets`;
  const authHeader = buildOAuth1Header('POST', endpoint);
  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text })
  });

  const raw = await response.text();
  let parsed = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch (_error) {
      parsed = {};
    }
  }

  if (!response.ok) {
    const errorMessage = parsed?.title || parsed?.detail || raw || `status ${response.status}`;
    throw new Error(`X API error: ${errorMessage}`);
  }

  const tweetId = parsed?.data?.id;
  if (!tweetId) {
    throw new Error('X API response did not include tweet id');
  }

  return {
    id: tweetId,
    url: `https://x.com/i/web/status/${tweetId}`
  };
}

function composeRoundPostText(round) {
  const imageLink = PUBLIC_BASE_URL
    ? `${PUBLIC_BASE_URL}/api/remote-viewing/rounds/${round.id}/image`
    : `/api/remote-viewing/rounds/${round.id}/image`;
  const title = safeTrim(round.targetTitle || 'Remote Viewing Target', 120);

  const lines = [
    `Remote Viewing Reveal ${round.roundDate}`,
    `${title}`,
    `Target image: ${imageLink}`,
    '#RemoteViewing #SignalScope'
  ];

  return safeTrim(lines.join('\n'), 280);
}

function listRevealedRoundsWithoutXPost() {
  const nowMs = Date.now();
  return store.remoteViewingRounds
    .filter((round) => round.imageFilename && round.targetPrompt && isRoundRevealed(round, nowMs) && !round.xPost?.id)
    .sort((a, b) => new Date(a.roundDate).getTime() - new Date(b.roundDate).getTime());
}

async function maybeAutoPostRevealedRoundsToX() {
  if (!X_AUTOPOST_ENABLED || !hasXCredentials()) {
    return;
  }

  const pending = listRevealedRoundsWithoutXPost();
  if (pending.length === 0) {
    return;
  }

  for (const round of pending) {
    try {
      const postResult = await postToX(composeRoundPostText(round));
      round.xPost = {
        id: postResult.id,
        url: postResult.url,
        postedAt: nowIso()
      };
      persistStore();
    } catch (error) {
      round.xPost = {
        id: '',
        url: '',
        postedAt: '',
        error: normalizeErrorMessage(error, 'X posting failed'),
        lastAttemptAt: nowIso()
      };
      persistStore();
      break;
    }
  }
}

async function frontloadRemoteViewingRounds(days, startDate) {
  if (!isRemoteViewingReady()) {
    throw new Error(
      'No usable provider chain. Configure ANTHROPIC_API_KEY and OPENROUTER_API_KEY (or OPENAI_API_KEY).'
    );
  }

  const start = startDate ? parseRoundDate(startDate) : parseRoundDate(dateKeyUtc());
  const totalDays = clampNumber(Number(days) || 30, 1, 120);
  const generated = [];
  const existing = [];
  const failed = [];

  for (let offset = 0; offset < totalDays; offset += 1) {
    const targetDate = new Date(start.getTime());
    targetDate.setUTCDate(start.getUTCDate() + offset);
    const roundDate = dateKeyUtc(targetDate);

    try {
      const round = getRoundByDate(roundDate);
      if (round && round.imageFilename && round.targetPrompt) {
        existing.push(roundDate);
        continue;
      }

      const ensured = await ensureRemoteViewingRound(roundDate);
      generated.push({
        roundDate,
        roundId: ensured.id,
        promptProvider: ensured.promptProvider || null,
        imageProvider: ensured.imageProvider || null,
        generationMode: ensured.generationMode || 'live',
        reserveItemId: Number.isFinite(Number(ensured.reserveItemId)) ? Number(ensured.reserveItemId) : null
      });
    } catch (error) {
      failed.push({
        roundDate,
        error: normalizeErrorMessage(error, 'Unknown generation error')
      });
    }
  }

  return {
    requestedDays: totalDays,
    startDate: dateKeyUtc(start),
    generatedCount: generated.length,
    existingCount: existing.length,
    failedCount: failed.length,
    reserveTakeoverCount: generated.filter((item) => item.generationMode === 'reserve').length,
    generated,
    existing,
    failed
  };
}

async function handleApi(req, res, pathname, searchParams) {
  if (req.method === 'GET' && pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      timestamp: nowIso(),
      remoteViewingEngineReady: isRemoteViewingReady(),
      persistence: {
        backend: storageBackend,
        databaseConfigured: Boolean(DATABASE_URL)
      }
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/register') {
    const body = await parseJsonBody(req);
    const name = safeTrim(body.name, 80);
    const email = safeTrim(body.email, 200).toLowerCase();
    const password = String(body.password || '');

    if (!name || !email || password.length < 6) {
      sendError(res, 400, 'Name, email, and a password of at least 6 characters are required');
      return;
    }

    const exists = store.users.some((user) => user.email === email);
    if (exists) {
      sendError(res, 409, 'An account with this email already exists');
      return;
    }

    const user = {
      id: nextId('user'),
      name,
      email,
      passwordHash: createPasswordHash(password),
      role: 'member',
      createdAt: nowIso()
    };

    store.users.push(user);

    const defaultTenant = store.tenants[0];
    if (defaultTenant) {
      ensureMembership(user.id, defaultTenant.id);
    }

    const token = crypto.randomBytes(24).toString('hex');
    store.sessions.push({
      token,
      userId: user.id,
      createdAt: nowIso(),
      lastSeenAt: nowIso()
    });

    persistStore();
    sendJson(res, 201, { token, user: userResponse(user) });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const body = await parseJsonBody(req);
    const email = safeTrim(body.email, 200).toLowerCase();
    const password = String(body.password || '');

    const user = store.users.find((entry) => entry.email === email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      sendError(res, 401, 'Invalid email or password');
      return;
    }

    const token = crypto.randomBytes(24).toString('hex');
    store.sessions.push({
      token,
      userId: user.id,
      createdAt: nowIso(),
      lastSeenAt: nowIso()
    });

    persistStore();
    sendJson(res, 200, { token, user: userResponse(user) });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    const auth = requireAuth(req, res);
    if (!auth) {
      return;
    }

    store.sessions = store.sessions.filter((session) => session.token !== auth.token);
    persistStore();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/auth/me') {
    const auth = requireAuth(req, res);
    if (!auth) {
      return;
    }

    sendJson(res, 200, { user: userResponse(auth.user) });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/remote-viewing/daily') {
    const auth = getAuthContext(req);
    const payload = await buildRemoteViewingDailyPayload(auth.user?.id || null);
    await maybeAutoPostRevealedRoundsToX();
    sendJson(res, 200, payload);
    return;
  }

  if (req.method === 'GET' && pathname === '/api/remote-viewing/parallel/daily') {
    const auth = getAuthContext(req);
    const payload = await buildParallelRemoteViewingPayload(auth.user?.id || null);
    sendJson(res, 200, payload);
    return;
  }

  const tenantCommunityMatch = pathname.match(/^\/api\/tenants\/(\d+)\/community-viewing$/);
  if (req.method === 'GET' && tenantCommunityMatch) {
    const tenantId = Number(tenantCommunityMatch[1]);
    const tenant = store.tenants.find((item) => item.id === tenantId);
    if (!tenant) {
      sendError(res, 404, 'Tenant not found');
      return;
    }

    const auth = getAuthContext(req);
    const payload = buildCommunityViewingPayload(tenantId, auth.user?.id || null);
    sendJson(res, 200, payload);
    return;
  }

  const tenantCommunityRoundsMatch = pathname.match(/^\/api\/tenants\/(\d+)\/community-viewing\/rounds$/);
  if (req.method === 'POST' && tenantCommunityRoundsMatch) {
    const auth = requireAuth(req, res);
    if (!auth) {
      return;
    }

    const tenantId = Number(tenantCommunityRoundsMatch[1]);
    const tenant = store.tenants.find((item) => item.id === tenantId);
    if (!tenant) {
      sendError(res, 404, 'Tenant not found');
      return;
    }

    const body = await parseJsonBody(req, COMMUNITY_UPLOAD_JSON_BODY_BYTES);
    const title = safeTrim(body.title, 140);
    const briefing = safeTrim(body.briefing, 900);
    const revealHoursRaw = Number(body.revealHours);
    const revealHours = Number.isFinite(revealHoursRaw) ? clampNumber(revealHoursRaw, 0, 168) : 24;
    const imageDataUrl = body.imageDataUrl;

    if (title.length < 3) {
      sendError(res, 400, 'Title must be at least 3 characters');
      return;
    }

    if (!imageDataUrl) {
      sendError(res, 400, 'Image upload is required');
      return;
    }

    let parsedImage;
    try {
      parsedImage = parseCommunityImageDataUrl(imageDataUrl);
    } catch (error) {
      sendError(res, 400, normalizeErrorMessage(error, 'Invalid image upload'));
      return;
    }

    ensureMembership(auth.user.id, tenantId);

    const roundId = nextId('communityRound');
    const imageFilename = `community-round-${tenantId}-${roundId}-${Date.now()}.${parsedImage.extension}`;
    const imagePath = path.join(COMMUNITY_VIEWING_IMAGE_DIR, imageFilename);
    fs.writeFileSync(imagePath, parsedImage.buffer);

    const round = {
      id: roundId,
      tenantId,
      createdBy: auth.user.id,
      title,
      briefing,
      imageFilename,
      imageFormat: parsedImage.extension,
      imageMimeType: parsedImage.mimeType,
      revealAt: new Date(Date.now() + revealHours * 60 * 60 * 1000).toISOString(),
      createdAt: nowIso()
    };

    store.communityViewingRounds.push(round);
    persistStore();

    sendJson(res, 201, { round: serializeCommunityRound(round, auth.user.id, false) });
    return;
  }

  const tenantCommunityPredictionMatch = pathname.match(
    /^\/api\/tenants\/(\d+)\/community-viewing\/rounds\/(\d+)\/predictions$/
  );
  if (req.method === 'POST' && tenantCommunityPredictionMatch) {
    const auth = requireAuth(req, res);
    if (!auth) {
      return;
    }

    const tenantId = Number(tenantCommunityPredictionMatch[1]);
    const roundId = Number(tenantCommunityPredictionMatch[2]);
    const round = getCommunityRoundById(roundId);
    if (!round || round.tenantId !== tenantId) {
      sendError(res, 404, 'Community round not found');
      return;
    }

    if (communityRoundIsRevealed(round)) {
      sendError(res, 400, 'Predictions are closed for this community round');
      return;
    }

    const body = await parseJsonBody(req);
    const predictionText = safeTrim(body.prediction, 1200);
    if (predictionText.length < 8) {
      sendError(res, 400, 'Prediction must be at least 8 characters long');
      return;
    }

    ensureMembership(auth.user.id, tenantId);

    const existing = store.communityViewingPredictions.find(
      (prediction) => prediction.roundId === round.id && prediction.userId === auth.user.id
    );
    if (existing) {
      existing.prediction = predictionText;
      existing.updatedAt = nowIso();
      persistStore();
      sendJson(res, 200, { prediction: serializeCommunityPrediction(existing) });
      return;
    }

    const prediction = {
      id: nextId('communityPrediction'),
      roundId: round.id,
      tenantId,
      userId: auth.user.id,
      prediction: predictionText,
      createdAt: nowIso(),
      updatedAt: null
    };
    store.communityViewingPredictions.push(prediction);
    persistStore();
    sendJson(res, 201, { prediction: serializeCommunityPrediction(prediction) });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/remote-viewing/frontload') {
    const auth = requireAuth(req, res);
    if (!auth) {
      return;
    }

    const body = await parseJsonBody(req);
    const days = clampNumber(Number(body.days) || 30, 1, 120);
    const startDate = body.startDate ? safeTrim(body.startDate, 10) : '';
    if (startDate) {
      try {
        parseRoundDate(startDate);
      } catch (_error) {
        sendError(res, 400, 'Invalid startDate format. Use YYYY-MM-DD.');
        return;
      }
    }

    const result = await frontloadRemoteViewingRounds(days, startDate || dateKeyUtc());
    await maybeAutoPostRevealedRoundsToX();
    sendJson(res, 200, result);
    return;
  }

  if (req.method === 'POST' && pathname === '/api/remote-viewing/parallel/frontload-preloaded') {
    const auth = requireAuth(req, res);
    if (!auth) {
      return;
    }

    const body = await parseJsonBody(req);
    const days = clampNumber(Number(body.days) || PARALLEL_PRELOAD_DEFAULT_DAYS, 1, 730);
    const startDate = body.startDate ? safeTrim(body.startDate, 10) : '';
    if (startDate) {
      try {
        parseRoundDate(startDate);
      } catch (_error) {
        sendError(res, 400, 'Invalid startDate format. Use YYYY-MM-DD.');
        return;
      }
    }

    const result = await frontloadParallelPreloadedRounds(days, startDate || dateKeyUtc());
    sendJson(res, 200, result);
    return;
  }

  if (req.method === 'POST' && pathname === '/api/remote-viewing/reserve/frontload') {
    const auth = requireAuth(req, res);
    if (!auth) {
      return;
    }

    const body = await parseJsonBody(req);
    const targetAvailable = clampNumber(Number(body.targetAvailable) || 30, 1, 120);
    const result = await frontloadRemoteViewingReserveItems(targetAvailable);
    sendJson(res, 200, result);
    return;
  }

  if (req.method === 'POST' && pathname === '/api/remote-viewing/predictions') {
    const auth = requireAuth(req, res);
    if (!auth) {
      return;
    }

    const reserve = reserveInventorySummary();
    const existingTodayRound = getRoundByDate(dateKeyUtc());
    if (!isRemoteViewingReady() && reserve.available === 0 && !existingTodayRound) {
      sendError(
        res,
        503,
        'No usable provider chain and no reserve images are available. Configure providers or refill reserve pool.'
      );
      return;
    }

    const body = await parseJsonBody(req);
    const predictionText = safeTrim(body.prediction, 1200);
    if (predictionText.length < 8) {
      sendError(res, 400, 'Prediction must be at least 8 characters long');
      return;
    }

    let todayRound;
    try {
      todayRound = await ensureRoundForPredictionSubmission();
    } catch (error) {
      sendError(
        res,
        503,
        normalizeErrorMessage(
          error,
          'Remote viewing generation is currently unavailable. Check OpenAI quota/billing.'
        )
      );
      return;
    }

    if (!todayRound) {
      sendError(res, 500, 'Unable to initialize today\'s remote viewing round');
      return;
    }

    if (isRoundRevealed(todayRound)) {
      sendError(res, 400, 'Predictions are closed for today. Wait for the next round.');
      return;
    }

    const existing = store.remoteViewingPredictions.find(
      (prediction) => prediction.roundId === todayRound.id && prediction.userId === auth.user.id
    );

    if (existing) {
      existing.prediction = predictionText;
      existing.updatedAt = nowIso();
      existing.outcome = '';
      existing.score = null;
      existing.rationale = '';
      existing.scoredAt = null;
      delete existing.judgeError;
      delete existing.scoreAttempts;
      delete existing.lastScoreAttemptAt;

      persistStore();
      sendJson(res, 200, { prediction: serializePrediction(existing) });
      return;
    }

    const prediction = {
      id: nextId('remotePrediction'),
      roundId: todayRound.id,
      userId: auth.user.id,
      prediction: predictionText,
      createdAt: nowIso(),
      outcome: '',
      score: null,
      rationale: '',
      scoredAt: null
    };

    store.remoteViewingPredictions.push(prediction);
    persistStore();

    sendJson(res, 201, { prediction: serializePrediction(prediction) });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/remote-viewing/parallel/predictions') {
    const auth = requireAuth(req, res);
    if (!auth) {
      return;
    }

    const body = await parseJsonBody(req);
    const track = safeTrim(body.track, 24).toLowerCase();
    const predictionText = safeTrim(body.prediction, 1200);

    if (track !== PARALLEL_TRACK_DYNAMIC && track !== PARALLEL_TRACK_PRELOADED) {
      sendError(res, 400, 'Track must be dynamic or preloaded');
      return;
    }

    if (predictionText.length < 8) {
      sendError(res, 400, 'Prediction must be at least 8 characters long');
      return;
    }

    let todayRound;
    try {
      todayRound = await ensureParallelRound(dateKeyUtc(), track, {
        forceGenerate: track === PARALLEL_TRACK_PRELOADED
      });
    } catch (error) {
      sendError(
        res,
        503,
        normalizeErrorMessage(
          error,
          'Parallel remote-viewing generation is currently unavailable. Refill reserve or restore provider access.'
        )
      );
      return;
    }

    if (!todayRound) {
      sendError(res, 500, 'Unable to initialize today\'s parallel remote viewing round');
      return;
    }

    if (isRoundRevealed(todayRound)) {
      sendError(res, 400, 'Predictions are closed for this track today. Wait for the next round.');
      return;
    }

    const existing = store.remoteViewingParallelPredictions.find(
      (prediction) =>
        prediction.roundId === todayRound.id && prediction.userId === auth.user.id && prediction.track === track
    );

    if (existing) {
      existing.prediction = predictionText;
      existing.updatedAt = nowIso();
      existing.outcome = '';
      existing.score = null;
      existing.rationale = '';
      existing.scoredAt = null;
      delete existing.judgeError;
      delete existing.scoreAttempts;
      delete existing.lastScoreAttemptAt;

      persistStore();
      sendJson(res, 200, { prediction: serializePrediction(existing) });
      return;
    }

    const prediction = {
      id: nextId('remoteParallelPrediction'),
      roundId: todayRound.id,
      userId: auth.user.id,
      track,
      prediction: predictionText,
      createdAt: nowIso(),
      outcome: '',
      score: null,
      rationale: '',
      scoredAt: null
    };

    store.remoteViewingParallelPredictions.push(prediction);
    persistStore();
    sendJson(res, 201, { prediction: serializePrediction(prediction) });
    return;
  }

  const roundImageMatch = pathname.match(/^\/api\/remote-viewing\/rounds\/(\d+)\/image$/);
  const parallelRoundImageMatch = pathname.match(/^\/api\/remote-viewing\/parallel\/rounds\/(\d+)\/image$/);
  const communityRoundImageMatch = pathname.match(/^\/api\/community-viewing\/rounds\/(\d+)\/image$/);
  if (req.method === 'GET' && parallelRoundImageMatch) {
    const roundId = Number(parallelRoundImageMatch[1]);
    const round = getParallelRoundById(roundId);
    if (!round) {
      sendError(res, 404, 'Parallel remote viewing round not found');
      return;
    }

    if (!isRoundRevealed(round)) {
      sendError(res, 403, 'Image is locked until reveal time');
      return;
    }

    const imageFile = getRoundImageFile(round);
    if (!imageFile) {
      sendError(res, 404, 'Image file not found');
      return;
    }

    fs.readFile(imageFile.absolutePath, (error, data) => {
      if (error) {
        sendError(res, 500, 'Unable to read image file');
        return;
      }

      res.writeHead(200, {
        'Content-Type': imageFile.contentType,
        'Cache-Control': 'no-store'
      });
      res.end(data);
    });
    return;
  }

  if (req.method === 'GET' && roundImageMatch) {
    const roundId = Number(roundImageMatch[1]);
    const round = store.remoteViewingRounds.find((item) => item.id === roundId);
    if (!round) {
      sendError(res, 404, 'Remote viewing round not found');
      return;
    }

    if (!isRoundRevealed(round)) {
      sendError(res, 403, 'Image is locked until reveal time');
      return;
    }

    const imageFile = getRoundImageFile(round);
    if (!imageFile) {
      sendError(res, 404, 'Image file not found');
      return;
    }

    fs.readFile(imageFile.absolutePath, (error, data) => {
      if (error) {
        sendError(res, 500, 'Unable to read image file');
        return;
      }

      res.writeHead(200, {
        'Content-Type': imageFile.contentType,
        'Cache-Control': 'no-store'
      });
      res.end(data);
    });
    return;
  }

  if (req.method === 'GET' && communityRoundImageMatch) {
    const roundId = Number(communityRoundImageMatch[1]);
    const round = getCommunityRoundById(roundId);
    if (!round) {
      sendError(res, 404, 'Community viewing round not found');
      return;
    }

    if (!communityRoundIsRevealed(round)) {
      sendError(res, 403, 'Image is locked until reveal time');
      return;
    }

    const imageFile = getStoredImageFile(
      round.imageFilename,
      COMMUNITY_VIEWING_IMAGE_DIR,
      round.imageMimeType || round.imageFormat
    );
    if (!imageFile) {
      sendError(res, 404, 'Image file not found');
      return;
    }

    fs.readFile(imageFile.absolutePath, (error, data) => {
      if (error) {
        sendError(res, 500, 'Unable to read image file');
        return;
      }

      res.writeHead(200, {
        'Content-Type': imageFile.contentType,
        'Cache-Control': 'no-store'
      });
      res.end(data);
    });
    return;
  }

  const roundXPostMatch = pathname.match(/^\/api\/remote-viewing\/rounds\/(\d+)\/x-post$/);
  if (req.method === 'POST' && roundXPostMatch) {
    const auth = requireAuth(req, res);
    if (!auth) {
      return;
    }

    if (!hasXCredentials()) {
      sendError(
        res,
        503,
        'X credentials are missing. Set X_API_KEY, X_API_KEY_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET.'
      );
      return;
    }

    const roundId = Number(roundXPostMatch[1]);
    const round = store.remoteViewingRounds.find((item) => item.id === roundId);
    if (!round) {
      sendError(res, 404, 'Remote viewing round not found');
      return;
    }

    if (!isRoundRevealed(round)) {
      sendError(res, 400, 'Round is not revealed yet');
      return;
    }

    const postResult = await postToX(composeRoundPostText(round));
    round.xPost = {
      id: postResult.id,
      url: postResult.url,
      postedAt: nowIso()
    };
    persistStore();

    sendJson(res, 200, { xPost: round.xPost });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/tenants') {
    const auth = getAuthContext(req);
    const list = store.tenants.map((tenant) => serializeTenantSummary(tenant, auth.user?.id || null));
    sendJson(res, 200, { tenants: list });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/tenants') {
    const auth = requireAuth(req, res);
    if (!auth) {
      return;
    }

    const body = await parseJsonBody(req);
    const name = safeTrim(body.name, 90);
    const tagline = safeTrim(body.tagline, 140);
    const description = safeTrim(body.description, 560);

    if (!name || !tagline || !description) {
      sendError(res, 400, 'Name, tagline, and description are required');
      return;
    }

    const slugBase = slugify(name) || `tenant-${Date.now()}`;
    let slug = slugBase;
    let increment = 2;
    while (store.tenants.some((tenant) => tenant.slug === slug)) {
      slug = `${slugBase}-${increment}`;
      increment += 1;
    }

    const tenant = {
      id: nextId('tenant'),
      slug,
      name,
      tagline,
      description,
      theme: randomThemeFromName(name),
      createdBy: auth.user.id,
      createdAt: nowIso()
    };

    store.tenants.push(tenant);
    store.channels.push(
      { id: nextId('channel'), tenantId: tenant.id, name: '#general' },
      { id: nextId('channel'), tenantId: tenant.id, name: '#evidence-desk' },
      { id: nextId('channel'), tenantId: tenant.id, name: '#theory-lab' }
    );

    store.rooms.push({
      id: nextId('room'),
      tenantId: tenant.id,
      name: 'Founders Room',
      topic: 'Define initial investigation rules',
      schedule: 'Tonight 9:00 PM',
      attendees: '0 members',
      createdAt: nowIso()
    });

    ensureMembership(auth.user.id, tenant.id, 'owner');

    persistStore();
    sendJson(res, 201, { tenant: serializeTenantSummary(tenant, auth.user.id) });
    return;
  }

  const tenantDetailMatch = pathname.match(/^\/api\/tenants\/(\d+)$/);
  if (req.method === 'GET' && tenantDetailMatch) {
    const tenantId = Number(tenantDetailMatch[1]);
    const tenant = store.tenants.find((item) => item.id === tenantId);
    if (!tenant) {
      sendError(res, 404, 'Tenant not found');
      return;
    }

    const auth = getAuthContext(req);
    sendJson(res, 200, { tenant: serializeTenantDetail(tenant, auth.user?.id || null) });
    return;
  }

  const tenantPostsMatch = pathname.match(/^\/api\/tenants\/(\d+)\/posts$/);
  if (tenantPostsMatch) {
    const tenantId = Number(tenantPostsMatch[1]);
    const tenant = store.tenants.find((item) => item.id === tenantId);
    if (!tenant) {
      sendError(res, 404, 'Tenant not found');
      return;
    }

    if (req.method === 'GET') {
      const filter = searchParams.get('filter') || 'all';
      const sort = searchParams.get('sort') || 'hot';
      const posts = sortedTenantPosts(tenantId, filter, sort);
      sendJson(res, 200, { posts });
      return;
    }

    if (req.method === 'POST') {
      const auth = requireAuth(req, res);
      if (!auth) {
        return;
      }

      const body = await parseJsonBody(req);
      const type = safeTrim(body.type, 20).toLowerCase();
      const title = safeTrim(body.title, 180);
      const summary = safeTrim(body.summary, 1200);
      const url = safeTrim(body.url, 1024);
      const status = safeTrim(body.status, 40) || 'new';
      const tags = parseTags(body.tags);

      if (!['video', 'podcast', 'meme', 'brief'].includes(type)) {
        sendError(res, 400, 'Invalid media type');
        return;
      }

      if (!title || !summary || !url) {
        sendError(res, 400, 'Title, summary, and source URL are required');
        return;
      }

      ensureMembership(auth.user.id, tenantId);

      const post = {
        id: nextId('post'),
        tenantId,
        authorId: auth.user.id,
        type,
        title,
        summary,
        url,
        source: body.source ? safeTrim(body.source, 120) : `Source • ${hostnameFromUrl(url)}`,
        tags,
        clues: Number(body.clues) > 0 ? Math.min(Number(body.clues), 9999) : 0,
        upvotes: 1,
        status,
        createdAt: nowIso()
      };

      store.posts.push(post);
      persistStore();
      sendJson(res, 201, { post: serializePost(post) });
      return;
    }
  }

  const postUpvoteMatch = pathname.match(/^\/api\/posts\/(\d+)\/upvote$/);
  if (req.method === 'POST' && postUpvoteMatch) {
    const auth = requireAuth(req, res);
    if (!auth) {
      return;
    }

    const postId = Number(postUpvoteMatch[1]);
    const post = store.posts.find((item) => item.id === postId);
    if (!post) {
      sendError(res, 404, 'Post not found');
      return;
    }

    ensureMembership(auth.user.id, post.tenantId);
    post.upvotes += 1;
    persistStore();
    sendJson(res, 200, { upvotes: post.upvotes });
    return;
  }

  const postCommentsMatch = pathname.match(/^\/api\/posts\/(\d+)\/comments$/);
  if (postCommentsMatch) {
    const postId = Number(postCommentsMatch[1]);
    const post = store.posts.find((item) => item.id === postId);
    if (!post) {
      sendError(res, 404, 'Post not found');
      return;
    }

    if (req.method === 'GET') {
      const comments = store.comments
        .filter((comment) => comment.postId === postId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((comment) => serializeComment(comment));
      sendJson(res, 200, { comments });
      return;
    }

    if (req.method === 'POST') {
      const auth = requireAuth(req, res);
      if (!auth) {
        return;
      }

      const body = await parseJsonBody(req);
      const commentBody = safeTrim(body.body, 1200);
      if (!commentBody) {
        sendError(res, 400, 'Comment body is required');
        return;
      }

      ensureMembership(auth.user.id, post.tenantId);

      const comment = {
        id: nextId('comment'),
        postId,
        authorId: auth.user.id,
        body: commentBody,
        createdAt: nowIso()
      };

      store.comments.push(comment);
      persistStore();
      sendJson(res, 201, { comment: serializeComment(comment) });
      return;
    }
  }

  const tenantCasesMatch = pathname.match(/^\/api\/tenants\/(\d+)\/cases$/);
  if (tenantCasesMatch) {
    const tenantId = Number(tenantCasesMatch[1]);
    const tenant = store.tenants.find((item) => item.id === tenantId);
    if (!tenant) {
      sendError(res, 404, 'Tenant not found');
      return;
    }

    if (req.method === 'GET') {
      const cases = store.cases.filter((item) => item.tenantId === tenantId).map((item) => serializeCase(item));
      sendJson(res, 200, { cases });
      return;
    }

    if (req.method === 'POST') {
      const auth = requireAuth(req, res);
      if (!auth) {
        return;
      }

      const body = await parseJsonBody(req);
      const title = safeTrim(body.title, 170);
      const ownerLabel = safeTrim(body.ownerLabel, 100) || `${auth.user.name} • Investigator`;
      const initialTask = safeTrim(body.initialTask, 180);

      if (!title) {
        sendError(res, 400, 'Case title is required');
        return;
      }

      ensureMembership(auth.user.id, tenantId);

      const caseItem = {
        id: nextId('case'),
        tenantId,
        title,
        ownerLabel,
        state: 'active',
        createdAt: nowIso()
      };

      store.cases.push(caseItem);

      if (initialTask) {
        store.tasks.push({
          id: nextId('task'),
          caseId: caseItem.id,
          label: initialTask,
          done: false,
          updatedBy: auth.user.id,
          createdAt: nowIso()
        });
      }

      persistStore();
      sendJson(res, 201, { case: serializeCase(caseItem) });
      return;
    }
  }

  const taskMatch = pathname.match(/^\/api\/tasks\/(\d+)$/);
  if (req.method === 'PATCH' && taskMatch) {
    const auth = requireAuth(req, res);
    if (!auth) {
      return;
    }

    const taskId = Number(taskMatch[1]);
    const task = store.tasks.find((item) => item.id === taskId);
    if (!task) {
      sendError(res, 404, 'Task not found');
      return;
    }

    const caseItem = store.cases.find((item) => item.id === task.caseId);
    if (!caseItem) {
      sendError(res, 404, 'Case not found for task');
      return;
    }

    ensureMembership(auth.user.id, caseItem.tenantId);

    const body = await parseJsonBody(req);
    if (typeof body.done === 'boolean') {
      task.done = body.done;
    } else {
      task.done = !task.done;
    }
    task.updatedBy = auth.user.id;

    persistStore();
    sendJson(res, 200, {
      task: {
        id: task.id,
        label: task.label,
        done: task.done
      }
    });
    return;
  }

  sendError(res, 404, 'API route not found');
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = requestUrl.pathname;

  try {
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname, requestUrl.searchParams);
      return;
    }

    const filePath = resolvePath(req.url || '/');
    if (!filePath) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad request');
      return;
    }

    fs.stat(filePath, (statErr, stats) => {
      if (statErr || !stats.isFile()) {
        const fallback = path.join(PUBLIC_DIR, 'index.html');
        fs.readFile(fallback, (fallbackErr, content) => {
          if (fallbackErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        });
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(filePath, (readErr, data) => {
        if (readErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Internal server error');
          return;
        }

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      });
    });
  } catch (error) {
    console.error('Request failure:', error);
    sendError(res, 500, error.message || 'Unexpected server error');
  }
});

let xAutoPostTimer = null;
let parallelDynamicTimer = null;

function startXAutoPostLoop() {
  if (!X_AUTOPOST_ENABLED) {
    return;
  }

  const run = async () => {
    try {
      await maybeAutoPostRevealedRoundsToX();
    } catch (error) {
      console.error('X auto-post loop error:', error);
    }
  };

  void run();
  xAutoPostTimer = setInterval(() => {
    void run();
  }, X_AUTOPOST_INTERVAL_MS);
}

async function maybeGenerateParallelDynamicRound() {
  try {
    await ensureParallelRound(dateKeyUtc(), PARALLEL_TRACK_DYNAMIC);
  } catch (error) {
    console.error('Parallel dynamic generation loop error:', error);
  }
}

function startParallelDynamicLoop() {
  void maybeGenerateParallelDynamicRound();
  parallelDynamicTimer = setInterval(() => {
    void maybeGenerateParallelDynamicRound();
  }, 60_000);
}

async function shutdown(signal) {
  try {
    if (xAutoPostTimer) {
      clearInterval(xAutoPostTimer);
      xAutoPostTimer = null;
    }
    if (parallelDynamicTimer) {
      clearInterval(parallelDynamicTimer);
      parallelDynamicTimer = null;
    }

    await persistQueue.catch(() => {
      // Ignore flush errors during shutdown.
    });

    if (pgPool) {
      await pgPool.end();
      pgPool = null;
    }
  } catch (error) {
    console.error(`Shutdown error (${signal}):`, error);
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

async function startServer() {
  try {
    await initializeStore();
  } catch (error) {
    console.error('Fatal: unable to initialize datastore.', error);
    process.exit(1);
  }

  server.listen(PORT, HOST, () => {
    console.log(`SignalScope platform running on ${HOST}:${PORT}`);
    console.log(
      `Persistence backend: ${storageBackend}${DATABASE_URL ? ` (DATABASE_URL set, key: ${DATABASE_STORE_KEY})` : ''}`
    );
    const order = buildFailoverOrder();
    console.log(
      `Remote viewing failover prompt chain: ${
        order.prompt.length ? order.prompt.join(' -> ') : 'none configured'
      }`
    );
    console.log(
      `Remote viewing failover image chain: ${order.image.length ? order.image.join(' -> ') : 'none configured'}`
    );
    const reserve = reserveInventorySummary();
    console.log(`Remote viewing reserve inventory: ${reserve.available}/${reserve.total} available`);
    console.log(
      `X auto-post: ${X_AUTOPOST_ENABLED ? 'enabled' : 'disabled'} | credentials: ${
        hasXCredentials() ? 'present' : 'missing'
      }`
    );
    console.log(
      `Parallel dynamic generation schedule (UTC): ${String(PARALLEL_DYNAMIC_GENERATE_HOUR_UTC).padStart(2, '0')}:${String(
        PARALLEL_DYNAMIC_GENERATE_MINUTE_UTC
      ).padStart(2, '0')}`
    );
    console.log(`Parallel preloaded frontload default days: ${PARALLEL_PRELOAD_DEFAULT_DAYS}`);
    startXAutoPostLoop();
    startParallelDynamicLoop();
  });
}

void startServer();
