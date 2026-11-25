import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import * as webpush from 'web-push'

const P256_ORDER = BigInt('0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551')

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

let cachedFirestoreCfg = null
let cachedVapidKeys = null

function toBase64Url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function getFirestoreConfig() {
  if (cachedFirestoreCfg) return cachedFirestoreCfg
  const candidates = [
    new URL('../firebase-applet-config.json', import.meta.url),
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
  ]
  for (const cfgPath of candidates) {
    try {
      if (fs.existsSync(cfgPath)) {
        const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
        if (parsed?.projectId && parsed?.firestoreDatabaseId && parsed?.apiKey) {
          cachedFirestoreCfg = {
            projectId: String(parsed.projectId).trim(),
            databaseId: String(parsed.firestoreDatabaseId).trim(),
            apiKey: String(parsed.apiKey).trim(),
          }
          return cachedFirestoreCfg
        }
      }
    } catch {
      // Try next candidate
    }
  }
  return null
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
    /^(st[d]?|usthad|principal)-[a-zA-Z0-9_-]+$/.test(raw.trim())
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

function buildFirestoreBaseUrl(cfg) {
  return `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.databaseId}/documents`
}

function parseFirestoreSubDoc(docObj) {
  const f = docObj?.fields
  if (!f) return null
  const endpoint = f.endpoint?.stringValue || ''
  const p256dh = f.p256dh?.stringValue || ''
  const auth = f.auth?.stringValue || ''
  const actorId = f.actorId?.stringValue || ''
  if (!endpoint || !p256dh || !auth || !actorId) return null
  const assignedArr = Array.isArray(f.assignedClasses?.arrayValue?.values)
    ? f.assignedClasses.arrayValue.values
        .map((v) => v?.stringValue || '')
        .filter(Boolean)
    : []
  return {
    id: f.id?.stringValue || makeSubDocId(endpoint),
    endpoint,
    keys: { p256dh, auth },
    actorId,
    actorRole: f.actorRole?.stringValue || 'student',
    actorName: f.actorName?.stringValue || 'Campus Member',
    className: f.className?.stringValue || '',
    assignedClasses: assignedArr,
    platform: f.platform?.stringValue || 'web',
    updatedAtMs: Number(f.updatedAtMs?.integerValue || '0'),
  }
}

export async function getWebPushSubByEndpoint(endpoint) {
  const cfg = getFirestoreConfig()
  if (!cfg || !isValidPushEndpointUrl(endpoint)) return null
  const subId = makeSubDocId(endpoint)
  const url = `${buildFirestoreBaseUrl(cfg)}/campusWebPushSubs/${subId}?key=${encodeURIComponent(cfg.apiKey)}`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    return parseFirestoreSubDoc(data)
  } catch {
    return null
  }
}

export async function upsertWebPushSub(record) {
  const cfg = getFirestoreConfig()
  if (!cfg) {
    throw new Error('Firestore config unavailable on push server.')
  }
  const subId = makeSubDocId(record.endpoint)
  const docName = `projects/${cfg.projectId}/databases/${cfg.databaseId}/documents/campusWebPushSubs/${subId}`
  const existing = await getWebPushSubByEndpoint(record.endpoint)
  const nowMs = Date.now()

  const commonFields = {
    endpoint: { stringValue: record.endpoint },
    p256dh: { stringValue: record.keys.p256dh },
    auth: { stringValue: record.keys.auth },
    actorId: { stringValue: record.actorId },
    actorRole: { stringValue: record.actorRole },
    actorName: { stringValue: record.actorName },
    className: { stringValue: record.className || '' },
    assignedClasses: {
      arrayValue: {
        values: (record.assignedClasses || []).map((c) => ({ stringValue: c })),
      },
    },
    platform: { stringValue: record.platform || 'web' },
    updatedAtMs: { integerValue: String(nowMs) },
  }

  let write
  if (existing) {
    write = {
      update: {
        name: docName,
        fields: commonFields,
      },
      updateMask: {
        fieldPaths: Object.keys(commonFields),
      },
      currentDocument: { exists: true },
    }
  } else {
    write = {
      update: {
        name: docName,
        fields: {
          id: { stringValue: subId },
          campusId: { stringValue: 'ics-academy' },
          ...commonFields,
        },
      },
      updateTransforms: [
        {
          fieldPath: 'createdAt',
          setToServerValue: 'REQUEST_TIME',
        },
      ],
      currentDocument: { exists: false },
    }
  }

  const commitUrl = `${buildFirestoreBaseUrl(cfg)}:commit?key=${encodeURIComponent(cfg.apiKey)}`
  const res = await fetch(commitUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ writes: [write] }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Firestore subscription save failed (${res.status}): ${errText.slice(0, 180)}`)
  }
  return { id: subId, updatedAtMs: nowMs }
}

export async function deleteWebPushSubByEndpoint(endpoint) {
  const cfg = getFirestoreConfig()
  if (!cfg || !isValidPushEndpointUrl(endpoint)) return false
  const subId = makeSubDocId(endpoint)
  const url = `${buildFirestoreBaseUrl(cfg)}/campusWebPushSubs/${subId}?key=${encodeURIComponent(cfg.apiKey)}`
  try {
    const res = await fetch(url, { method: 'DELETE' })
    return res.ok || res.status === 404
  } catch {
    return false
  }
}

export async function listWebPushSubs() {
  const cfg = getFirestoreConfig()
  if (!cfg) return []
  const runQueryUrl = `${buildFirestoreBaseUrl(cfg)}:runQuery?key=${encodeURIComponent(cfg.apiKey)}`
  try {
    const res = await fetch(runQueryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'campusWebPushSubs' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'campusId' },
              op: 'EQUAL',
              value: { stringValue: 'ics-academy' },
            },
          },
          limit: 300,
        },
      }),
    })
    if (!res.ok) return []
    const rows = await res.json()
    if (!Array.isArray(rows)) return []
    const subs = []
    for (const row of rows) {
      if (row?.document) {
        const parsed = parseFirestoreSubDoc(row.document)
        if (parsed) subs.push(parsed)
      }
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
