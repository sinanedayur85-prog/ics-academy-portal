import {
  deleteWebPushSubByEndpoint,
  getVapidKeyPair,
  getWebPushSubByEndpoint,
  isValidBase64UrlKey,
  isValidPortalActorId,
  isValidPushEndpointUrl,
  sendWebPushNotification,
  upsertWebPushSub,
} from './_push-web-store.js'

function applyCors(req, res) {
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
  res.setHeader('Content-Type', 'application/json')
}

function resolveAction(req) {
  const qAction = typeof req.query?.action === 'string' ? req.query.action.trim().toLowerCase() : ''
  if (qAction) return qAction
  const rawUrl = String(req.url || '')
  if (rawUrl.includes('vapid-public-key')) return 'vapid-public-key'
  if (rawUrl.includes('unsubscribe')) return 'unsubscribe'
  if (rawUrl.includes('subscribe')) return 'subscribe'
  if (rawUrl.includes('test')) return 'test'
  return 'vapid-public-key'
}

export default async function handler(req, res) {
  applyCors(req, res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const action = resolveAction(req)

  try {
    if (action === 'vapid-public-key') {
      if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' })
        return
      }
      const vapid = getVapidKeyPair()
      res.status(200).json({
        ok: Boolean(vapid.ok && vapid.publicKey),
        publicKey: vapid.publicKey,
        persistentEnvConfigured: vapid.persistent,
      })
      return
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}

    if (action === 'subscribe') {
      const {
        subscription,
        actorId,
        actorRole,
        actorName,
        className,
        assignedClasses,
        platform,
      } = body

      if (!subscription || typeof subscription !== 'object') {
        res.status(400).json({ error: 'Valid push subscription is required.' })
        return
      }
      const endpoint = typeof subscription.endpoint === 'string' ? subscription.endpoint.trim() : ''
      const p256dh = subscription.keys?.p256dh
      const authKey = subscription.keys?.auth

      if (
        !isValidPushEndpointUrl(endpoint) ||
        !isValidBase64UrlKey(p256dh, 16, 200) ||
        !isValidBase64UrlKey(authKey, 8, 100)
      ) {
        res.status(400).json({ error: 'Invalid push subscription endpoint or keys.' })
        return
      }
      if (!isValidPortalActorId(actorId)) {
        res.status(400).json({ error: 'Valid portal actorId is required.' })
        return
      }

      const safeRole =
        actorRole === 'principal' || actorRole === 'usthad' ? actorRole : 'student'
      const safeName =
        typeof actorName === 'string' && actorName.trim()
          ? actorName.trim().slice(0, 120)
          : 'Campus Member'
      const safeClass = typeof className === 'string' ? className.trim().slice(0, 60) : ''
      const safeAssigned = Array.isArray(assignedClasses)
        ? assignedClasses
            .filter((c) => typeof c === 'string' && c.trim().length > 0)
            .map((c) => c.trim().slice(0, 60))
            .slice(0, 20)
        : []
      const safePlatform =
        typeof platform === 'string' && platform.trim().length >= 2
          ? platform.trim().slice(0, 40)
          : 'web'

      await upsertWebPushSub({
        endpoint,
        keys: { p256dh, auth: authKey },
        actorId: actorId.trim(),
        actorRole: safeRole,
        actorName: safeName,
        className: safeClass,
        assignedClasses: safeAssigned,
        platform: safePlatform,
      })

      res.status(200).json({
        ok: true,
        actorId: actorId.trim(),
        actorRole: safeRole,
      })
      return
    }

    if (action === 'unsubscribe') {
      const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : ''
      if (endpoint && isValidPushEndpointUrl(endpoint)) {
        await deleteWebPushSubByEndpoint(endpoint)
      }
      res.status(200).json({ ok: true })
      return
    }

    if (action === 'test') {
      const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : ''
      if (!endpoint || !isValidPushEndpointUrl(endpoint)) {
        res.status(400).json({ error: 'Valid push endpoint is required.' })
        return
      }

      let sub = await getWebPushSubByEndpoint(endpoint)
      if (
        !sub &&
        body.subscription &&
        typeof body.subscription === 'object' &&
        isValidBase64UrlKey(body.subscription.keys?.p256dh, 16, 200) &&
        isValidBase64UrlKey(body.subscription.keys?.auth, 8, 100)
      ) {
        sub = {
          endpoint,
          keys: {
            p256dh: body.subscription.keys.p256dh,
            auth: body.subscription.keys.auth,
          },
          actorName: 'ICS Academy Member',
          className: '',
        }
      }

      if (!sub) {
        res.status(404).json({
          error: 'Device subscription not found. Please enable notifications first.',
        })
        return
      }

      const delivered = await sendWebPushNotification(
        sub,
        {
          title: 'ICS Academy — Notifications Active',
          body: `Real-time alerts are active for ${sub.actorName}${sub.className ? ` (${sub.className})` : ''}.`,
          href: '#notices',
          tag: `ics-test-${Date.now()}`,
          notificationId: `test_${Date.now()}`,
          type: 'test',
          requireInteraction: false,
        },
        'high',
        120,
      )
      res.status(200).json({ ok: delivered })
      return
    }

    res.status(400).json({ error: 'Unknown push action.' })
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Web push request failed.',
    })
  }
}
