// Helper functions for VAPID token generation and push sending
function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function createVapidToken(audience, privateJwk) {
  const header  = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: 'mailto:john@dondlingergc.com' };
  const enc = (o) => base64UrlEncode(new TextEncoder().encode(JSON.stringify(o)));
  const dataToSign = new TextEncoder().encode(`${enc(header)}.${enc(payload)}`);
  const key = await crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: { name: 'SHA-256' } }, key, dataToSign);
  return `${enc(header)}.${enc(payload)}.${base64UrlEncode(sig)}`;
}

async function pushToAll(env, title, body, preferenceColumn = null) {
  console.log(`[cron] PUSH: ${title} | ${body}`);
  await env.waz_analytics.prepare('INSERT INTO notifications (title, message, timestamp) VALUES (?, ?, ?)').bind(title, body, Date.now()).run();
  
  let query = 'SELECT endpoint FROM subscriptions';
  if (preferenceColumn === 'preferences_weather' || preferenceColumn === 'preferences_river' || preferenceColumn === 'preferences_aqi') {
    query += ` WHERE ${preferenceColumn} = 1`;
  }
  
  const { results: subs } = await env.waz_analytics.prepare(query).all();
  if (!subs?.length) return;
  
  const vapidPub = env.VAPID_PUBLIC_KEY || "BMb36GOhjyJJzODjpDxXhmv7PZxyR-e2miXbuOakZESk83z-TgtgobvOXYIWGkgaDTREY9A5XcaXDTBfWQToHOM";
  let privateJwk;
  try {
    privateJwk = JSON.parse(env.VAPID_PRIVATE_KEY);
  } catch (e) {
    console.error('[cron] Bad or missing VAPID private key:', e.message);
    return;
  }
  
  await Promise.all(subs.map(async (row) => {
    try {
      const url = new URL(row.endpoint);
      const vapidToken = await createVapidToken(`${url.protocol}//${url.host}`, privateJwk);
      const res = await fetch(row.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `vapid t=${vapidToken}, k=${vapidPub}`,
          'TTL': '86400',
          'Content-Length': '0'
        },
      });
      if (res.status === 410 || res.status === 404) {
        await env.waz_analytics.prepare('DELETE FROM subscriptions WHERE endpoint = ?').bind(row.endpoint).run();
      }
    } catch (e) {
      console.error('[cron] push failed:', e.message);
    }
  }));
}

// State helpers (using D1 database instead of KV)
async function readState(env) {
  try {
    const row = await env.waz_analytics.prepare('SELECT val FROM cron_state WHERE key = ?').bind('state').first();
    return row ? JSON.parse(row.val) : {};
  } catch (e) {
    return {};
  }
}

async function writeState(env, s) {
  await env.waz_analytics.prepare('INSERT OR REPLACE INTO cron_state (key, val) VALUES (?, ?)')
    .bind('state', JSON.stringify(s))
    .run();
}

async function generateAlert(env, context) {
  if (!env.AI) return context;
  try {
    const resp = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: `You write push notification alerts for a Lake Wazeecha weather app. Tone: direct, casual. One sentence max.`
        },
        {
          role: 'user',
          content: `Write a push notification for this situation: ${context}`
        }
      ],
      max_tokens: 80,
    });
    return resp?.response?.trim() || context;
  } catch (e) {
    return context;
  }
}

function isEscalating(history = [], currentValue, threshold = 1.1) {
  if (history.length < 2) return true;
  const avg = history.reduce((a, b) => a + b, 0) / history.length;
  return currentValue >= avg * threshold;
}

