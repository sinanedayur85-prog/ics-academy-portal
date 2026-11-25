import crypto from 'crypto'
import * as webpush from 'web-push'

const P256_ORDER = BigInt('0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551')

const DEFAULT_RTDB_BASE_URL =
  'https://ics-academy-push-default-rtdb.asia-southeast1.firebasedatabase.app'

const ALLOWED_PUSH_HOST_SUFFIXES = [
  '.push.apple.com',
  'web.push.apple.com',
  'fcm.googleapis.com',
  'android.googleapis.com',
  '.push.services.mozilla.com',
  'updates.push.services.mozilla.com',
  '.notify.windows.com',
  '.push.samsungosp.com',
  '.push.opera.com',
]

let cachedVapidKeys = null
let cachedRtdbAccessToken = null
let cachedRtdbTokenExpiryMs = 0

function toBase64Url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function getRtdbBaseUrl() {
  const raw = (process.env.FIREBASE_RTDB_URL || process.env.RTDB_DATABASE_URL || '').trim()
  if (/^https:\/\/[a-z0-9-]+\.(firebaseio\.com|[a-z0-9-]+\.firebasedatabase\.app)\/?$/i.test(raw)) {
    return raw.replace(/\/+$/, '')
  }
  return DEFAULT_RTDB_BASE_URL
}

function normalizePrivateKey(raw) {
  if (typeof raw !== 'string') return ''
  let key = raw.trim()
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim()
  }
  key = key.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim()
  return key
}

function extractPemKey(raw) {
  const normalized = normalizePrivateKey(raw)
  const pemMatch = normalized.match(
    /-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA )?PRIVATE KEY-----/,
  )
  return pemMatch ? `${pemMatch[0].trim()}\n` : ''
}

