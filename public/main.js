const yearNode = document.getElementById('year');
if (yearNode) {
  yearNode.textContent = String(new Date().getFullYear());
}

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
