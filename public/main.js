const TYPE_LABELS = {
  video: 'Video',
  podcast: 'Podcast',
  meme: 'Meme',
  brief: 'Brief'
};

const STORAGE_TOKEN_KEY = 'signalscope_token';

const state = {
  token: localStorage.getItem(STORAGE_TOKEN_KEY) || '',
  user: null,
  tenants: [],
  tenantId: null,
  tenantDetail: null,
  posts: [],
  filter: 'all',
  sort: 'hot',
  remoteViewing: null
};

const nodes = {
  tenantSelect: document.getElementById('tenant-select'),
  tenantList: document.getElementById('tenant-list'),
  channelList: document.getElementById('channel-list'),
  hotTags: document.getElementById('hot-tags'),
  heroTitle: document.getElementById('hero-title'),
  heroDescription: document.getElementById('hero-description'),
  membersStat: document.getElementById('stat-members'),
  activeStat: document.getElementById('stat-active'),
  casesStat: document.getElementById('stat-cases'),
  mediaFilter: document.getElementById('media-filter'),
  sortSelect: document.getElementById('sort-select'),
  feedList: document.getElementById('feed-list'),
  feedCount: document.getElementById('feed-count'),
  caseList: document.getElementById('case-list'),
  roomsList: document.getElementById('rooms-list'),
  investigatorList: document.getElementById('investigator-list'),
  postForm: document.getElementById('post-form'),
  postFeedback: document.getElementById('form-feedback'),
  loginForm: document.getElementById('login-form'),
  registerForm: document.getElementById('register-form'),
  authFeedback: document.getElementById('auth-feedback'),
  authUser: document.getElementById('auth-user'),
  logoutBtn: document.getElementById('logout-btn'),
  tenantForm: document.getElementById('tenant-form'),
  tenantFeedback: document.getElementById('tenant-feedback'),
  caseForm: document.getElementById('case-form'),
  caseFeedback: document.getElementById('case-feedback'),
  rvForm: document.getElementById('rv-form'),
  rvPrediction: document.getElementById('rv-prediction'),
  rvFeedback: document.getElementById('rv-feedback'),
  rvEngineNote: document.getElementById('rv-engine-note'),
  rvTodayMeta: document.getElementById('rv-today-meta'),
  rvRevealedMeta: document.getElementById('rv-revealed-meta'),
  rvImageShell: document.getElementById('rv-image-shell'),
  rvImage: document.getElementById('rv-image'),
  rvPrompt: document.getElementById('rv-prompt'),
  rvOutcome: document.getElementById('rv-outcome'),
  rvRecord: document.getElementById('rv-record'),
  rvLeaderboard: document.getElementById('rv-leaderboard'),
  year: document.getElementById('current-year')
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatTimestamp(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function setFeedback(node, message, tone = 'neutral') {
  if (!node) {
    return;
  }

  node.textContent = message || '';
  node.classList.remove('error', 'success');

  if (!message) {
    return;
  }

  if (tone === 'error') {
    node.classList.add('error');
  } else if (tone === 'success') {
    node.classList.add('success');
  }
}

async function apiRequest(endpoint, options = {}) {
  const requestInit = {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json'
    }
  };

  if (state.token) {
    requestInit.headers.Authorization = `Bearer ${state.token}`;
  }

  if (options.body !== undefined) {
    requestInit.headers['Content-Type'] = 'application/json';
    requestInit.body = JSON.stringify(options.body);
  }

  const response = await fetch(endpoint, requestInit);
  const text = await response.text();

  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (_error) {
      payload = {};
    }
  }

  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

function applyTenantTheme(theme) {
  if (!theme) {
    return;
  }

  document.documentElement.style.setProperty('--tenant-brand', theme.brand || '#0b3a53');
  document.documentElement.style.setProperty('--tenant-accent', theme.accent || '#d07a2f');
  document.documentElement.style.setProperty('--tenant-glow', theme.glow || 'rgba(11, 58, 83, 0.16)');
}

function requireSession(feedbackNode) {
  if (state.user) {
    return true;
  }

  setFeedback(feedbackNode || nodes.authFeedback, 'Please log in to perform this action.', 'error');
  return false;
}

function renderAuth() {
  if (!nodes.authUser || !nodes.logoutBtn || !nodes.loginForm || !nodes.registerForm) {
    return;
  }

  if (state.user) {
    nodes.authUser.textContent = `${state.user.name} • ${state.user.email}`;
    nodes.logoutBtn.hidden = false;
    nodes.loginForm.hidden = true;
    nodes.registerForm.hidden = true;
  } else {
    nodes.authUser.textContent = 'Guest mode';
    nodes.logoutBtn.hidden = true;
    nodes.loginForm.hidden = false;
    nodes.registerForm.hidden = false;
  }
}

function renderTenantSelector() {
  if (!nodes.tenantSelect) {
    return;
  }

  if (state.tenants.length === 0) {
    nodes.tenantSelect.innerHTML = '<option value="">No tenants</option>';
    return;
  }

  nodes.tenantSelect.innerHTML = state.tenants
    .map((tenant) => {
      const selected = Number(tenant.id) === Number(state.tenantId) ? ' selected' : '';
      return `<option value="${tenant.id}"${selected}>${escapeHtml(tenant.name)}</option>`;
    })
    .join('');
}

function renderTenantList() {
  if (!nodes.tenantList) {
    return;
  }

  if (state.tenants.length === 0) {
    nodes.tenantList.innerHTML = '<p class="rv-meta">No tenants yet. Create one to begin.</p>';
    return;
  }

  nodes.tenantList.innerHTML = state.tenants
    .map((tenant) => {
      const active = Number(tenant.id) === Number(state.tenantId) ? ' active' : '';
      return `<button type="button" class="tenant-button${active}" data-community="${tenant.id}">
        <strong>${escapeHtml(tenant.name)}</strong>
        <span>${escapeHtml(tenant.tagline || '')}</span>
        <small>${escapeHtml(tenant.stats?.members || '')}</small>
      </button>`;
    })
    .join('');
}

function renderHero() {
  if (!state.tenantDetail) {
    if (nodes.heroTitle) {
      nodes.heroTitle.textContent = 'SignalScope';
    }
    if (nodes.heroDescription) {
      nodes.heroDescription.textContent =
        'Create a tenant to start publishing investigations, evidence threads, and remote-viewing predictions.';
    }
    return;
  }

  const tenant = state.tenantDetail;

  if (nodes.heroTitle) {
    nodes.heroTitle.textContent = tenant.name;
  }

  if (nodes.heroDescription) {
    nodes.heroDescription.textContent = tenant.description;
  }

  if (nodes.membersStat) {
    nodes.membersStat.textContent = tenant.stats?.members || '0 members';
  }

  if (nodes.activeStat) {
    nodes.activeStat.textContent = tenant.stats?.active || '0 online';
  }

  if (nodes.casesStat) {
    nodes.casesStat.textContent = tenant.stats?.cases || '0 open';
  }
}

function renderChannels() {
  if (!nodes.channelList) {
    return;
  }

  const channels = state.tenantDetail?.channels || [];
  nodes.channelList.innerHTML = channels.map((name) => `<li>${escapeHtml(name)}</li>`).join('');
}

function renderHotTags() {
  if (!nodes.hotTags) {
    return;
  }

  const tags = state.tenantDetail?.hotTags || [];
  nodes.hotTags.innerHTML = tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('');
}

function renderFilterButtons() {
  if (!nodes.mediaFilter) {
    return;
  }

  Array.from(nodes.mediaFilter.querySelectorAll('button[data-filter]')).forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.filter === state.filter));
  });
}

