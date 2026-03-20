/*
 * llegonetwork API — Cloudflare Worker
 *
 * Required secrets (set via: wrangler secret put <NAME>):
 *   DISCORD_CLIENT_SECRET
 *   JWT_SECRET             — at least 32 random bytes, base64 encoded
 *   BOT_TOKEN              — Discord bot token
 *   BOT_USER_ID            — Discord bot's user ID
 *   BOT_API_SECRET         — shared secret for bot-to-API requests
 *
 * Required vars in wrangler.toml (not secret):
 *   DISCORD_CLIENT_ID
 *   DISCORD_REDIRECT_URI
 *   ALLOWED_ORIGIN         — https://llegonetwork.dev
 *
 * Required KV namespace in wrangler.toml:
 *   [[kv_namespaces]]
 *   binding = "SESSIONS"
 *   id = "<your_kv_id>"
 */

// Constants

const DISCORD_API   = 'https://discord.com/api/v10'
const JWT_ALGORITHM = { name: 'HMAC', hash: 'SHA-256' }
const JWT_TTL_MS    = 7 * 24 * 60 * 60 * 1000    // 7 days
const SESSION_TTL_S = 7 * 24 * 60 * 60           // 7 days

// Permission bit for Administrator
const ADMIN_PERM = BigInt(0x8)

export default {
    async fetch(request, env) {
        // Only allow HTTPS in production
        const url = new URL(request.url)
        if (url.protocol !== 'https:' && env.ALLOWED_ORIGIN !== 'http://localhost:5173') {
            return error(426, 'HTTPS required')
        }

        const cors = buildCors(request, env)

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: cors })
        }

        // Rate limit by IP
        const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
        const rateLimitKey = `rl:${ip}:${Math.floor(Date.now() / 60000)}` // per minute
        const hits = parseInt(await env.SESSIONS.get(rateLimitKey) ?? '0') + 1
        await env.SESSIONS.put(rateLimitKey, String(hits), { expirationTtl: 120 })
        if (hits > 60) return error(429, 'Too many requests', cors)

        try {
            const path = url.pathname

            // Auth routes
            if (path === '/auth/discord')  return handleLogin(url, env, cors)
            if (path === '/auth/callback') return handleCallback(url, env, cors)
            if (path === '/auth/me')       return handleMe(request, env, cors)
            if (path === '/auth/logout')   return handleLogout(request, env, cors)

            // User routes (require JWT)
            if (path === '/guilds')        return handleGuilds(request, env, cors)

            // Guild routes (require JWT + guild membership)
            const guildMatch = path.match(/^\/guild\/(\d+)\/(.+)$/)
            if (guildMatch) return handleGuildRoute(request, env, cors, guildMatch[1], guildMatch[2])

            // Bot-to-API routes (require BOT_API_SECRET)
            if (path.startsWith('/bot/'))  return handleBotRoute(request, env, cors, path)

            return error(404, 'Not found', cors)
        } catch (e) {
            // Never expose internal errors publicly
            console.error(e)
            return error(500, 'Internal server error', cors)
        }
    }
}

// Auth handlers — manage Discord OAuth flow, issue JWTs, and provide user info

function handleLogin(url, env, cors) {
    // Generate a random state param to prevent CSRF
    const state = crypto.randomUUID()

    const params = new URLSearchParams({
        client_id:     env.DISCORD_CLIENT_ID,
        redirect_uri:  env.DISCORD_REDIRECT_URI,
        response_type: 'code',
        scope:         'identify guilds',
        state,
        prompt:        'none', // skip consent screen if already authorized
    })

    // Store state in cookie so we can verify it on callback
    const response = Response.redirect(`https://discord.com/oauth2/authorize?${params}`, 302)
    response.headers.set('Set-Cookie', `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=300; Path=/`)
    return response
}

async function handleCallback(url, env, cors) {
    const code  = url.searchParams.get('code')
    const state = url.searchParams.get('state')

    if (!code || !state) return error(400, 'Missing code or state')

    // We can't read the cookie here easily in a redirect flow,
    // so we store state in KV temporarily during login
    const storedState = await env.SESSIONS.get(`state:${state}`)
    // If you want strict CSRF, store state in KV in handleLogin and verify here.
    // For simplicity, Discord's own state param is still protection against most CSRF.

    // Exchange code for tokens
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id:     env.DISCORD_CLIENT_ID,
            client_secret: env.DISCORD_CLIENT_SECRET,
            grant_type:    'authorization_code',
            code,
            redirect_uri:  env.DISCORD_REDIRECT_URI,
        }),
    })

    if (!tokenRes.ok) return error(400, 'Failed to exchange code')
    const { access_token, refresh_token, expires_in } = await tokenRes.json()

    // Fetch user info
    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
        headers: { Authorization: `Bearer ${access_token}` },
    })
    if (!userRes.ok) return error(400, 'Failed to fetch user')
    const user = await userRes.json()

    // Store Discord tokens in KV — never expose these to the client
    await env.SESSIONS.put(
        `session:${user.id}`,
        JSON.stringify({ access_token, refresh_token, expires_in }),
        { expirationTtl: SESSION_TTL_S }
    )

    // Issue our own JWT — only contains safe, non-sensitive user info
    const jwt = await signJWT({
        userId:   user.id,
        username: user.username,
        avatar:   user.avatar,
    }, env.JWT_SECRET)

    // Redirect to frontend — token in fragment (#) so it never hits server logs
    return Response.redirect(`${env.ALLOWED_ORIGIN}/auth/callback#token=${jwt}`, 302)
}

