// ── Section navigation ──
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.remove('active');
    const oc = a.getAttribute('onclick') || '';
    if (oc.includes("'"+id+"'")) a.classList.add('active');
  });
  // Re-run reveal on new section
  setTimeout(()=>observeReveals(), 50);
}

// ── Sub-pane navigation ──
function showSub(section, pane, btn) {
  document.querySelectorAll('#'+section+' .sub-pane').forEach(p=>p.classList.remove('active'));
  const el = document.getElementById(section+'-'+pane);
  if (el) {
    el.classList.add('active');
    // Reset and re-trigger animations in new pane
    el.querySelectorAll('.reveal,.reveal-left,.reveal-right').forEach(r=>{r.classList.remove('visible');});
    setTimeout(()=>{
      el.querySelectorAll('.reveal,.reveal-left,.reveal-right').forEach(r=>r.classList.add('visible'));
    }, 50);
  }
  if (btn) {
    btn.closest('.sub-nav').querySelectorAll('.sub-nav-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
  }
}
function showMod(pane) {
  const btn = document.querySelector('#modalities .sub-nav-btn[onclick*="\''+pane+'\'"]');
  showSub('modalities', pane, btn);
}

// ── Reveal on scroll ──
function observeReveals() {
  const targets = document.querySelectorAll('.section.active .reveal, .section.active .reveal-left, .section.active .reveal-right');
  const obs = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
    });
  }, {threshold:0.12, rootMargin:'0px 0px -40px 0px'});
  targets.forEach(t=>obs.observe(t));
}

// ── Nav scroll state ──
window.addEventListener('scroll', ()=>{
  const nav = document.getElementById('main-nav');
  if (window.scrollY > 60) nav.classList.add('scrolled');
  else nav.classList.remove('scrolled');
}, {passive:true});

// ── Modal ──
function openModal() { document.getElementById('modal-overlay').classList.add('open'); document.body.style.overflow='hidden'; }
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); document.body.style.overflow=''; }
document.getElementById('modal-overlay').addEventListener('click', function(e){ if(e.target===this) closeModal(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeModal(); closeDrawer(); } });

// ── Mobile drawer ──
function toggleDrawer() { document.getElementById('nav-drawer').classList.toggle('open'); }
function closeDrawer() { document.getElementById('nav-drawer').classList.remove('open'); }

// ── Drag-to-scroll on modality strip ──
const scroll = document.getElementById('mod-scroll');
if (scroll) {
  let isDown=false, startX, scrollLeft;
  scroll.addEventListener('mousedown', e=>{ isDown=true; scroll.style.cursor='grabbing'; startX=e.pageX-scroll.offsetLeft; scrollLeft=scroll.scrollLeft; });
  scroll.addEventListener('mouseleave',()=>{ isDown=false; scroll.style.cursor='grab'; });
  scroll.addEventListener('mouseup',()=>{ isDown=false; scroll.style.cursor='grab'; });
  scroll.addEventListener('mousemove', e=>{ if(!isDown) return; e.preventDefault(); const x=e.pageX-scroll.offsetLeft; scroll.scrollLeft=scrollLeft-(x-startX)*1.2; });
}

// ── Init active nav link ──
document.querySelectorAll('.nav-links a')[0].classList.add('active');

// ── Multilingual State & Fetching ──
let siteData = null;
let currentLang = localStorage.getItem('lang') || 'en';

const fetchUrl = window.location.protocol === 'file:' ? 'content.json' : 'content.json?cb=' + new Date().getTime();
fetch(fetchUrl)
  .then(response => response.json())
  .then(data => {
    siteData = data;
    updateLanguageUI();
    renderLanguage(currentLang);
  })
  .catch(err => console.error("Error loading content.json:", err));

function renderLanguage(lang) {
  if (!siteData || !siteData[lang]) return;
  
  const langData = siteData[lang];
  
  // Update document metadata dynamically
  if (langData.metadata) {
    document.title = langData.metadata.title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', langData.metadata.description);
  }
  
  bindStaticContent(langData);
  renderHomeModalities(langData);
  renderAboutContent(langData);
  renderServicesContent(langData);
  renderModalitiesContent(langData);
  
  // Re-run scroll animations on the newly loaded elements
  observeReveals();
}