function commentMarkup(comment) {
  return `<article class="comment-item">
    <div class="comment-meta">
      <strong>${escapeHtml(comment.authorName)}</strong>
      <span>${escapeHtml(formatTimestamp(comment.createdAt))}</span>
    </div>
    <p>${escapeHtml(comment.body)}</p>
  </article>`;
}

function postCardMarkup(post) {
  const type = TYPE_LABELS[post.type] || 'Post';
  const safeUrl = escapeHtml(post.url);
  const commentsMarkup =
    post.latestComments && post.latestComments.length > 0
      ? post.latestComments.map((comment) => commentMarkup(comment)).join('')
      : '<p class="post-author">No comments yet. Start the thread.</p>';

  const tagsMarkup = (post.tags || [])
    .slice(0, 6)
    .map((tag) => `<span>#${escapeHtml(tag)}</span>`)
    .join('');

  const disabled = state.user ? '' : ' disabled';
  const commentPlaceholder = state.user ? 'Add a finding or source update' : 'Log in to join this thread';

  return `<article class="feed-card">
    <div class="feed-card-head">
      <div>
        <span class="type-pill">${escapeHtml(type)}</span>
        <h3>${escapeHtml(post.title)}</h3>
      </div>
      <span class="status-pill">${escapeHtml(post.status)}</span>
    </div>
    <p>${escapeHtml(post.summary)}</p>
    <a class="post-source" href="${safeUrl}" target="_blank" rel="noreferrer">${escapeHtml(post.source)}</a>
    <p class="post-author">By ${escapeHtml(post.authorName)} • ${escapeHtml(formatTimestamp(post.createdAt))}</p>
    <div class="card-tags">${tagsMarkup}</div>
    <div class="card-meta">
      <div class="meta-line">
        <span>${Number(post.clues || 0)} clues</span>
        <span>${Number(post.comments || 0)} comments</span>
        <span>${Number(post.upvotes || 0)} boosts</span>
      </div>
      <button type="button" class="upvote-btn" data-action="upvote" data-post-id="${post.id}"${disabled}>+ boost</button>
    </div>
    <div class="feed-comments">
      <div class="comment-list">${commentsMarkup}</div>
      <form class="comment-form" data-post-id="${post.id}">
        <input type="text" name="body" maxlength="1200" placeholder="${escapeHtml(commentPlaceholder)}"${disabled} required />
        <button type="submit"${disabled}>Reply</button>
      </form>
    </div>
  </article>`;
}