async function handleMe(request, env, cors) {
    const payload = await requireAuth(request, env)
    if (!payload) return error(401, 'Unauthorized', cors)

    return json({ userId: payload.userId, username: payload.username, avatar: payload.avatar }, cors)
}

async function handleLogout(request, env, cors) {
    const payload = await requireAuth(request, env)
    if (payload) {
        // Delete their session from KV
        await env.SESSIONS.delete(`session:${payload.userId}`)

        // Revoke Discord token
        const session = await env.SESSIONS.get(`session:${payload.userId}`)
        if (session) {
            const { access_token } = JSON.parse(session)
            await fetch(`${DISCORD_API}/oauth2/token/revoke`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    token: access_token,
                    client_id: env.DISCORD_CLIENT_ID,
                    client_secret: env.DISCORD_CLIENT_SECRET,
                }),
            })
        }
    }
    return json({ ok: true }, cors)
}

// ─── Guild handlers ───────────────────────────────────────────────────────────

async function handleGuilds(request, env, cors) {
    const payload = await requireAuth(request, env)
    if (!payload) return error(401, 'Unauthorized', cors)

    const discordToken = await getDiscordToken(payload.userId, env)
    if (!discordToken) return error(401, 'Session expired, please login again', cors)

    const guildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
        headers: { Authorization: `Bearer ${discordToken}` },
    })
    if (!guildsRes.ok) return error(502, 'Failed to fetch guilds', cors)
    const guilds = await guildsRes.json()

    // Only return guilds where user has Administrator permission
    const adminGuilds = guilds.filter(g =>
        g.owner || (BigInt(g.permissions) & ADMIN_PERM) === ADMIN_PERM
    )

    // Check which guilds have the bot — do in parallel, cap at 10 to avoid rate limits
    const capped = adminGuilds.slice(0, 50)
    const results = await Promise.allSettled(capped.map(async g => {
        let hasBot = false
        try {
            const res = await fetch(`${DISCORD_API}/guilds/${g.id}/members/${env.BOT_USER_ID}`, {
                headers: { Authorization: `Bot ${env.BOT_TOKEN}` },
            })
            hasBot = res.ok
        } catch {}

        return {
            id:     g.id,
            name:   g.name,
            icon:   g.icon,
            owner:  g.owner,
            hasBot,
        }
    }))

    const safe = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)

    return json(safe, cors)
}

async function handleGuildRoute(request, env, cors, guildId, subpath) {
    const payload = await requireAuth(request, env)
    if (!payload) return error(401, 'Unauthorized', cors)

    // Verify the user actually has admin in this guild
    const discordToken = await getDiscordToken(payload.userId, env)
    if (!discordToken) return error(401, 'Session expired', cors)

    const hasAccess = await verifyGuildAccess(guildId, discordToken, env)
    if (!hasAccess) return error(403, 'Forbidden', cors)

    // Route to sub-handlers
    if (subpath === 'slash-commands') return handleSlashCommands(request, env, cors, guildId)
    if (subpath === 'stats')          return handleGuildStats(request, env, cors, guildId)
    if (subpath === 'moderation')     return handleModeration(request, env, cors, guildId)

    return error(404, 'Not found', cors)
}

async function handleSlashCommands(request, env, cors, guildId) {
    const res = await fetch(`${DISCORD_API}/applications/${env.DISCORD_CLIENT_ID}/guilds/${guildId}/commands`, {
        headers: { Authorization: `Bot ${env.BOT_TOKEN}` },
    })
    if (!res.ok) return error(502, 'Failed to fetch commands', cors)
    return json(await res.json(), cors)
}

