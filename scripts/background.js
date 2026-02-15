chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'toggle-ecoaware' });
  } catch (e) {
    console.log('[EcoAware] Not available on this page');
  }
});
