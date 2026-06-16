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

fetch('content.json')
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
          ${mod.benefits.map(benefit => `
            <div class="mod-benefit">
              <div class="mod-benefit-icon">
                <svg viewBox="0 0 24 24" style="width:24px; height:24px;">
                  <circle cx="12" cy="12" r="10" stroke="var(--gold)" fill="none" stroke-width="1.5"/>
                  <path d="M8 12l3 3 5-5" stroke="var(--gold)" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
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