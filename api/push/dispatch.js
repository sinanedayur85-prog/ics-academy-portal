import crypto from 'crypto'

let cachedAccessToken = null
let cachedAccessTokenExpiryMs = 0

function isValidProjectId(raw) {
  return typeof raw === 'string' && /^[a-z][a-z0-9-]{4,29}$/.test(raw.trim())
}

function isValidActorId(raw) {
  return (
    typeof raw === 'string' &&
    raw.length >= 4 &&
    raw.length <= 64 &&
    /^(st[d]?|student|usthad|principal)-[a-zA-Z0-9_-]+$/.test(raw.trim())
  )
}

function sanitizeActorTopic(actorId) {
  if (!isValidActorId(actorId)) return ''
  return `ics_actor_${actorId.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)}`
}

function normalizeClassLabel(raw) {
  if (!raw || typeof raw !== 'string') return ''
  return raw
    .replace(/^class\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function sanitizeClassTopic(rawClass) {
  const norm = normalizeClassLabel(rawClass)
  if (!norm || norm === 'ALL') return ''
  const slug = norm.replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return slug ? `ics_class_${slug}` : ''
}

function loadServiceAccountCredentials() {
  const envProjectId = (process.env.FCM_PROJECT_ID || '').trim()
  const fallbackProjectId = isValidProjectId(envProjectId) ? envProjectId : 'ics-academy-push'

  const rawJson = (
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.FCM_SERVICE_ACCOUNT_JSON ||
    ''
  ).trim()

  if (rawJson) {
    try {
      const jsonText = rawJson.startsWith('{')
        ? rawJson
        : Buffer.from(rawJson, 'base64').toString('utf8')
      const parsed = JSON.parse(jsonText)
      const clientEmail = typeof parsed.client_email === 'string' ? parsed.client_email.trim() : ''
      const privateKey =
        typeof parsed.private_key === 'string'
          ? parsed.private_key.replace(/\\n/g, '\n').trim()
          : ''
      const projectId = isValidProjectId(parsed.project_id)
        ? parsed.project_id.trim()
        : fallbackProjectId
      if (clientEmail && privateKey.includes('BEGIN PRIVATE KEY')) {
        return { projectId, clientEmail, privateKey }
      }
    } catch {
      // Fall through to split env vars
    }
  }

  const clientEmail = (process.env.FCM_CLIENT_EMAIL || '').trim()
  const privateKey = (process.env.FCM_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim()
  if (clientEmail && privateKey.includes('BEGIN PRIVATE KEY')) {
    return { projectId: fallbackProjectId, clientEmail, privateKey }
  }

  return null
}

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8')
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function getGoogleFcmAccessToken(creds) {
  const nowMs = Date.now()
  if (cachedAccessToken && nowMs < cachedAccessTokenExpiryMs - 60_000) {
    return cachedAccessToken
  }

  const iat = Math.floor(nowMs / 1000)
  const exp = iat + 3600
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claimSet = base64UrlEncode(
    JSON.stringify({
      iss: creds.clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat,
      exp,
    }),
  )
  const unsignedJwt = `${header}.${claimSet}`
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(unsignedJwt)
  signer.end()
  const signature = base64UrlEncode(signer.sign(creds.privateKey))
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
    throw new Error(`OAuth token exchange failed (${tokenRes.status}): ${errText.slice(0, 160)}`)
  }

  const tokenData = await tokenRes.json()
  if (!tokenData?.access_token) {
    throw new Error('OAuth token response missing access_token')
  }

  cachedAccessToken = tokenData.access_token
  cachedAccessTokenExpiryMs = nowMs + (Number(tokenData.expires_in) || 3500) * 1000
  return cachedAccessToken
}

function buildFcmTargetsForNotification(notif) {
  const senderTopic = sanitizeActorTopic(notif.actorId)
  const excludeSender = (expr) => (senderTopic ? `${expr} && !('${senderTopic}' in topics)` : expr)

  // 1. Direct 1-on-1 chat or specific recipient
  if (notif.targetRecipientId) {
    if (notif.actorId && notif.targetRecipientId === notif.actorId) return []
    const recipientTopic = sanitizeActorTopic(notif.targetRecipientId)
    return recipientTopic ? [{ topic: recipientTopic }] : []
  }

  // 2. Personal student attendance / leave / direct student alert
  if (notif.targetStudentId) {
    if (notif.actorId && notif.targetStudentId === notif.actorId) return []
    const studentTopic = sanitizeActorTopic(notif.targetStudentId)
    return studentTopic ? [{ topic: studentTopic }] : []
  }

  // 3. Staff Room group chat or staff-only announcements
  if (notif.targetStaffOnly) {
    return senderTopic
      ? [{ condition: excludeSender("'ics_staff' in topics") }]
      : [{ topic: 'ics_staff' }]
  }

  // 4. Multi-class targeted notices / syllabus / tests
  const classTopics = Array.isArray(notif.targetClasses)
    ? Array.from(new Set(notif.targetClasses.map(sanitizeClassTopic).filter(Boolean)))
    : []

  if (classTopics.length > 0 && !notif.targetClasses.some((c) => normalizeClassLabel(c) === 'ALL')) {
    const targets = []
    // FCM conditions allow up to 5 topic terms; chunk into groups of 4 classes + 1 sender exclusion
    for (let i = 0; i < classTopics.length; i += 4) {
      const chunk = classTopics.slice(i, i + 4)
      const orExpr = chunk.map((t) => `'${t}' in topics`).join(' || ')
      const wrapped = chunk.length > 1 ? `(${orExpr})` : orExpr
      targets.push({ condition: excludeSender(wrapped) })
    }
    return targets
  }

  // 5. Single class / batch group chat or class notice
  const singleClassTopic = sanitizeClassTopic(notif.targetClass)
  if (singleClassTopic) {
    return senderTopic
      ? [{ condition: excludeSender(`'${singleClassTopic}' in topics`) }]
      : [{ topic: singleClassTopic }]
  }

  // Chat messages must always have an explicit recipient, staff room, or class target
  if (notif.type === 'chat') {
    return []
  }

  // 6. Campus-wide announcement
  return senderTopic
    ? [{ condition: excludeSender("'ics_all' in topics") }]
    : [{ topic: 'ics_all' }]
}

async function sendFcmV1Message(creds, accessToken, target, payload, ttlSeconds) {
  const endpoint = `https://fcm.googleapis.com/v1/projects/${creds.projectId}/messages:send`
  const fcmBody = {
    message: {
      ...target,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        title: payload.title,
        body: payload.body,
        href: payload.href,
        tag: payload.tag,
        notificationId: payload.notificationId,
        type: payload.type,
        senderId: payload.senderId || '',
      },
      android: {
        priority: 'HIGH',
        ttl: `${ttlSeconds}s`,
        notification: {
          channel_id: 'ics_academy_updates',
          sound: 'default',
          default_sound: true,
          default_vibrate_timings: true,
          notification_priority: 'PRIORITY_MAX',
          visibility: 'PUBLIC',
          tag: payload.tag,
        },
      },
    },
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(fcmBody),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`FCM v1 error (${res.status}): ${errText.slice(0, 200)}`)
  }
  return await res.json()
}

