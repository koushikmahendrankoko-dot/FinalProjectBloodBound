/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — feedback.js (v2 — bug-fixed)
   FIX: renderAllData() was re-rendering the entire DOM on every
   like/vote click, wiping star hover state mid-interaction.
   Now uses partial renders — star rating and review form are
   never re-rendered after initial mount; only the lists update.
═══════════════════════════════════════════════════════════════ */

const FB_KEYS = {
  REVIEWS:     'bb_fb_reviews',
  BUGS:        'bb_fb_bugs',
  SUGGESTIONS: 'bb_fb_suggestions',
  LIKES:       'bb_fb_likes',
  VOTES:       'bb_fb_votes'
};

const REVIEWS_PER_PAGE = 5;
let visibleReviewCount = REVIEWS_PER_PAGE;
let currentSort   = 'newest';
let currentFilter = 'all';

let selectedOverallRating = 0;
let categoryRatings = { gameplay:0, story:0, visuals:0, difficulty:0 };
let selectedRecommend = null;
let selectedPriority  = null;

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', () => {
  initUserBadge();
  initStarRating();      // mounts once, never re-rendered
  initCategoryRatings(); // mounts once, never re-rendered
  initCharCounters();
  renderStats();         // lightweight stat bar only
  renderRatingBreakdown();
  renderReviewsList();
  renderBugList();
  renderSuggestionsList();
});

/* ── USER BADGE ── */
function initUserBadge() {
  const usernameEl = document.getElementById('fb-username');
  const statusEl   = document.getElementById('fb-status');
  const avatarEl   = document.getElementById('fb-avatar');
  const nameInput  = document.getElementById('review-name');

  if (window.BB && window.BB.isLoggedIn()) {
    const username = window.BB.getCurrentUser();
    if (usernameEl) usernameEl.textContent = username;
    if (statusEl)   statusEl.innerHTML = '✓ Signed in';
    if (avatarEl) {
      avatarEl.textContent = username.charAt(0).toUpperCase();
      Object.assign(avatarEl.style, {
        display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:'var(--font-heading)', fontWeight:'700',
        fontSize:'.7rem', color:'#fff'
      });
    }
    if (nameInput && !nameInput.value) nameInput.value = username;
  }
}

/* ── STAR RATING (overall) — mounted once, not re-rendered ── */
function initStarRating() {
  const stars = document.querySelectorAll('#star-rating .star');
  const label = document.getElementById('star-label');
  const labels = ['','Poor','Fair','Good','Great','Excellent!'];

  stars.forEach(star => {
    const val = parseInt(star.dataset.val, 10);

    star.addEventListener('mouseenter', () => {
      stars.forEach(s => s.classList.toggle('hovered', parseInt(s.dataset.val,10)<=val));
      if (label) label.textContent = labels[val];
    });
    star.addEventListener('mouseleave', () => {
      stars.forEach(s => s.classList.remove('hovered'));
      if (label) label.textContent = selectedOverallRating ? labels[selectedOverallRating] : 'Click to rate';
    });
    star.addEventListener('click', () => {
      selectedOverallRating = val;
      stars.forEach(s => s.classList.toggle('selected', parseInt(s.dataset.val,10)<=val));
      if (label) label.textContent = labels[val];
    });
  });
}

/* ── CATEGORY RATINGS — mounted once ── */
function initCategoryRatings() {
  document.querySelectorAll('.cat-stars').forEach(group => {
    const cat   = group.dataset.cat;
    const stars = group.querySelectorAll('.cat-star');
    stars.forEach(star => {
      const val = parseInt(star.dataset.val, 10);
      star.addEventListener('mouseenter', () => stars.forEach(s => s.classList.toggle('hovered', parseInt(s.dataset.val,10)<=val)));
      star.addEventListener('mouseleave', () => stars.forEach(s => s.classList.remove('hovered')));
      star.addEventListener('click',      () => {
        categoryRatings[cat]=val;
        stars.forEach(s => s.classList.toggle('selected', parseInt(s.dataset.val,10)<=val));
      });
    });
  });
}