function loadServiceAccountCredentials() {
  const splitEmail = (process.env.FCM_CLIENT_EMAIL || '').trim()
  const splitKey = extractPemKey(process.env.FCM_PRIVATE_KEY || '')
  if (splitEmail && splitKey) {
    return { clientEmail: splitEmail, privateKey: splitKey }
  }

  const rawEnvCandidates = [
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    process.env.FCM_SERVICE_ACCOUNT_JSON,
    process.env.FIREBASE_SERVICE_ACCOUNT,
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
  ]
  const rawJson = (rawEnvCandidates.find((v) => typeof v === 'string' && v.trim().length > 0) || '').trim()
  if (!rawJson) return null

  let candidate = rawJson
  if (
    (candidate.startsWith('"') && candidate.endsWith('"')) ||
    (candidate.startsWith("'") && candidate.endsWith("'"))
  ) {
    candidate = candidate.slice(1, -1).trim()
  }

  const attempts = [candidate]
  if (!candidate.startsWith('{')) {
    try {
      attempts.push(Buffer.from(candidate, 'base64').toString('utf8').trim())
    } catch {
      // Ignore base64 failure
    }
  }

  for (const text of attempts) {
    try {
      const parsed = JSON.parse(text)
      const obj = typeof parsed === 'string' ? JSON.parse(parsed) : parsed
      const clientEmail = typeof obj?.client_email === 'string' ? obj.client_email.trim() : ''
      const privateKey = extractPemKey(obj?.private_key || '')
      if (clientEmail && privateKey) {
        return { clientEmail, privateKey }
      }
    } catch {
      const unescaped = text.replace(/\\"/g, '"')
      const emailMatch = unescaped.match(/"client_email"\s*:\s*"([^"\s]+@[^"\s]+)"/)
      const privateKey = extractPemKey(unescaped)
      const clientEmail = emailMatch ? emailMatch[1].trim() : ''
      if (clientEmail && privateKey) {
        return { clientEmail, privateKey }
      }
    }
  }

  return null
}

async function getRtdbAdminAccessToken() {
  const nowMs = Date.now()
  if (cachedRtdbAccessToken && nowMs < cachedRtdbTokenExpiryMs - 60_000) {
    return cachedRtdbAccessToken
  }

  const creds = loadServiceAccountCredentials()
  if (!creds) {
    throw new Error('Firebase service account credentials are not configured on the push server.')
  }

  const iat = Math.floor(nowMs / 1000)
  const exp = iat + 3600
  const header = toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claimSet = toBase64Url(
    JSON.stringify({
      iss: creds.clientEmail,
      scope:
        'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/firebase.database',
      aud: 'https://oauth2.googleapis.com/token',
      iat,
      exp,
    }),
  )
  const unsignedJwt = `${header}.${claimSet}`
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(unsignedJwt)
  signer.end()
  const signature = toBase64Url(signer.sign(creds.privateKey))
  const assertion = `${unsignedJwt}.${signature}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => '')
    throw new Error(`RTDB OAuth token exchange failed (${tokenRes.status}): ${errText.slice(0, 160)}`)
  }

  const tokenData = await tokenRes.json()
  if (!tokenData?.access_token) {
    throw new Error('RTDB OAuth token response missing access_token')
  }

  cachedRtdbAccessToken = tokenData.access_token
  cachedRtdbTokenExpiryMs = nowMs + (Number(tokenData.expires_in) || 3500) * 1000
  return cachedRtdbAccessToken
}

function getServerVapidSeedMaterial() {
  const candidates = [
    process.env.VAPID_DERIVATION_SECRET,
    process.env.FCM_PRIVATE_KEY,
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    process.env.FCM_SERVICE_ACCOUNT_JSON,
    process.env.FIREBASE_SERVICE_ACCOUNT,
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
  ]
  const found = candidates.find((v) => typeof v === 'string' && v.trim().length >= 32)
  return found ? found.trim() : ''
}

export function getVapidKeyPair() {
  if (cachedVapidKeys) return cachedVapidKeys

  const subject =
    typeof process.env.VAPID_SUBJECT === 'string' &&
    /^(mailto:|https:\/\/)/i.test(process.env.VAPID_SUBJECT.trim())
      ? process.env.VAPID_SUBJECT.trim()
      : 'mailto:admin@icsacademy.edu.in'

  const envPub = typeof process.env.VAPID_PUBLIC_KEY === 'string' ? process.env.VAPID_PUBLIC_KEY.trim() : ''
  const envPriv = typeof process.env.VAPID_PRIVATE_KEY === 'string' ? process.env.VAPID_PRIVATE_KEY.trim() : ''

  if (envPub.length >= 60 && envPriv.length >= 32) {
    webpush.setVapidDetails(subject, envPub, envPriv)
    cachedVapidKeys = {
      ok: true,
      publicKey: envPub,
      privateKey: envPriv,
      subject,
      persistent: true,
      source: 'env',
    }
    return cachedVapidKeys
  }

  // Deterministically derive a persistent RFC 8292 P-256 ECDSA VAPID keypair from server-side credentials
  const seedMaterial = getServerVapidSeedMaterial()
  if (seedMaterial) {
    const hash = crypto
      .createHash('sha256')
      .update('ics-academy-manhappatta-vapid-p256-v1:')
      .update(seedMaterial)
      .digest()
    const scalar = (BigInt(`0x${hash.toString('hex')}`) % (P256_ORDER - 1n)) + 1n
    const privBuf = Buffer.from(scalar.toString(16).padStart(64, '0'), 'hex')
    const ecdh = crypto.createECDH('prime256v1')
    ecdh.setPrivateKey(privBuf)
    const pubBuf = ecdh.getPublicKey(null, 'uncompressed')
    const publicKey = toBase64Url(pubBuf)
    const privateKey = toBase64Url(privBuf)
    webpush.setVapidDetails(subject, publicKey, privateKey)
    cachedVapidKeys = {
      ok: true,
      publicKey,
      privateKey,
      subject,
      persistent: true,
      source: 'derived-server-secret',
    }
    return cachedVapidKeys
  }

  // Last-resort ephemeral fallback for local dev without env vars
  const generated = webpush.generateVAPIDKeys()
  webpush.setVapidDetails(subject, generated.publicKey, generated.privateKey)
  cachedVapidKeys = {
    ok: true,
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
    subject,
    persistent: false,
    source: 'ephemeral',
  }
  return cachedVapidKeys
}

export function isValidPushEndpointUrl(raw) {
  if (typeof raw !== 'string') return false
  const trimmed = raw.trim()
  if (trimmed.length < 16 || trimmed.length > 600) return false
  try {
    const u = new URL(trimmed)
    if (u.protocol !== 'https:') return false
    const host = u.hostname.toLowerCase()
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '169.254.169.254' ||
      /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
    ) {
      return false
    }
    return ALLOWED_PUSH_HOST_SUFFIXES.some((suffix) =>
      suffix.startsWith('.') ? host.endsWith(suffix) : host === suffix,
    )
  } catch {
    return false
  }
}

export function isValidBase64UrlKey(raw, minLen = 8, maxLen = 200) {
  return (
    typeof raw === 'string' &&
    raw.length >= minLen &&
    raw.length <= maxLen &&
    /^[A-Za-z0-9_-]+=*$/.test(raw)
  )
}

export function isValidPortalActorId(raw) {
  return (
    typeof raw === 'string' &&
    raw.length >= 4 &&
    raw.length <= 64 &&
    /^(st[d]?|student|usthad|principal)-[a-zA-Z0-9_-]+$/.test(raw.trim())
  )
}

export function normalizeClassLabel(raw) {
  if (!raw || typeof raw !== 'string') return ''
  return raw
    .replace(/^class\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

export function makeSubDocId(endpoint) {
  return `wsub_${crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 40)}`
}

function parseRtdbSubRecord(raw, fallbackId = '') {
  if (!raw || typeof raw !== 'object') return null
  const endpoint = typeof raw.endpoint === 'string' ? raw.endpoint.trim() : ''
  const p256dh = typeof raw.keys?.p256dh === 'string' ? raw.keys.p256dh : typeof raw.p256dh === 'string' ? raw.p256dh : ''
  const auth = typeof raw.keys?.auth === 'string' ? raw.keys.auth : typeof raw.auth === 'string' ? raw.auth : ''
  const actorId = typeof raw.actorId === 'string' ? raw.actorId.trim() : ''
  if (!endpoint || !p256dh || !auth || !actorId) return null

  const assignedArr = Array.isArray(raw.assignedClasses)
    ? raw.assignedClasses.filter((v) => typeof v === 'string' && v.trim().length > 0)
    : []

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : fallbackId || makeSubDocId(endpoint),
    endpoint,
    keys: { p256dh, auth },
    actorId,
    actorRole: typeof raw.actorRole === 'string' ? raw.actorRole : 'student',
    actorName: typeof raw.actorName === 'string' ? raw.actorName : 'Campus Member',
    className: typeof raw.className === 'string' ? raw.className : '',
    assignedClasses: assignedArr,
    platform: typeof raw.platform === 'string' ? raw.platform : 'web',
    updatedAtMs: Number(raw.updatedAtMs || 0),
  }
}

export async function getWebPushSubByEndpoint(endpoint) {
  if (!isValidPushEndpointUrl(endpoint)) return null
  try {
    const token = await getRtdbAdminAccessToken()
    const subId = makeSubDocId(endpoint)
    const url = `${getRtdbBaseUrl()}/campusWebPushSubs/${encodeURIComponent(subId)}.json`
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    return parseRtdbSubRecord(data, subId)
  } catch {
    return null
  }
}

export async function upsertWebPushSub(record) {
  const token = await getRtdbAdminAccessToken()
  const subId = makeSubDocId(record.endpoint)
  const nowMs = Date.now()
  const url = `${getRtdbBaseUrl()}/campusWebPushSubs/${encodeURIComponent(subId)}.json`

  const payload = {
    id: subId,
    campusId: 'ics-academy',
    endpoint: record.endpoint,
    keys: {
      p256dh: record.keys.p256dh,
      auth: record.keys.auth,
    },
    actorId: record.actorId,
    actorRole: record.actorRole,
    actorName: record.actorName,
    className: record.className || '',
    assignedClasses: Array.isArray(record.assignedClasses) ? record.assignedClasses : [],
    platform: record.platform || 'web',
    updatedAtMs: nowMs,
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`RTDB subscription save failed (${res.status}): ${errText.slice(0, 180)}`)
  }
  return { id: subId, updatedAtMs: nowMs }
}

export async function deleteWebPushSubByEndpoint(endpoint) {
  if (!isValidPushEndpointUrl(endpoint)) return false
  try {
    const token = await getRtdbAdminAccessToken()
    const subId = makeSubDocId(endpoint)
    const url = `${getRtdbBaseUrl()}/campusWebPushSubs/${encodeURIComponent(subId)}.json`
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok || res.status === 404
  } catch {
    return false
  }
}

export async function listWebPushSubs() {
  try {
    const token = await getRtdbAdminAccessToken()
    const url = `${getRtdbBaseUrl()}/campusWebPushSubs.json`
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return []
    const data = await res.json()
    if (!data || typeof data !== 'object') return []
    const subs = []
    for (const [key, value] of Object.entries(data)) {
      const parsed = parseRtdbSubRecord(value, key)
      if (parsed) subs.push(parsed)
    }
    return subs
  } catch {
    return []
  }
}

function matchesWebPushTarget(sub, filter) {
  if (!sub || !sub.actorId) return false
  if (filter.senderId && sub.actorId === filter.senderId) return false

  const isPrincipal = sub.actorRole === 'principal'
  const isStaff = isPrincipal || sub.actorRole === 'usthad'
  const normMyClass = normalizeClassLabel(sub.className)
  const normAssigned = (sub.assignedClasses || []).map(normalizeClassLabel).filter(Boolean)

  if (filter.targetRecipientId) {
    return sub.actorId === filter.targetRecipientId
  }
  if (filter.targetStudentId) {
    return sub.actorId === filter.targetStudentId
  }
  if (filter.targetStaffOnly) {
    return isStaff
  }

  const targetClasses = Array.isArray(filter.targetClasses)
    ? filter.targetClasses.map(normalizeClassLabel).filter(Boolean)
    : []
  const singleClass = normalizeClassLabel(filter.targetClass)

  if (filter.type === 'chat') {
    if (singleClass && singleClass !== 'ALL') {
      if (!isStaff) return normMyClass === singleClass
      return normMyClass === singleClass || normAssigned.includes(singleClass)
    }
    return false
  }

  if (targetClasses.length > 0 && !targetClasses.includes('ALL')) {
    if (isPrincipal) return true
    if (normMyClass && targetClasses.includes(normMyClass)) return true
    return normAssigned.some((c) => targetClasses.includes(c))
  }

  if (singleClass && singleClass !== 'ALL') {
    if (isPrincipal) return true
    if (normMyClass === singleClass) return true
    return normAssigned.includes(singleClass)
  }

  return true
}

export async function sendWebPushNotification(sub, payload, urgency = 'high', ttlSeconds = 3600) {
  const vapid = getVapidKeyPair()
  if (!vapid.ok) return false
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        },
      },
      JSON.stringify(payload),
      {
        TTL: ttlSeconds,
        urgency,
        topic: payload.tag ? String(payload.tag).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) : undefined,
      },
    )
    return true
  } catch (err) {
    const statusCode = Number(err?.statusCode || 0)
    if (statusCode === 404 || statusCode === 410) {
      await deleteWebPushSubByEndpoint(sub.endpoint).catch(() => {})
    }
    return false
  }
}

export async function dispatchWebPushToMatchingSubs(payload, filter, urgency = 'high', ttlSeconds = 3600) {
  const subs = await listWebPushSubs()
  if (subs.length === 0) return { sent: 0, failed: 0, matched: 0 }
  const matched = subs.filter((s) => matchesWebPushTarget(s, filter))
  if (matched.length === 0) return { sent: 0, failed: 0, matched: 0 }

  const results = await Promise.allSettled(
    matched.map((s) => sendWebPushNotification(s, payload, urgency, ttlSeconds)),
  )
  const sent = results.filter((r) => r.status === 'fulfilled' && r.value === true).length
  return { sent, failed: matched.length - sent, matched: matched.length }
}
