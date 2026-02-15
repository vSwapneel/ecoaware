const EcoNarrator = {
  API_KEY: 'API KEY Claude',

  async narrate(assessment, productContext) {
    if (!this.API_KEY || this.API_KEY === 'YOUR_ANTHROPIC_API_KEY_HERE') {
      return this._fallback(assessment);
    }
    try {
      // Build a concise product context string for AI (title + key bullets + reviews)
      const ctx = productContext ? [
        'Product: ' + (productContext.title || '').slice(0, 120),
        'Bullets: ' + (productContext.bullets || []).slice(0, 4).join(' | ').slice(0, 300),
        'Badges: ' + (productContext.badges || []).join(', '),
        'Category field: ' + (productContext.category || ''),
        'Rating: ' + (productContext.rating || 'N/A') + ' (' + (productContext.reviewsCount || 0) + ' reviews)',
        'Review snippets:\n' + (productContext.reviewSnippets || []).slice(0, 5).map((r,i) => (i+1) + '. ' + r.slice(0, 200)).join('\n')
      ].join('\n') : '';

      const prompt = `You are EcoAware, a grounded sustainability narrator. You REPHRASE deterministic signals into display-ready text.

HARD RULES:
- Only reference data in ASSESSMENT and PRODUCT CONTEXT below
- Never invent certifications, materials, or CO2 numbers not in the data
- Never override the deterministic score or state
- If data is missing, say so honestly
- Keep each field SHORT — renders in a small UI panel
- Category: "${assessment.category}" (${assessment.categoryLabel})

TONE GUIDANCE (match tone to risk level):
- GW risk >= 60 (HIGH): Be direct and firm. Use words like "misleading", "unsubstantiated", "raises serious concerns". The buyer needs a clear warning.
- GW risk 25-59 (MODERATE/LOW): Use a softer, constructive tone. Say "could be better qualified", "would benefit from more detail", "consider asking for", "worth noting". Frame it as room for improvement, not deception.
- GW risk < 25 (CLEAN): Be positive and encouraging. Highlight what's good. If minor things could improve, phrase as suggestions, not warnings.

CONTEXTUAL JUDGMENT (IMPORTANT):
You have access to PRODUCT CONTEXT (title, materials, bullets) which the deterministic engine does NOT fully understand. Use your judgment:
- If a greenwashing flag seems WRONG given the actual product material, say so. Example: bamboo toothbrush claiming "biodegradable" is FACTUAL, not greenwashing. Wood, cotton, paper products making decomposition claims are generally honest.
- If a claim is technically accurate for the material but could be MORE specific, suggest improvement rather than flagging as greenwashing.
- Distinguish between "misleading claim" vs "could be better qualified" — the tone matters.
- Credible claims should mention WHY they're credible (e.g. "FSC certification verified by third party").

VERIFICATION FRAMEWORK (cite when relevant):
FTC GREEN GUIDES: Broad "eco-friendly" claims are nearly impossible to substantiate. Qualifications must be specific. "Free-of" claims need substantiation. Certifications must clearly convey their basis.
7 SINS OF GREENWASHING: Hidden Trade-off, No Proof, Vagueness, Irrelevance, Lesser of Two Evils, Fibbing, False Labels.

PRODUCT CONTEXT:
${ctx}

ASSESSMENT:
${JSON.stringify(assessment, null, 0)}

Return ONLY JSON with these fields:
{
  "verdict": "2-3 sentences. Address buyer as 'you'. Lead with key finding. End with action. Use contextual judgment — be fair, not harsh.",
  "sustainability_summary": "1 sentence. Describe what was FOUND, not what's missing. Be specific to the actual materials/product. For a bamboo toothbrush: 'Made with bamboo and boar bristles — naturally renewable materials.' NOT 'Strong materials foundation but missing certification backing.' If no cert exists, don't frame it as a gap unless the category genuinely needs one (electronics without ENERGY STAR = real gap; toothbrush without FSC = normal).",
  "confidence_explanation": "1 sentence. WHY confidence is ${assessment.confidenceLabel}. Name specific signals.",
  "durability_insight": "1 sentence if durability data exists. Otherwise empty string.",
  "greenwashing_summary": "1 sentence if GENUINE greenwashing concerns exist after contextual judgment. Empty string if flags were false positives for the material.",
  "greenwashing_flags": ["Only include flags that are GENUINELY misleading after considering the actual product material. Skip flags that are factually accurate for the material."],
  "credible_claims": ["Verified claim with brief reason why it's credible"],
  "review_insight": "2-3 sentences summarizing what real buyers say. Cover: overall sentiment, durability/quality mentions, any sustainability-related feedback. Written for spoken narration — conversational, natural, like a friend summarizing reviews for you. If no review snippets available, empty string.",
  "ai_context_score": "Integer 0-100. YOUR contextual sustainability judgment based on what pattern-matching can't catch. Score based on: (1) Do claims and materials make sense together? (2) Do reviews contradict listings? (3) Is the brand transparent or evasive? (4) Are there hidden trade-offs the listing glosses over? Default to 50 if unsure. Go above 50 if claims are genuinely backed. Go below 50 if something smells off."
}
No markdown wrapping. Raw JSON only.`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'x-api-key':this.API_KEY, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
        body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:750, messages:[{role:'user',content:prompt}] })
      });
      if (!res.ok) throw new Error('API '+res.status);
      const data = await res.json();
      const text = (data.content||[]).map(c=>c.text||'').join('').trim();
      const clean = text.replace(/```json|```/g,'').trim();
      const parsed = JSON.parse(clean);
      // Safety: check for hallucinated CO2
      const allText = Object.values(parsed).flat().join(' ');
      if (/\d+\s*kg\s*co2/i.test(allText) || /\d+\s*tons?\s*co2/i.test(allText)) {
        console.warn('[EcoAware] AI hallucinated CO2 — using fallback');
        return this._fallback(assessment);
      }
      return parsed;
    } catch (err) {
      console.error('[EcoAware AI]', err);
      return this._fallback(assessment);
    }
  },

  _fallback(a) {
    let verdict = '';
    if (a.state === 'Unknown') verdict = 'Limited data available for this product. ';
    verdict += 'Sustainability score: ' + a.score + '/100 (' + a.label + '). ';
    if (a.score >= 65) verdict += 'Good signals detected. ';
    else if (a.score >= 40) verdict += 'Average — greener alternatives may exist. ';
    else verdict += 'Few sustainability signals. Consider alternatives. ';
    if (a.greenwashing.risk >= 60) verdict += 'Greenwashing risk is elevated — some claims appear misleading. ';
    else if (a.greenwashing.risk >= 25) verdict += 'Some claims could be better qualified. ';

    // Build summary focusing on what was FOUND, not what's missing
    const pos = a.reasons.filter(r => r.type === 'positive').map(r => r.text);
    const warn = a.reasons.filter(r => r.type === 'warning').map(r => r.text);
    const certs = a.matchedCerts.map(c => c.display_name);
    let summary = '';
    if (certs.length && pos.length) {
      summary = certs.join(', ') + ' verified. ' + pos.filter(p => !certs.some(c => p.includes(c))).slice(0, 1).join(', ') + '.';
    } else if (pos.length) {
      summary = pos.slice(0, 2).join('. ') + '.';
    } else if (certs.length) {
      summary = certs.join(', ') + ' certified.';
    } else {
      summary = 'No strong sustainability signals detected on this listing.';
    }
    // Only mention warnings if GW risk is genuinely high
    if (warn.length && a.greenwashing.risk >= 50) {
      summary += ' Note: ' + warn[0] + '.';
    }

    // Build review insight from durability assessment (which scans reviews)
    let reviewInsight = '';
    if (a.durability && a.durability.signals.length) {
      const revSignals = a.durability.signals.filter(s => s.startsWith('Reviews:') || s.startsWith('Review concerns:'));
      if (revSignals.length) reviewInsight = revSignals.join('. ') + '.';
    }

    return {
      verdict: verdict.trim(),
      sustainability_summary: summary.trim(),
      confidence_explanation: a.confidenceReason || '',
      durability_insight: a.durability ? a.durability.signals.filter(s => !s.startsWith('Review')).slice(0, 2).join(', ') : '',
      greenwashing_summary: a.greenwashing.rulesFired.length && a.greenwashing.risk >= 40 ? a.greenwashing.rulesFired[0].user_message : '',
      greenwashing_flags: a.greenwashing.risk >= 40 ? a.greenwashing.rulesFired.map(r => r.user_message).slice(0, 2) : [],
      credible_claims: a.matchedCerts.map(c => c.display_name + ' verified').slice(0, 2),
      review_insight: reviewInsight,
      ai_context_score: 50
    };
  }
};
