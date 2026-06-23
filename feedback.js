/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — feedback.js
   Ratings, reviews, bug reports, feature suggestions
   All data persisted in localStorage (acts as a shared community pool)
═══════════════════════════════════════════════════════════════ */

const FB_KEYS = {
  REVIEWS: 'bb_fb_reviews',
  BUGS: 'bb_fb_bugs',
  SUGGESTIONS: 'bb_fb_suggestions',
  LIKES: 'bb_fb_likes',       // reviewId -> true (per-browser like tracking)
  VOTES: 'bb_fb_votes'        // suggestionId -> true
};

const REVIEWS_PER_PAGE = 5;
let visibleReviewCount = REVIEWS_PER_PAGE;
let currentSort = 'newest';
let currentFilter = 'all';

let selectedOverallRating = 0;
let categoryRatings = { gameplay: 0, story: 0, visuals: 0, difficulty: 0 };
let selectedRecommend = null;
let selectedPriority = null;

document.addEventListener('DOMContentLoaded', () => {
  initUserBadge();
  initStarRating();
  initCategoryRatings();
  initCharCounters();
  renderAllData();
});

/* ── USER BADGE ── */
function initUserBadge() {
  const usernameEl = document.getElementById('fb-username');
  const statusEl = document.getElementById('fb-status');
  const avatarEl = document.getElementById('fb-avatar');
  const nameInput = document.getElementById('review-name');

  if (window.BB && window.BB.isLoggedIn()) {
    const username = window.BB.getCurrentUser();
    usernameEl.textContent = username;
    statusEl.innerHTML = '✓ Signed in';
    avatarEl.textContent = username.charAt(0).toUpperCase();
    avatarEl.style.display = 'flex';
    avatarEl.style.alignItems = 'center';
    avatarEl.style.justifyContent = 'center';
    avatarEl.style.fontFamily = 'var(--font-heading)';
    avatarEl.style.fontWeight = '700';
    avatarEl.style.fontSize = '.7rem';
    avatarEl.style.color = '#fff';

    if (nameInput && !nameInput.value) nameInput.value = username;
  }
}

/* ── STAR RATING (overall) ── */
function initStarRating() {
  const stars = document.querySelectorAll('#star-rating .star');
  const label = document.getElementById('star-label');
  const labels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'];

  stars.forEach(star => {
    const val = parseInt(star.dataset.val, 10);

    star.addEventListener('mouseenter', () => {
      stars.forEach(s => {
        s.classList.toggle('hovered', parseInt(s.dataset.val, 10) <= val);
      });
      label.textContent = labels[val];
    });

    star.addEventListener('mouseleave', () => {
      stars.forEach(s => s.classList.remove('hovered'));
      label.textContent = selectedOverallRating
        ? labels[selectedOverallRating]
        : 'Click to rate';
    });

    star.addEventListener('click', () => {
      selectedOverallRating = val;
      stars.forEach(s => {
        s.classList.toggle('selected', parseInt(s.dataset.val, 10) <= val);
      });
      label.textContent = labels[val];
    });
  });
}

/* ── CATEGORY RATINGS ── */
function initCategoryRatings() {
  document.querySelectorAll('.cat-stars').forEach(group => {
    const cat = group.dataset.cat;
    const stars = group.querySelectorAll('.cat-star');

    stars.forEach(star => {
      const val = parseInt(star.dataset.val, 10);

      star.addEventListener('mouseenter', () => {
        stars.forEach(s => s.classList.toggle('hovered', parseInt(s.dataset.val, 10) <= val));
      });
      star.addEventListener('mouseleave', () => {
        stars.forEach(s => s.classList.remove('hovered'));
      });
      star.addEventListener('click', () => {
        categoryRatings[cat] = val;
        stars.forEach(s => s.classList.toggle('selected', parseInt(s.dataset.val, 10) <= val));
      });
    });
  });
}

