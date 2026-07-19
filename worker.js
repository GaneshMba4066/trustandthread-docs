// worker.js – Cloudflare Worker for Trust & Thread
// Uses the API_URL env var (Fly.io FastAPI endpoint) to fetch the public RSA key
// and validates JWTs for protected content. If the IdP is unreachable,
// it serves public pages unchanged and injects a styled error banner.

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// In‑memory cache for the public key (valid for 5 minutes)
let cachedKey = null;
let cacheExpires = 0;

async function getPublicKey() {
  const now = Date.now();
  if (cachedKey && now < cacheExpires) return cachedKey;
  const apiUrl = API_URL; // injected via wrangler vars
  const resp = await fetch(`${apiUrl}/certs`);
  if (!resp.ok) throw new Error('Failed to fetch public key');
  const data = await resp.text();
  cachedKey = data;
  cacheExpires = now + 5 * 60 * 1000; // 5 min cache
  return cachedKey;
}

async function verifyJwt(token) {
  // Use the native Web Crypto API for RS256 verification
  const keyPem = await getPublicKey();
  const key = await crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(keyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = urlBase64ToUint8Array(parts[2]);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
  if (!valid) throw new Error('Invalid signature');
  // payload can be inspected if needed – omitted for brevity
  return true;
}

function pemToArrayBuffer(pem) {
  // Strip header/footer and decode base64
  const b64 = pem.replace(/-----BEGIN PUBLIC KEY-----/, '')
                .replace(/-----END PUBLIC KEY-----/, '')
                .replace(/\s+/g, '');
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; ++i) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function handleRequest(request) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  // Public pages are always allowed – we just proxy them.
  const upstream = request;

  if (!token) {
    // No JWT – serve public content directly
    return fetch(upstream);
  }

  try {
    await verifyJwt(token);
    // JWT valid – proxy to the static site (same URL, just forward)
    return fetch(upstream);
  } catch (e) {
    // If the failure was due to the IdP being unreachable, we still serve the public page.
    // Any other JWT error results in a 401.
    if (e.message.includes('Failed to fetch public key')) {
      const resp = await fetch(upstream);
      const html = await resp.text();
      const banner = `<div style="background:#0D1117;color:#00FFFF;padding:0.5rem;position:fixed;top:0;left:0;width:100%;z-index:9999;">
        ERR: IdP unreachable. Public documentation remains accessible.
      </div>`;
      return new Response(banner + html, {
        status: resp.status,
        headers: resp.headers,
      });
    }
    // Invalid JWT – deny access to protected content
    return new Response('Unauthorized: invalid token', { status: 401 });
  }
}
