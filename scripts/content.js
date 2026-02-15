(function () {
  'use strict';
  if (document.getElementById('ecoaware-panel')) return;

  // Helpers
  function scoreLevel(s) { return s >= 65 ? 'high' : s >= 40 ? 'medium' : 'low'; }
  function reasonIcon(t) { return { positive: '✓', negative: '✗', warning: '!', neutral: '·' }[t] || '·'; }
  function gwEmoji(l) { return l === 'HIGH' ? '🚨' : l === 'MODERATE' ? '⚠️' : l === 'LOW' ? '✅' : '➖'; }

  function renderReasons(reasons, id) {
    if (!reasons || reasons.length === 0) return '';
    var html = reasons.map(function(r) { return '<div class="ecoaware-reason ' + r.type + '"><span class="ecoaware-reason-icon">' + reasonIcon(r.type) + '</span><span>' + r.text + '</span></div>'; }).join('');
    return '<div class="ecoaware-reasons collapsed" id="ecoaware-reasons-' + id + '">' + html + '</div>' +
      '<button class="ecoaware-reasons-toggle" onclick="var el=document.getElementById(\'ecoaware-reasons-' + id + '\');var c=el.classList.contains(\'collapsed\');el.classList.toggle(\'collapsed\',!c);el.classList.toggle(\'expanded\',c);this.textContent=c?\'▾ Hide details\':\'▸ Why this score?\';">▸ Why this score?</button>';
  }

  function isProductPage() {
    var url = window.location.href;
    if (url.includes('amazon.com') || url.includes('amazon.co.uk')) {
      return url.includes('/dp/') || url.includes('/gp/product/') || !!document.querySelector('#productTitle');
    }
    return false;
  }

  function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function headerHTML() {
    return '<div class="ecoaware-header"><div class="ecoaware-logo"><div class="ecoaware-logo-icon">🌿</div><span>EcoAware</span></div><button class="ecoaware-close" id="ecoaware-close-btn" title="Close panel">✕</button></div>';
  }

  function noProductHTML() {
    return headerHTML() +
      '<div class="ecoaware-no-product">' +
        '<div class="ecoaware-no-product-icon">🔍</div>' +
        '<div class="ecoaware-no-product-title">No product detected</div>' +
        '<div class="ecoaware-no-product-text">Navigate to a product page to see sustainability analysis.</div>' +
      '</div>';
  }

  function loadingHTML() {
    return headerHTML() +
      '<div class="ecoaware-loading"><div class="ecoaware-spinner"></div>' +
      '<div class="ecoaware-loading-text">Analyzing product...</div>' +
      '<div class="ecoaware-loading-sub">Scoring sustainability, detecting greenwashing...</div></div>';
  }

  function buildPanelHTML(product, a, n) {
    var sLevel = scoreLevel(a.score);
    var gwRisk = a.greenwashing.risk;
    var gwLevel = gwRisk >= 60 ? 'HIGH' : gwRisk >= 35 ? 'MODERATE' : gwRisk >= 15 ? 'LOW' : 'NONE';

    var html = headerHTML() + '<div class="ecoaware-body">';

    // Product title + category tag
    html += '<div class="ecoaware-product-title">' + esc((product.title || 'Product').slice(0, 100)) + '</div>';
    html += '<div class="ecoaware-type-tag">' + esc(a.categoryLabel) + '</div>';

    // Greenwashing alert — show when rules fired
    if (a.greenwashing.rulesFired.length > 0 && gwRisk >= 25) {
      var alertClass = gwRisk >= 60 ? 'HIGH' : 'MEDIUM';
      var alertLabel = gwRisk >= 60 ? 'Greenwashing Risk: HIGH' : 'Claims Could Be Better Qualified';
      html += '<div class="ecoaware-greenwash-alert ' + alertClass + '">' +
        '<div class="ecoaware-gw-alert-header"><span>' + gwEmoji(gwLevel) + ' ' + alertLabel + '</span></div>';
      if (n.greenwashing_summary) {
        html += '<div class="ecoaware-gw-alert-summary">' + esc(n.greenwashing_summary) + '</div>';
      }
      if (n.greenwashing_flags && n.greenwashing_flags.length > 0) {
        html += '<div class="ecoaware-ai-flags">' + n.greenwashing_flags.slice(0,3).map(function(f) { return '<div class="ecoaware-reason negative"><span class="ecoaware-reason-icon">✗</span><span>' + esc(f) + '</span></div>'; }).join('') + '</div>';
      }
      if (n.credible_claims && n.credible_claims.length > 0) {
        html += '<div class="ecoaware-ai-flags">' + n.credible_claims.slice(0,2).map(function(f) { return '<div class="ecoaware-reason positive"><span class="ecoaware-reason-icon">✓</span><span>' + esc(f) + '</span></div>'; }).join('') + '</div>';
      }
      // Expandable rule details
      var gwReasons = a.greenwashing.rulesFired.map(function(rf) {
        return { type: 'warning', text: rf.name + (rf.source_refs ? ' (' + rf.source_refs.join(', ') + ')' : '') };
      });
      html += renderReasons(gwReasons, 'gw');
      html += '</div>';
    }

    // Sustainability score card
    html += '<div class="ecoaware-score-card">' +
      '<div class="ecoaware-score-header">' +
        '<span class="ecoaware-score-label">🌱 Sustainability</span>' +
        '<span class="ecoaware-score-value ' + sLevel + '">' + a.score + '<span style="font-size:13px;color:var(--eco-text-dim)">/100</span></span>' +
      '</div>' +
      '<div class="ecoaware-progress"><div class="ecoaware-progress-fill ' + sLevel + '" style="width:' + a.score + '%"></div></div>' +
      '<div class="ecoaware-sustain-label-row">' +
        '<span class="ecoaware-sustain-label ' + a.color + '">' + a.label + '</span>' +
        '<span class="ecoaware-confidence-badge ' + a.confidenceLabel + '">' + a.confidenceLabel + '</span>' +
      '</div>';

    // Evidence summary
    if (n.sustainability_summary) {
      html += '<div class="ecoaware-evidence-summary">📋 ' + esc(n.sustainability_summary) + '</div>';
    }
    // Confidence explanation
    if (n.confidence_explanation) {
      html += '<div class="ecoaware-confidence-explain">🔎 ' + esc(n.confidence_explanation) + '</div>';
    }
    // Durability insight
    if (n.durability_insight) {
      html += '<div class="ecoaware-durability-insight">🔧 ' + esc(n.durability_insight) + '</div>';
    }

    html += renderReasons(a.reasons, 'sustain') + '</div>';

    // Buying Intelligence Row (3 cards)
    // Intel summary — compact inline badges
    var confClass = a.confidenceLabel === 'HIGH' ? 'high' : a.confidenceLabel === 'MEDIUM' ? 'medium' : 'low';
    var gwClass = gwRisk >= 60 ? 'low' : gwRisk >= 35 ? 'medium' : 'high';
    html += '<div class="ecoaware-intel-bar">' +
      '<div class="ecoaware-intel-chip ' + confClass + '"><span class="ecoaware-intel-chip-label">Confidence:</span> <span class="ecoaware-intel-chip-value">' + a.confidenceLabel + '</span></div>' +
      '<div class="ecoaware-intel-chip ' + gwClass + '"><span class="ecoaware-intel-chip-label">Greenwashing Risk:</span> <span class="ecoaware-intel-chip-value">' + gwLevel + '</span></div>' +
    '</div>';

    html += '<div class="ecoaware-divider"></div>';

    // Review Insight (AI-summarized review sentiment with voice)
    if (n.review_insight) {
      html += '<div class="ecoaware-review-section">' +
        '<div class="ecoaware-review-header">' +
          '<span class="ecoaware-review-label">💬 What Buyers Say</span>';
      if (typeof EcoVoice !== 'undefined' && EcoVoice.isEnabled()) {
        html += '<button class="ecoaware-voice-btn ecoaware-voice-review" data-text="' + esc(n.review_insight) + '" title="Listen to review summary">🔊</button>';
      }
      html += '</div>' +
        '<div class="ecoaware-review-text">' + esc(n.review_insight) + '</div>';
      if (product.rating) {
        html += '<div class="ecoaware-review-meta">⭐ ' + product.rating + '/5 from ' + (product.reviewsCount ? product.reviewsCount.toLocaleString() : '?') + ' reviews</div>';
      }
      html += '</div>';
    }

    html += '<div class="ecoaware-divider"></div>';

    // AI Verdict with voice button
    html += '<div class="ecoaware-verdict">' +
      '<div class="ecoaware-verdict-header">' +
        '<span class="ecoaware-verdict-label">✨ AI Verdict</span>';
    if (typeof EcoVoice !== 'undefined' && EcoVoice.isEnabled()) {
      html += '<button class="ecoaware-voice-btn" id="ecoaware-voice-btn" data-text="' + esc(n.verdict) + '" title="Listen to verdict">🔊</button>';
    }
    html += '</div>' +
      '<div class="ecoaware-verdict-text">' + esc(n.verdict || 'No AI verdict available. Add your Anthropic API key for AI narration.') + '</div>' +
      '<div class="ecoaware-verdict-source">' +
        (a.state === 'Unknown'
          ? 'Limited data — treat as estimate'
          : 'Based on ' + a.matchedCerts.length + ' cert(s) and ' + a.greenwashing.rulesFired.length + ' risk signal(s)') +
      '</div>' +
    '</div>';

    // Carbon note
    html += '<div class="ecoaware-carbon-note">' + esc(a.carbonNote) + '</div>';

    // Ask AI Agent CTA
    html += '<a href="https://patriotai.gmu.edu/chat/278423a9-6191-42b0-8519-11c6cd52ed9a" target="_blank" rel="noopener noreferrer" class="ecoaware-ask-ai">' +
      '<span class="ecoaware-ask-ai-icon">🤖</span>' +
      '<span class="ecoaware-ask-ai-text"><strong>Curious about greener options?</strong><br>Ask our AI for sustainable alternatives</span>' +
      '<span class="ecoaware-ask-ai-arrow">→</span>' +
    '</a>';

    html += '</div>'; // close body

    html += '<div class="ecoaware-footer">EcoAware v1 · Know what you\'re really buying</div>';

    return html;
  }

  // ---------------------------------------------------------------------------
  // Create panel + floating tab
  // ---------------------------------------------------------------------------
  var panel = document.createElement('div');
  panel.id = 'ecoaware-panel';
  panel.className = 'ecoaware-animate-in';
  document.body.appendChild(panel);

  var tab = document.createElement('div');
  tab.id = 'ecoaware-tab';
  tab.innerHTML = '<div class="ecoaware-tab-content" id="ecoaware-tab-open"><span class="ecoaware-tab-icon">🌿</span></div><button class="ecoaware-tab-close" id="ecoaware-tab-close" title="Dismiss EcoAware">✕</button>';
  document.body.appendChild(tab);

  // --- Vertical drag for floating tab ---
  var isDragging = false, dragStartY = 0, tabStartTop = 0;

  tab.addEventListener('mousedown', function (e) {
    if (e.target.closest('#ecoaware-tab-close')) return; // don't drag on close btn
    isDragging = true;
    dragStartY = e.clientY;
    tabStartTop = tab.getBoundingClientRect().top;
    tab.classList.add('dragging');
    e.preventDefault();
  });

  document.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    var newTop = tabStartTop + (e.clientY - dragStartY);
    newTop = Math.max(10, Math.min(window.innerHeight - 50, newTop));
    tab.style.top = newTop + 'px';
  });

  document.addEventListener('mouseup', function () {
    if (isDragging) {
      isDragging = false;
      tab.classList.remove('dragging');
    }
  });

  // Track dismissed state — once dismissed, only extension icon click can bring it back
  var dismissed = false;

  // Events (capture phase)
  document.addEventListener('click', function (e) {
    // Close panel → show floating tab
    if (e.target.closest('#ecoaware-close-btn')) {
      e.preventDefault(); e.stopPropagation();
      panel.classList.remove('ecoaware-animate-in');
      panel.classList.add('ecoaware-hidden');
      if (!dismissed) tab.classList.add('visible');
      return;
    }
    // Click floating tab → reopen panel
    if (e.target.closest('#ecoaware-tab-open')) {
      e.preventDefault(); e.stopPropagation();
      if (isDragging) return; // ignore click during drag
      panel.classList.remove('ecoaware-hidden');
      tab.classList.remove('visible');
      return;
    }
    // Dismiss floating tab → fully hidden, only extension icon can restore
    if (e.target.closest('#ecoaware-tab-close')) {
      e.preventDefault(); e.stopPropagation();
      tab.classList.remove('visible');
      dismissed = true;
      return;
    }
    // Voice buttons (verdict + review)
    if (e.target.closest('.ecoaware-voice-btn')) {
      var btn = e.target.closest('.ecoaware-voice-btn');
      EcoVoice.speak(btn.getAttribute('data-text'), btn);
      return;
    }
  }, true);

  // Listen for message from extension icon click (background/popup) to restore panel
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (msg) {
      if (msg && msg.action === 'toggle-ecoaware') {
        dismissed = false;
        panel.classList.remove('ecoaware-hidden');
        tab.classList.remove('visible');
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Main
  // ---------------------------------------------------------------------------
  async function init() {
    if (!isProductPage()) {
      panel.innerHTML = noProductHTML();
      return;
    }

    panel.innerHTML = loadingHTML();

    // Wait for knowledge JSONs
    if (typeof ECOAWARE_READY !== 'undefined') await ECOAWARE_READY;
    await new Promise(function (r) { setTimeout(r, 800); });

    try {
      var product = EcoScraper.scrape();
      if (!product || !product.title) { panel.innerHTML = noProductHTML(); return; }

      var assessment = EcoAwareEngine.score(product, {
        GREENWASHING_RULES: ECOAWARE_GW_RULES,
        CERT_PACK: ECOAWARE_CERTS,
        CATEGORY_MODEL: ECOAWARE_CATEGORIES,
        CARBON_POLICY: ECOAWARE_CARBON
      });

      var narration = await EcoNarrator.narrate(assessment, product);

      // Apply AI context score if returned
      if (narration.ai_context_score != null && !isNaN(narration.ai_context_score)) {
        assessment = EcoAwareEngine.applyAiScore(assessment, parseInt(narration.ai_context_score));
        console.log('[EcoAware] AI context score:', narration.ai_context_score, '→ adjusted score:', assessment.score);
      }

      panel.innerHTML = buildPanelHTML(product, assessment, narration);
      console.log('[EcoAware] Done:', assessment.score, assessment.label, '|', assessment.categoryLabel, '| GW risk:', assessment.greenwashing.risk);

    } catch (err) {
      console.error('[EcoAware] Error:', err);
      var lt = panel.querySelector('.ecoaware-loading-text');
      if (lt) lt.textContent = 'Analysis failed: ' + err.message;
    }
  }

  init();
})();