function renderFeed() {
  if (!nodes.feedList || !nodes.feedCount) {
    return;
  }

  nodes.feedCount.textContent = `${state.posts.length} threads in view`;

  if (state.posts.length === 0) {
    nodes.feedList.innerHTML =
      '<div class="empty-state">No threads match this filter yet. Try another media type or publish a new lead.</div>';
    return;
  }

  nodes.feedList.innerHTML = state.posts.map((post) => postCardMarkup(post)).join('');
}

function checklistMarkup(caseItem) {
  const checklist = (caseItem.checklist || [])
    .map((task) => {
      const doneClass = task.done ? ' done' : '';
      return `<button type="button" class="${doneClass}" data-action="toggle-task" data-task-id="${task.id}" data-done="${task.done}">${escapeHtml(task.label)}</button>`;
    })
    .join('');

  return `<article class="case-card">
    <div class="case-card-head">
      <h3>${escapeHtml(caseItem.title)}</h3>
      <span class="status-pill">${escapeHtml(caseItem.state || 'active')}</span>
    </div>
    <p>${escapeHtml(caseItem.ownerLabel || 'Investigator')}</p>
    <div class="checklist">${checklist}</div>
  </article>`;
}

function renderCases() {
  if (!nodes.caseList) {
    return;
  }

  const cases = state.tenantDetail?.cases || [];
  nodes.caseList.innerHTML = cases.map((caseItem) => checklistMarkup(caseItem)).join('');
}

function renderRooms() {
  if (!nodes.roomsList) {
    return;
  }

  const rooms = state.tenantDetail?.rooms || [];

  nodes.roomsList.innerHTML = rooms
    .map(
      (room) => `<article class="room-card">
      <div class="room-card-head">
        <h3>${escapeHtml(room.name)}</h3>
        <span class="type-pill">Live</span>
      </div>
      <p>${escapeHtml(room.topic)}</p>
      <p>${escapeHtml(room.schedule)} • ${escapeHtml(room.attendees)}</p>
    </article>`
    )
    .join('');
}

function renderInvestigators() {
  if (!nodes.investigatorList) {
    return;
  }

  const investigators = state.tenantDetail?.investigators || [];
  nodes.investigatorList.innerHTML = investigators
    .map(
      (entry) => `<li>
      <div>
        <strong>${escapeHtml(entry.name)}</strong>
        <div>${escapeHtml(entry.role)}</div>
      </div>
      <span>${escapeHtml(entry.score)}</span>
    </li>`
    )
    .join('');
}

