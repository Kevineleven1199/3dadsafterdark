const TYPE_LABELS = {
  video: 'Video',
  podcast: 'Podcast',
  meme: 'Meme',
  brief: 'Brief'
};

const STORAGE_TOKEN_KEY = 'signalscope_token';
const INTRO_STORAGE_KEY = 'signalscope_intro_seen';

const state = {
  token: localStorage.getItem(STORAGE_TOKEN_KEY) || '',
  user: null,
  tenants: [],
  tenantId: null,
  tenantDetail: null,
  posts: [],
  filter: 'all',
  sort: 'hot',
  remoteViewing: null,
  parallelRemoteViewing: null,
  communityViewing: null
};

const nodes = {
  tenantSelect: document.getElementById('tenant-select'),
  tenantList: document.getElementById('tenant-list'),
  channelList: document.getElementById('channel-list'),
  hotTags: document.getElementById('hot-tags'),
  heroTitle: document.getElementById('hero-title'),
  heroDescription: document.getElementById('hero-description'),
  onboardingStatus: document.getElementById('onboarding-status'),
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
  rvFrontloadBtn: document.getElementById('rv-frontload-btn'),
  rvReserveFrontloadBtn: document.getElementById('rv-reserve-frontload-btn'),
  rvXPostBtn: document.getElementById('rv-x-post-btn'),
  rvAdminFeedback: document.getElementById('rv-admin-feedback'),
  rvParallelNote: document.getElementById('rv-parallel-note'),
  rvParallelDynamicForm: document.getElementById('rv-parallel-dynamic-form'),
  rvParallelDynamicPrediction: document.getElementById('rv-parallel-dynamic-prediction'),
  rvParallelDynamicMeta: document.getElementById('rv-parallel-dynamic-meta'),
  rvParallelDynamicFeedback: document.getElementById('rv-parallel-dynamic-feedback'),
  rvParallelDynamicRecord: document.getElementById('rv-parallel-dynamic-record'),
  rvParallelPreloadedForm: document.getElementById('rv-parallel-preloaded-form'),
  rvParallelPreloadedPrediction: document.getElementById('rv-parallel-preloaded-prediction'),
  rvParallelPreloadedMeta: document.getElementById('rv-parallel-preloaded-meta'),
  rvParallelPreloadedFeedback: document.getElementById('rv-parallel-preloaded-feedback'),
  rvParallelPreloadedRecord: document.getElementById('rv-parallel-preloaded-record'),
  rvParallelFrontloadBtn: document.getElementById('rv-parallel-frontload-btn'),
  rvParallelFeedback: document.getElementById('rv-parallel-feedback'),
  rvParallelComparison: document.getElementById('rv-parallel-comparison'),
  rvCommunityNote: document.getElementById('rv-community-note'),
  rvCommunityCreateForm: document.getElementById('rv-community-create-form'),
  rvCommunityTitle: document.getElementById('rv-community-title'),
  rvCommunityBriefingInput: document.getElementById('rv-community-briefing-input'),
  rvCommunityRevealHours: document.getElementById('rv-community-reveal-hours'),
  rvCommunityImageInput: document.getElementById('rv-community-image-input'),
  rvCommunityCreateFeedback: document.getElementById('rv-community-create-feedback'),
  rvCommunityActiveMeta: document.getElementById('rv-community-active-meta'),
  rvCommunityPredictionForm: document.getElementById('rv-community-prediction-form'),
  rvCommunityPrediction: document.getElementById('rv-community-prediction'),
  rvCommunityPredictionFeedback: document.getElementById('rv-community-prediction-feedback'),
  rvCommunityRevealedMeta: document.getElementById('rv-community-revealed-meta'),
  rvCommunityImageShell: document.getElementById('rv-community-image-shell'),
  rvCommunityImage: document.getElementById('rv-community-image'),
  rvCommunityBriefing: document.getElementById('rv-community-briefing'),
  rvCommunityPredictionsList: document.getElementById('rv-community-predictions-list'),
  year: document.getElementById('current-year'),
  abductionIntro: document.getElementById('abduction-intro'),
  introSkipBtn: document.getElementById('intro-skip-btn')
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

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(String(reader.result || ''));
    };
    reader.onerror = () => {
      reject(new Error('Unable to read selected image file'));
    };
    reader.readAsDataURL(file);
  });
}

