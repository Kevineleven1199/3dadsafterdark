const yearNode = document.getElementById('year');
if (yearNode) {
  yearNode.textContent = String(new Date().getFullYear());
}

const storageKey = 'dadAfterDarkIntroSeen';
const splash = document.getElementById('splash');
const enterButton = document.getElementById('enter-experience');
const skipIntro = document.getElementById('skip-intro');

function setIntroSeen() {
  try {
    localStorage.setItem(storageKey, '1');
  } catch {
    // Ignore storage errors in restricted browsing contexts.
  }
}

function hasSeenIntro() {
  try {
    return localStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
}

function dismissSplash(persist) {
  if (!splash || splash.classList.contains('dismissed')) {
    return;
  }

  if (persist) {
    setIntroSeen();
  }

  document.body.classList.remove('prelaunch');
  splash.classList.add('dismissed');

  window.setTimeout(() => {
    splash.remove();
  }, 850);
}

if (hasSeenIntro()) {
  dismissSplash(false);
}

if (enterButton) {
  enterButton.addEventListener('click', () => {
    dismissSplash(true);
  });
}

if (skipIntro) {
  skipIntro.addEventListener('click', (event) => {
    event.preventDefault();
    dismissSplash(true);
    const main = document.getElementById('main-content');
    if (main) {
      main.scrollIntoView({ behavior: 'smooth' });
    }
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    dismissSplash(true);
  }
});

const revealNodes = document.querySelectorAll('.reveal');
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
    threshold: 0.2
  }
);

revealNodes.forEach((node) => observer.observe(node));
