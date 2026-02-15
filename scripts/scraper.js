const EcoScraper = {

  detect() {
    const url = window.location.href;
    if (url.includes('amazon.com') || url.includes('amazon.co.uk')) return 'amazon';
    return null;
  },

  scrape() {
    const site = this.detect();
    if (!site) return null;

    const scrapers = {
      amazon: () => this.scrapeAmazon(),
    };

    try {
      const data = scrapers[site]();
      data.site = site;
      data.url = window.location.href;
      data.scrapedAt = Date.now();
      return data;
    } catch (e) {
      console.error('[EcoLens] Scrape error:', e);
      return null;
    }
  },

  scrapeAmazon() {
    const getText = (selectors) => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el.textContent.trim();
      }
      return '';
    };

    const title = getText([
      '#productTitle',
      '#title span',
      'h1.product-title-word-break',
    ]);

    // Price
    const priceText = getText([
      '.a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.a-price-whole',
      '#corePrice_feature_div .a-offscreen',
      '#tp_price_block_total_price_ww .a-offscreen',
    ]);
    const price = this.parsePrice(priceText);

    // Original / list price
    const listPriceText = getText([
      '.a-text-price .a-offscreen',
      '#listPrice',
      '.basisPrice .a-offscreen',
    ]);
    const listPrice = this.parsePrice(listPriceText);

    // Rating
    const ratingText = getText([
      '#acrPopover span.a-icon-alt',
      'i.a-icon-star span.a-icon-alt',
    ]);
    const rating = parseFloat(ratingText) || 0;

    // Reviews count
    const reviewsText = getText([
      '#acrCustomerReviewText',
      '#reviewsMedley .a-size-base',
    ]);
    const reviewsCount = parseInt(reviewsText.replace(/[^0-9]/g, '')) || 0;

    // Description / bullets
    const bullets = [];
    document.querySelectorAll('#feature-bullets li span.a-list-item').forEach(el => {
      const t = el.textContent.trim();
      if (t && t.length > 5) bullets.push(t);
    });

    const description = getText([
      '#productDescription p',
      '#productDescription',
      '#productDescription_feature_div',
    ]);

    // About this item section
    const aboutItems = [];
    document.querySelectorAll('#feature-bullets ul li').forEach(el => {
      aboutItems.push(el.textContent.trim());
    });

    // Technical details / product info
    const details = {};
    document.querySelectorAll('#productDetails_techSpec_section_1 tr, #prodDetails tr, .product-facts-detail').forEach(row => {
      const key = row.querySelector('th, td:first-child');
      const val = row.querySelector('td:last-child, td:nth-child(2)');
      if (key && val) {
        details[key.textContent.trim().toLowerCase()] = val.textContent.trim();
      }
    });

    // Badges — scoped to product detail area ONLY (not suggested products)
    const badges = [];
    const productScope = document.querySelector('#ppd, #dp, #dp-container, #centerCol') || document;
    productScope.querySelectorAll('.a-badge-text, .ac-badge-text-primary').forEach(el => {
      const t = el.textContent.trim();
      if (t && !badges.includes(t)) badges.push(t);
    });
    // Climate Pledge Friendly — look in product section only, never full body
    const cpfSelectors = [
      '#climatePledgeFriendlyBadge',
      '[data-csa-c-content-id="climate-pledge-friendly"]',
      '#climatePledgeFriendly',
      '.climate-pledge-friendly'
    ];
    const hasCPF = cpfSelectors.some(sel => productScope.querySelector(sel));
    // Fallback: check text ONLY in the product detail area, not full page
    const productDetailText = (productScope.textContent || '').slice(0, 8000);
    if (hasCPF || (productDetailText.includes('Climate Pledge Friendly') && !badges.includes('Climate Pledge Friendly'))) {
      badges.push('Climate Pledge Friendly');
    }

    // Brand
    const brand = getText([
      '#bylineInfo',
      '.po-brand .a-span9 span',
      'a#brand',
    ]);

    // Category
    const category = getText([
      '#wayfinding-breadcrumbs_feature_div ul li:last-child a',
      '.a-breadcrumb li:last-child a',
    ]);

    // Image
    const imageEl = document.querySelector('#landingImage, #imgBlkFront');
    const image = imageEl ? (imageEl.src || imageEl.getAttribute('data-old-hires') || '') : '';

    // Review highlights / snippets (top reviews visible on page)
    const reviewSnippets = [];
    document.querySelectorAll('[data-hook="review-body"] span, .review-text-content span').forEach(el => {
      const t = el.textContent.trim();
      if (t && t.length > 20 && t.length < 300 && reviewSnippets.length < 5) {
        reviewSnippets.push(t);
      }
    });

    // Warranty info from details table
    const warranty = details['warranty'] || details['warranty description'] ||
      details['manufacturer warranty'] || details['warranty type'] || '';

    return {
      title,
      price,
      listPrice,
      rating,
      reviewsCount,
      bullets,
      description,
      aboutItems,
      details,
      badges,
      brand,
      category,
      image,
      reviewSnippets,
      warranty,
    };
  },

  parsePrice(text) {
    if (!text) return null;
    const match = text.match(/[\d,.]+/);
    if (!match) return null;
    return parseFloat(match[0].replace(/,/g, ''));
  },
};
