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
observeReveals();

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