function pushHistory(history = [], value, maxLen = 4) {
  const updated = [...history, value];
  return updated.slice(-maxLen);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Extract Edge Data
    const cf = request.cf || {};
    const client_ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const user_agent = request.headers.get('user-agent') || 'unknown';
    const origin = request.headers.get('Origin');
    
    // Setup strict CORS matching wazweather and dondlingergc domains
    let allowedOrigin = 'https://wazweather.dondlingergc.com';
    if (origin && (
        origin === 'https://wazweather.dondlingergc.com' ||
        origin === 'https://dondlingergc.com' ||
        origin.endsWith('.dondlingergc.com') ||
        origin.startsWith('http://localhost')
    )) {
      allowedOrigin = origin;
    }
    
    const CORS_HEADERS = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };

    if (url.pathname === '/subscribe') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }
      if (request.method === 'POST') {
        try {
          const body = await request.json();
          const { endpoint, keys, preferences } = body;
          
          if (!endpoint || !keys || !keys.p256dh || !keys.auth || !preferences) {
            return new Response(JSON.stringify({ error: 'Invalid subscription object' }), { status: 400, headers: CORS_HEADERS });
          }

          let endpointUrl;
          try {
            endpointUrl = new URL(endpoint);
          } catch (e) {
            return new Response(JSON.stringify({ error: 'Invalid endpoint URL' }), { status: 400, headers: CORS_HEADERS });
          }

          const pref_river = preferences.river ? 1 : 0;
          const pref_aqi = preferences.aqi ? 1 : 0;
          const pref_weather = preferences.weather ? 1 : 0;
          const timestamp = new Date().toISOString();

          await env.waz_analytics.prepare(`
            INSERT INTO subscriptions (endpoint, p256dh, auth, preferences_river, preferences_aqi, preferences_weather, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(endpoint) DO UPDATE SET
              p256dh = excluded.p256dh,
              auth = excluded.auth,
              preferences_river = excluded.preferences_river,
              preferences_aqi = excluded.preferences_aqi,
              preferences_weather = excluded.preferences_weather,
              created_at = excluded.created_at
          `).bind(endpoint, keys.p256dh, keys.auth, pref_river, pref_aqi, pref_weather, timestamp).run();

          return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS_HEADERS });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS_HEADERS });
        }
      }
    }

    if (url.pathname === '/unsubscribe') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }
      if (request.method === 'POST') {
        try {
          const body = await request.json();
          const endpoint = body?.endpoint;
          const auth = body?.keys?.auth ?? body?.auth;

          if (!endpoint || !auth) {
            return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400, headers: CORS_HEADERS });
          }

          const stored = await env.waz_analytics.prepare('SELECT auth FROM subscriptions WHERE endpoint = ?').bind(endpoint).first();
          if (!stored) {
            return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS_HEADERS });
          }

          if (stored.auth !== auth) {
            return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: CORS_HEADERS });
          }

          await env.waz_analytics.prepare('DELETE FROM subscriptions WHERE endpoint = ?').bind(endpoint).run();
          return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS_HEADERS });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS_HEADERS });
        }
      }
    }

    if (url.pathname === '/api/latest-notification') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }
      if (request.method === 'GET') {
        try {
          const { results } = await env.waz_analytics.prepare('SELECT title, message as body, link, timestamp FROM notifications ORDER BY id DESC LIMIT 1').all();
          if (!results || results.length === 0) {
            return new Response(JSON.stringify({ title: 'Update', body: 'New data available' }), { status: 200, headers: CORS_HEADERS });
          }
          return new Response(JSON.stringify(results[0]), { status: 200, headers: CORS_HEADERS });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS_HEADERS });
        }
      }
    }
    
    if (url.pathname === '/api/broadcast') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }
      if (request.method === 'POST') {
        const auth = request.headers.get('Authorization');
        if (!env.SHARED_SECRET || auth !== env.SHARED_SECRET) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS });
        }
        try {
          const body = await request.json();
          const { title, body: message, link } = body;
          
          if (!title || !message) {
            return new Response(JSON.stringify({ error: 'Missing title or body' }), { status: 400, headers: CORS_HEADERS });
          }
          
          await env.waz_analytics.prepare('INSERT INTO notifications (title, message, link, timestamp) VALUES (?, ?, ?, ?)').bind(title, message, link || null, Date.now()).run();
          
          const { results: subs } = await env.waz_analytics.prepare('SELECT endpoint FROM subscriptions').all();
          if (!subs?.length) {
             return new Response(JSON.stringify({ success: true, count: 0 }), { status: 200, headers: CORS_HEADERS });
          }
          
          const vapidPub = env.VAPID_PUBLIC_KEY || "BMb36GOhjyJJzODjpDxXhmv7PZxyR-e2miXbuOakZESk83z-TgtgobvOXYIWGkgaDTREY9A5XcaXDTBfWQToHOM";
          let privateJwk;
          try {
            privateJwk = JSON.parse(env.VAPID_PRIVATE_KEY);
          } catch (e) {
            return new Response(JSON.stringify({ error: 'Bad VAPID key' }), { status: 500, headers: CORS_HEADERS });
          }
          
          let sent = 0;
          await Promise.allSettled(subs.map(async (row) => {
            const url = new URL(row.endpoint);
            const vapidToken = await createVapidToken(`${url.protocol}//${url.host}`, privateJwk);
            const res = await fetch(row.endpoint, {
              method: 'POST',
              headers: {
                'Authorization': `vapid t=${vapidToken}, k=${vapidPub}`,
                'TTL': '86400',
                'Content-Length': '0'
              },
            });
            if (res.status === 410 || res.status === 404) {
              await env.waz_analytics.prepare('DELETE FROM subscriptions WHERE endpoint = ?').bind(row.endpoint).run();
            } else if (res.ok) {
              sent++;
            }
          }));
          
          return new Response(JSON.stringify({ success: true, count: sent }), { status: 200, headers: CORS_HEADERS });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS_HEADERS });
        }
      }
    }
    
    if (url.pathname === '/api/analytics') {
      if (request.method === 'POST') {
        try {
          const payload = await request.json();
          const timestamp = new Date().toISOString();
          
          await env.waz_analytics.prepare(`
            INSERT INTO analytics (
              timestamp, endpoint, latency_ms, status_code, 
              client_ip, cf_city, cf_region, cf_country, cf_postal_code, 
              cf_latitude, cf_longitude, cf_asn, cf_as_organization, cf_bot_score, cf_device_type,
              user_agent, connection_type, pwa_installed, 
              event_type, web_vitals_ttfb, web_vitals_fcp, web_vitals_cls, user_uuid
            ) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            timestamp, 
            payload.endpoint || null, 
            payload.latency_ms || null, 
            payload.status_code || null, 
            client_ip, 
            cf.city || null, 
            cf.region || null, 
            cf.country || null, 
            cf.postalCode || null, 
            cf.latitude || null, 
            cf.longitude || null, 
            cf.asn || null, 
            cf.asOrganization || null, 
            cf.botManagement?.score || null, 
            cf.clientTcpRtt ? 'unknown' : 'unknown', 
            user_agent, 
            payload.connection_type || null, 
            payload.pwa_installed ? 1 : 0, 
            payload.event_type || 'api_fetch', 
            payload.web_vitals_ttfb || null, 
            payload.web_vitals_fcp || null, 
            payload.web_vitals_cls || null,
            payload.user_uuid || null
          ).run();
          
          return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
      } else if (request.method === 'GET') {
        try {
          const { results } = await env.waz_analytics.prepare(`
            SELECT * FROM analytics ORDER BY timestamp DESC LIMIT 50
          `).all();
          
          return new Response(JSON.stringify(results), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
      }
    }

    if (url.pathname === '/telemetry') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }
      if (request.method === 'POST') {
        try {
          const payload = await request.json();
          await env.waz_analytics.prepare(`
            INSERT OR REPLACE INTO cron_state (key, val) VALUES (?, ?)
          `).bind('latest_forecast', JSON.stringify(payload)).run();
          return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS_HEADERS });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS_HEADERS });
        }
      } else if (request.method === 'GET') {
        try {
          const row = await env.waz_analytics.prepare(`
            SELECT val FROM cron_state WHERE key = ?
          `).bind('latest_forecast').first();
          const latest_forecast = row ? JSON.parse(row.val) : null;
          return new Response(JSON.stringify({ latest_forecast }), {
            status: 200,
            headers: CORS_HEADERS
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS_HEADERS });
        }
      }
    }

    if (url.pathname === '/api/preferences') {
      if (request.method === 'GET') {
        try {
          const uuid = url.searchParams.get('uuid');
          if (!uuid) return new Response(JSON.stringify({ error: 'Missing uuid' }), { status: 400 });
          
          const { results } = await env.waz_analytics.prepare(`
            SELECT * FROM user_preferences WHERE user_uuid = ?
          `).bind(uuid).all();
          
          return new Response(JSON.stringify(results[0] || {}), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
      } else if (request.method === 'POST') {
        try {
          const payload = await request.json();
          const timestamp = new Date().toISOString();
          
          if (!payload.user_uuid) {
             return new Response(JSON.stringify({ error: 'Missing user_uuid' }), { status: 400 });
          }

          // Use INSERT ON CONFLICT DO UPDATE (UPSERT)
          await env.waz_analytics.prepare(`
            INSERT INTO user_preferences (user_uuid, username, default_zip, temp_units, theme_preference, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_uuid) DO UPDATE SET
              username = excluded.username,
              default_zip = excluded.default_zip,
              temp_units = excluded.temp_units,
              theme_preference = excluded.theme_preference,
              updated_at = excluded.updated_at
          `).bind(
            payload.user_uuid,
            payload.username || null,
            payload.default_zip || null,
            payload.temp_units || null,
            payload.theme_preference || null,
            timestamp
          ).run();
          
          return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
          if (e.message && e.message.includes('UNIQUE constraint failed')) {
            return new Response(JSON.stringify({ error: 'Username already taken' }), { status: 409 });
          }
          return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
      }
    }

    if (url.pathname === '/check-weather') {
      const providedSecret = request.headers.get('X-Cron-Secret');
      if (env.CRON_SECRET && providedSecret !== env.CRON_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
      }
      ctx.waitUntil(runChecks(env));
      return new Response(JSON.stringify({ ok: true, triggered: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runChecks(env));
  }
};

async function runChecks(env) {
  const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=44.3936&longitude=-89.8173&current=temperature_2m,precipitation,weather_code,wind_gusts_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=America%2FChicago&wind_speed_unit=mph&precipitation_unit=inch&temperature_unit=fahrenheit';
  const USGS_URL    = 'https://waterservices.usgs.gov/nwis/iv/?format=json&sites=05400760&parameterCd=00060,00065&siteStatus=all';
  const NWS_URL     = 'https://api.weather.gov/alerts/active?point=44.3936,-89.8173';

  const NWS_COOLDOWNS = {
    'Tornado Warning':              6 * 60 * 60 * 1000, // 6 hours
    'Tornado Watch':                15 * 60 * 1000,
    'Severe Thunderstorm Warning':  6 * 60 * 60 * 1000, // 6 hours
    'Severe Thunderstorm Watch':    15 * 60 * 1000,
    'Flash Flood Warning':          6 * 60 * 60 * 1000, // 6 hours
    'Flash Flood Watch':            15 * 60 * 1000,
    'Winter Storm Warning':         6 * 60 * 60 * 1000, // 6 hours
    'Winter Storm Watch':           60 * 60 * 1000,
    'Special Weather Statement':    15 * 60 * 1000,
    'Heat Advisory':                6 * 60 * 60 * 1000, // 6 hours
    'Excessive Heat Warning':       6 * 60 * 60 * 1000, // 6 hours
  };
  const DEFAULT_NWS_COOLDOWN = 12 * 60 * 60 * 1000; // 12 hours

  try {
    const [weatherRes, usgsRes, nwsRes] = await Promise.all([
      fetch(WEATHER_URL),
      fetch(USGS_URL).catch(() => null),
      fetch(NWS_URL, { headers: { 'User-Agent': 'wazweather-worker (contact@dondlingergc.com)' } }).catch(() => null),
    ]);

    const weather = await weatherRes.json();
    const usgs = usgsRes ? await usgsRes.json().catch(() => null) : null;
    const nws = nwsRes ? await nwsRes.json().catch(() => null) : null;

    const current = weather?.current;
    const daily   = weather?.daily;
    if (!current || !daily) { console.error('[cron] No weather data'); return; }

    const state = await readState(env);
    const [todayDate, timePart] = current.time.split('T');
    const localHour = parseInt(timePart.split(':')[0], 10);
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;

    // 1. NWS Alerts
    if (nws?.features) {
      if (!state.sent_nws_alerts) state.sent_nws_alerts = {};
      for (const feature of nws.features) {
        const props   = feature.properties;
        const alertId = props.id || feature.id;
        if (!alertId) continue;
        const expires = props.expires ? new Date(props.expires).getTime() : now + ONE_HOUR;
        const cooldown = NWS_COOLDOWNS[props.event] ?? DEFAULT_NWS_COOLDOWN;
        const lastSent = state.sent_nws_alerts[alertId]?.sent || 0;
        if (now - lastSent < cooldown) continue;

        const raw = `NWS issued a ${props.event} for Wood County / Lake Wazeecha area. ${props.headline || ''}`.trim();
        const body = await generateAlert(env, raw);
        await pushToAll(env, `⚠️ ${props.event}`, body, 'preferences_weather');
        state.sent_nws_alerts[alertId] = { sent: now, expires };
      }
      for (const id of Object.keys(state.sent_nws_alerts)) {
        if (state.sent_nws_alerts[id].expires < now) delete state.sent_nws_alerts[id];
      }
    }

    // 2. Daily Forecast
    if (localHour >= 7 && state.daily_forecast_sent_date !== todayDate) {
      const raw = `Today at Lake Wazeecha: high of ${daily.temperature_2m_max[0]}°F, low ${daily.temperature_2m_min[0]}°F, ${daily.precipitation_sum[0]} inches rain expected.`;
      const body = await generateAlert(env, raw);
      await pushToAll(env, '🌤️ Morning Forecast', body, 'preferences_weather');
      state.daily_forecast_sent_date = todayDate;
    }

    // 3. Rain Start/Stop
    const isRaining = current.precipitation > 0;
    if (!state.rain_history) state.rain_history = [];
    state.rain_history = pushHistory(state.rain_history, current.precipitation);

    const RAIN_COOLDOWN = 15 * 60 * 1000;
    if (isRaining && !state.is_raining && (now - (state.last_rain_start || 0)) > RAIN_COOLDOWN) {
      const raw = `Rain just started at Lake Wazeecha. Current: ${current.precipitation} inches in last 15 min.`;
      const body = await generateAlert(env, raw);
      await pushToAll(env, '🌧️ Rain Started', body, 'preferences_weather');
      state.is_raining = true;
      state.last_rain_start = now;
    } else if (!isRaining && state.is_raining && (now - (state.last_rain_stop || 0)) > RAIN_COOLDOWN) {
      const body = await generateAlert(env, 'Rain has stopped at Lake Wazeecha. Radar looks clear for now.');
      await pushToAll(env, '🌤️ Rain Stopped', body, 'preferences_weather');
      state.is_raining = false;
      state.last_rain_stop = now;
    }

    // 4. Thunderstorms
    const isThunderstorm = current.weather_code >= 95;
    const THUNDERSTORM_COOLDOWN = 30 * 60 * 1000;
    if (isThunderstorm && !state.is_thunderstorm) {
      const raw = `Severe thunderstorms detected at Lake Wazeecha. Secure the site.`;
      const body = await generateAlert(env, raw);
      await pushToAll(env, '⚡ Thunderstorm Alert', body, 'preferences_weather');
      state.is_thunderstorm = true;
      state.last_thunderstorm_alert = now;
    } else if (!isThunderstorm && state.is_thunderstorm) {
      state.is_thunderstorm = false;
    } else if (isThunderstorm && state.is_thunderstorm && (now - (state.last_thunderstorm_alert || 0)) > THUNDERSTORM_COOLDOWN) {
      const raw = `Thunderstorms continue at Lake Wazeecha. Wind gusts are ${current.wind_gusts_10m} mph.`;
      const body = await generateAlert(env, raw);
      await pushToAll(env, '⚡ Thunderstorm Update', body, 'preferences_weather');
      state.last_thunderstorm_alert = now;
    }

    // 5. Wind Gusts
    const wind = current.wind_gusts_10m;
    if (state.wind_date !== todayDate) { state.wind_date = todayDate; state.highest_wind_gust_seen_today = 0; state.wind_history = []; }
    if (!state.wind_history) state.wind_history = [];
    state.wind_history = pushHistory(state.wind_history, wind);
    const highestGust = state.highest_wind_gust_seen_today || 0;
    let windThreshold = null;
    if (wind >= 50 && highestGust < 50) windThreshold = 50;
    else if (wind >= 35 && highestGust < 35) windThreshold = 35;
    else if (wind >= 25 && highestGust < 25) windThreshold = 25;
    else if (wind >= 15 && highestGust < 15) windThreshold = 15;

    if (windThreshold && isEscalating(state.wind_history, wind)) {
      const raw = `Wind gusts hitting ${wind}mph at Lake Wazeecha and escalating.`;
      const body = await generateAlert(env, raw);
      await pushToAll(env, '💨 High Winds', body, 'preferences_weather');
      state.highest_wind_gust_seen_today = Math.max(highestGust, wind);
    }

    // 6. River Alert
    if (usgs?.value?.timeSeries) {
      let discharge = null, gauge = null;
      for (const ts of usgs.value.timeSeries) {
        const code = ts.variable.variableCode[0].value;
        const vals = ts.values[0].value;
        if (vals?.length) {
          const v = parseFloat(vals[vals.length - 1].value);
          if (code === '00060') discharge = v;
          if (code === '00065') gauge = v;
        }
      }
      if (discharge > 10000 && state.last_high_discharge_alert !== todayDate) {
        const body = await generateAlert(env, `Wisconsin River discharge is critically high at ${discharge} cfs. Flood risk elevated.`);
        await pushToAll(env, '🌊 River Alert', body, 'preferences_river');
        state.last_high_discharge_alert = todayDate;
      }
      if (gauge > 15 && state.last_high_gauge_alert !== todayDate) {
        const body = await generateAlert(env, `Wisconsin River gauge height at ${gauge} ft — critically high. Watch the banks.`);
        await pushToAll(env, '🌊 River Gauge Critical', body, 'preferences_river');
        state.last_high_gauge_alert = todayDate;
      }
    }

    await writeState(env, state);

    // Prune notifications older than 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    await env.waz_analytics.prepare('DELETE FROM notifications WHERE timestamp < ?').bind(thirtyDaysAgo).run();

    console.log('[cron] Done.');
  } catch (err) {
    console.error('[cron] Fatal:', err);
  }
}