function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'de' : 'en';
  localStorage.setItem('lang', currentLang);
  
  // Opacity fade transition
  document.body.style.opacity = 0;
  setTimeout(() => {
    updateLanguageUI();
    renderLanguage(currentLang);
    document.body.style.opacity = 1;
  }, 250);
}

function updateLanguageUI() {
  const btns = document.querySelectorAll('.nav-lang-toggle');
  btns.forEach(btn => {
    // Show the target language option (e.g. if current is EN, show "DE", if DE, show "EN")
    btn.textContent = currentLang === 'en' ? 'DE' : 'EN';
  });
  document.documentElement.lang = currentLang;
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

function bindStaticContent(data) {
  document.querySelectorAll('[data-copy]').forEach(el => {
    const key = el.getAttribute('data-copy');
    const value = getNestedValue(data, key);
    if (value) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = value;
      } else if (el.getAttribute('data-html') === 'true' || key.endsWith('.headline') || key.endsWith('.title') || key.endsWith('.quote') || key.includes('body') || key.includes('address') || key.includes('note') || key.includes('logo') || key.includes('text')) {
        el.innerHTML = value;
      } else {
        el.textContent = value;
      }
    }
  });
}

function renderHomeModalities(data) {
  const container = document.getElementById('mod-scroll');
  if (!container || !data.modalities || !data.modalities.list) return;
  
  container.innerHTML = data.modalities.list.map((mod, idx) => `
    <div class="modality-card reveal delay-${(idx % 4) + 1}" onclick="showSection('modalities');showMod('${mod.id}')">
      <div class="modality-card-img">
        <img src="${mod.image}" alt="${mod.title}"/>
      </div>
      <div class="modality-card-content">
        <p class="modality-card-num">0${idx + 1}</p>
        <h3>${mod.title}</h3>
        <p>${mod.desc}</p>
        <span class="modality-card-arrow">Learn more →</span>
      </div>
    </div>
  `).join('');
}

function renderAboutContent(data) {
  const tagsContainer = document.getElementById('about-bio-tags');
  if (tagsContainer && data.about.bio.tags) {
    tagsContainer.innerHTML = data.about.bio.tags.map(tag => `
      <span class="bio-tag">${tag}</span>
    `).join('');
  }

  const paragraphsContainer = document.getElementById('about-bio-paragraphs');
  if (paragraphsContainer && data.about.bio.paragraphs) {
    paragraphsContainer.innerHTML = data.about.bio.paragraphs.map(p => `
      <p class="body-md" style="margin-bottom:16px">${p}</p>
    `).join('');
  }

  const pillarsContainer = document.getElementById('about-pillars');
  if (pillarsContainer && data.about.pillars.items) {
    pillarsContainer.innerHTML = data.about.pillars.items.map(p => `
      <div class="pillar-big-card">
        <div class="pillar-roman">${p.roman}</div>
        <h3>${p.title}</h3>
        <p>${p.desc}</p>
      </div>
    `).join('');
  }
}