function renderRemoteViewing() {
  if (!nodes.rvEngineNote || !nodes.rvTodayMeta || !nodes.rvRevealedMeta || !nodes.rvRecord || !nodes.rvLeaderboard) {
    return;
  }

  const payload = state.remoteViewing;
  if (!payload) {
    nodes.rvEngineNote.textContent = 'Loading daily remote viewing data...';
    return;
  }

  const engine = payload.engine || { ready: false, message: 'Remote viewing engine unavailable.' };
  const today = payload.today;
  const revealed = payload.revealed;

  nodes.rvEngineNote.textContent = engine.message || '';

  if (today) {
    nodes.rvTodayMeta.textContent = `Round ${today.roundDate}. Locked until ${formatTimestamp(today.revealAt)}.`;
  } else if (engine.ready) {
    nodes.rvTodayMeta.textContent = 'Today\'s round is initializing.';
  } else {
    nodes.rvTodayMeta.textContent = 'Today\'s round unavailable until OpenAI key is configured.';
  }

  const canSubmit = Boolean(state.user && engine.ready && today && today.submissionOpen);
  if (nodes.rvForm) {
    const controls = Array.from(nodes.rvForm.querySelectorAll('textarea, button'));
    controls.forEach((element) => {
      element.disabled = !canSubmit;
    });
  }

  if (today?.myPrediction && nodes.rvPrediction) {
    nodes.rvPrediction.value = today.myPrediction.prediction || '';
  }

  if (!state.user && nodes.rvFeedback && !nodes.rvFeedback.textContent) {
    setFeedback(nodes.rvFeedback, 'Log in to submit a daily prediction.', 'error');
  }

  if (revealed) {
    nodes.rvRevealedMeta.textContent = `Round ${revealed.roundDate} revealed on ${formatTimestamp(revealed.revealAt)}.`;

    if (nodes.rvImageShell && nodes.rvImage) {
      if (revealed.imageUrl) {
        nodes.rvImage.src = revealed.imageUrl;
        nodes.rvImageShell.hidden = false;
      } else {
        nodes.rvImageShell.hidden = true;
      }
    }

    if (nodes.rvPrompt) {
      nodes.rvPrompt.textContent = revealed.targetPrompt
        ? `Target prompt: ${revealed.targetPrompt}`
        : 'Target prompt unavailable.';
    }

    const myPrediction = revealed.myPrediction;
    if (myPrediction && nodes.rvOutcome) {
      if (myPrediction.outcome === 'win') {
        setFeedback(
          nodes.rvOutcome,
          `Win (${myPrediction.score ?? 'n/a'}). ${myPrediction.rationale || ''}`,
          'success'
        );
      } else if (myPrediction.outcome === 'loss') {
        setFeedback(
          nodes.rvOutcome,
          `Loss (${myPrediction.score ?? 'n/a'}). ${myPrediction.rationale || ''}`,
          'error'
        );
      } else {
        setFeedback(nodes.rvOutcome, 'Prediction submitted. AI scoring is pending.', 'neutral');
      }
    } else if (nodes.rvOutcome) {
      setFeedback(nodes.rvOutcome, 'No prediction submitted for the latest revealed round.', 'neutral');
    }
  } else {
    nodes.rvRevealedMeta.textContent = 'No revealed round yet. Check back after the next reveal window.';
    if (nodes.rvImageShell) {
      nodes.rvImageShell.hidden = true;
    }
    if (nodes.rvPrompt) {
      nodes.rvPrompt.textContent = '';
    }
    if (nodes.rvOutcome) {
      setFeedback(nodes.rvOutcome, '', 'neutral');
    }
  }

  const record = payload.record || { wins: 0, losses: 0, total: 0, winRate: '0%' };
  nodes.rvRecord.textContent = `${record.wins}W ${record.losses}L (${record.winRate}) across ${record.total} scored rounds.`;

  const leaderboard = Array.isArray(payload.leaderboard) ? payload.leaderboard : [];
  if (leaderboard.length === 0) {
    nodes.rvLeaderboard.innerHTML = '<li>No scored rounds yet.</li>';
  } else {
    nodes.rvLeaderboard.innerHTML = leaderboard
      .map(
        (entry) =>
          `<li>${escapeHtml(entry.userName)} • ${entry.wins}W-${entry.losses}L (${escapeHtml(entry.winRate)})</li>`
      )
      .join('');
  }
}

function renderAll() {
  renderAuth();
  renderTenantSelector();
  renderTenantList();
  renderHero();
  renderChannels();
  renderHotTags();
  renderRemoteViewing();
  renderFilterButtons();
  renderFeed();
  renderCases();
  renderRooms();
  renderInvestigators();

  if (nodes.sortSelect) {
    nodes.sortSelect.value = state.sort;
  }

  if (state.tenantDetail?.theme) {
    applyTenantTheme(state.tenantDetail.theme);
  }
}

