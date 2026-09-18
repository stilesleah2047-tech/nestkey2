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

// Public (no target) or user-targeted event.
function emit(event, data, targetUserId) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data || {})}\n\n`;
  clients.forEach((c) => {
    if (targetUserId && c.userId !== String(targetUserId)) return;
    try { c.res.write(payload); } catch (e) { /* dropped */ }
  });
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
