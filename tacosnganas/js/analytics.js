// Analytics tracking script for TACOnganas website
(function() {
  function getSessionId() {
    let sid = localStorage.getItem('tg_session_id');
    if (!sid) {
      sid = Math.random().toString(36).substr(2, 12) + Date.now();
      localStorage.setItem('tg_session_id', sid);
    }
    return sid;
  }
  function sendEvent(event_type, metadata) {
    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type,
        page: window.location.pathname,
        session_id: getSessionId(),
        metadata: metadata || {}
      })
    });
  }
  // Log page view
  sendEvent('page_view');
  // Track deal clicks
  document.addEventListener('click', function(e) {
    const t = e.target.closest('[data-deal-id]');
    if (t) {
      sendEvent('deal_click', { deal_id: t.getAttribute('data-deal-id') });
    }
  });
  window.tgAnalytics = { sendEvent };
})();