function renderServicesContent(data) {
  const container = document.getElementById('services-packages-section');
  if (!container || !data.services.packages) return;

  let html = '';

  data.services.packages.forEach(track => {
    html += `
      <div class="pkg-track reveal">
        <div class="pkg-track-header">
          <div>
            <h3 class="pkg-track-name">${track.name}</h3>
            <p class="pkg-track-title">${track.subtitle}</p>
            <p class="body-sm" style="margin-top:12px;max-width:420px">${track.description}</p>
          </div>
          <div class="pkg-perks">
            <p class="pkg-perks-label">Included in every ${track.name} package</p>
            ${track.perks.map(perk => `
              <div class="pkg-perk-item">
                <span class="pkg-perk-dot"></span>
                <span>${perk}</span>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="pkg-cards-grid">
          ${track.cards.map((card, idx) => `
            <div class="pkg-card ${idx === 1 ? 'pkg-card-featured' : ''}">
              <div class="pkg-card-top">
                <h4>${card.title}</h4>
                <span class="pkg-freq">${card.frequency}</span>
              </div>
              <div class="pkg-price-row">
                <div>
                  <div class="pkg-price">${card.price}</div>
                  <div class="pkg-save">${card.save}</div>
                </div>
                ${card.price_alt ? `
                  <div class="pkg-price-alt">
                    <div class="pkg-price">${card.price_alt}</div>
                    <div class="pkg-save">${card.save_alt}</div>
                  </div>
                ` : ''}
              </div>
              <button class="${idx === 1 ? 'btn-gold' : 'btn-outline-sm'}" onclick="openModal()">Book</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });

  const lg = data.services.long_game;
  if (lg) {
    html += `
      <div class="pkg-track pkg-track-long-game reveal">
        <div class="pkg-track-header">
          <div>
            <h3 class="pkg-track-name">${lg.name}</h3>
            <p class="pkg-track-title">${lg.subtitle}</p>
            <p class="body-sm" style="margin-top:16px;max-width:420px">${lg.description}</p>
          </div>
          <div class="pkg-perks">
            <p class="pkg-perks-label">Included in ${lg.name}</p>
            ${lg.perks.map(perk => `
              <div class="pkg-perk-item">
                <span class="pkg-perk-dot"></span>
                <span>${perk}</span>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="long-game-rate">
          <div class="long-game-rate-inner">
            <span class="long-game-rate-label">${lg.rate_label}</span>
            <span class="long-game-rate-price">${lg.rate_price} <sub>${lg.rate_sub}</sub></span>
          </div>
          <p class="body-sm" style="margin-top:16px;max-width:400px">Duration and frequency are agreed together after your first session. Book a single session to begin — and we'll take it from there.</p>
          <button class="btn-gold" style="margin-top:24px" onclick="openModal()">Book a first session</button>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

function getBenefitIcon(modId, idx) {
  const icons = {
    classic: [
      '<path d="M2 12 Q6 6 10 12 Q14 18 18 12 Q20 9 22 12"/>',
      '<path d="M18 11V6a2 2 0 0 0-4 0"/><path d="M14 10V4a2 2 0 0 0-4 0v2"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
      '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
      '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'
    ],
    shiatsu: [
      '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
      '<path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>',
      '<path d="M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z"/><path d="M12 8v4l3 3"/>',
      '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>'
    ],
    connected: [
      '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
      '<circle cx="6" cy="12" r="4"/><circle cx="18" cy="12" r="4"/><path d="M10 12h4"/>',
      '<path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 2v10l6.3 6.3"/>',
      '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>'
    ],
    tuina: [
      '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
      '<path d="M4.5 12.5l4 4 10-10"/>',
      '<path d="M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z"/><path d="M12 2 Q16 12 12 22"/><path d="M2 12h20"/>',
      '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>'
    ],
    qigong: [
      '<path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 2v10l4 4"/>',
      '<circle cx="12" cy="12" r="10"/><path d="M12 2 Q16 12 12 22"/><path d="M2 12h20"/>',
      '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
      '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>'
    ]
  };

  const modGroup = icons[modId];
  if (modGroup && modGroup[idx]) {
    return `
      <svg viewBox="0 0 24 24" style="width:24px; height:24px;">
        ${modGroup[idx]}
      </svg>
    `;
  }

  // Fallback checkmark circle
  return `
    <svg viewBox="0 0 24 24" style="width:24px; height:24px;">
      <circle cx="12" cy="12" r="10" stroke="var(--gold)" fill="none" stroke-width="1.5"/>
      <path d="M8 12l3 3 5-5" stroke="var(--gold)" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

function renderModalitiesContent(data) {
  const container = document.getElementById('modalities-panes-container');
  if (!container || !data.modalities.list) return;

  container.innerHTML = data.modalities.list.map((mod, idx) => `
    <div id="modalities-${mod.id}" class="sub-pane ${idx === 0 ? 'active' : ''}">
      <div class="mod-wrap">
        <div class="mod-image-banner">
          <img src="${mod.image}" alt="${mod.title}"/>
        </div>
        <div class="mod-intro reveal">
          <p class="eyebrow" style="margin-bottom:12px">What is ${mod.title}?</p>
          <h2>${mod.title}</h2>
          <p style="margin-top:14px">${mod.desc}</p>
        </div>
        <div class="mod-benefits reveal">
          ${mod.benefits.map((benefit, bIdx) => `
            <div class="mod-benefit">
              <div class="mod-benefit-icon">
                ${getBenefitIcon(mod.id, bIdx)}
              </div>
              <h4>${benefit.title}</h4>
              <p>${benefit.desc}</p>
            </div>
          `).join('')}
        </div>
        <div class="mod-detail-grid reveal">
          <p>${mod.details}</p>
        </div>
        <p class="mod-checks-title">${mod.checks_title || 'Great for'}</p>
        <div class="mod-checks">
          ${mod.checks.map(check => `
            <div class="mod-check">${check}</div>
          `).join('')}
        </div>
        ${mod.callout ? `
          <div class="tuina-callout reveal">
            <div class="tuina-callout-icon">${mod.callout.icon}</div>
            <div>
              <h3>${mod.callout.title}</h3>
              <p>${mod.callout.description}</p>
            </div>
          </div>
        ` : ''}
        <div class="mod-cta-bar reveal">
          <div>
            <h2>${data.modalities.cta_bar.title}</h2>
            <p>${data.modalities.cta_bar.description}</p>
          </div>
          <button class="btn-gold" onclick="openModal()">${data.modalities.cta_bar.cta}</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ── Form submission handling (FormSubmit.co via AJAX) ──
function submitBookingForm(event) {
  event.preventDefault();
  const submitBtn = document.getElementById('bm-submit');
  const originalText = submitBtn.textContent;
  
  const firstName = document.getElementById('bm-first-name').value.trim();
  const lastName = document.getElementById('bm-last-name').value.trim();
  const email = document.getElementById('bm-email').value.trim();
  const therapy = document.getElementById('bm-therapy').value;
  const notes = document.getElementById('bm-notes').value.trim();
  
  const clientName = firstName + " " + lastName;
  submitBtn.disabled = true;
  submitBtn.textContent = currentLang === 'en' ? 'Sending...' : 'Senden...';

  fetch("https://formsubmit.co/ajax/hello@pauseandmove.ch", {
    method: "POST",
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      _subject: "Booking Request " + clientName,
      "Name": clientName,
      "Email": email,
      "Therapy": therapy,
      "Notes": notes,
      _captcha: "false"
    })
  })
  .then(response => {
    if (response.ok) {
      submitBtn.textContent = currentLang === 'en' ? 'Sent successfully!' : 'Erfolgreich gesendet!';
      document.getElementById('booking-form').reset();
      setTimeout(() => {
        closeModal();
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }, 1500);
    } else {
      throw new Error("Form submission failed");
    }
  })
  .catch(err => {
    console.error(err);
    submitBtn.textContent = currentLang === 'en' ? 'Error. Try again.' : 'Fehler. Erneut versuchen.';
    submitBtn.disabled = false;
    setTimeout(() => {
      submitBtn.textContent = originalText;
    }, 3000);
  });
}

function submitContactForm(event) {
  event.preventDefault();
  const submitBtn = document.getElementById('cf-submit');
  const originalText = submitBtn.textContent;
  
  const firstName = document.getElementById('cf-first-name').value.trim();
  const lastName = document.getElementById('cf-last-name').value.trim();
  const email = document.getElementById('cf-email').value.trim();
  const interest = document.getElementById('cf-interest').value;
  const message = document.getElementById('cf-message').value.trim();
  
  const clientName = firstName + " " + lastName;
  submitBtn.disabled = true;
  submitBtn.textContent = currentLang === 'en' ? 'Sending...' : 'Senden...';

  fetch("https://formsubmit.co/ajax/hello@pauseandmove.ch", {
    method: "POST",
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      _subject: "Booking Request " + clientName,
      "Name": clientName,
      "Email": email,
      "Interested In": interest,
      "Message": message,
      _captcha: "false"
    })
  })
  .then(response => {
    if (response.ok) {
      submitBtn.textContent = currentLang === 'en' ? 'Sent successfully!' : 'Erfolgreich gesendet!';
      document.getElementById('contact-form').reset();
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }, 3000);
    } else {
      throw new Error("Form submission failed");
    }
  })
  .catch(err => {
    console.error(err);
    submitBtn.textContent = currentLang === 'en' ? 'Error. Try again.' : 'Fehler. Erneut versuchen.';
    submitBtn.disabled = false;
    setTimeout(() => {
      submitBtn.textContent = originalText;
    }, 3000);
  });
}