export default async function handler(req, res) {
  const origin = typeof req.headers?.origin === 'string' ? req.headers.origin : ''
  const isAllowedOrigin =
    !origin ||
    /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.(vercel\.app|run\.app|netlify\.app)$/i.test(origin) ||
    /^(capacitor|https?):\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)

  if (origin && isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const creds = loadServiceAccountCredentials()

  if (req.method === 'GET') {
    res.status(200).json({
      ok: true,
      configured: Boolean(creds),
      projectId: creds ? creds.projectId : 'ics-academy-push',
      mode: 'fcm-topics-v1',
    })
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!creds) {
    res.status(200).json({
      ok: false,
      configured: false,
      reason: 'FCM credentials not configured on this Vercel deployment yet.',
    })
    return
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
    let targets = []
    let payload = null
    let ttlSeconds = 3600

    if (body.call && typeof body.call === 'object') {
      const call = body.call
      const calleeTopic = sanitizeActorTopic(call.calleeId)
      if (!calleeTopic || (call.callerId && call.callerId === call.calleeId)) {
        res.status(200).json({ ok: true, sent: 0 })
        return
      }
      const callLabel = call.callType === 'video' ? 'Incoming Video Call' : 'Incoming Voice Call'
      const callerName = String(call.callerName || 'ICS Academy').slice(0, 80)
      targets = [{ topic: calleeTopic }]
      payload = {
        title: `${callLabel} — ${callerName}`.slice(0, 140),
        body: 'Tap to open ICS Academy and answer.',
        href: '#campus-chat',
        tag: `ics-call-${String(call.id || Date.now()).slice(0, 48)}`,
        notificationId: `call_${String(call.id || Date.now()).slice(0, 48)}`,
        type: 'call',
        senderId: typeof call.callerId === 'string' ? call.callerId.slice(0, 64) : '',
      }
      ttlSeconds = 60
    } else if (body.notification && typeof body.notification === 'object') {
      const n = body.notification
      const allowedTypes = new Set([
        'notice',
        'attendance',
        'period-attendance',
        'leave',
        'chat',
        'unit-test',
        'syllabus',
      ])
      const safeType = allowedTypes.has(n.type) ? n.type : 'notice'
      targets = buildFcmTargetsForNotification({ ...n, type: safeType })
      if (targets.length === 0) {
        res.status(200).json({ ok: true, sent: 0 })
        return
      }
      payload = {
        title: String(n.title || 'ICS Academy').trim().slice(0, 140) || 'ICS Academy',
        body: String(n.message || 'Open ICS Academy to view details.').trim().slice(0, 320),
        href: typeof n.href === 'string' && n.href.startsWith('#') ? n.href.slice(0, 80) : '#notices',
        tag: `ics-notif-${safeType}-${String(n.id || Date.now()).slice(0, 48)}`,
        notificationId: String(n.id || `notif_${Date.now()}`).slice(0, 64),
        type: safeType,
        senderId: typeof n.actorId === 'string' ? n.actorId.slice(0, 64) : '',
      }
      ttlSeconds = safeType === 'chat' || safeType === 'leave' || safeType === 'attendance' ? 1800 : 21600
    } else {
      res.status(400).json({ error: 'notification or call payload is required.' })
      return
    }

    const accessToken = await getGoogleFcmAccessToken(creds)
    const results = await Promise.allSettled(
      targets.map((t) => sendFcmV1Message(creds, accessToken, t, payload, ttlSeconds)),
    )
    const sent = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.length - sent

    res.status(200).json({ ok: sent > 0, sent, failed })
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Push dispatch failed',
    })
  }
}