async function loadCurrentUser() {
  if (!state.token) {
    state.user = null;
    return;
  }

  try {
    const payload = await apiRequest('/api/auth/me');
    state.user = payload.user;
  } catch (_error) {
    state.user = null;
    state.token = '';
    localStorage.removeItem(STORAGE_TOKEN_KEY);
  }
}

async function loadTenants() {
  const payload = await apiRequest('/api/tenants');
  state.tenants = payload.tenants || [];

  if (!state.tenantId && state.tenants[0]) {
    state.tenantId = Number(state.tenants[0].id);
  }

  if (state.tenantId && !state.tenants.some((tenant) => Number(tenant.id) === Number(state.tenantId))) {
    state.tenantId = state.tenants[0] ? Number(state.tenants[0].id) : null;
  }
}

async function loadTenantDetail() {
  if (!state.tenantId) {
    state.tenantDetail = null;
    return;
  }

  const payload = await apiRequest(`/api/tenants/${state.tenantId}`);
  state.tenantDetail = payload.tenant;
}

async function loadPosts() {
  if (!state.tenantId) {
    state.posts = [];
    return;
  }

  const query = new URLSearchParams({
    filter: state.filter,
    sort: state.sort
  });

  const payload = await apiRequest(`/api/tenants/${state.tenantId}/posts?${query.toString()}`);
  state.posts = payload.posts || [];
}

async function loadTenantData() {
  await Promise.all([loadTenantDetail(), loadPosts()]);
}

async function loadRemoteViewing() {
  try {
    const payload = await apiRequest('/api/remote-viewing/daily');
    state.remoteViewing = payload;
  } catch (error) {
    state.remoteViewing = {
      engine: {
        ready: false,
        message: error.message || 'Remote viewing endpoint unavailable.'
      },
      today: null,
      revealed: null,
      record: { wins: 0, losses: 0, total: 0, winRate: '0%' },
      leaderboard: []
    };
  }
}

async function refreshAllData() {
  await loadTenants();
  await Promise.all([loadTenantData(), loadRemoteViewing()]);
}

async function withRefresh(task, feedbackNode) {
  try {
    await task();
    await refreshAllData();
    renderAll();
  } catch (error) {
    const isAuthError = error.status === 401;
    if (isAuthError) {
      state.user = null;
      state.token = '';
      localStorage.removeItem(STORAGE_TOKEN_KEY);
      renderAuth();
    }
    setFeedback(feedbackNode || nodes.authFeedback, error.message, 'error');
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  if (!nodes.loginForm) {
    return;
  }

  const formData = new FormData(nodes.loginForm);
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');

  if (!email || !password) {
    setFeedback(nodes.authFeedback, 'Email and password are required.', 'error');
    return;
  }

  try {
    const payload = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email, password }
    });

    state.token = payload.token;
    state.user = payload.user;
    localStorage.setItem(STORAGE_TOKEN_KEY, state.token);
    setFeedback(nodes.authFeedback, `Logged in as ${state.user.name}.`, 'success');
    nodes.loginForm.reset();
    renderAuth();
    await withRefresh(async () => {}, null);
  } catch (error) {
    setFeedback(nodes.authFeedback, error.message, 'error');
  }
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  if (!nodes.registerForm) {
    return;
  }

  const formData = new FormData(nodes.registerForm);
  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');

  if (!name || !email || password.length < 6) {
    setFeedback(nodes.authFeedback, 'Name, email, and password (6+ chars) are required.', 'error');
    return;
  }

  try {
    const payload = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: { name, email, password }
    });

    state.token = payload.token;
    state.user = payload.user;
    localStorage.setItem(STORAGE_TOKEN_KEY, state.token);
    setFeedback(nodes.authFeedback, `Account created for ${state.user.name}.`, 'success');
    nodes.registerForm.reset();
    renderAuth();
    await withRefresh(async () => {}, null);
  } catch (error) {
    setFeedback(nodes.authFeedback, error.message, 'error');
  }
}

async function handleLogout() {
  if (!state.token) {
    return;
  }

  try {
    await apiRequest('/api/auth/logout', { method: 'POST' });
  } catch (_error) {
    // no-op
  }

  state.token = '';
  state.user = null;
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  setFeedback(nodes.authFeedback, 'You are now logged out.', 'success');
  await withRefresh(async () => {}, null);
}