/* ── CHAR COUNTERS ── */
function initCharCounters() {
  const reviewText  = document.getElementById('review-text');
  const reviewCount = document.getElementById('review-count');
  if (reviewText) reviewText.addEventListener('input', () => { if(reviewCount) reviewCount.textContent=`${reviewText.value.length} / 500`; });

  const suggestDesc  = document.getElementById('suggest-desc');
  const suggestCount = document.getElementById('suggest-count');
  if (suggestDesc) suggestDesc.addEventListener('input', () => { if(suggestCount) suggestCount.textContent=`${suggestDesc.value.length} / 400`; });
}

function setRecommend(val, btn) {
  selectedRecommend = val;
  btn.parentElement.querySelectorAll('.recommend-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}
function setPriority(val, btn) {
  selectedPriority = val;
  btn.parentElement.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

/* ── DATA HELPERS ── */
function getData(key) {
  try { const r=localStorage.getItem(key); return r?JSON.parse(r):[]; } catch(e) { return []; }
}
function setData(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); return true; } catch(e) { return false; }
}
function generateId() { return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function formatDate(ts) {
  const now=Date.now(), diff=now-ts;
  const m=Math.floor(diff/60000), h=Math.floor(m/60), d=Math.floor(h/24);
  if (m<1) return 'Just now';
  if (m<60) return `${m}m ago`;
  if (h<24) return `${h}h ago`;
  if (d<7)  return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
function chapterLabel(v) { return {ch1:'Ch.I',ch2:'Ch.II',ch3:'Ch.III',ch4:'Ch.IV',ch5:'✓ Complete'}[v]||v; }

/* ── SUBMIT: REVIEW ── */
function submitReview(event) {
  event.preventDefault();
  const errorEl  = document.getElementById('review-error');
  if (errorEl) errorEl.classList.add('hidden');

  const name    = document.getElementById('review-name').value.trim();
  const chapter = document.getElementById('review-chapter').value;
  const text    = document.getElementById('review-text').value.trim();

  if (!selectedOverallRating) { showFormError(errorEl,'Please select a star rating.'); return; }
  if (!name)  { showFormError(errorEl,'Please enter a display name.'); return; }
  if (!text)  { showFormError(errorEl,'Please write a review.'); return; }

  const review = {
    id: generateId(), name, rating: selectedOverallRating,
    categories:{...categoryRatings}, chapter:chapter||null,
    text, recommend:selectedRecommend, likes:0,
    createdAt:Date.now(),
    verified:!!(window.BB&&window.BB.isLoggedIn())
  };
  const reviews = getData(FB_KEYS.REVIEWS);
  reviews.unshift(review);
  setData(FB_KEYS.REVIEWS, reviews);

  // Reset form fields but NOT the star DOM (initStarRating owns those)
  document.getElementById('review-form').reset();
  selectedOverallRating=0; categoryRatings={gameplay:0,story:0,visuals:0,difficulty:0};
  selectedRecommend=null;
  document.querySelectorAll('#star-rating .star').forEach(s=>s.classList.remove('selected','hovered'));
  document.getElementById('star-label').textContent='Click to rate';
  document.querySelectorAll('.cat-star').forEach(s=>s.classList.remove('selected','hovered'));
  document.querySelectorAll('.recommend-btn').forEach(b=>b.classList.remove('selected'));
  const rc=document.getElementById('review-count'); if(rc) rc.textContent='0 / 500';
  if (window.BB&&window.BB.isLoggedIn()) { const ni=document.getElementById('review-name'); if(ni) ni.value=window.BB.getCurrentUser(); }

  showPageToast('✓ Review posted!');
  visibleReviewCount=REVIEWS_PER_PAGE;
  // Partial re-render — only lists, never the rating widgets
  renderStats(); renderRatingBreakdown(); renderReviewsList();
  document.getElementById('community-reviews')?.scrollIntoView({behavior:'smooth',block:'start'});
}

function showFormError(el, msg) {
  if (!el) return;
  el.textContent='⚠ '+msg; el.classList.remove('hidden');
  setTimeout(()=>el.classList.add('hidden'), 4000);
}

/* ── SUBMIT: BUG ── */
function submitBug(event) {
  event.preventDefault();
  const errorEl = document.getElementById('bug-error');
  if (errorEl) errorEl.classList.add('hidden');
  const title    = document.getElementById('bug-title').value.trim();
  const area     = document.getElementById('bug-chapter').value;
  const severity = document.getElementById('bug-severity').value;
  const steps    = document.getElementById('bug-steps').value.trim();
  if (!title||!area||!severity||!steps) { showFormError(errorEl,'Please fill all required fields.'); return; }
  const bugs = getData(FB_KEYS.BUGS);
  bugs.unshift({ id:generateId(), title, area, severity, steps,
    expected:document.getElementById('bug-expected').value.trim(),
    browser:navigator.userAgent.split(' ').slice(-2).join(' '),
    reporter:(window.BB&&window.BB.isLoggedIn())?window.BB.getCurrentUser():'Anonymous',
    createdAt:Date.now() });
  setData(FB_KEYS.BUGS, bugs);
  document.getElementById('bug-form').reset();
  showPageToast('✓ Bug report submitted!');
  renderStats(); renderBugList();
}

/* ── SUBMIT: SUGGESTION ── */
function submitSuggestion(event) {
  event.preventDefault();
  const errorEl = document.getElementById('suggest-error');
  if (errorEl) errorEl.classList.add('hidden');
  const title    = document.getElementById('suggest-title').value.trim();
  const category = document.getElementById('suggest-category').value;
  const desc     = document.getElementById('suggest-desc').value.trim();
  if (!title||!category||!desc) { showFormError(errorEl,'Please fill all required fields.'); return; }
  const suggestions = getData(FB_KEYS.SUGGESTIONS);
  suggestions.unshift({ id:generateId(), title, category, desc, priority:selectedPriority,
    votes:0, author:(window.BB&&window.BB.isLoggedIn())?window.BB.getCurrentUser():'Anonymous',
    createdAt:Date.now() });
  setData(FB_KEYS.SUGGESTIONS, suggestions);
  document.getElementById('suggestion-form').reset();
  const sc=document.getElementById('suggest-count'); if(sc) sc.textContent='0 / 400';
  selectedPriority=null;
  document.querySelectorAll('.priority-btn').forEach(b=>b.classList.remove('selected'));
  showPageToast('✓ Suggestion submitted!');
  renderStats(); renderSuggestionsList();
}

/* ── PARTIAL RENDERS (never touch star widgets) ── */
function renderStats() {
  const reviews     = getData(FB_KEYS.REVIEWS);
  const bugs        = getData(FB_KEYS.BUGS);
  const suggestions = getData(FB_KEYS.SUGGESTIONS);
  const tot = document.getElementById('stat-total');     if(tot)  tot.textContent=reviews.length;
  const bug = document.getElementById('stat-bugs');      if(bug)  bug.textContent=bugs.length;
  const sug = document.getElementById('stat-suggestions');if(sug) sug.textContent=suggestions.length;
  const avg = document.getElementById('stat-avg');
  if (avg) avg.textContent = reviews.length ? (reviews.reduce((s,r)=>s+r.rating,0)/reviews.length).toFixed(1) : '—';
}

function renderRatingBreakdown() {
  const reviews = getData(FB_KEYS.REVIEWS);
  const bigNum  = document.getElementById('big-rating-num');
  const bigStars= document.getElementById('big-stars');
  const bigCount= document.getElementById('big-rating-count');
  if (!bigNum) return;
  if (!reviews.length) {
    bigNum.textContent='—'; if(bigStars) bigStars.textContent='☆☆☆☆☆'; if(bigCount) bigCount.textContent='No ratings yet';
    [1,2,3,4,5].forEach(n=>{ const b=document.getElementById(`rb-${n}`); if(b) b.style.width='0%'; const c=document.getElementById(`rc-${n}`); if(c) c.textContent='0'; });
    return;
  }
  const avg=reviews.reduce((s,r)=>s+r.rating,0)/reviews.length;
  bigNum.textContent=avg.toFixed(1);
  if (bigStars) bigStars.textContent='★'.repeat(Math.round(avg))+'☆'.repeat(5-Math.round(avg));
  if (bigCount) bigCount.textContent=`Based on ${reviews.length} review${reviews.length===1?'':'s'}`;
  const counts={1:0,2:0,3:0,4:0,5:0};
  reviews.forEach(r=>counts[r.rating]=(counts[r.rating]||0)+1);
  [1,2,3,4,5].forEach(n=>{
    const b=document.getElementById(`rb-${n}`); if(b) b.style.width=(counts[n]/reviews.length*100)+'%';
    const c=document.getElementById(`rc-${n}`); if(c) c.textContent=counts[n];
  });
}

function renderReviewsList() {
  const reviews  = getData(FB_KEYS.REVIEWS);
  const list     = document.getElementById('reviews-list');
  const empty    = document.getElementById('reviews-empty');
  const loadBtn  = document.getElementById('load-more-btn');
  const likes    = getData(FB_KEYS.LIKES);
  const likedSet = new Set(Array.isArray(likes)?likes:Object.keys(likes||{}));
  if (!list) return;

  let filtered = [...reviews];
  if (currentFilter!=='all') filtered=filtered.filter(r=>r.chapter===currentFilter);
  if (currentSort==='highest') filtered.sort((a,b)=>b.rating-a.rating||b.createdAt-a.createdAt);
  else if (currentSort==='lowest') filtered.sort((a,b)=>a.rating-b.rating||b.createdAt-a.createdAt);
  else filtered.sort((a,b)=>b.createdAt-a.createdAt);

  if (!filtered.length) {
    list.innerHTML=''; if(empty) { empty.classList.remove('hidden'); if(!list.contains(empty)) list.appendChild(empty); }
    if(loadBtn) loadBtn.classList.add('hidden'); return;
  }
  if(empty) empty.classList.add('hidden');

  list.innerHTML=filtered.slice(0,visibleReviewCount).map(r=>{
    const isLiked=likedSet.has(r.id);
    return `
      <div class="review-card" data-id="${r.id}">
        <div class="review-card-header">
          <div class="review-avatar">${escapeHtmlFb(r.name.charAt(0).toUpperCase())}</div>
          <div class="review-meta">
            <div class="review-name">${escapeHtmlFb(r.name)}</div>
            <div class="review-info-row">
              <span class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span>
              ${r.chapter?`<span class="review-chapter-badge">${chapterLabel(r.chapter)}</span>`:''}
              ${r.verified?'<span class="review-chapter-badge">✓ Verified</span>':''}
              <span class="review-date">${formatDate(r.createdAt)}</span>
            </div>
          </div>
        </div>
        <p class="review-text">${escapeHtmlFb(r.text)}</p>
        ${r.recommend?`<span class="review-recommend ${r.recommend}">${r.recommend==='yes'?'👍 Recommends':'👎 Not recommended'}</span>`:''}
        <div class="review-card-actions">
          <button class="review-like-btn ${isLiked?'liked':''}" onclick="toggleLike('${r.id}')">
            🩸 <span>${r.likes||0}</span> Helpful
          </button>
        </div>
      </div>`;
  }).join('');

  if(loadBtn) filtered.length>visibleReviewCount ? loadBtn.classList.remove('hidden') : loadBtn.classList.add('hidden');
}

function toggleLike(reviewId) {
  const reviews=getData(FB_KEYS.REVIEWS), likes=getData(FB_KEYS.LIKES);
  const likedSet=new Set(Array.isArray(likes)?likes:Object.keys(likes||{}));
  const review=reviews.find(r=>r.id===reviewId); if(!review) return;
  if (likedSet.has(reviewId)) { likedSet.delete(reviewId); review.likes=Math.max(0,(review.likes||0)-1); }
  else { likedSet.add(reviewId); review.likes=(review.likes||0)+1; }
  setData(FB_KEYS.REVIEWS,reviews); setData(FB_KEYS.LIKES,Array.from(likedSet));
  renderReviewsList(); // only lists re-render, not star widgets
}

function sortReviews(val) { currentSort=val; visibleReviewCount=REVIEWS_PER_PAGE; renderReviewsList(); }
function filterReviews(val) { currentFilter=val; visibleReviewCount=REVIEWS_PER_PAGE; renderReviewsList(); }
function loadMoreReviews() { visibleReviewCount+=REVIEWS_PER_PAGE; renderReviewsList(); }

function renderBugList() {
  const bugs=getData(FB_KEYS.BUGS);
  const list=document.getElementById('bug-list'), empty=document.getElementById('bugs-empty');
  if (!list) return;
  if (!bugs.length) { list.innerHTML=''; if(empty){list.appendChild(empty);empty.classList.remove('hidden');} return; }
  if(empty) empty.classList.add('hidden');
  const sorted=[...bugs].sort((a,b)=>({crash:4,high:3,medium:2,low:1}[b.severity]-{crash:4,high:3,medium:2,low:1}[a.severity])||(b.createdAt-a.createdAt));
  list.innerHTML=sorted.slice(0,8).map(b=>`
    <div class="bug-card severity-${b.severity}">
      <div class="bug-card-title">${escapeHtmlFb(b.title)}</div>
      <div class="bug-card-meta">
        <span class="bug-severity ${b.severity}">${b.severity.toUpperCase()}</span>
        <span class="bug-area">${escapeHtmlFb(b.area)}</span>
        <span class="bug-date">${formatDate(b.createdAt)}</span>
      </div>
    </div>`).join('');
}

function renderSuggestionsList() {
  const suggestions=getData(FB_KEYS.SUGGESTIONS);
  const votes=getData(FB_KEYS.VOTES);
  const votedSet=new Set(Array.isArray(votes)?votes:Object.keys(votes||{}));
  const list=document.getElementById('suggestions-list'), empty=document.getElementById('suggestions-empty');
  if (!list) return;
  if (!suggestions.length) { list.innerHTML=''; if(empty){list.appendChild(empty);empty.classList.remove('hidden');} return; }
  if(empty) empty.classList.add('hidden');
  const sorted=[...suggestions].sort((a,b)=>(b.votes-a.votes)||(b.createdAt-a.createdAt));
  const pLabels={nice:'😊 Nice to have',want:'🔥 Really wanted',need:'⚡ Critical'};
  list.innerHTML=sorted.slice(0,8).map(s=>`
    <div class="suggestion-card" data-id="${s.id}">
      <div class="suggestion-vote">
        <button class="vote-btn ${votedSet.has(s.id)?'voted':''}" onclick="toggleVote('${s.id}')">▲</button>
        <span class="vote-count">${s.votes||0}</span>
      </div>
      <div class="suggestion-body">
        <div class="suggestion-title">${escapeHtmlFb(s.title)}</div>
        <p class="suggestion-desc">${escapeHtmlFb(s.desc)}</p>
        <div class="suggestion-footer">
          <span class="suggestion-cat">${escapeHtmlFb(s.category)}</span>
          ${s.priority?`<span class="suggestion-priority">${pLabels[s.priority]}</span>`:''}
        </div>
      </div>
    </div>`).join('');
}

function toggleVote(id) {
  const suggestions=getData(FB_KEYS.SUGGESTIONS), votes=getData(FB_KEYS.VOTES);
  const votedSet=new Set(Array.isArray(votes)?votes:Object.keys(votes||{}));
  const s=suggestions.find(x=>x.id===id); if(!s) return;
  if (votedSet.has(id)) { votedSet.delete(id); s.votes=Math.max(0,(s.votes||0)-1); }
  else { votedSet.add(id); s.votes=(s.votes||0)+1; }
  setData(FB_KEYS.SUGGESTIONS,suggestions); setData(FB_KEYS.VOTES,Array.from(votedSet));
  renderSuggestionsList();
}

function escapeHtmlFb(str) { const d=document.createElement('div'); d.textContent=str; return d.innerHTML; }

function showPageToast(msg, dur=3000) {
  let c=document.getElementById('global-toast-container');
  if (!c) { c=document.createElement('div'); c.id='global-toast-container'; Object.assign(c.style,{position:'fixed',bottom:'24px',right:'24px',zIndex:'9999',display:'flex',flexDirection:'column',gap:'8px'}); document.body.appendChild(c); }
  const t=document.createElement('div'); t.className='toast'; t.textContent=msg; c.appendChild(t);
  setTimeout(()=>{ t.classList.add('fade-out'); setTimeout(()=>t.remove(),300); }, dur);
}