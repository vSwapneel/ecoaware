# EcoAware 🌿

**Know what you're really buying.** A Chrome extension that provides real-time sustainability analysis, greenwashing detection, and AI-powered insights while you shop on Amazon.

## The Problem

Online shoppers encounter vague environmental claims every day — "eco-friendly," "green," "natural" — with no way to verify them. EcoAware makes sustainability visible at the moment of purchase. No research, no guesswork — just honest, grounded analysis.

## How It Works

When you visit an Amazon product page, EcoAware automatically:

1. **Scrapes** the product listing — title, bullets, specs, badges, description, and buyer reviews
2. **Scores** sustainability across 8 weighted factors using a deterministic engine grounded in FTC Green Guides
3. **Detects greenwashing** by matching claims against rules derived from federal environmental marketing standards
4. **Narrates** findings using Claude AI for contextual, spoken-ready verdicts
5. **Speaks** the verdict aloud using ElevenLabs text-to-speech

No backend. No accounts. No tracking.

## Scoring Architecture

### 8 Scoring Buckets

Every product is evaluated across 8 dimensions, each scored 0–100 and combined using category-specific weights:

- **Certifications** — Verified eco-labels such as FSC, ENERGY STAR, USDA Organic, Fair Trade, B Corp, and OEKO-TEX
- **Materials** — Recycled content, natural fibers, sustainable sourcing, and material percentages
- **Packaging** — Recyclable or compostable packaging claims and How2Recycle labeling
- **Durability** — Warranty length, repairability, durable materials, and review sentiment on build quality
- **Energy** — Energy efficiency ratings, kWh metrics, and ENERGY STAR certification
- **Transparency** — Specific standards cited, audit language, traceability, and chain of custody
- **Ethics** — Fair Trade, Rainforest Alliance, B Corp, and labor practice signals
- **AI Context** — Claude's contextual judgment on whether claims, materials, and reviews align coherently

### 11 Product Categories

Weights shift by category because sustainability means different things for different products. Durability matters most for furniture but is irrelevant for cleaning products. Energy dominates for appliances but doesn't apply to apparel. The engine automatically detects the product category and applies the appropriate weight profile.

Supported categories: Food & Produce, Electronics, Appliances, Apparel & Textiles, Leather Goods, Furniture, Home Goods, Cleaning, Bags & Luggage, Beauty & Personal Care, and a General fallback.

### Greenwashing Detection

The engine evaluates claims against rules derived from FTC Green Guides (16 CFR Part 260). It flags unqualified claims like "eco-friendly" without specifics, "biodegradable" on plastic products, or "carbon neutral" without methodology. Each rule has a severity level that affects both the greenwashing risk score and the transparency bucket.

The engine is also material-aware — a bamboo toothbrush claiming "biodegradable" is recognized as factual and not flagged, while the same claim on a plastic product would be.

### AI Contextual Scoring

The deterministic engine handles pattern matching. Claude handles judgment — checking whether reviews contradict the listing, whether claims are coherent with actual materials, whether the brand is transparent or evasive, and whether there are hidden trade-offs the listing glosses over. The AI score is weighted at 10% — enough to nudge a borderline product across a threshold, never enough to override the fundamentals.

### Review Sentiment Analysis

Buyer reviews are scanned for sustainability-relevant sentiment. If multiple reviewers mention things like "plastic-free," "eco," or "no waste," it boosts the materials and transparency scores. If reviewers flag "greenwashing," "misleading," or "wrapped in plastic," those scores take a hit.

### Optional: Enable AI Features

- **AI commentry** — Paste your Anthropic API key in `scripts/ai-narrator.js` (line 11)
- **Voice** — Paste your ElevenLabs API key in `scripts/voice.js` (line 10)

The extension works fully without API keys using deterministic scoring and template-based verdicts. Adding keys enables richer AI narration and voice output.

## Deep Dive: Sustainability AI Advisor

For deeper questions about certifications, materials, or greener alternatives, users can chat with our companion AI advisor built on Patriot AI:

[Chat with EcoAware Sustainability Advisor](https://patriotai.gmu.edu/chat/278423a9-6191-42b0-8519-11c6cd52ed9a)

## File Structure

```
ecoaware/
├── manifest.json
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── knowledge/
│   ├── certifications.json
│   ├── greenwashing_rules.json
│   ├── category_model.json
│   └── carbon_claims_policy.json
├── scripts/
│   ├── scraper.js
│   ├── scoring-engine.js
│   ├── ai-narrator.js
│   ├── voice.js
│   ├── knowledge-loader.js
│   ├── content.js
│   └── background.js
└── styles/
    └── panel.css
```

## Tech Stack

- Vanilla JavaScript — no frameworks, no build step
- Chrome Extension Manifest V3
- Anthropic Claude API (optional — AI narration and contextual scoring)
- ElevenLabs API (optional — text-to-speech)
- Patriot AI (companion deep-dive agent)

## Knowledge Sources

The scoring engine is grounded in structured JSON knowledge files derived from research into federal standards and certification bodies:

- **Greenwashing Rules** — Based on FTC Green Guides (16 CFR Part 260), covering unqualified claims, vague language, and misleading certifications
- **Certifications** — 15+ eco-labels with pattern matching, strength ratings, and explanations of what each certification does and does not guarantee
- **Category Model** — Product-specific weight profiles ensuring scores reflect what matters for each product type
- **Carbon Claims Policy** — Framework for evaluating carbon neutrality and offset claims, requiring methodology disclosure

---

Built for the GMU Sustainability Hackathon 2025.