async function handlePostSubmit(event) {
  event.preventDefault();
  if (!nodes.postForm || !requireSession(nodes.postFeedback)) {
    return;
  }

  const formData = new FormData(nodes.postForm);
  const type = String(formData.get('type') || '').trim();
  const title = String(formData.get('title') || '').trim();
  const summary = String(formData.get('summary') || '').trim();
  const url = String(formData.get('url') || '').trim();
  const tags = String(formData.get('tags') || '').trim();

  if (!type || !title || !summary || !url) {
    setFeedback(nodes.postFeedback, 'Media type, title, notes, and URL are required.', 'error');
    return;
  }

  await withRefresh(async () => {
    await apiRequest(`/api/tenants/${state.tenantId}/posts`, {
      method: 'POST',
      body: { type, title, summary, url, tags }
    });

    state.sort = 'new';
    nodes.postForm.reset();
    setFeedback(nodes.postFeedback, 'Lead published successfully.', 'success');
  }, nodes.postFeedback);
}

async function handleCreateTenant(event) {
  event.preventDefault();
  if (!nodes.tenantForm || !requireSession(nodes.tenantFeedback)) {
    return;
  }

  const formData = new FormData(nodes.tenantForm);
  const name = String(formData.get('name') || '').trim();
  const tagline = String(formData.get('tagline') || '').trim();
  const description = String(formData.get('description') || '').trim();

  if (!name || !tagline || !description) {
    setFeedback(nodes.tenantFeedback, 'Name, tagline, and description are required.', 'error');
    return;
  }

  try {
    const payload = await apiRequest('/api/tenants', {
      method: 'POST',
      body: { name, tagline, description }
    });

    setFeedback(nodes.tenantFeedback, `Tenant ${payload.tenant.name} created.`, 'success');
    nodes.tenantForm.reset();
    await loadTenants();
    state.tenantId = Number(payload.tenant.id);
    state.filter = 'all';
    state.sort = 'new';
    await Promise.all([loadTenantData(), loadRemoteViewing()]);
    renderAll();
  } catch (error) {
    setFeedback(nodes.tenantFeedback, error.message, 'error');
  }
}

async function handleCreateCase(event) {
  event.preventDefault();
  if (!nodes.caseForm || !requireSession(nodes.caseFeedback)) {
    return;
  }

  const formData = new FormData(nodes.caseForm);
  const title = String(formData.get('title') || '').trim();
  const initialTask = String(formData.get('initialTask') || '').trim();

  if (!title) {
    setFeedback(nodes.caseFeedback, 'Case title is required.', 'error');
    return;
  }

  await withRefresh(async () => {
    await apiRequest(`/api/tenants/${state.tenantId}/cases`, {
      method: 'POST',
      body: { title, initialTask }
    });

    nodes.caseForm.reset();
    setFeedback(nodes.caseFeedback, 'New case opened.', 'success');
  }, nodes.caseFeedback);
}

async function handleRemotePredictionSubmit(event) {
  event.preventDefault();
  if (!nodes.rvForm || !nodes.rvPrediction || !requireSession(nodes.rvFeedback)) {
    return;
  }

  const prediction = String(nodes.rvPrediction.value || '').trim();
  if (prediction.length < 8) {
    setFeedback(nodes.rvFeedback, 'Prediction must be at least 8 characters.', 'error');
    return;
  }

  await withRefresh(async () => {
    await apiRequest('/api/remote-viewing/predictions', {
      method: 'POST',
      body: { prediction }
    });

    setFeedback(nodes.rvFeedback, 'Prediction submitted for today\'s locked target.', 'success');
  }, nodes.rvFeedback);
}

async function handleFeedClick(event) {
  const upvoteTrigger = event.target.closest('button[data-action="upvote"]');
  if (!upvoteTrigger) {
    return;
  }

  if (!requireSession(nodes.authFeedback)) {
    return;
  }

  const postId = Number(upvoteTrigger.dataset.postId);
  if (!postId) {
    return;
  }

  await withRefresh(async () => {
    await apiRequest(`/api/posts/${postId}/upvote`, { method: 'POST' });
  }, nodes.authFeedback);
}