/* ── CHAR COUNTERS ── */
function initCharCounters() {
  const reviewText = document.getElementById('review-text');
  const reviewCount = document.getElementById('review-count');
  if (reviewText) {
    reviewText.addEventListener('input', () => {
      reviewCount.textContent = `${reviewText.value.length} / 500`;
    });
  }

  const suggestDesc = document.getElementById('suggest-desc');
  const suggestCount = document.getElementById('suggest-count');
  if (suggestDesc) {
    suggestDesc.addEventListener('input', () => {
      suggestCount.textContent = `${suggestDesc.value.length} / 400`;
    });
  }
}

/* ── RECOMMEND / PRIORITY BUTTONS ── */
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

/* ──────────────────────────────────────────────
   DATA HELPERS
────────────────────────────────────────────── */
function getData(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function setData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('Failed to save feedback data', e);
    return false;
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function chapterLabel(val) {
  const map = {
    ch1: 'Chapter I',
    ch2: 'Chapter II',
    ch3: 'Chapter III',
    ch4: 'Chapter IV',
    ch5: 'Completed ✓'
  };
  return map[val] || val;
}

/* ──────────────────────────────────────────────
   SUBMIT: REVIEW
────────────────────────────────────────────── */
function submitReview(event) {
  event.preventDefault();

  const errorEl = document.getElementById('review-error');
  errorEl.classList.add('hidden');

  const name = document.getElementById('review-name').value.trim();
  const chapter = document.getElementById('review-chapter').value;
  const text = document.getElementById('review-text').value.trim();

  if (!selectedOverallRating) {
    showFormError(errorEl, 'Please select an overall star rating.');
    return;
  }
  if (!name) {
    showFormError(errorEl, 'Please enter a display name.');
    return;
  }
  if (!text) {
    showFormError(errorEl, 'Please write a short review.');
    return;
  }

  const review = {
    id: generateId(),
    name,
    rating: selectedOverallRating,
    categories: { ...categoryRatings },
    chapter: chapter || null,
    text,
    recommend: selectedRecommend,
    likes: 0,
    createdAt: Date.now(),
    verified: !!(window.BB && window.BB.isLoggedIn())
  };

  const reviews = getData(FB_KEYS.REVIEWS);
  reviews.unshift(review);
  setData(FB_KEYS.REVIEWS, reviews);

  // Reset form
  document.getElementById('review-form').reset();
  selectedOverallRating = 0;
  categoryRatings = { gameplay: 0, story: 0, visuals: 0, difficulty: 0 };
  selectedRecommend = null;
  document.querySelectorAll('#star-rating .star').forEach(s => s.classList.remove('selected', 'hovered'));
  document.getElementById('star-label').textContent = 'Click to rate';
  document.querySelectorAll('.cat-star').forEach(s => s.classList.remove('selected', 'hovered'));
  document.querySelectorAll('.recommend-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('review-count').textContent = '0 / 500';

  if (window.BB && window.BB.isLoggedIn() && name) {
    document.getElementById('review-name').value = window.BB.getCurrentUser();
  }

  showPageToast('✓ Thank you! Your review has been posted.');
  visibleReviewCount = REVIEWS_PER_PAGE;
  renderAllData();

  // Scroll to reviews
  document.getElementById('community-reviews').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showFormError(el, msg) {
  el.textContent = '⚠ ' + msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

/* ──────────────────────────────────────────────
   SUBMIT: BUG REPORT
────────────────────────────────────────────── */
function submitBug(event) {
  event.preventDefault();

  const errorEl = document.getElementById('bug-error');
  errorEl.classList.add('hidden');

  const title = document.getElementById('bug-title').value.trim();
  const area = document.getElementById('bug-chapter').value;
  const severity = document.getElementById('bug-severity').value;
  const steps = document.getElementById('bug-steps').value.trim();
  const expected = document.getElementById('bug-expected').value.trim();
  const browser = document.getElementById('bug-browser').value.trim();

  if (!title || !area || !severity || !steps) {
    showFormError(errorEl, 'Please fill in all required fields.');
    return;
  }

  const bug = {
    id: generateId(),
    title,
    area,
    severity,
    steps,
    expected,
    browser: browser || navigator.userAgent.split(' ').slice(-2).join(' '),
    reporter: (window.BB && window.BB.isLoggedIn()) ? window.BB.getCurrentUser() : 'Anonymous',
    createdAt: Date.now()
  };

  const bugs = getData(FB_KEYS.BUGS);
  bugs.unshift(bug);
  setData(FB_KEYS.BUGS, bugs);

  document.getElementById('bug-form').reset();
  showPageToast('✓ Bug report submitted. Thanks for helping us fix Bloodbound!');
  renderAllData();
}

/* ──────────────────────────────────────────────
   SUBMIT: SUGGESTION
────────────────────────────────────────────── */
function submitSuggestion(event) {
  event.preventDefault();

  const errorEl = document.getElementById('suggest-error');
  errorEl.classList.add('hidden');

  const title = document.getElementById('suggest-title').value.trim();
  const category = document.getElementById('suggest-category').value;
  const desc = document.getElementById('suggest-desc').value.trim();

  if (!title || !category || !desc) {
    showFormError(errorEl, 'Please fill in all required fields.');
    return;
  }

  const suggestion = {
    id: generateId(),
    title,
    category,
    desc,
    priority: selectedPriority,
    votes: 0,
    author: (window.BB && window.BB.isLoggedIn()) ? window.BB.getCurrentUser() : 'Anonymous',
    createdAt: Date.now()
  };

  const suggestions = getData(FB_KEYS.SUGGESTIONS);
  suggestions.unshift(suggestion);
  setData(FB_KEYS.SUGGESTIONS, suggestions);

  document.getElementById('suggestion-form').reset();
  document.getElementById('suggest-count').textContent = '0 / 400';
  selectedPriority = null;
  document.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('selected'));

  showPageToast('✓ Suggestion submitted! Vote on others below.');
  renderAllData();
}

/* ──────────────────────────────────────────────
   RENDER: STATS BAR
────────────────────────────────────────────── */
function renderStatsBar(reviews, bugs, suggestions) {
  document.getElementById('stat-total').textContent = reviews.length;
  document.getElementById('stat-bugs').textContent = bugs.length;
  document.getElementById('stat-suggestions').textContent = suggestions.length;

  if (reviews.length === 0) {
    document.getElementById('stat-avg').textContent = '—';
  } else {
    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    document.getElementById('stat-avg').textContent = avg.toFixed(1);
  }
}

/* ──────────────────────────────────────────────
   RENDER: RATING BREAKDOWN
────────────────────────────────────────────── */
function renderRatingBreakdown(reviews) {
  const bigNum = document.getElementById('big-rating-num');
  const bigStars = document.getElementById('big-stars');
  const bigCount = document.getElementById('big-rating-count');

  if (reviews.length === 0) {
    bigNum.textContent = '—';
    bigStars.textContent = '☆☆☆☆☆';
    bigCount.textContent = 'No ratings yet';
    [1,2,3,4,5].forEach(n => {
      document.getElementById(`rb-${n}`).style.width = '0%';
      document.getElementById(`rc-${n}`).textContent = '0';
    });
    return;
  }

  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  bigNum.textContent = avg.toFixed(1);

  const fullStars = Math.round(avg);
  bigStars.textContent = '★'.repeat(fullStars) + '☆'.repeat(5 - fullStars);
  bigCount.textContent = `Based on ${reviews.length} review${reviews.length === 1 ? '' : 's'}`;

  const counts = { 1:0, 2:0, 3:0, 4:0, 5:0 };
  reviews.forEach(r => counts[r.rating] = (counts[r.rating] || 0) + 1);

  [1,2,3,4,5].forEach(n => {
    const pct = (counts[n] / reviews.length) * 100;
    document.getElementById(`rb-${n}`).style.width = pct + '%';
    document.getElementById(`rc-${n}`).textContent = counts[n];
  });
}

/* ──────────────────────────────────────────────
   RENDER: REVIEWS LIST
────────────────────────────────────────────── */
function renderReviewsList(reviews) {
  const list = document.getElementById('reviews-list');
  const empty = document.getElementById('reviews-empty');
  const loadMoreBtn = document.getElementById('load-more-btn');
  const likes = getData(FB_KEYS.LIKES);
  const likedSet = Array.isArray(likes) ? new Set(likes) : new Set(Object.keys(likes || {}));

  let filtered = [...reviews];

  // Filter by chapter
  if (currentFilter !== 'all') {
    filtered = filtered.filter(r => r.chapter === currentFilter);
  }

  // Sort
  if (currentSort === 'newest') {
    filtered.sort((a, b) => b.createdAt - a.createdAt);
  } else if (currentSort === 'highest') {
    filtered.sort((a, b) => b.rating - a.rating || b.createdAt - a.createdAt);
  } else if (currentSort === 'lowest') {
    filtered.sort((a, b) => a.rating - b.rating || b.createdAt - a.createdAt);
  }

  if (filtered.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    if (!list.contains(empty)) list.appendChild(empty);
    loadMoreBtn.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');

  const visible = filtered.slice(0, visibleReviewCount);

  list.innerHTML = visible.map(r => {
    const initial = r.name.charAt(0).toUpperCase();
    const isLiked = likedSet.has(r.id);
    const chapterBadge = r.chapter ? `<span class="review-chapter-badge">${chapterLabel(r.chapter)}</span>` : '';
    const recommendHtml = r.recommend
      ? `<span class="review-recommend ${r.recommend}">${r.recommend === 'yes' ? '👍 Recommends' : '👎 Not recommended'}</span>`
      : '';
    const verifiedBadge = r.verified ? '<span class="review-chapter-badge" title="Signed-in player">✓ Verified</span>' : '';

    return `
      <div class="review-card" data-id="${r.id}">
        <div class="review-card-header">
          <div class="review-avatar">${escapeHtmlFb(initial)}</div>
          <div class="review-meta">
            <div class="review-name">${escapeHtmlFb(r.name)}</div>
            <div class="review-info-row">
              <span class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
              ${chapterBadge}
              ${verifiedBadge}
              <span class="review-date">${formatDate(r.createdAt)}</span>
            </div>
          </div>
        </div>
        <p class="review-text">${escapeHtmlFb(r.text)}</p>
        ${recommendHtml}
        <div class="review-card-actions">
          <button class="review-like-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${r.id}')">
            🩸 <span>${r.likes || 0}</span> Helpful
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (filtered.length > visibleReviewCount) {
    loadMoreBtn.classList.remove('hidden');
  } else {
    loadMoreBtn.classList.add('hidden');
  }
}

function toggleLike(reviewId) {
  const reviews = getData(FB_KEYS.REVIEWS);
  const likes = getData(FB_KEYS.LIKES);
  const likedSet = new Set(Array.isArray(likes) ? likes : Object.keys(likes || {}));

  const review = reviews.find(r => r.id === reviewId);
  if (!review) return;

  if (likedSet.has(reviewId)) {
    likedSet.delete(reviewId);
    review.likes = Math.max(0, (review.likes || 0) - 1);
  } else {
    likedSet.add(reviewId);
    review.likes = (review.likes || 0) + 1;
  }

  setData(FB_KEYS.REVIEWS, reviews);
  setData(FB_KEYS.LIKES, Array.from(likedSet));
  renderAllData();
}

function sortReviews(val) {
  currentSort = val;
  visibleReviewCount = REVIEWS_PER_PAGE;
  renderAllData();
}

function filterReviews(val) {
  currentFilter = val;
  visibleReviewCount = REVIEWS_PER_PAGE;
  renderAllData();
}

function loadMoreReviews() {
  visibleReviewCount += REVIEWS_PER_PAGE;
  renderAllData();
}

/* ──────────────────────────────────────────────
   RENDER: BUG LIST
────────────────────────────────────────────── */
function renderBugList(bugs) {
  const list = document.getElementById('bug-list');
  const empty = document.getElementById('bugs-empty');

  if (bugs.length === 0) {
    list.innerHTML = '';
    list.appendChild(empty);
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  const sorted = [...bugs].sort((a, b) => {
    const severityOrder = { crash: 4, high: 3, medium: 2, low: 1 };
    return (severityOrder[b.severity] - severityOrder[a.severity]) || (b.createdAt - a.createdAt);
  });

  const visible = sorted.slice(0, 8);

  list.innerHTML = visible.map(b => `
    <div class="bug-card severity-${b.severity}">
      <div class="bug-card-title">${escapeHtmlFb(b.title)}</div>
      <div class="bug-card-meta">
        <span class="bug-severity ${b.severity}">${b.severity.toUpperCase()}</span>
        <span class="bug-area">${escapeHtmlFb(b.area)}</span>
        <span class="bug-date">${formatDate(b.createdAt)}</span>
      </div>
    </div>
  `).join('');
}

/* ──────────────────────────────────────────────
   RENDER: SUGGESTIONS LIST
────────────────────────────────────────────── */
function renderSuggestionsList(suggestions) {
  const list = document.getElementById('suggestions-list');
  const empty = document.getElementById('suggestions-empty');
  const votes = getData(FB_KEYS.VOTES);
  const votedSet = new Set(Array.isArray(votes) ? votes : Object.keys(votes || {}));

  if (suggestions.length === 0) {
    list.innerHTML = '';
    list.appendChild(empty);
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  const sorted = [...suggestions].sort((a, b) => (b.votes - a.votes) || (b.createdAt - a.createdAt));
  const visible = sorted.slice(0, 8);

  const priorityLabels = {
    nice: '😊 Nice to have',
    want: '🔥 Really wanted',
    need: '⚡ Critical'
  };

  list.innerHTML = visible.map(s => {
    const isVoted = votedSet.has(s.id);
    const priorityHtml = s.priority ? `<span class="suggestion-priority">${priorityLabels[s.priority]}</span>` : '';

    return `
      <div class="suggestion-card" data-id="${s.id}">
        <div class="suggestion-vote">
          <button class="vote-btn ${isVoted ? 'voted' : ''}" onclick="toggleVote('${s.id}')">▲</button>
          <span class="vote-count">${s.votes || 0}</span>
        </div>
        <div class="suggestion-body">
          <div class="suggestion-title">${escapeHtmlFb(s.title)}</div>
          <p class="suggestion-desc">${escapeHtmlFb(s.desc)}</p>
          <div class="suggestion-footer">
            <span class="suggestion-cat">${escapeHtmlFb(s.category)}</span>
            ${priorityHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function toggleVote(suggestionId) {
  const suggestions = getData(FB_KEYS.SUGGESTIONS);
  const votes = getData(FB_KEYS.VOTES);
  const votedSet = new Set(Array.isArray(votes) ? votes : Object.keys(votes || {}));

  const suggestion = suggestions.find(s => s.id === suggestionId);
  if (!suggestion) return;

  if (votedSet.has(suggestionId)) {
    votedSet.delete(suggestionId);
    suggestion.votes = Math.max(0, (suggestion.votes || 0) - 1);
  } else {
    votedSet.add(suggestionId);
    suggestion.votes = (suggestion.votes || 0) + 1;
  }

  setData(FB_KEYS.SUGGESTIONS, suggestions);
  setData(FB_KEYS.VOTES, Array.from(votedSet));
  renderAllData();
}

/* ──────────────────────────────────────────────
   RENDER ALL
────────────────────────────────────────────── */
function renderAllData() {
  const reviews = getData(FB_KEYS.REVIEWS);
  const bugs = getData(FB_KEYS.BUGS);
  const suggestions = getData(FB_KEYS.SUGGESTIONS);

  renderStatsBar(reviews, bugs, suggestions);
  renderRatingBreakdown(reviews);
  renderReviewsList(reviews);
  renderBugList(bugs);
  renderSuggestionsList(suggestions);
}

/* ── ESCAPE HELPER ── */
function escapeHtmlFb(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}