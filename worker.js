export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Extract Edge Data
    const cf = request.cf || {};
    const client_ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const user_agent = request.headers.get('user-agent') || 'unknown';
    
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

    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    const WEATHER_APIS = ["https://api.weather.gov/"];
    
    for (const api of WEATHER_APIS) {
      const start = Date.now();
      let status = 500;
      
      try {
        const res = await fetch(api, {
          headers: { 'User-Agent': 'WazWeather Edge Worker' }
        });
        status = res.status;
      } catch (e) {
        console.error(`Failed to poll ${api}:`, e);
      }
      
      const latency = Date.now() - start;
      const timestamp = new Date().toISOString();
      
      ctx.waitUntil(
        env.waz_analytics.prepare(`
          INSERT INTO analytics (
            timestamp, endpoint, latency_ms, status_code, client_ip, event_type, user_uuid
          ) 
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(timestamp, api, latency, status, 'cron', 'background_poll', 'system').run()
      );
    }
  }
};