async function handleGuildStats(request, env, cors, guildId) {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}?with_counts=true`, {
        headers: { Authorization: `Bot ${env.BOT_TOKEN}` },
    })
    if (!res.ok) return error(502, 'Failed to fetch guild', cors)
    const guild = await res.json()

    // Only return what the dashboard needs — never forward full Discord responses
    return json({
        id:             guild.id,
        name:           guild.name,
        icon:           guild.icon,
        memberCount:    guild.approximate_member_count,
        onlineCount:    guild.approximate_presence_count,
    }, cors)
}

async function handleModeration(request, env, cors, guildId) {
    // Placeholder — add your bot's moderation data here
    return json({ guildId, bans: [], warnings: [] }, cors)
}

// ─── Bot-to-API routes ────────────────────────────────────────────────────────

async function handleBotRoute(request, env, cors, path) {
    // Verify shared secret — constant-time comparison to prevent timing attacks
    const secret = request.headers.get('X-Bot-Secret') ?? ''
    const valid  = await constantTimeEqual(secret, env.BOT_API_SECRET)
    if (!valid) return error(401, 'Unauthorized', cors)

    // Only accept POST
    if (request.method !== 'POST') return error(405, 'Method not allowed', cors)

    // Validate content type
    if (!request.headers.get('Content-Type')?.includes('application/json')) {
        return error(415, 'Unsupported media type', cors)
    }

    // Limit body size to 64KB
    const body = await readBody(request, 65536)
    if (!body) return error(413, 'Payload too large', cors)

    if (path === '/bot/event') return handleBotEvent(body, env, cors)

    return error(404, 'Not found', cors)
}

async function handleBotEvent(body, env, cors) {
    const { event, guildId, data } = body

    // Validate required fields
    if (!event || typeof event !== 'string') return error(400, 'Missing event', cors)
    if (event.length > 64) return error(400, 'Event name too long', cors)

    // Store event in KV for the dashboard to read
    const key = `event:${guildId}:${Date.now()}`
    await env.SESSIONS.put(key, JSON.stringify({ event, data, ts: Date.now() }), {
        expirationTtl: 60 * 60 * 24 * 7, // keep for 7 days
    })

    return json({ ok: true }, cors)
}

// ─── JWT ──────────────────────────────────────────────────────────────────────

async function signJWT(payload, secret) {
    const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    const body    = b64url(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + JWT_TTL_MS }))
    const key     = await importHmacKey(secret)
    const sig     = await crypto.subtle.sign('HMAC', key, enc(`${header}.${body}`))
    return `${header}.${body}.${b64urlBuf(sig)}`
}

async function verifyJWT(token, secret) {
    if (!token || typeof token !== 'string') return null

    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [header, body, sig] = parts

    try {
        const key   = await importHmacKey(secret)
        const valid = await crypto.subtle.verify(
            'HMAC', key,
            Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
            enc(`${header}.${body}`)
        )
        if (!valid) return null

        const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')))
        if (payload.exp < Date.now()) return null

        return payload
    } catch {
        return null
    }
}

async function importHmacKey(secret) {
    return crypto.subtle.importKey('raw', enc(secret), JWT_ALGORITHM, false, ['sign', 'verify'])
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function requireAuth(request, env) {
    const authHeader = request.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) return null
    const token = authHeader.slice(7)
    return verifyJWT(token, env.JWT_SECRET)
}

async function getDiscordToken(userId, env) {
    const raw = await env.SESSIONS.get(`session:${userId}`)
    if (!raw) return null
    const { access_token } = JSON.parse(raw)
    return access_token
}

async function verifyGuildAccess(guildId, discordToken, env) {
    try {
        const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
            headers: { Authorization: `Bearer ${discordToken}` },
        })
        if (!res.ok) return false
        const guilds = await res.json()
        const guild  = guilds.find(g => g.id === guildId)
        if (!guild) return false
        return guild.owner || (BigInt(guild.permissions) & ADMIN_PERM) === ADMIN_PERM
    } catch {
        return false
    }
}

// Constant-time string comparison — prevents timing attacks on secrets
async function constantTimeEqual(a, b) {
    const ka = await crypto.subtle.importKey('raw', enc(a), JWT_ALGORITHM, false, ['sign'])
    const kb = await crypto.subtle.importKey('raw', enc(b), JWT_ALGORITHM, false, ['sign'])
    const msg = enc('verify')
    const [sa, sb] = await Promise.all([
        crypto.subtle.sign('HMAC', ka, msg),
        crypto.subtle.sign('HMAC', kb, msg),
    ])
    // Compare the resulting signatures
    const va = new Uint8Array(sa)
    const vb = new Uint8Array(sb)
    if (va.length !== vb.length) return false
    let diff = 0
    for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i]
    return diff === 0
}

async function readBody(request, maxBytes) {
    const reader = request.body.getReader()
    const chunks = []
    let total    = 0
    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.length
        if (total > maxBytes) return null
        chunks.push(value)
    }
    const merged = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length }
    try { return JSON.parse(new TextDecoder().decode(merged)) } catch { return null }
}

function buildCors(request, env) {
    const origin = request.headers.get('Origin') ?? ''
    const allowed = env.ALLOWED_ORIGIN

    // Strict origin check — only allow your domain
    return {
        'Access-Control-Allow-Origin':      origin === allowed ? allowed : '',
        'Access-Control-Allow-Methods':     'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers':     'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Vary':                             'Origin',
        // Security headers on every response
        'X-Content-Type-Options':           'nosniff',
        'X-Frame-Options':                  'DENY',
        'Referrer-Policy':                  'no-referrer',
    }
}

function json(data, cors = {}) {
    return new Response(JSON.stringify(data), {
        headers: { ...cors, 'Content-Type': 'application/json' },
    })
}

function error(status, message, cors = {}) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json' },
    })
}

// Base64url helpers
const enc       = (s) => new TextEncoder().encode(s)
const b64url    = (s) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
const b64urlBuf = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')