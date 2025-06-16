document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-include]').forEach(async el => {
    const file = el.getAttribute('data-include');
    if (file) {
      const res = await fetch(file);
      if (res.ok) {
        el.innerHTML = await res.text();
      }
    }
  });
  loadDealsSection();
});

async function loadDealsSection() {
  const dealsSection = document.getElementById('deals-section');
  if (!dealsSection) return;
  try {
    const res = await fetch('/api/deals');
    if (!res.ok) return;
    const deals = await res.json();
    const now = new Date();
    const activeDeals = deals.filter(d => d.active_flag && (!d.start_datetime || new Date(d.start_datetime) <= now) && (!d.end_datetime || new Date(d.end_datetime) >= now));
    if (activeDeals.length === 0) {
      dealsSection.innerHTML = '';
      return;
    }
    dealsSection.innerHTML = `<div class='deals-banner'>${activeDeals.map(d => `
      <div class='deal-card' data-deal-id='${d.id}'>
        ${d.image ? `<img src='/site/images/${d.image}' alt='${d.title}' class='deal-img'>` : ''}
        <div class='deal-info'>
          <strong>${d.title}</strong>
          <span>${d.description || ''}</span>
          ${d.end_datetime ? `<span class='deal-expiry'>Ends: ${new Date(d.end_datetime).toLocaleString()}</span>` : ''}
          <button class='deal-claim-btn' data-deal-id='${d.id}'>Claim Deal</button>
        </div>
      </div>`).join('')}</div>`;
  } catch (e) {
    // fail silently
  }
}