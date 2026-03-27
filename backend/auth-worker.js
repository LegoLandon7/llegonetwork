const SESSION_TTL = 7 * 24 * 60 * 60;

// ── Rate limiting (KV-backed, persistent across instances) ──────────────────
async function isLimited(ip, kv) {
    const now = Date.now();
    const key = `rl:${ip}`;
    const e = await kv.get(key, { type: "json" }) ?? { c: 0, t: now };
    if (now - e.t > 60000) { e.c = 1; e.t = now; } else e.c++;
    await kv.put(key, JSON.stringify(e), { expirationTtl: 120 });
    return e.c > 30;
}

// ── AES-GCM encrypt/decrypt for storing tokens at rest ─────────────────────
async function getAesKey(secret) {
    const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encrypt(text, secret) {
    const key = await getAesKey(secret);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
    const combined = new Uint8Array(12 + enc.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(enc), 12);
    return btoa(String.fromCharCode(...combined)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function decrypt(b64, secret) {
    const key = await getAesKey(secret);
    const bytes = Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    const iv = bytes.slice(0, 12);
    const data = bytes.slice(12);
    const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return new TextDecoder().decode(dec);
}

// ── HMAC / JWT ──────────────────────────────────────────────────────────────
async function hmac(data, ctx, secret) {
    const key = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(`${secret}:${ctx}`),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function safeEq(a, b) {
    if (a.length !== b.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
}

function b64url(obj) {
    return btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function signJWT(payload, secret) {
    const h = b64url({ alg: "HS256", typ: "JWT" });
    const b = b64url(payload);
    return `${h}.${b}.${await hmac(`${h}.${b}`, "jwt", secret)}`;
}

async function verifyJWT(token, secret) {
    try {
        if (typeof token !== "string") return null;
        const [h, b, sig] = token.split(".");
        if (!h || !b || !sig) return null;
        if (!safeEq(sig, await hmac(`${h}.${b}`, "jwt", secret))) return null;
        const p = JSON.parse(atob(b.replace(/-/g, "+").replace(/_/g, "/")));
        if (p.exp < Math.floor(Date.now() / 1000)) return null;
        return p;
    } catch { return null; }
}

// ── Cookies / State ─────────────────────────────────────────────────────────
function getCookie(header, name) {
    for (const part of (header ?? "").split(";")) {
        const [k, ...v] = part.trim().split("=");
        if (k === name) try { return decodeURIComponent(v.join("=")); } catch { return null; }
    }
    return null;
}

async function makeState(secret, kv, redirectTo) {
    const arr = new Uint8Array(24);
    crypto.getRandomValues(arr);
    const n = Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
    const mac = await hmac(n, "state", secret);
    await kv.put(`state:${n}`, redirectTo, { expirationTtl: 600 });
    return `${n}.${mac}`;
}

async function checkState(s, secret, kv) {
    if (typeof s !== "string") return null;
    const i = s.lastIndexOf(".");
    const n = s.slice(0, i), m = s.slice(i + 1);
    if (!safeEq(m, await hmac(n, "state", secret))) return null;
    const redirectTo = await kv.get(`state:${n}`);
    if (!redirectTo) return null;
    await kv.delete(`state:${n}`);
    return redirectTo;
}

// ── Token refresh ────────────────────────────────────────────────────────────
async function refreshAccessToken(session, env) {
    const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, COOKIE_SECRET } = env;

    const decryptedRefresh = await decrypt(session.refreshToken, COOKIE_SECRET);

    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id:     DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            grant_type:    "refresh_token",
            refresh_token: decryptedRefresh,
        }),
    });

    if (!tokenRes.ok) return null;
    const data = await tokenRes.json();
    if (!data.access_token) return null;

    return {
        accessToken:  await encrypt(data.access_token, COOKIE_SECRET),
        refreshToken: await encrypt(data.refresh_token, COOKIE_SECRET),
        expiresAt:    Math.floor(Date.now() / 1000) + (data.expires_in ?? 604800),
        userId:       session.userId,
    };
}

async function getValidSession(sessionId, env) {
    const { SESSIONS, COOKIE_SECRET } = env;
    const session = await SESSIONS.get(`session:${sessionId}`, { type: "json" });
    if (!session) return null;

    // Refresh if token expires within 5 minutes
    if (session.expiresAt - Math.floor(Date.now() / 1000) < 300) {
        const refreshed = await refreshAccessToken(session, env);
        if (!refreshed) return null;
        await SESSIONS.put(`session:${sessionId}`, JSON.stringify(refreshed), { expirationTtl: SESSION_TTL });
        return refreshed;
    }

    return session;
}

// ── CORS / Security headers ─────────────────────────────────────────────────
function getAllowedOrigins(frontendUrl) {
    return frontendUrl.split(",").map(s => s.trim()).filter(Boolean);
}

function corsHeaders(origin, frontendUrl) {
    const allowed = getAllowedOrigins(frontendUrl);
    if (!allowed.includes(origin)) return {};
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
    };
}

const SEC = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

function json(data, status = 200, extra = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...SEC, ...extra },
    });
}

const MSGS = { 400: "Bad request", 401: "Unauthorized", 404: "Not found", 429: "Too many requests", 500: "Server error" };
const err = (s) => json({ error: MSGS[s] ?? "Error" }, s);

function makeCookie(jwt) {
    return `auth=${jwt}; HttpOnly; Path=/; SameSite=None; Max-Age=${SESSION_TTL}; Secure`;
}

