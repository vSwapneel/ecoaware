/* EcoAware Scoring Engine — Deterministic, JSON-driven */
const EcoAwareEngine = (() => {
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const norm = s => (s||'').toLowerCase().replace(/['']/g,"'").replace(/[""]/g,'"').replace(/[‐‑–—]/g,'-').replace(/\s+/g,' ').trim();
  const hasAny = (t, ps) => (ps||[]).some(p => p && t.includes(p));
  const hasAll = (t, ps) => (ps||[]).every(p => !p || t.includes(p));
  const wordHit = (t, w) => new RegExp('\\b'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(t);
  const snip = (t,n,r) => { r=r||80; const i=t.indexOf(n); if(i<0)return''; return t.slice(Math.max(0,i-r),Math.min(t.length,i+n.length+r)).trim(); };

  function buildEvidence(product) {
    const t = norm(product.title);
    const bl = (product.bullets||[]).map(norm).filter(Boolean);
    const d = norm(product.description);
    const sp = norm(product.specsText||Object.values(product.details||{}).join(' '));
    const bg = norm((product.badges||[]).join(' ')+(product.badgesText||''));
    const ab = norm((product.aboutItems||[]).join(' '));
    const rv = norm((product.reviewSnippets||[]).join(' '));
    const wa = norm(product.warranty||'');
    const textAll = [t,bl.join(' '),sp,d,bg,ab,wa].filter(Boolean).join(' | ');
    return {
      textAll, reviewText: rv,
      sections: { title:!!t, bullets:bl.length>0, specs:!!sp, description:!!d, badges:!!bg },
      signals: {
        hasPercent: /(\d{1,3}\s?%|percent)/i.test(textAll),
        hasStandardWords: /\b(standard|certified|certification|verified|audit|audited|traceability|chain of custody|methodology|scope|boundary|lca|life cycle)\b/i.test(textAll),
        hasEnergyMetrics: /\b(kwh|watts?|wh\/yr|kwh\/year)\b/i.test(textAll)
      }
    };
  }

  function detectCategory(product, evidence, CM) {
    const tc = norm((product.title||'')+' '+(product.category||''));
    const hints = CM.category_detection_hints||{};
    let best = {cat:'general',hits:0};
    for (const [cat,words] of Object.entries(hints)) {
      let hits = 0;
      for (const w of words) { const wn=norm(w); if(!wn)continue; if(wn.length<=4&&/^[a-z0-9]+$/.test(wn)?wordHit(tc,wn):tc.includes(wn)) hits++; }
      if (hits > best.hits) best = {cat,hits};
    }
    const labels = {food_produce:'🍎 Food & Produce',electronics:'🔌 Electronics',appliances:'🏠 Home Appliance',apparel_textiles:'👕 Clothing & Textiles',leather_goods:'🧳 Leather Goods',furniture:'🪑 Furniture',home_goods:'🏡 Home Goods',cleaning:'🧹 Cleaning',bags:'🎒 Bags & Luggage',beauty_personal_care:'🧴 Beauty & Care',general:'📦 General'};
    return { category:best.cat, categoryLabel:labels[best.cat]||labels.general, profile:(CM.profiles&&CM.profiles[best.cat])||CM.profiles.general };
  }

  function matchCerts(evidence, CP) {
    const matched = [];
    for (const c of (CP.certifications||[])) {
      const found = [];
      for (const p of (c.patterns||[])) { const pn=norm(p); if(!pn)continue; if(pn.length<=4&&/^[a-z0-9]+$/.test(pn)?wordHit(evidence.textAll,pn):evidence.textAll.includes(pn)) found.push(pn); }
      if (found.length) matched.push({id:c.id,display_name:c.display_name,strength:c.strength,what_it_means:c.what_it_means,limitations:c.limitations,matched_patterns:found});
    }
    return { matchedCerts:matched, hasStrong:matched.some(c=>c.strength>=5), strengthSum:matched.reduce((a,c)=>a+c.strength,0) };
  }

  // Materials that are inherently biodegradable — claiming "biodegradable" for these is factual, not greenwashing
  const NATURALLY_BIODEGRADABLE = ['bamboo','wood','cotton','hemp','jute','cork','wool','silk','linen','sisal','coconut','paper','cardboard','natural rubber','beeswax','straw','seaweed','mushroom','mycelium','cellulose'];
  // Materials that are inherently compostable
  const NATURALLY_COMPOSTABLE = ['bamboo','wood','cotton','hemp','jute','cork','paper','cardboard','coconut','straw','seaweed','pla','cellulose'];
  // Materials that are inherently recyclable
  const NATURALLY_RECYCLABLE = ['aluminum','aluminium','glass','steel','stainless steel','copper','tin','paper','cardboard'];

  function evaluateRules(evidence, category, RULES) {
    const fired = [];
    const hasBiodegradableMaterial = NATURALLY_BIODEGRADABLE.some(m => evidence.textAll.includes(m));
    const hasCompostableMaterial = NATURALLY_COMPOSTABLE.some(m => evidence.textAll.includes(m));
    const hasRecyclableMaterial = NATURALLY_RECYCLABLE.some(m => evidence.textAll.includes(m));

    for (const r of (RULES||[])) {
      const cats = (r.applicability&&r.applicability.product_categories)||['any'];
      if (!cats.includes('any')&&!cats.includes(category)) continue;
      const anyOk = r.match.any.length ? hasAny(evidence.textAll,r.match.any) : true;
      const allOk = r.match.all.length ? hasAll(evidence.textAll,r.match.all) : true;
      const noneOk = r.match.none.length ? !hasAny(evidence.textAll,r.match.none) : true;
      if (!(anyOk&&allOk&&noneOk)) continue;
      if (r.requires_proof_any&&r.requires_proof_any.length&&!hasAny(evidence.textAll,r.requires_proof_any)) continue;
      if (r.proof_terms_any&&r.proof_terms_any.length&&hasAny(evidence.textAll,r.proof_terms_any)) continue;

      // Material-aware suppression: skip rules when the claim is backed by the material itself
      if (r.id === 'DEGRADABLE_OR_BIODEGRADABLE_UNQUALIFIED' && hasBiodegradableMaterial) continue;
      if (r.id === 'UNQUALIFIED_COMPOSTABLE' && hasCompostableMaterial) continue;
      if (r.id === 'UNQUALIFIED_RECYCLABLE_CLAIM' && hasRecyclableMaterial) continue;

      const needle = (r.match.any||[]).find(p=>evidence.textAll.includes(p))||'';
      fired.push({id:r.id,severity:r.severity,name:r.name,user_message:r.user_message,source_refs:r.source_refs,evidence_snippet:needle?snip(evidence.textAll,needle):''});
    }
    return fired;
  }

  function assessDurability(evidence) {
    const t = evidence.textAll; const findings = [];
    const wm = t.match(/(\d+)\s*year\s*warranty/i)||t.match(/lifetime\s*warranty/i);
    if (wm) findings.push('Warranty: '+wm[0]);
    const dm = {'stainless steel':'Stainless steel','solid wood':'Solid wood','cast iron':'Cast iron','full grain leather':'Full grain leather','cordura':'Cordura fabric','gore-tex':'Gore-Tex'};
    for (const [k,v] of Object.entries(dm)) { if(t.includes(k)) findings.push(v); }
    if (/\b(replaceable parts|replaceable battery|modular|repairable|spare parts)\b/i.test(t)) findings.push('Repairability signals');
    const rt = evidence.reviewText||'';
    const pos = ['durable','sturdy','well-built','well built','heavy duty','long-lasting','built to last'].filter(w=>rt.includes(w));
    const neg = ['broke','broken','fell apart','cheaply made','flimsy','poor quality'].filter(w=>rt.includes(w));
    if (pos.length) findings.push('Reviews: '+pos.slice(0,2).join(', '));
    if (neg.length) findings.push('Review concerns: '+neg.slice(0,2).join(', '));
    return findings.length ? {signals:findings,count:findings.length} : null;
  }

  function computeBuckets(evidence, certMatch, rulesFired, durability) {
    const b = {certifications:50,materials:50,packaging:50,durability:50,energy:50,transparency:50,ethics:50,ai_context:50};
    const s5=certMatch.matchedCerts.filter(c=>c.strength>=5).length;
    const s4=certMatch.matchedCerts.filter(c=>c.strength===4).length;
    const s3=certMatch.matchedCerts.filter(c=>c.strength===3).length;
    b.certifications += Math.min(35,s5*20)+Math.min(25,s4*12)+Math.min(12,s3*6);
    if (certMatch.matchedCerts.some(c=>c.id==='ENERGY_STAR')) b.energy+=25;
    if (evidence.signals.hasEnergyMetrics) b.energy+=10;
    if (evidence.signals.hasPercent) b.materials+=10;
    if (/\b(recycled|organic cotton|bamboo|hemp|post-consumer)\b/i.test(evidence.textAll)) b.materials+=10;
    if (/\b(check locally|where facilities exist|how2recycle)\b/i.test(evidence.textAll)) b.packaging+=10;
    if (durability) b.durability+=Math.min(20,durability.count*5);
    if (/\b(2 year|two year|3 year|5 year|lifetime)\b/i.test(evidence.textAll)) b.durability+=10;
    if (/\b(repairable|replaceable battery|spare parts)\b/i.test(evidence.textAll)) b.durability+=8;
    if (evidence.signals.hasStandardWords) b.transparency+=10;
    if (certMatch.matchedCerts.some(c=>c.id==='FAIRTRADE'||c.id==='RAINFOREST_ALLIANCE')) b.ethics+=10;
    if (certMatch.matchedCerts.some(c=>c.id==='B_CORP')) b.ethics+=6;
    for (const rf of rulesFired) { if(rf.severity>=4) b.transparency-=8; else if(rf.severity===3) b.transparency-=5; }
    if (rulesFired.some(r=>['UNQUALIFIED_RECYCLABLE_CLAIM','UNQUALIFIED_COMPOSTABLE','DEGRADABLE_OR_BIODEGRADABLE_UNQUALIFIED'].includes(r.id))) b.packaging-=10;

    // Review sustainability sentiment — buyers confirming eco claims in their own words
    const rt = evidence.reviewText || '';
    const ecoPositive = ['plastic-free','plastic free','no plastic','eco','sustainable','green choice','environmentally','renewable','compostable','biodegradable','recyclable','no waste','zero waste','less waste','reduce waste','natural material','organic','microplastic','earth friendly'];
    const ecoNegative = ['greenwashing','misleading','not eco','not sustainable','false claim','fake','plastic inside','wrapped in plastic','too much packaging','wasteful'];
    const posHits = ecoPositive.filter(w => rt.includes(w)).length;
    const negHits = ecoNegative.filter(w => rt.includes(w)).length;
    if (posHits >= 2) { b.materials += 6; b.transparency += 4; }
    else if (posHits === 1) { b.materials += 3; }
    if (negHits >= 2) { b.materials -= 6; b.transparency -= 6; }
    else if (negHits === 1) { b.transparency -= 3; }

    for (const k of Object.keys(b)) b[k]=clamp(b[k],0,100);
    return b;
  }

  function score(product, packs) {
    const evidence = buildEvidence(product);
    const {category,categoryLabel,profile} = detectCategory(product,evidence,packs.CATEGORY_MODEL);
    const certMatch = matchCerts(evidence,packs.CERT_PACK);
    const rulesFired = evaluateRules(evidence,category,packs.GREENWASHING_RULES);
    const durability = assessDurability(evidence);
    const buckets = computeBuckets(evidence,certMatch,rulesFired,durability);
    const w = profile.weights; let raw=0;
    for (const [k,v] of Object.entries(w)) raw+=(buckets[k]||50)*v;
    raw = clamp(raw,0,100);
    // Confidence
    let conf=0.25;
    if(evidence.sections.bullets) conf+=0.15; if(evidence.sections.specs) conf+=0.15;
    if(evidence.sections.badges) conf+=0.10; if(evidence.sections.description) conf+=0.10;
    if(evidence.signals.hasPercent||evidence.signals.hasEnergyMetrics) conf+=0.10;
    if(certMatch.matchedCerts.length>0) conf+=0.10;
    if(!certMatch.matchedCerts.length&&(profile.cert_dependency||0)>=0.4) conf-=(profile.missing_cert_behavior&&profile.missing_cert_behavior.confidence_penalty)||0;
    conf-=Math.min(0.25,0.05*rulesFired.filter(r=>r.severity>=3).length);
    conf=clamp(conf,0,1);
    // GW Risk
    let risk=10;
    for(const rf of rulesFired){if(rf.severity>=4)risk+=20;else if(rf.severity===3)risk+=12;else if(rf.severity===2)risk+=7;else risk+=3;}
    if(!certMatch.hasStrong&&profile.missing_cert_behavior) risk+=Math.round(100*(profile.missing_cert_behavior.risk_increase||0));
    risk=clamp(risk,0,100);
    // State
    // const isUnknown = (conf<0.55)||(!certMatch.hasStrong&&!rulesFired.some(r=>r.severity>=4));
    const isUnknown = (conf<0.40);
    let finalScore = isUnknown ? (0.6*raw+0.4*50) : raw;
    finalScore = Math.round(clamp(finalScore,0,100));
    let label,color;
    if(isUnknown){label='Unknown';color='unknown';}
    else if(finalScore>=75){label='Very Sustainable';color='very-high';}
    else if(finalScore>=55){label='Sustainable';color='high';}
    else if(finalScore>=40){label='Moderate';color='medium';}
    else if(finalScore>=25){label='Low Sustainability';color='low';}
    else{label='Not Sustainable';color='very-low';}
    let confLabel; if(conf>=0.7)confLabel='HIGH';else if(conf>=0.4)confLabel='MEDIUM';else if(conf>=0.2)confLabel='LOW';else confLabel='INSUFFICIENT';
    const sc=certMatch.matchedCerts.length+(durability?1:0)+(evidence.signals.hasPercent?1:0)+(evidence.signals.hasStandardWords?1:0);
    let confReason; if(confLabel==='HIGH')confReason=sc+' evidence signals. Assessment well-supported.'; else if(confLabel==='MEDIUM')confReason=sc+' signals found, some data missing.'; else if(confLabel==='LOW')confReason='Only '+sc+' signal(s). Assessment limited.'; else confReason='No meaningful signals. Baseline estimate.';
    // Reasons
    const reasons = [];
    for(const c of certMatch.matchedCerts.slice(0,2)) reasons.push({type:'positive',text:c.display_name+' detected',detail:c.what_it_means});
    const sortB=Object.entries(buckets).sort((a,b)=>b[1]-a[1]);
    if(sortB[0]&&sortB[0][1]>55) reasons.push({type:'positive',text:'Strongest: '+sortB[0][0]+' ('+sortB[0][1]+'/100)'});
    if(durability&&durability.count>0) reasons.push({type:'positive',text:'Durability: '+durability.signals[0]});
    for(const rf of rulesFired.sort((a,b)=>b.severity-a.severity).slice(0,2)) reasons.push({type:'warning',text:rf.user_message,source:rf.source_refs});
    // Missing
    const missing = [];
    if(!certMatch.matchedCerts.length){const tips={electronics:'Look for ENERGY STAR or EPEAT.',appliances:'Look for ENERGY STAR badge.',apparel_textiles:'Look for GOTS/OEKO-TEX or material %.',leather_goods:'Look for traceability/audit language.',beauty_personal_care:'Look for ingredients list and safer-chemistry certs.',food_produce:'Missing certifications are common for produce.',general:'Look for a named certification or standard.'};missing.push(tips[category]||tips.general);}
    if(!evidence.signals.hasStandardWords) missing.push('Look for specific details: %, standards, audits.');
    // Carbon
    const hasCO2=/\b(kg co2|g co2|tco2e|co2e)\b/i.test(evidence.textAll);
    const hasMethod=/\b(iso 14067|ghg protocol|lca|life cycle|boundary|scope)\b/i.test(evidence.textAll);
    let carbonNote; if(!hasCO2)carbonNote=packs.CARBON_POLICY.phrasing_templates.no_data; else if(!hasMethod)carbonNote=packs.CARBON_POLICY.phrasing_templates.qualitative_only; else carbonNote=packs.CARBON_POLICY.phrasing_templates.numeric_with_source;

    return {
      category,categoryLabel,score:finalScore,state:isUnknown?'Unknown':'Known',label,color,
      confidence:Math.round(conf*100)/100,confidenceLabel:confLabel,confidenceReason:confReason,
      buckets,matchedCerts:certMatch.matchedCerts,
      greenwashing:{risk,rulesFired},durability,
      reasons:reasons.slice(0,6),missingSignals:missing.slice(0,4),carbonNote,
      _weights: w, _isUnknown: isUnknown
    };
  }

  // Apply AI context score (0-100) after narrator returns it
  function applyAiScore(assessment, aiScore) {
    if (typeof aiScore !== 'number' || aiScore < 0 || aiScore > 100) return assessment;
    const a = Object.assign({}, assessment);
    a.buckets = Object.assign({}, a.buckets, { ai_context: aiScore });
    const w = a._weights;
    let raw = 0;
    for (const [k,v] of Object.entries(w)) raw += (a.buckets[k]||50)*v;
    raw = clamp(raw, 0, 100);

    // AI confident opinion (far from neutral 50) can lift product out of Unknown
    const aiHasOpinion = aiScore >= 60 || aiScore <= 40;
    const stillUnknown = a._isUnknown && !aiHasOpinion;

    const finalScore = stillUnknown ? (0.6*raw + 0.4*50) : raw;
    a.score = Math.round(clamp(finalScore, 0, 100));
    a.state = stillUnknown ? 'Unknown' : 'Known';

    // Update label/color using score, not locked to Unknown
    if(stillUnknown){a.label='Unknown';a.color='unknown';}
    else if(a.score>=75){a.label='Very Sustainable';a.color='very-high';}
    else if(a.score>=55){a.label='Sustainable';a.color='high';}
    else if(a.score>=40){a.label='Moderate';a.color='medium';}
    else if(a.score>=25){a.label='Low Sustainability';a.color='low';}
    else{a.label='Not Sustainable';a.color='very-low';}
    a.aiContextScore = aiScore;
    return a;
  }

  return { score, applyAiScore };
})();