async function handleFeedSubmit(event) {
  const form = event.target.closest('form.comment-form');
  if (!form) {
    return;
  }

  event.preventDefault();

  if (!requireSession(nodes.authFeedback)) {
    return;
  }

  const postId = Number(form.dataset.postId);
  const input = form.querySelector('input[name="body"]');
  const body = String(input?.value || '').trim();

  if (!postId || !body) {
    return;
  }

  await withRefresh(async () => {
    await apiRequest(`/api/posts/${postId}/comments`, {
      method: 'POST',
      body: { body }
    });

    if (input) {
      input.value = '';
    }
  }, nodes.authFeedback);
}

async function handleCaseClick(event) {
  const trigger = event.target.closest('button[data-action="toggle-task"]');
  if (!trigger) {
    return;
  }

  if (!requireSession(nodes.caseFeedback)) {
    return;
  }

  const taskId = Number(trigger.dataset.taskId);
  if (!taskId) {
    return;
  }

  const current = trigger.dataset.done === 'true';

  await withRefresh(async () => {
    await apiRequest(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: { done: !current }
    });
  }, nodes.caseFeedback);
}

function setupEvents() {
  if (nodes.loginForm) {
    nodes.loginForm.addEventListener('submit', handleLoginSubmit);
  }

  if (nodes.registerForm) {
    nodes.registerForm.addEventListener('submit', handleRegisterSubmit);
  }

  if (nodes.logoutBtn) {
    nodes.logoutBtn.addEventListener('click', () => {
      void handleLogout();
    });
  }

  if (nodes.tenantSelect) {
    nodes.tenantSelect.addEventListener('change', (event) => {
      void (async () => {
        state.tenantId = Number(event.target.value || 0);
        state.filter = 'all';
        await withRefresh(async () => {}, nodes.authFeedback);
      })();
    });
  }

  if (nodes.tenantList) {
    nodes.tenantList.addEventListener('click', (event) => {
      void (async () => {
        const trigger = event.target.closest('[data-community]');
        if (!trigger) {
          return;
        }

        state.tenantId = Number(trigger.dataset.community || 0);
        state.filter = 'all';
        await withRefresh(async () => {}, nodes.authFeedback);
      })();
    });
  }

  if (nodes.mediaFilter) {
    nodes.mediaFilter.addEventListener('click', (event) => {
      void (async () => {
        const trigger = event.target.closest('button[data-filter]');
        if (!trigger) {
          return;
        }

        state.filter = String(trigger.dataset.filter || 'all');
        await withRefresh(async () => {}, nodes.authFeedback);
      })();
    });
  }

  if (nodes.sortSelect) {
    nodes.sortSelect.addEventListener('change', (event) => {
      void (async () => {
        state.sort = String(event.target.value || 'hot');
        await withRefresh(async () => {}, nodes.authFeedback);
      })();
    });
  }

  if (nodes.postForm) {
    nodes.postForm.addEventListener('submit', (event) => {
      void handlePostSubmit(event);
    });
  }

  if (nodes.tenantForm) {
    nodes.tenantForm.addEventListener('submit', (event) => {
      void handleCreateTenant(event);
    });
  }

  if (nodes.caseForm) {
    nodes.caseForm.addEventListener('submit', (event) => {
      void handleCreateCase(event);
    });
  }

  if (nodes.rvForm) {
    nodes.rvForm.addEventListener('submit', (event) => {
      void handleRemotePredictionSubmit(event);
    });
  }

  if (nodes.feedList) {
    nodes.feedList.addEventListener('click', (event) => {
      void handleFeedClick(event);
    });
    nodes.feedList.addEventListener('submit', (event) => {
      void handleFeedSubmit(event);
    });
  }

  if (nodes.caseList) {
    nodes.caseList.addEventListener('click', (event) => {
      void handleCaseClick(event);
    });
  }
}

function setupRevealAnimation() {
  const blocks = Array.from(document.querySelectorAll('.reveal-block'));
  blocks.forEach((block, index) => {
    block.style.transitionDelay = `${Math.min(index * 60, 320)}ms`;
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.18
    }
  );

  blocks.forEach((block) => observer.observe(block));
}

async function init() {
  if (nodes.year) {
    nodes.year.textContent = String(new Date().getFullYear());
  }

  setupEvents();
  setupRevealAnimation();

  try {
    await loadCurrentUser();
    await refreshAllData();
    renderAll();
  } catch (error) {
    console.error(error);
    setFeedback(nodes.authFeedback, 'Failed to load platform data from server.', 'error');
  }
}

void init();
