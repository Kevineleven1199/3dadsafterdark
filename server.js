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
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

function nowIso() {
  return new Date().toISOString();
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

function createSeedData() {
  const createdAt = nowIso();
  const users = [
    {
      id: 1,
      name: 'Signal Bot',
      email: 'bot@signalscope.local',
      passwordHash: createPasswordHash(crypto.randomBytes(16).toString('hex')),
      role: 'system',
      createdAt
    },
    {
      id: 2,
      name: 'Demo Investigator',
      email: 'demo@signalscope.local',
      passwordHash: createPasswordHash('demo1234'),
      role: 'admin',
      createdAt
    }
  ];

  const tenants = [
    {
      id: 1,
      slug: 'cold-case-streamers',
      name: 'Cold Case Streamers',
      tagline: 'Decode strange footage, timeline breaks, and suspicious edits.',
      description:
        'A rapid-response community focused on video anomalies, clip provenance, and collaborative timeline reconstruction.',
      theme: {
        brand: '#0b3a53',
        accent: '#d07a2f',
        glow: 'rgba(11, 58, 83, 0.16)'
      },
      createdBy: 2,
      createdAt
    },
    {
      id: 2,
      slug: 'podcast-receipts-guild',
      name: 'Podcast Receipts Guild',
      tagline: 'Track claims, references, and hidden context in longform audio.',
      description:
        'Members investigate interview claims and source chains, then publish compact receipts so discussions stay grounded.',
      theme: {
        brand: '#1f4d2d',
        accent: '#9f6d2f',
        glow: 'rgba(31, 77, 45, 0.16)'
      },
      createdBy: 2,
      createdAt
    },
    {
      id: 3,
      slug: 'meme-intel-exchange',
      name: 'Meme Intel Exchange',
      tagline: 'Investigate meme campaigns, narrative shifts, and remix origins.',
      description:
        'A collaborative board for tracking how memes move, mutate, and influence broader online discourse.',
      theme: {
        brand: '#5a2f4f',
        accent: '#cc8f3b',
        glow: 'rgba(90, 47, 79, 0.16)'
      },
      createdBy: 2,
      createdAt
    }
  ];

  const memberships = [
    { userId: 2, tenantId: 1, role: 'owner', joinedAt: createdAt },
    { userId: 2, tenantId: 2, role: 'owner', joinedAt: createdAt },
    { userId: 2, tenantId: 3, role: 'owner', joinedAt: createdAt }
  ];

  const channels = [
    { id: 1, tenantId: 1, name: '#frame-by-frame' },
    { id: 2, tenantId: 1, name: '#metadata-lab' },
    { id: 3, tenantId: 1, name: '#live-watch' },
    { id: 4, tenantId: 1, name: '#open-theories' },
    { id: 5, tenantId: 2, name: '#episode-claims' },
    { id: 6, tenantId: 2, name: '#fact-packets' },
    { id: 7, tenantId: 2, name: '#clip-debates' },
    { id: 8, tenantId: 2, name: '#source-vault' },
    { id: 9, tenantId: 3, name: '#origin-hunt' },
    { id: 10, tenantId: 3, name: '#template-lineage' },
    { id: 11, tenantId: 3, name: '#campaign-watch' },
    { id: 12, tenantId: 3, name: '#meme-court' }
  ];

  const posts = [
    {
      id: 1,
      tenantId: 1,
      authorId: 2,
      type: 'video',
      title: 'Station tunnel clip: shadow drift or composited fake?',
      summary:
        'Three angles disagree by 0.6 seconds. Looking for clean extraction and lighting analysis before we tag this as fabricated.',
      url: 'https://www.youtube.com/watch?v=3CgdIcNsDQw',
      source: 'YouTube • Nightshift Archive',
      tags: ['timeline', 'light-source', 'cctv'],
      clues: 41,
      upvotes: 214,
      status: 'investigating',
      createdAt
    },
    {
      id: 2,
      tenantId: 1,
      authorId: 1,
      type: 'podcast',
      title: 'Audio dropout at 18:03: accidental mute or intentional censor?',
      summary:
        'Waveform shows clean cuts around a named entity mention. Need transcript diffs between platform mirrors.',
      url: 'https://www.youtube.com/watch?v=Tk6dJStYung',
      source: 'Podcast mirror • Late Tape Files',
      tags: ['transcript', 'audio-gap', 'entity-redaction'],
      clues: 27,
      upvotes: 141,
      status: 'open',
      createdAt
    },
    {
      id: 3,
      tenantId: 1,
      authorId: 1,
      type: 'meme',
      title: 'Meme set with matching QR corners across five accounts',
      summary:
        'Possible coordinated drop. Seeking timestamp order and creator overlap before flagging as campaign behavior.',
      url: 'https://knowyourmeme.com',
      source: 'Cross-platform meme scrape',
      tags: ['meme-trace', 'bot-cluster', 'qr'],
      clues: 19,
      upvotes: 122,
      status: 'collecting',
      createdAt
    },
    {
      id: 4,
      tenantId: 2,
      authorId: 2,
      type: 'podcast',
      title: 'Host cites a leaked memo: can we locate the original?',
      summary:
        'Current source chain loops between blogs. Need first publication, timestamp, and any archive snapshots.',
      url: 'https://www.youtube.com/watch?v=iD-_XfpV3ik',
      source: 'Podcast network upload',
      tags: ['memo', 'archive', 'source-chain'],
      clues: 33,
      upvotes: 189,
      status: 'active',
      createdAt
    },
    {
      id: 5,
      tenantId: 2,
      authorId: 1,
      type: 'video',
      title: 'Interview clip edited mid-answer before viral repost',
      summary:
        'Comparing platform versions to reconstruct the uncut answer and determine who uploaded first.',
      url: 'https://www.youtube.com/watch?v=ubSA-xJfNUI',
      source: 'Video repost network',
      tags: ['edit-map', 'versioning', 'upload-order'],
      clues: 25,
      upvotes: 137,
      status: 'open',
      createdAt
    },
    {
      id: 6,
      tenantId: 2,
      authorId: 1,
      type: 'brief',
      title: 'Receipt pack draft: energy market claim from episode 72',
      summary:
        'Need one volunteer to verify two government datasets before publishing the final packet.',
      url: 'https://archive.org',
      source: 'Guild internal brief',
      tags: ['dataset', 'receipt-pack', 'review'],
      clues: 16,
      upvotes: 88,
      status: 'review',
      createdAt
    },
    {
      id: 7,
      tenantId: 3,
      authorId: 2,
      type: 'meme',
      title: 'Template mutation map suggests coordinated release window',
      summary:
        'Fifteen variants in 90 minutes from unrelated pages. Looking for shared scheduling tools or source packs.',
      url: 'https://www.reddit.com',
      source: 'Meme tracker ingest',
      tags: ['release-window', 'template', 'cluster'],
      clues: 58,
      upvotes: 311,
      status: 'active',
      createdAt
    },
    {
      id: 8,
      tenantId: 3,
      authorId: 1,
      type: 'video',
      title: 'Short-form meme explainer clipped to remove context',
      summary:
        'Need the full stream source and first clipping account to determine whether framing was intentional.',
      url: 'https://www.youtube.com/watch?v=9SEulgwQPZM',
      source: 'Short video mirror',
      tags: ['context', 'clipper', 'stream-archive'],
      clues: 22,
      upvotes: 149,
      status: 'watch',
      createdAt
    },
    {
      id: 9,
      tenantId: 3,
      authorId: 1,
      type: 'brief',
      title: 'Narrative shift index for week 7 posted to board',
      summary:
        'Draft chart links meme spikes to podcast segments. Requesting peer review before publishing externally.',
      url: 'https://www.kaggle.com',
      source: 'Intel board weekly brief',
      tags: ['index', 'narrative', 'review-needed'],
      clues: 11,
      upvotes: 79,
      status: 'review',
      createdAt
    }
  ];

  const comments = [
    {
      id: 1,
      postId: 1,
      authorId: 1,
      body: 'Camera 2 exposure shifts exactly when the shadow appears. Could be sensor auto-leveling.',
      createdAt
    },
    {
      id: 2,
      postId: 1,
      authorId: 2,
      body: 'Agreed. I can run a frame histogram pass tonight and post diff artifacts.',
      createdAt
    },
    {
      id: 3,
      postId: 4,
      authorId: 2,
      body: 'Archive.org has a prior version from 2024-11-08. Pulling citation chain now.',
      createdAt
    },
    {
      id: 4,
      postId: 7,
      authorId: 1,
      body: 'Variant cluster shares identical compression profile. Might indicate single export pipeline.',
      createdAt
    }
  ];

  const cases = [
    {
      id: 1,
      tenantId: 1,
      title: 'Southside Station Timeline',
      ownerLabel: 'Ops Lead • Mira',
      state: 'active',
      createdAt
    },
    {
      id: 2,
      tenantId: 1,
      title: 'Audio Redaction Sequence',
      ownerLabel: 'Audio Cell • Omar',
      state: 'watch',
      createdAt
    },
    {
      id: 3,
      tenantId: 2,
      title: 'Episode 72 Citation Audit',
      ownerLabel: 'Receipts Desk • Tala',
      state: 'review',
      createdAt
    },
    {
      id: 4,
      tenantId: 3,
      title: 'Template Cluster 02-20',
      ownerLabel: 'Pattern Cell • Jo',
      state: 'active',
      createdAt
    }
  ];

  const tasks = [
    { id: 1, caseId: 1, label: 'Sync all timestamps to UTC', done: true, updatedBy: 2, createdAt },
    { id: 2, caseId: 1, label: 'Run frame diff on camera 3', done: false, updatedBy: 2, createdAt },
    { id: 3, caseId: 1, label: 'Capture witness comments archive', done: false, updatedBy: 1, createdAt },
    { id: 4, caseId: 2, label: 'Import mirror transcripts', done: true, updatedBy: 2, createdAt },
    { id: 5, caseId: 2, label: 'Map silent region lengths', done: false, updatedBy: 1, createdAt },
    { id: 6, caseId: 3, label: 'Locate original policy PDF', done: true, updatedBy: 2, createdAt },
    { id: 7, caseId: 3, label: 'Extract quoted passage context', done: false, updatedBy: 1, createdAt },
    { id: 8, caseId: 4, label: 'Tag unique variant signatures', done: true, updatedBy: 2, createdAt },
    { id: 9, caseId: 4, label: 'Map distribution hubs', done: false, updatedBy: 1, createdAt }
  ];

  const rooms = [
    {
      id: 1,
      tenantId: 1,
      name: 'Evidence Assembly',
      topic: 'Synchronizing station footage clips',
      schedule: 'Starts in 18m',
      attendees: '32 watchers',
      createdAt
    },
    {
      id: 2,
      tenantId: 1,
      name: 'Night Briefing',
      topic: 'Vote on hoax probability threshold',
      schedule: 'Tonight 10:30 PM',
      attendees: '78 interested',
      createdAt
    },
    {
      id: 3,
      tenantId: 2,
      name: 'Receipts Sprint',
      topic: 'Publishing a one-page claim report',
      schedule: 'Today 3:00 PM',
      attendees: '24 editors',
      createdAt
    },
    {
      id: 4,
      tenantId: 3,
      name: 'Template Court',
      topic: 'Vote on original template author',
      schedule: 'Tonight 8:45 PM',
      attendees: '91 jurors',
      createdAt
    }
  ];

  return {
    nextIds: {
      user: 3,
      tenant: 4,
      channel: 13,
      post: 10,
      comment: 5,
      case: 5,
      task: 10,
      room: 5
    },
    users,
    sessions: [],
    tenants,
    memberships,
    channels,
    posts,
    comments,
    cases,
    tasks,
    rooms
  };
}

function ensureDataStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(DATA_FILE)) {
    const seed = createSeedData();
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2), 'utf8');
    return seed;
  }

  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to load datastore. Recreating from seed.', error);
    const seed = createSeedData();
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2), 'utf8');
    return seed;
  }
}

let store = ensureDataStore();

function persistStore() {
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

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';

    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
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

  const activeWatchers = Math.max(7, recentUserIds.size * 5 + Math.ceil(members * 0.6));

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

  return ['#new-room', '#open-investigation'];
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
    { brand: '#0b3a53', accent: '#d07a2f', glow: 'rgba(11, 58, 83, 0.16)' },
    { brand: '#1f4d2d', accent: '#9f6d2f', glow: 'rgba(31, 77, 45, 0.16)' },
    { brand: '#5a2f4f', accent: '#cc8f3b', glow: 'rgba(90, 47, 79, 0.16)' },
    { brand: '#234b71', accent: '#cb7e31', glow: 'rgba(35, 75, 113, 0.16)' },
    { brand: '#4d3b1e', accent: '#2d6e70', glow: 'rgba(45, 110, 112, 0.16)' }
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

async function handleApi(req, res, pathname, searchParams) {
  if (req.method === 'GET' && pathname === '/api/health') {
    sendJson(res, 200, { ok: true, timestamp: nowIso() });
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

server.listen(PORT, HOST, () => {
  console.log(`SignalScope platform running on ${HOST}:${PORT}`);
  console.log('Demo login: demo@signalscope.local / demo1234');
});
