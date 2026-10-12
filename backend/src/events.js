// Minimal Server-Sent Events hub for real-time updates.
const clients = [];

function addClient(res, userId, isAdmin) {
  const client = { res, userId: userId ? String(userId) : null, isAdmin: !!isAdmin };
  clients.push(client);
  return () => {
    const i = clients.indexOf(client);
    if (i > -1) clients.splice(i, 1);
  };
}

// Posts a newly published listing to Ezekiel's n8n social-video workflow.
// Fires once per publish (see emit() below). Safe no-op if the webhook URL
// is not configured, and never blocks or breaks the publish flow.
function advertiseListing(data) {
  const url = process.env.N8N_PROPERTY_WEBHOOK_URL;
  if (!url) return; // webhook not configured -> skip quietly

  const id = data && data.id;
  if (!id) return;

  // Map internal deal codes to friendly words for the social post.
  const dealMap = { rent: 'For Rent', sale: 'For Sale', land: 'Land' };
  const deal = dealMap[String(data.deal || '').toLowerCase()] || (data.deal || '');

  const payload = {
    id: String(id),
    title: data.title || '',
    price: data.price != null ? data.price : '',
    deal,
    beds: data.beds != null ? data.beds : '',
    region: data.region || '',
    location: data.location || '',
    county: data.county || '',
    description: data.description || '',
    photo: data.photo || '',
    url: `https://nestkey.co.ke/property.html?id=${encodeURIComponent(String(id))}`,
  };

  // Fire-and-forget; log but never throw into the publish path.
  Promise.resolve()
    .then(() => fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }))
    .catch((e) => { console.error('[advertiseListing] webhook failed:', e && e.message); });
}

// Public (no target) or user-targeted event.
function emit(event, data, targetUserId) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data || {})}\n\n`;
  clients.forEach((c) => {
    if (targetUserId && c.userId !== String(targetUserId)) return;
    try { c.res.write(payload); } catch (e) { /* dropped */ }
  });

  // Single choke point: auto-post every newly published listing to n8n.
  if (event === 'listing.published') advertiseListing(data);
}

// Admin-only broadcast (the platform activity feed).
function emitAdmin(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data || {})}\n\n`;
  clients.forEach((c) => {
    if (!c.isAdmin) return;
    try { c.res.write(payload); } catch (e) { /* dropped */ }
  });
}

module.exports = { addClient, emit, emitAdmin };
