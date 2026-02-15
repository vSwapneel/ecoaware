var ECOAWARE_GW_RULES, ECOAWARE_CERTS, ECOAWARE_CATEGORIES, ECOAWARE_CARBON;
var ECOAWARE_READY;

(function () {
  function loadJSON(url) {
    return fetch(chrome.runtime.getURL(url)).then(function (r) { return r.json(); });
  }

  ECOAWARE_READY = Promise.all([
    loadJSON('knowledge/greenwashing_rules.json'),
    loadJSON('knowledge/certifications.json'),
    loadJSON('knowledge/category_model.json'),
    loadJSON('knowledge/carbon_claims_policy.json')
  ]).then(function (data) {
    ECOAWARE_GW_RULES = data[0];
    ECOAWARE_CERTS = data[1];
    ECOAWARE_CATEGORIES = data[2];
    ECOAWARE_CARBON = data[3];
    console.log('[EcoAware] Knowledge loaded:', ECOAWARE_GW_RULES.length, 'GW rules,', ECOAWARE_CERTS.certifications.length, 'certs');
    return true;
  }).catch(function (err) {
    console.error('[EcoAware] Failed to load knowledge:', err);
    return false;
  });
})();