function clearCookie() {
    return `auth=; HttpOnly; Path=/; SameSite=None; Max-Age=0; Secure`;
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default {
    async fetch(req, env) {
        const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI, COOKIE_SECRET, FRONTEND_URL, SESSIONS } = env;

        const url    = new URL(req.url);
        const path   = url.pathname;
        const origin = req.headers.get("origin") ?? "";
        const cors   = corsHeaders(origin, FRONTEND_URL);
        const ip     = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown";

        if (req.method === "OPTIONS")
            return new Response(null, { status: 204, headers: { ...cors, ...SEC } });

        if (await isLimited(ip, SESSIONS)) return err(429);

        if (path === "/auth/login") {
            const redirectTo = url.searchParams.get("redirect") ?? getAllowedOrigins(FRONTEND_URL)[0];
            const allowed = getAllowedOrigins(FRONTEND_URL);
            const safeRedirect = allowed.includes(redirectTo) ? redirectTo : allowed[0];

            return new Response(null, {
                status: 302,
                headers: {
                    ...SEC,
                    Location: `https://discord.com/api/oauth2/authorize?${new URLSearchParams({
                        client_id:     DISCORD_CLIENT_ID,
                        redirect_uri:  DISCORD_REDIRECT_URI,
                        response_type: "code",
                        // expanded scope for bot dashboard use
                        scope:         "identify guilds guilds.members.read",
                        state:         await makeState(COOKIE_SECRET, SESSIONS, safeRedirect),
                    })}`,
                },
            });
        }

        if (path === "/auth/callback") {
            const code  = url.searchParams.get("code");
            const state = url.searchParams.get("state");

            const redirectTo = await checkState(state, COOKIE_SECRET, SESSIONS);
            if (!code || code.length > 512 || !redirectTo) return err(400);

            const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
                method:  "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body:    new URLSearchParams({
                    client_id:     DISCORD_CLIENT_ID,
                    client_secret: DISCORD_CLIENT_SECRET,
                    grant_type:    "authorization_code",
                    code,
                    redirect_uri:  DISCORD_REDIRECT_URI,
                }),
            });

            const tokenData = await tokenRes.json();
            if (!tokenRes.ok || !tokenData.access_token) return err(500);

            const userRes = await fetch("https://discord.com/api/v10/users/@me", {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
            });

            const user = await userRes.json();
            if (!userRes.ok || !user.id) return err(500);

            const arr = new Uint8Array(32);
            crypto.getRandomValues(arr);
            const sessionId = Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");

            // Store encrypted tokens + expiry
            await SESSIONS.put(`session:${sessionId}`, JSON.stringify({
                accessToken:  await encrypt(tokenData.access_token, COOKIE_SECRET),
                refreshToken: await encrypt(tokenData.refresh_token, COOKIE_SECRET),
                expiresAt:    Math.floor(Date.now() / 1000) + (tokenData.expires_in ?? 604800),
                userId:       user.id,
            }), { expirationTtl: SESSION_TTL });

            const jwt = await signJWT({
                userId:   user.id,
                username: user.username,
                avatar:   user.avatar ?? null,
                sessionId,
                exp:      Math.floor(Date.now() / 1000) + SESSION_TTL,
            }, COOKIE_SECRET);

            return new Response(null, {
                status: 302,
                headers: { ...SEC, "Set-Cookie": makeCookie(jwt), Location: redirectTo },
            });
        }

        if (path === "/auth/logout") {
            const p = await verifyJWT(getCookie(req.headers.get("cookie"), "auth"), COOKIE_SECRET);
            if (p?.sessionId) await SESSIONS.delete(`session:${p.sessionId}`);
            return new Response(null, {
                status: 302,
                headers: { ...SEC, "Set-Cookie": clearCookie(), Location: getAllowedOrigins(FRONTEND_URL)[0] },
            });
        }

        if (path === "/user") {
            const p = await verifyJWT(getCookie(req.headers.get("cookie"), "auth"), COOKIE_SECRET);
            if (!p) return err(401);
            const session = await getValidSession(p.sessionId, env);
            if (!session) return err(401);
            return json({ userId: p.userId, username: p.username, avatar: p.avatar }, 200, cors);
        }

        if (path === "/user/guilds") {
            const p = await verifyJWT(getCookie(req.headers.get("cookie"), "auth"), COOKIE_SECRET);
            if (!p) return err(401);
            const session = await getValidSession(p.sessionId, env);
            if (!session) return err(401);

            const accessToken = await decrypt(session.accessToken, COOKIE_SECRET);
            const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!res.ok) return err(500);

            // Include permissions field for each guild (useful for bot dashboard)
            const guilds = await res.json();
            return json(guilds.map(g => ({
                id:          g.id,
                name:        g.name,
                icon:        g.icon,
                owner:       g.owner,
                permissions: g.permissions, // raw permissions bitfield
                features:    g.features,
            })), 200, cors);
        }

        // Guild member info (requires guilds.members.read scope)
        if (path === "/user/guilds/member") {
            const guildId = url.searchParams.get("guild_id");
            if (!guildId) return err(400);

            const p = await verifyJWT(getCookie(req.headers.get("cookie"), "auth"), COOKIE_SECRET);
            if (!p) return err(401);
            const session = await getValidSession(p.sessionId, env);
            if (!session) return err(401);

            const accessToken = await decrypt(session.accessToken, COOKIE_SECRET);
            const res = await fetch(`https://discord.com/api/v10/users/@me/guilds/${guildId}/member`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!res.ok) return err(res.status === 404 ? 404 : 500);
            return json(await res.json(), 200, cors);
        }

        return err(404);
    },
};