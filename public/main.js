(function () {
  const PROJECTS = {
    'ip-speil': {
      title: 'ip-speil',
      tags: [{ text: 'Privacy', cls: 'tag-sapphire' }, { text: 'Network diagnostics', cls: 'tag-teal' }],
      href: 'https://ip.mlz.no',
      content: `
        <div class="modal-lede">
          <p>A small privacy/debugging tool built with care for UX, observability, and data minimization.</p>
        </div>
        <div class="modal-story">
          <h2>Why I built it</h2>
          <p>I wanted a practical tool for debugging VPNs, browser privacy settings, IPv6 leaks, and what basic metadata websites receive. Most IP-check pages either feel ad-heavy, opaque, or too shallow, so this is my small, transparent version.</p>
          <p>The project turns "what does the internet see when I visit a page?" into a fast diagnostic view, while keeping browser-local signals separate from server-observed data.</p>
        </div>
        <div class="modal-section-grid">
          <section class="modal-section">
            <h2>What it does</h2>
            <ul>
              <li>Shows HTTP IP, location, ISP, ASN, and reverse DNS.</li>
              <li>Detects VPN, proxy, hosting, and mobile network signals.</li>
              <li>Checks WebRTC ICE candidates for public, local, and relay exposure.</li>
              <li>Compares IPv4 and IPv6 routing.</li>
              <li>Shows browser fingerprint signals and request headers.</li>
              <li>Copies a redacted diagnostics report.</li>
            </ul>
          </section>
          <section class="modal-section modal-section-tech">
            <h2>Technical notes</h2>
            <ul>
              <li>Node server with static frontend.</li>
              <li>Browser-side WebRTC, fingerprint, IPv6, and Cloudflare trace checks.</li>
              <li>IP metadata via ip-api.</li>
              <li>No database, no cookies, no stored scan results.</li>
              <li>Tests and headless browser smoke check.</li>
              <li>Dev environment pinned with devbox.</li>
            </ul>
          </section>
        </div>
      `
    }
  };

  const backdrop = document.getElementById('modal-backdrop');
  const modalTitle = document.getElementById('modal-title');
  const modalTags = document.getElementById('modal-tags');
  const modalContent = document.getElementById('modal-content');
  const modalVisit = document.getElementById('modal-visit');
  const modalClose = document.getElementById('modal-close');
  let previousFocus = null;

  function openProject(id, options = {}) {
    const p = PROJECTS[id];
    if (!p) return;
    previousFocus = options.trigger || document.activeElement;
    modalTitle.textContent = p.title;
    modalTags.innerHTML = p.tags.map(t => `<span class="tag ${t.cls}">${t.text}</span>`).join('');
    modalContent.innerHTML = p.content;
    modalVisit.href = p.href;
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    modalClose.focus();
  }

  function closeProject(options = {}) {
    backdrop.classList.remove('open');
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (options.updateUrl !== false && location.hash) {
      history.replaceState(null, '', location.pathname);
    }
    if (options.restoreFocus !== false && previousFocus instanceof HTMLElement) {
      previousFocus.focus();
    }
  }

  modalClose.addEventListener('click', closeProject);

  backdrop.addEventListener('click', function (e) {
    if (e.target === backdrop) closeProject();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && backdrop.classList.contains('open')) closeProject();
  });

  document.querySelectorAll('.card[data-project]').forEach(card => {
    card.addEventListener('click', function (e) {
      e.preventDefault();
      const id = this.dataset.project;
      history.pushState(null, '', '#' + id);
      openProject(id, { trigger: this });
    });
  });

  window.addEventListener('popstate', function () {
    const id = location.hash.slice(1);
    if (PROJECTS[id]) {
      openProject(id, { trigger: document.querySelector(`[data-project="${id}"]`) });
    } else {
      closeProject({ updateUrl: false, restoreFocus: false });
    }
  });

  const hash = location.hash.slice(1);
  if (hash && PROJECTS[hash]) {
    openProject(hash, { trigger: document.querySelector(`[data-project="${hash}"]`) });
  }
})();
