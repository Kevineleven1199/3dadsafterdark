const yearNode = document.getElementById('year');
if (yearNode) {
  yearNode.textContent = String(new Date().getFullYear());
}

const splash = document.getElementById('splash');
const enterButton = document.getElementById('enter-experience');
const skipIntro = document.getElementById('skip-intro');
const splashStatus = document.getElementById('splash-status');
const splashMeterBar = document.getElementById('splash-meter-bar');

function dismissSplash() {
  if (!splash || splash.classList.contains('dismissed')) {
    return;
  }

  document.body.classList.remove('prelaunch');
  splash.classList.add('dismissed');

  window.setTimeout(() => {
    splash.remove();
  }, 1000);
}

if (enterButton) {
  const lockMs = 6200;
  const startMs = Date.now();

  const statusForProgress = (progress) => {
    if (progress < 0.2) {
      return 'Opening portal...';
    }
    if (progress < 0.45) {
      return 'Agents going undercover...';
    }
    if (progress < 0.7) {
      return 'Abduction beam charging...';
    }
    if (progress < 1) {
      return 'Neon signal syncing...';
    }
    return 'Drop is live. Enter when ready.';
  };

  const tick = () => {
    const elapsed = Date.now() - startMs;
    const progress = Math.min(1, elapsed / lockMs);

    if (splashMeterBar) {
      splashMeterBar.style.transform = `scaleX(${progress})`;
    }

    if (splashStatus) {
      splashStatus.textContent = statusForProgress(progress);
    }

    if (progress < 1) {
      window.requestAnimationFrame(tick);
      return;
    }

    enterButton.disabled = false;
    enterButton.textContent = 'Enter The Drop';
  };

  enterButton.textContent = 'Calibrating...';
  tick();

  enterButton.addEventListener('click', () => {
    dismissSplash();
  });
}

if (skipIntro) {
  skipIntro.addEventListener('click', (event) => {
    event.preventDefault();
    dismissSplash();
    const main = document.getElementById('main-content');
    if (main) {
      main.scrollIntoView({ behavior: 'smooth' });
    }
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    dismissSplash();
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
    threshold: 0.15
  }
);

revealNodes.forEach((node) => observer.observe(node));

const leadForm = document.getElementById('lead-form');
const formNote = document.getElementById('form-note');

if (leadForm) {
  leadForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const data = new FormData(leadForm);
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim();
    const company = String(data.get('company') || '').trim();
    const interest = String(data.get('interest') || '').trim();
    const message = String(data.get('message') || '').trim();

    if (!name || !email || !interest || !message) {
      if (formNote) {
        formNote.textContent = 'Please complete all required fields.';
      }
      return;
    }

    const subject = encodeURIComponent(`3 Dads After Dark Inquiry: ${interest}`);
    const body = encodeURIComponent(
      [
        `Name: ${name}`,
        `Email: ${email}`,
        `Company: ${company || 'N/A'}`,
        `Interest: ${interest}`,
        '',
        'Message:',
        message
      ].join('\n')
    );

    window.location.href = `mailto:hello@3dadsafterdark.com?subject=${subject}&body=${body}`;

    if (formNote) {
      formNote.textContent = 'Your email app should open now to send the inquiry.';
    }
  });
}
