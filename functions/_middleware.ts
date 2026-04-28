import { detectBot } from './_bot-detection';

/**
 * Cloudflare Pages Functions middleware that runs on every request to the
 * static site. Detects bot user agents and forwards a fire-and-forget
 * {bot, path} ping to the Worker's /api/internal/track-bot route, where
 * it lands in the same in-memory buffer that powers /api/agents/activity
 * and the /agent-traffic dashboard.
 *
 * This closes the coverage gap where editorial / SEO Pages routes
 * (/originals/*, /api-reference/*, /for-ai-agents, /models/*, etc) were
 * invisible to bot tracking because Cloudflare Pages serves them, not
 * the Worker.
 *
 * Setup: PAGES_TRACK_SECRET must be set as a Pages environment variable
 * in the Cloudflare dashboard (Pages → tensorfeed → Settings →
 * Environment variables, encrypted) to the same value as the Worker's
 * PAGES_TRACK_SECRET. Without it, the middleware no-ops and serves
 * pages normally.
 *
 * Cost: zero KV ops (the Worker buffers in-memory and flushes in
 * batches). One internal edge-to-edge fetch per detected bot hit, fired
 * via context.waitUntil so it never delays the user response.
 */

interface Env {
  PAGES_TRACK_SECRET?: string;
}

const TRACK_URL = 'https://tensorfeed.ai/api/internal/track-bot';

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;

  let trackingStatus = 'no-bot';

  try {
    const ua = request.headers.get('user-agent') || '';
    const bot = detectBot(ua);

    if (bot) {
      trackingStatus = `bot:${bot}`;
      if (!env.PAGES_TRACK_SECRET) {
        trackingStatus = `bot:${bot}:no-secret`;
      } else {
        const url = new URL(request.url);
        const pathname = url.pathname;
        const isWorkerPath =
          pathname.startsWith('/api/') ||
          pathname.startsWith('/feed.') ||
          pathname.startsWith('/feed/') ||
          pathname === '/llms.txt' ||
          pathname === '/llms-full.txt';

        if (isWorkerPath) {
          trackingStatus = `bot:${bot}:skipped-worker-path`;
        } else {
          // Diagnostic mode: AWAIT the fetch so we can capture the
          // status code into the response header. Will revert to
          // waitUntil (fire-and-forget) once verified.
          try {
            const r = await fetch(TRACK_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Internal-Auth': env.PAGES_TRACK_SECRET,
                'User-Agent': 'TensorFeed-Pages-Track/1.0',
              },
              body: JSON.stringify({ bot, path: pathname }),
            });
            trackingStatus = `bot:${bot}:fetch:${r.status}`;
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'unknown';
            trackingStatus = `bot:${bot}:fetch-err:${msg.slice(0, 40)}`;
          }
        }
      }
    }
  } catch {
    trackingStatus = 'middleware-error';
  }

  const response = await next();
  response.headers.set('X-Pages-Middleware', 'active');
  response.headers.set('X-Pages-Track', trackingStatus);
  return response;
};
