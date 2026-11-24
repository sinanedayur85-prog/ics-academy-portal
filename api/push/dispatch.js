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
  const envProjectId = (process.env.FCM_PROJECT_ID || '').trim()
  const fallbackProjectId = isValidProjectId(envProjectId) ? envProjectId : 'ics-academy-push'

  // 1. Check dedicated split env vars first (cleanest option in Vercel UI)
  const splitEmail = (process.env.FCM_CLIENT_EMAIL || '').trim()
  const splitKey = extractPemKey(process.env.FCM_PRIVATE_KEY || '')
  if (splitEmail && splitKey) {
    return { creds: { projectId: fallbackProjectId, clientEmail: splitEmail, privateKey: splitKey }, reason: 'ready' }
  }

  // 2. Check full Service Account JSON env vars
  const rawEnvCandidates = [
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    process.env.FCM_SERVICE_ACCOUNT_JSON,
    process.env.FIREBASE_SERVICE_ACCOUNT,
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
  ]
  const rawJson = (rawEnvCandidates.find((v) => typeof v === 'string' && v.trim().length > 0) || '').trim()

  if (rawJson) {
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
        // Ignore base64 decode failure
      }
    }

    let sawGoogleServices = false
    let sawEmail = false
    let sawKey = false

    for (const text of attempts) {
      if (text.includes('mobilesdk_app_id') || text.includes('"project_info"')) {
        sawGoogleServices = true
      }

      try {
        const parsed = JSON.parse(text)
        const obj = typeof parsed === 'string' ? JSON.parse(parsed) : parsed
        const clientEmail = typeof obj?.client_email === 'string' ? obj.client_email.trim() : ''
        const privateKey = extractPemKey(obj?.private_key || '')
        const projectId = isValidProjectId(obj?.project_id)
          ? obj.project_id.trim()
          : fallbackProjectId
        if (clientEmail) sawEmail = true
        if (privateKey) sawKey = true
        if (clientEmail && privateKey) {
          return { creds: { projectId, clientEmail, privateKey }, reason: 'ready' }
        }
      } catch {
        // Recover cleanly even if Vercel UI mangled JSON quotes/newlines
        const unescaped = text.replace(/\\"/g, '"')
        const emailMatch = unescaped.match(/"client_email"\s*:\s*"([^"\s]+@[^"\s]+)"/)
        const privateKey = extractPemKey(unescaped)
        const projMatch = unescaped.match(/"project_id"\s*:\s*"([^"]+)"/)
        const clientEmail = emailMatch ? emailMatch[1].trim() : ''
        const projectId =
          projMatch && isValidProjectId(projMatch[1]) ? projMatch[1].trim() : fallbackProjectId
        if (clientEmail) sawEmail = true
        if (privateKey) sawKey = true
        if (clientEmail && privateKey) {
          return { creds: { projectId, clientEmail, privateKey }, reason: 'ready' }
        }
      }
    }

    if (sawGoogleServices) {
      return { creds: null, reason: 'wrong_file_google_services_json' }
    }
    if (!sawEmail && !sawKey) {
      return { creds: null, reason: 'missing_client_email_and_private_key' }
    }
    if (!sawEmail) {
      return { creds: null, reason: 'missing_client_email' }
    }
    if (!sawKey) {
      return { creds: null, reason: 'missing_private_key' }
    }
    return { creds: null, reason: 'invalid_json_or_key_format' }
  }

  return { creds: null, reason: 'env_var_missing_in_vercel' }
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
  // High-priority data-only FCM message guarantees Android's CampusFirebaseMessagingService.onMessageReceived()
  // ALWAYS runs even when the app is completely closed (as long as the phone has internet ON).
  // This lets the device display our pure-white silhouette notification icon AND immediately send
  // a real WhatsApp-style 2-tick delivery ACK to Firestore (never firing when internet is OFF).
  const fcmBody = {
    message: {
      ...target,
      data: {
        title: payload.title,
        body: payload.body,
        href: payload.href,
        tag: payload.tag,
        notificationId: payload.notificationId,
        type: payload.type,
        senderId: payload.senderId || '',
        messageId: payload.messageId || '',
      },
      android: {
        priority: 'HIGH',
        ttl: `${ttlSeconds}s`,
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

  const { creds, reason } = loadServiceAccountCredentials()

  if (req.method === 'GET') {
    res.status(200).json({
      ok: true,
      configured: Boolean(creds),
      configReason: reason,
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
      configReason: reason,
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
      const rawNotifId = String(n.id || `notif_${Date.now()}`).slice(0, 64)
      const derivedChatMsgId =
        typeof n.chatMessageId === 'string' && /^[a-zA-Z0-9_-]{4,128}$/.test(n.chatMessageId.trim())
          ? n.chatMessageId.trim()
          : safeType === 'chat' && rawNotifId.startsWith('notif_chat_')
            ? rawNotifId.slice('notif_chat_'.length).trim()
            : ''
      payload = {
        title: String(n.title || 'ICS Academy').trim().slice(0, 140) || 'ICS Academy',
        body: String(n.message || 'Open ICS Academy to view details.').trim().slice(0, 320),
        href: typeof n.href === 'string' && n.href.startsWith('#') ? n.href.slice(0, 80) : '#notices',
        tag: `ics-notif-${safeType}-${String(n.id || Date.now()).slice(0, 48)}`,
        notificationId: rawNotifId,
        type: safeType,
        senderId: typeof n.actorId === 'string' ? n.actorId.slice(0, 64) : '',
        messageId: derivedChatMsgId,
      }
      ttlSeconds = 259200
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
