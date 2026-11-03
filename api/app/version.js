export default async function handler(req, res) {
  const origin = req.headers?.origin || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  let version = '1.0.19'
  let buildNumber = 19
  let publishedAt = new Date().toISOString()

  try {
    const ghRes = await fetch(
      'https://api.github.com/repos/sinanedayur85-prog/ics-academy-portal/releases/tags/latest-apk',
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'ics-academy-portal',
        },
      },
    )
    if (ghRes.ok) {
      const releaseData = await ghRes.json()
      const bodyText = releaseData?.body || ''
      const buildMatch = bodyText.match(/Build\s*#(\d+)/i)
      const versionMatch = bodyText.match(/Version:\s*([0-9.]+)/i)
      if (buildMatch) {
        buildNumber = Number(buildMatch[1])
        version = versionMatch ? versionMatch[1] : `1.0.${buildNumber}`
        publishedAt = releaseData?.published_at || publishedAt
      }
    }
  } catch {
    // Use fallback version
  }

  res.status(200).json({
    version,
    buildNumber,
    publishedAt,
  })
}