function setupAbductionIntro() {
  const intro = nodes.abductionIntro;
  if (!intro) {
    document.body.classList.add('ship-interior');
    return;
  }

  const quickMode =
    localStorage.getItem(INTRO_STORAGE_KEY) === '1' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timers = [];
  let closed = false;

  const clearTimers = () => {
    timers.forEach((timer) => {
      clearTimeout(timer);
    });
  };

  const closeIntro = () => {
    if (closed) {
      return;
    }
    closed = true;
    clearTimers();
    document.removeEventListener('keydown', handleKeydown);
    localStorage.setItem(INTRO_STORAGE_KEY, '1');
    document.body.classList.remove('intro-lock');
    document.body.classList.add('ship-interior');
    intro.classList.add('closing');
    setTimeout(() => {
      intro.classList.add('hidden');
    }, 540);
  };

  const handleKeydown = (event) => {
    if (event.key === 'Escape') {
      closeIntro();
    }
  };

  document.body.classList.add('intro-lock');
  document.addEventListener('keydown', handleKeydown);

  if (nodes.introSkipBtn) {
    nodes.introSkipBtn.addEventListener('click', closeIntro);
  }

  const schedule = (delay, className) => {
    const timer = setTimeout(() => {
      intro.classList.add(className);
    }, delay);
    timers.push(timer);
  };

  if (quickMode) {
    schedule(80, 'phase-beam');
    schedule(210, 'phase-abduct');
    schedule(380, 'phase-jump');
    schedule(560, 'phase-cockpit');
    timers.push(setTimeout(closeIntro, 1450));
    return;
  }

  schedule(450, 'phase-beam');
  schedule(1300, 'phase-abduct');
  schedule(2550, 'phase-jump');
  schedule(3900, 'phase-cockpit');
  timers.push(setTimeout(closeIntro, 5500));
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

  document.documentElement.style.setProperty('--tenant-brand', theme.brand || '#7cc4ff');
  document.documentElement.style.setProperty('--tenant-accent', theme.accent || '#91ff6a');
  document.documentElement.style.setProperty('--tenant-glow', theme.glow || 'rgba(145, 255, 106, 0.2)');
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
        'Use the quick-start steps below to sign in, choose a community, and start contributing clear, source-backed findings.';
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

function renderOnboarding() {
  const statusNode = nodes.onboardingStatus;
  const stepNodes = Array.from(document.querySelectorAll('#onboarding-steps li[data-step]'));
  if (!statusNode || stepNodes.length === 0) {
    return;
  }

  const hasAccount = Boolean(state.user);
  const hasCommunity = Boolean(state.tenantId);
  const hasContribution =
    Boolean(state.remoteViewing?.today?.myPrediction) || (Array.isArray(state.posts) && state.posts.length > 0);

  const stepState = {
    account: hasAccount,
    community: hasCommunity,
    contribute: hasContribution
  };

  stepNodes.forEach((stepNode) => {
    const key = String(stepNode.dataset.step || '');
    const done = Boolean(stepState[key]);
    stepNode.classList.toggle('done', done);
    stepNode.classList.toggle('active', !done);
  });

  if (!hasAccount) {
    statusNode.textContent = 'Start with Step 1: create an account to unlock posting and predictions.';
    return;
  }

  if (!hasCommunity) {
    statusNode.textContent = 'Step 2: pick or create a community so your updates land in the right place.';
    return;
  }

  if (!hasContribution) {
    statusNode.textContent = 'Step 3: submit your first prediction or publish your first lead.';
    return;
  }

  statusNode.textContent = 'You are set up. Keep the streak going with one prediction and one lead daily.';
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
  const reserve = engine.reserve || {};

  const promptOrder = Array.isArray(engine.failoverOrder?.prompt)
    ? engine.failoverOrder.prompt.join(' -> ')
    : 'none';
  const imageOrder = Array.isArray(engine.failoverOrder?.image)
    ? engine.failoverOrder.image.join(' -> ')
    : 'none';
  const reserveAvailable = Number.isFinite(Number(reserve.available)) ? Number(reserve.available) : 0;
  const reserveTotal = Number.isFinite(Number(reserve.total)) ? Number(reserve.total) : 0;
  nodes.rvEngineNote.textContent = `${
    engine.message || ''
  } Prompt chain: ${promptOrder}. Image chain: ${imageOrder}. Reserve: ${reserveAvailable}/${reserveTotal} ready.`;

  if (today) {
    nodes.rvTodayMeta.textContent = `Round ${today.roundDate}. Locked until ${formatTimestamp(today.revealAt)}.`;
  } else if (engine.ready) {
    nodes.rvTodayMeta.textContent = 'Today\'s round is initializing.';
  } else {
    nodes.rvTodayMeta.textContent = 'Today\'s round unavailable until provider chain is healthy.';
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

  if (nodes.rvFrontloadBtn) {
    nodes.rvFrontloadBtn.disabled = !Boolean(state.user && engine.ready);
  }
  if (nodes.rvReserveFrontloadBtn) {
    nodes.rvReserveFrontloadBtn.disabled = !Boolean(state.user && engine.ready);
  }
  if (nodes.rvXPostBtn) {
    nodes.rvXPostBtn.disabled = !Boolean(state.user && revealed && revealed.status === 'revealed');
  }

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

function renderParallelTrackSummary(trackPayload, metaNode, recordNode, predictionNode, formNode) {
  if (!metaNode || !recordNode) {
    return;
  }

  const today = trackPayload?.today;
  const revealed = trackPayload?.revealed;
  const record = trackPayload?.record || { wins: 0, losses: 0, total: 0, winRate: '0%' };

  if (!today) {
    metaNode.textContent = 'Today\'s round is initializing.';
  } else if (today.generationScheduled) {
    metaNode.textContent = `Round ${today.roundDate}. Image scheduled at ${formatTimestamp(today.generateAt)} and reveal at ${formatTimestamp(today.revealAt)}.`;
  } else {
    metaNode.textContent = `Round ${today.roundDate}. Reveal at ${formatTimestamp(today.revealAt)}.`;
  }

  if (today?.myPrediction && predictionNode) {
    predictionNode.value = today.myPrediction.prediction || '';
  }

  if (formNode) {
    const controls = Array.from(formNode.querySelectorAll('textarea, button'));
    const canSubmit = Boolean(state.user && today && today.submissionOpen);
    controls.forEach((element) => {
      element.disabled = !canSubmit;
    });
  }

  let revealedLine = 'No revealed round yet.';
  if (revealed) {
    if (revealed.myPrediction?.outcome === 'win') {
      revealedLine = `Latest revealed ${revealed.roundDate}: Win (${revealed.myPrediction.score ?? 'n/a'}).`;
    } else if (revealed.myPrediction?.outcome === 'loss') {
      revealedLine = `Latest revealed ${revealed.roundDate}: Loss (${revealed.myPrediction.score ?? 'n/a'}).`;
    } else if (revealed.myPrediction) {
      revealedLine = `Latest revealed ${revealed.roundDate}: submitted, scoring pending.`;
    } else {
      revealedLine = `Latest revealed ${revealed.roundDate}: no prediction submitted.`;
    }
  }

  recordNode.textContent = `${record.wins}W ${record.losses}L (${record.winRate}) across ${record.total} scored rounds. ${revealedLine}`;
}

function renderParallelRemoteViewing() {
  if (!nodes.rvParallelNote) {
    return;
  }

  const payload = state.parallelRemoteViewing;
  if (!payload) {
    nodes.rvParallelNote.textContent = 'Loading parallel experiment tracks...';
    return;
  }

  const engine = payload.engine || {};
  const tracks = payload.tracks || {};
  const dynamicTrack = tracks.dynamic || {};
  const preloadedTrack = tracks.preloaded || {};
  const comparison = payload.comparison || {};

  nodes.rvParallelNote.textContent =
    `${engine.message || ''} Dynamic generation at ${engine.dynamicGenerateAtUtc || '08:55'} UTC. ` +
    `Preloaded control target depth: ${engine.preloadedDefaultDays || 365} days.`;

  renderParallelTrackSummary(
    dynamicTrack,
    nodes.rvParallelDynamicMeta,
    nodes.rvParallelDynamicRecord,
    nodes.rvParallelDynamicPrediction,
    nodes.rvParallelDynamicForm
  );
  renderParallelTrackSummary(
    preloadedTrack,
    nodes.rvParallelPreloadedMeta,
    nodes.rvParallelPreloadedRecord,
    nodes.rvParallelPreloadedPrediction,
    nodes.rvParallelPreloadedForm
  );

  if (nodes.rvParallelFrontloadBtn) {
    nodes.rvParallelFrontloadBtn.disabled = !Boolean(state.user);
  }

  if (nodes.rvParallelComparison) {
    const dynamic = comparison.dynamic || { winRate: '0%', total: 0 };
    const preloaded = comparison.preloaded || { winRate: '0%', total: 0 };
    const delta = Number.isFinite(Number(comparison.deltaWinRatePct))
      ? Number(comparison.deltaWinRatePct)
      : 0;
    nodes.rvParallelComparison.textContent =
      `Dynamic ${dynamic.winRate} (${dynamic.total} scored) vs Preloaded ${preloaded.winRate} (${preloaded.total} scored). ` +
      `Delta preloaded-dynamic: ${delta.toFixed(2)} percentage points.`;
  }
}

function renderCommunityViewing() {
  if (
    !nodes.rvCommunityNote ||
    !nodes.rvCommunityActiveMeta ||
    !nodes.rvCommunityPredictionForm ||
    !nodes.rvCommunityRevealedMeta ||
    !nodes.rvCommunityPredictionsList
  ) {
    return;
  }

  const payload = state.communityViewing;
  if (!payload) {
    nodes.rvCommunityNote.textContent = 'Loading tenant community rounds...';
    return;
  }

  if (payload.error) {
    nodes.rvCommunityNote.textContent = payload.error;
  }

  const active = payload.active;
  const revealed = payload.revealed;
  const tenantName = state.tenantDetail?.name || 'this tenant';
  const canCreateRound = Boolean(state.user && state.tenantId);
  nodes.rvCommunityNote.textContent =
    `Community rounds are scoped to ${tenantName}. Upload a real photo, lock guesses, then reveal on schedule.`;

  if (nodes.rvCommunityCreateForm) {
    const controls = Array.from(nodes.rvCommunityCreateForm.querySelectorAll('input, textarea, button'));
    controls.forEach((element) => {
      element.disabled = !canCreateRound;
    });
  }

  if (active) {
    nodes.rvCommunityActiveMeta.textContent =
      `${active.title} • ${active.submissionCount} guess${active.submissionCount === 1 ? '' : 'es'} • ` +
      `reveals ${formatTimestamp(active.revealAt)} • posted by ${active.createdBy?.name || 'Unknown'}.`;
  } else {
    nodes.rvCommunityActiveMeta.textContent = 'No active community round. Start one with your own photo.';
  }

  const canSubmitPrediction = Boolean(state.user && active && active.submissionOpen);
  const predictionControls = Array.from(
    nodes.rvCommunityPredictionForm.querySelectorAll('textarea, button')
  );
  predictionControls.forEach((element) => {
    element.disabled = !canSubmitPrediction;
  });

  if (nodes.rvCommunityPrediction) {
    nodes.rvCommunityPrediction.value = active?.myPrediction?.prediction || '';
  }

  if (!state.user && nodes.rvCommunityPredictionFeedback && !nodes.rvCommunityPredictionFeedback.textContent) {
    setFeedback(nodes.rvCommunityPredictionFeedback, 'Log in to submit a community guess.', 'error');
  }

  if (revealed) {
    nodes.rvCommunityRevealedMeta.textContent =
      `${revealed.title} • revealed ${formatTimestamp(revealed.revealAt)} • ` +
      `${revealed.submissionCount} total guess${revealed.submissionCount === 1 ? '' : 'es'}.`;

    if (nodes.rvCommunityImageShell && nodes.rvCommunityImage) {
      if (revealed.imageUrl) {
        nodes.rvCommunityImage.src = revealed.imageUrl;
        nodes.rvCommunityImageShell.hidden = false;
      } else {
        nodes.rvCommunityImageShell.hidden = true;
      }
    }

    if (nodes.rvCommunityBriefing) {
      nodes.rvCommunityBriefing.textContent = revealed.briefing
        ? `Briefing: ${revealed.briefing}`
        : 'No additional briefing was provided for this round.';
    }

    const predictions = Array.isArray(revealed.predictions) ? revealed.predictions : [];
    if (predictions.length === 0) {
      nodes.rvCommunityPredictionsList.innerHTML = '<li>No guesses were submitted for this round.</li>';
    } else {
      nodes.rvCommunityPredictionsList.innerHTML = predictions
        .map((entry) => {
          const text = String(entry.prediction || '');
          const clipped = text.length > 260 ? `${text.slice(0, 257)}...` : text;
          return `<li><strong>${escapeHtml(entry.userName || 'Unknown')}</strong> • ${escapeHtml(clipped)}</li>`;
        })
        .join('');
    }
  } else {
    nodes.rvCommunityRevealedMeta.textContent =
      'No revealed community rounds yet. Create one and set a reveal timer.';
    if (nodes.rvCommunityImageShell) {
      nodes.rvCommunityImageShell.hidden = true;
    }
    if (nodes.rvCommunityBriefing) {
      nodes.rvCommunityBriefing.textContent = '';
    }
    nodes.rvCommunityPredictionsList.innerHTML = '<li>Revealed guesses will appear here.</li>';
  }
}

function renderAll() {
  renderAuth();
  renderTenantSelector();
  renderTenantList();
  renderHero();
  renderOnboarding();
  renderChannels();
  renderHotTags();
  renderRemoteViewing();
  renderParallelRemoteViewing();
  renderCommunityViewing();
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

async function loadParallelRemoteViewing() {
  try {
    const payload = await apiRequest('/api/remote-viewing/parallel/daily');
    state.parallelRemoteViewing = payload;
  } catch (error) {
    state.parallelRemoteViewing = {
      engine: {
        providerReady: false,
        message: error.message || 'Parallel remote-viewing endpoint unavailable.',
        dynamicGenerateAtUtc: '08:55',
        preloadedDefaultDays: 365
      },
      tracks: {
        dynamic: {
          today: null,
          revealed: null,
          record: { wins: 0, losses: 0, total: 0, winRate: '0%' }
        },
        preloaded: {
          today: null,
          revealed: null,
          record: { wins: 0, losses: 0, total: 0, winRate: '0%' }
        }
      },
      comparison: {
        dynamic: { wins: 0, losses: 0, total: 0, winRate: '0%', winRatePct: 0 },
        preloaded: { wins: 0, losses: 0, total: 0, winRate: '0%', winRatePct: 0 },
        deltaWinRatePct: 0
      }
    };
  }
}

async function loadCommunityViewing() {
  if (!state.tenantId) {
    state.communityViewing = null;
    return;
  }

  try {
    const payload = await apiRequest(`/api/tenants/${state.tenantId}/community-viewing`);
    state.communityViewing = payload;
  } catch (error) {
    state.communityViewing = {
      active: null,
      revealed: null,
      queue: [],
      error: error.message || 'Community viewing endpoint unavailable.'
    };
  }
}

async function refreshAllData() {
  await loadTenants();
  await Promise.all([loadTenantData(), loadRemoteViewing(), loadParallelRemoteViewing(), loadCommunityViewing()]);
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

  if (state.user) {
    setFeedback(
      nodes.authFeedback,
      `Already logged in as ${state.user.email}. Click Log out first to switch accounts.`,
      'error'
    );
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
    const message =
      error.status === 404
        ? `${error.message} Use Create Account below if this is your first login on this deployment.`
        : error.message;
    setFeedback(nodes.authFeedback, message, 'error');

    if (error.status === 404 && nodes.registerForm) {
      const registerEmail = nodes.registerForm.querySelector('input[name="email"]');
      if (registerEmail && !String(registerEmail.value || '').trim()) {
        registerEmail.value = email;
      }
    }
  }
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  if (!nodes.registerForm) {
    return;
  }

  if (state.user) {
    setFeedback(
      nodes.authFeedback,
      `Already logged in as ${state.user.email}. Click Log out first to create another account.`,
      'error'
    );
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
    await Promise.all([loadTenantData(), loadRemoteViewing(), loadParallelRemoteViewing(), loadCommunityViewing()]);
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

async function handleRemoteFrontload() {
  if (!requireSession(nodes.rvAdminFeedback)) {
    return;
  }

  await withRefresh(async () => {
    const result = await apiRequest('/api/remote-viewing/frontload', {
      method: 'POST',
      body: { days: 30 }
    });

    setFeedback(
      nodes.rvAdminFeedback,
      `Frontload complete: ${result.generatedCount} generated, ${result.existingCount} existing, ${result.failedCount} failed, ${result.reserveTakeoverCount || 0} reserve takeovers.`,
      result.failedCount > 0 ? 'error' : 'success'
    );
  }, nodes.rvAdminFeedback);
}

async function handleRemoteReserveFrontload() {
  if (!requireSession(nodes.rvAdminFeedback)) {
    return;
  }

  await withRefresh(async () => {
    const result = await apiRequest('/api/remote-viewing/reserve/frontload', {
      method: 'POST',
      body: { targetAvailable: 30 }
    });

    setFeedback(
      nodes.rvAdminFeedback,
      `Reserve top-up: ${result.generatedCount} generated, ${result.availableAfterCount} available now, ${result.failedCount} failed.`,
      result.failedCount > 0 ? 'error' : 'success'
    );
  }, nodes.rvAdminFeedback);
}

async function handleRemoteXPost() {
  if (!requireSession(nodes.rvAdminFeedback)) {
    return;
  }

  const revealedId = Number(state.remoteViewing?.revealed?.id || 0);
  if (!revealedId) {
    setFeedback(nodes.rvAdminFeedback, 'No revealed round is available to post.', 'error');
    return;
  }

  await withRefresh(async () => {
    const result = await apiRequest(`/api/remote-viewing/rounds/${revealedId}/x-post`, {
      method: 'POST'
    });

    setFeedback(
      nodes.rvAdminFeedback,
      `Posted to X: ${result.xPost?.url || 'posted'}`,
      'success'
    );
  }, nodes.rvAdminFeedback);
}

async function handleParallelPredictionSubmit(track, predictionNode, feedbackNode) {
  if (!predictionNode || !requireSession(feedbackNode)) {
    return;
  }

  const prediction = String(predictionNode.value || '').trim();
  if (prediction.length < 8) {
    setFeedback(feedbackNode, 'Prediction must be at least 8 characters.', 'error');
    return;
  }

  await withRefresh(async () => {
    await apiRequest('/api/remote-viewing/parallel/predictions', {
      method: 'POST',
      body: { track, prediction }
    });

    const label = track === 'dynamic' ? 'Dynamic' : 'Preloaded';
    setFeedback(feedbackNode, `${label} track prediction submitted.`, 'success');
  }, feedbackNode);
}

async function handleParallelPreloadedFrontload() {
  if (!requireSession(nodes.rvParallelFeedback)) {
    return;
  }

  await withRefresh(async () => {
    const result = await apiRequest('/api/remote-viewing/parallel/frontload-preloaded', {
      method: 'POST',
      body: { days: 365 }
    });
    setFeedback(
      nodes.rvParallelFeedback,
      `Parallel preloaded frontload: ${result.generatedCount} generated, ${result.existingCount} existing, ${result.failedCount} failed.`,
      result.failedCount > 0 ? 'error' : 'success'
    );
  }, nodes.rvParallelFeedback);
}

async function handleCommunityRoundCreate(event) {
  event.preventDefault();
  if (!nodes.rvCommunityCreateForm || !requireSession(nodes.rvCommunityCreateFeedback)) {
    return;
  }

  if (!state.tenantId) {
    setFeedback(nodes.rvCommunityCreateFeedback, 'Select a tenant before creating a community round.', 'error');
    return;
  }

  const title = String(nodes.rvCommunityTitle?.value || '').trim();
  const briefing = String(nodes.rvCommunityBriefingInput?.value || '').trim();
  const revealHours = Number(nodes.rvCommunityRevealHours?.value || 24);
  const imageFile = nodes.rvCommunityImageInput?.files?.[0] || null;

  if (title.length < 3) {
    setFeedback(nodes.rvCommunityCreateFeedback, 'Title must be at least 3 characters.', 'error');
    return;
  }
  if (!Number.isFinite(revealHours) || revealHours < 0 || revealHours > 168) {
    setFeedback(nodes.rvCommunityCreateFeedback, 'Reveal hours must be between 0 and 168.', 'error');
    return;
  }
  if (!imageFile) {
    setFeedback(nodes.rvCommunityCreateFeedback, 'Select an image file to upload.', 'error');
    return;
  }
  if (imageFile.size > 8 * 1024 * 1024) {
    setFeedback(nodes.rvCommunityCreateFeedback, 'Image must be 8MB or smaller.', 'error');
    return;
  }

  await withRefresh(async () => {
    const imageDataUrl = await fileToDataUrl(imageFile);
    const result = await apiRequest(`/api/tenants/${state.tenantId}/community-viewing/rounds`, {
      method: 'POST',
      body: { title, briefing, revealHours, imageDataUrl }
    });
    nodes.rvCommunityCreateForm.reset();
    if (nodes.rvCommunityRevealHours) {
      nodes.rvCommunityRevealHours.value = '24';
    }
    setFeedback(
      nodes.rvCommunityCreateFeedback,
      `Community round "${result.round?.title || title}" created.`,
      'success'
    );
  }, nodes.rvCommunityCreateFeedback);
}

async function handleCommunityPredictionSubmit(event) {
  event.preventDefault();
  if (!nodes.rvCommunityPrediction || !requireSession(nodes.rvCommunityPredictionFeedback)) {
    return;
  }

  if (!state.tenantId) {
    setFeedback(nodes.rvCommunityPredictionFeedback, 'Select a tenant first.', 'error');
    return;
  }

  const activeRoundId = Number(state.communityViewing?.active?.id || 0);
  if (!activeRoundId) {
    setFeedback(nodes.rvCommunityPredictionFeedback, 'No active community round is available.', 'error');
    return;
  }

  const prediction = String(nodes.rvCommunityPrediction.value || '').trim();
  if (prediction.length < 8) {
    setFeedback(nodes.rvCommunityPredictionFeedback, 'Prediction must be at least 8 characters.', 'error');
    return;
  }

  await withRefresh(async () => {
    await apiRequest(`/api/tenants/${state.tenantId}/community-viewing/rounds/${activeRoundId}/predictions`, {
      method: 'POST',
      body: { prediction }
    });
    setFeedback(nodes.rvCommunityPredictionFeedback, 'Community prediction submitted.', 'success');
  }, nodes.rvCommunityPredictionFeedback);
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

function jumpToSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) {
    return;
  }

  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const focusTarget = section.querySelector('input, textarea, select, button');
  if (focusTarget) {
    setTimeout(() => {
      focusTarget.focus({ preventScroll: true });
    }, 280);
  }
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

  if (nodes.rvFrontloadBtn) {
    nodes.rvFrontloadBtn.addEventListener('click', () => {
      void handleRemoteFrontload();
    });
  }

  if (nodes.rvReserveFrontloadBtn) {
    nodes.rvReserveFrontloadBtn.addEventListener('click', () => {
      void handleRemoteReserveFrontload();
    });
  }

  if (nodes.rvXPostBtn) {
    nodes.rvXPostBtn.addEventListener('click', () => {
      void handleRemoteXPost();
    });
  }

  if (nodes.rvParallelDynamicForm) {
    nodes.rvParallelDynamicForm.addEventListener('submit', (event) => {
      event.preventDefault();
      void handleParallelPredictionSubmit(
        'dynamic',
        nodes.rvParallelDynamicPrediction,
        nodes.rvParallelDynamicFeedback
      );
    });
  }

  if (nodes.rvParallelPreloadedForm) {
    nodes.rvParallelPreloadedForm.addEventListener('submit', (event) => {
      event.preventDefault();
      void handleParallelPredictionSubmit(
        'preloaded',
        nodes.rvParallelPreloadedPrediction,
        nodes.rvParallelPreloadedFeedback
      );
    });
  }

  if (nodes.rvParallelFrontloadBtn) {
    nodes.rvParallelFrontloadBtn.addEventListener('click', () => {
      void handleParallelPreloadedFrontload();
    });
  }

  if (nodes.rvCommunityCreateForm) {
    nodes.rvCommunityCreateForm.addEventListener('submit', (event) => {
      void handleCommunityRoundCreate(event);
    });
  }

  if (nodes.rvCommunityPredictionForm) {
    nodes.rvCommunityPredictionForm.addEventListener('submit', (event) => {
      void handleCommunityPredictionSubmit(event);
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

  Array.from(document.querySelectorAll('[data-jump]')).forEach((button) => {
    button.addEventListener('click', () => {
      jumpToSection(String(button.getAttribute('data-jump') || ''));
    });
  });
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

  setupAbductionIntro();
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
