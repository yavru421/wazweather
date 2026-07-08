(function() {
  'use strict';
  var LAT = 44.3936, LON = -89.8173;
  // Parse URL parameters if present
  var urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('lat') && urlParams.has('lon')) {
    LAT = parseFloat(urlParams.get('lat'));
    LON = parseFloat(urlParams.get('lon'));
  }

  var WX_URL, USGS_URL, NWS_URL, AQI_URL;

  function updateUrls(lat, lon) {
    LAT = lat;
    LON = lon;
    WX_URL = 'https://api.open-meteo.com/v1/forecast?latitude='+LAT+'&longitude='+LON+
      '&hourly=temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,precipitation_probability,precipitation,weather_code,uv_index,relative_humidity_2m,pressure_msl'+
      '&daily=sunrise,sunset,uv_index_max,precipitation_probability_max,wind_gusts_10m_max,weather_code,precipitation_sum,temperature_2m_max,temperature_2m_min'+
      '&forecast_days=7&timezone=America%2FChicago&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch';
    USGS_URL = 'https://waterservices.usgs.gov/nwis/iv/?sites=05395000&parameterCd=00060,00065&format=json&period=P7D';
    NWS_URL  = 'https://api.weather.gov/alerts/active?point='+LAT+','+LON;
    AQI_URL  = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude='+LAT+'&longitude='+LON+'&current=us_aqi,uv_index';
  }
  updateUrls(LAT, LON);

  var persona = 'lake';
  var wxCache = null;
  var usgsCache = null;
  var hudMode = 'foreman';
  var countdownInterval = null;
  var rainArrivalTime = null;
  var radarWorker = null;

  function el(id){ return document.getElementById(id); }
  function setText(id, v){ var e=el(id); if(e) e.textContent=v; }

  /* Clock */
  function tickClock(){ setText('waz-clock', new Date().toLocaleTimeString('en-US',{hour12:false})); }
  setInterval(tickClock, 1000); tickClock();

  /* Dot sync */
  var container = el('wazeecha-telemetry');
  var dots = document.querySelectorAll('.waz-dot');
  function updateDots(){
    if(!container) return;
    var idx = Math.round(container.scrollLeft / window.innerWidth);
    dots.forEach(function(d,i){ d.classList.toggle('active', i===idx); });
  }
  if(container) container.addEventListener('scroll', updateDots, {passive:true});

  /* Utilities */
  function degToCardinal(d){ return ['N','NE','E','SE','S','SW','W','NW'][Math.round(d/45)%8]||'--'; }
  function relTime(ts){ var d=Date.now()-ts; if(d<60000) return 'just now'; if(d<3600000) return Math.floor(d/60000)+'m ago'; return Math.floor(d/3600000)+'h ago'; }
  function wCode(c){
    if(c<=1)  return {emoji:'☀️', label:'Clear',       color:'#ffb300'};
    if(c<=3)  return {emoji:'⛅', label:'Partly Cloudy',color:'#98989d'};
    if(c<=48) return {emoji:'🌫️', label:'Foggy',        color:'#6b7280'};
    if(c<=67) return {emoji:'🌧️', label:'Rain',         color:'#0a84ff'};
    if(c<=77) return {emoji:'❄️', label:'Snow',         color:'#bfdbfe'};
    if(c<=82) return {emoji:'🌦️', label:'Showers',      color:'#0a84ff'};
    if(c<=99) return {emoji:'⛈️', label:'Thunderstorm', color:'#ef4444'};
    return {emoji:'🌡️', label:'Unknown', color:'#98989d'};
  }
  function dayName(dateStr, i){
    if(i===0) return 'Today';
    if(i===1) return 'Tmrw';
    return new Date(dateStr+'T12:00:00').toLocaleDateString([],{weekday:'short'});
  }

  /* Persona */
  window.wazSetPersona = function(p){
    persona = p;
    document.querySelectorAll('.ri-persona-btn').forEach(function(b){ b.classList.toggle('active', b.dataset.persona===p); });
    if(wxCache) renderRainIntel(wxCache);
  };

  window.shareForemanDiagnostics = function() {
    var pStatus = el('foreman-pour-status') ? el('foreman-pour-status').textContent : '--';
    var pDetails = el('foreman-pour-details') ? el('foreman-pour-details').textContent : '--';
    var rStatus = el('foreman-roofing-status') ? el('foreman-roofing-status').textContent : '--';
    var rDetails = el('foreman-roofing-details') ? el('foreman-roofing-details').textContent : '--';

    var canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    var ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

    ctx.fillStyle = '#f97316';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('🏗️ JOBSITE FOREMAN DIAGNOSTICS', 30, 50);

    ctx.fillStyle = '#98989d';
    ctx.font = '14px monospace';
    ctx.fillText('Time: ' + new Date().toLocaleString(), 30, 80);
    ctx.fillText('Location: ' + LAT.toFixed(4) + ', ' + LON.toFixed(4), 30, 100);

    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(30, 120); ctx.lineTo(570, 120); ctx.stroke();

    ctx.fillStyle = '#fffffffff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('POUR READY INDEX:', 30, 160);

    ctx.fillStyle = pStatus.includes('SAFE') || pStatus === 'OPTIMAL' ? '#39FF14' : '#ef4444';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(pStatus, 450, 160);

    ctx.fillStyle = '#d1d5db';
    ctx.font = '14px monospace';
    ctx.fillText(pDetails, 30, 190);

    ctx.beginPath(); ctx.moveTo(30, 220); ctx.lineTo(570, 220); ctx.stroke();

    ctx.fillStyle = '#fffffffff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('ROOFING & SIDING SAFETY:', 30, 260);

    ctx.fillStyle = rStatus.includes('SAFE') ? '#39FF14' : '#ef4444';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(rStatus, 450, 260);

    ctx.fillStyle = '#d1d5db';
    ctx.font = '14px monospace';
    ctx.fillText(rDetails, 30, 290);

    ctx.fillStyle = '#6b7280';
    ctx.font = '12px monospace';
    ctx.fillText('WaZWeather ZLA Kinematic Forecasting Engine', 30, 360);

    canvas.toBlob(function(blob) {
      if (!blob) return;
      var file = new File([blob], 'foreman-diagnostics.png', { type: 'image/png' });
      var shareData = {
        title: 'WaZWeather Jobsite Diagnostics',
        text: 'Live weather diagnostic report for coordinates ' + LAT.toFixed(4) + ', ' + LON.toFixed(4),
        url: window.location.origin + window.location.pathname + '?lat=' + LAT + '&lon=' + LON,
        files: [file]
      };
      if (navigator.canShare && navigator.canShare(shareData)) {
        navigator.share(shareData).catch(function(err) {
          console.warn('[ZLA] Web Share failed:', err);
        });
      } else {
        navigator.clipboard.writeText(shareData.url);
        alert('Web Share not supported. Location URL copied to clipboard!');
      }
    }, 'image/png');
  };

  window.setWazMode = function(m){
    hudMode = m;
    localStorage.setItem('waz_hud_mode', m);
    var btnForeman = el('mode-btn-foreman');
    var btnOutdoorsman = el('mode-btn-outdoorsman');
    if(btnForeman) btnForeman.classList.toggle('active', m === 'foreman');
    if(btnOutdoorsman) btnOutdoorsman.classList.toggle('active', m === 'outdoorsman');
    var cardForeman = el('hud-foreman-card');
    var cardOutdoorsman = el('hud-outdoorsman-card');
    if(cardForeman) cardForeman.style.display = m === 'foreman' ? 'block' : 'none';
    if(cardOutdoorsman) cardOutdoorsman.style.display = m === 'outdoorsman' ? 'block' : 'none';
    updateHudStats();
  };

  
  // Generate Smart Recommendations
  function generateRecommendations(h) {
    if(!h || !h.temperature_2m) return;
    var container = el('waz-smart-insights-container');
    if(!container) return;
    
    var now = new Date();
    var curHr = 0;
    for(var i=0; i<h.time.length; i++){
      if(new Date(h.time[i]) <= now) curHr = i;
      else break;
    }
    
    var insights = [];
    
    // 1. The "Bring It" Metric
    var rainRisk = false;
    for(var i=curHr; i<curHr+6; i++){
        if(h.precipitation_probability[i] > 40) {
            rainRisk = true; break;
        }
    }
    if(rainRisk) {
        insights.push({title: '☔ Precipitation Risk', text: 'Grab an umbrella or rain shell before you head out. Rain likely in the next 6 hours.'});
    }
    
    // 2. The "Window" Metric
    var windowFound = false;
    for(var i=curHr; i<curHr+12; i++){
        if(h.precipitation_probability[i] === 0 && h.weather_code[i] <= 3) {
            var startHr = new Date(h.time[i]).getHours();
            var ampm = startHr >= 12 ? 'PM' : 'AM';
            var hr12 = startHr % 12 || 12;
            insights.push({title: '🌤️ Perfect Window', text: 'Perfect window for outdoor activities/walks around ' + hr12 + ' ' + ampm + '.'});
            windowFound = true;
            break;
        }
    }
    
    // 3. The "Layer" Metric
    var tCur = h.temperature_2m[curHr];
    var tEve = null;
    for(var i=curHr; i<curHr+12; i++){
        var d = new Date(h.time[i]);
        if(d.getHours() >= 18) {
            tEve = h.temperature_2m[i]; break;
        }
    }
    if(tCur > 70 && tEve && tEve < 55) {
        insights.push({title: '🧥 Layer Up', text: 'Warm afternoon, but it\'s going to get chilly fast after sunset. Pack a light jacket.'});
    }
    
    // 4. The "Car Window" Metric
    if(h.precipitation_probability[curHr] > 50 || h.precipitation_probability[curHr+1] > 50) {
        insights.push({title: '🚗 Sudden Shower', text: 'Rain approaching soon. Make sure car windows are rolled up!'});
    }
    
    if(insights.length === 0) {
        insights.push({title: '✨ All Clear', text: 'Conditions look great. Enjoy the day!'});
    }
    
    var html = '';
    insights.forEach(function(ins) {
        html += '<div class="ri-advice" style="margin-bottom: 15px;"><div class="ri-advice-lbl" style="color:#0a84ff; font-size:0.75rem; font-weight:700; margin-bottom:5px;">' + ins.title + '</div><div style="color:#ffffff; font-size:1.1rem; line-height:1.4; font-weight:500;">' + ins.text + '</div></div>';
    });
    container.innerHTML = html;
  }
\n\n  function updateHudStats(){
    if(!wxCache) return;
    try {
      var h = wxCache.hourly || {};
      var now = new Date();
      var times = h.time || [];
      var curHr = 0;
      for(var i=0; i<times.length; i++){
        if(new Date(times[i]) <= now) curHr = i;
        else break;
      }
      
      var t = (h.temperature_2m && h.temperature_2m[curHr]!=null) ? h.temperature_2m[curHr] : null;
      var rh = (h.relative_humidity_2m && h.relative_humidity_2m[curHr]!=null) ? h.relative_humidity_2m[curHr] : null;
      var wind = (h.wind_speed_10m && h.wind_speed_10m[curHr]!=null) ? h.wind_speed_10m[curHr] : null;

      // Foreman Calculations
      if(t !== null && rh !== null){
        var pourStatus = "OPTIMAL";
        var pourColor = "#39FF14";
        var pourReason = "No risks detected";
        if(t < 40){
          pourStatus = "CRITICAL (FREEZING)";
          pourColor = "#ef4444";
          pourReason = "Temp too low (< 40°F)";
        } else if(t > 90){
          pourStatus = "WARNING (FLASH SET)";
          pourColor = "#ef4444";
          pourReason = "Temp too high (> 90°F)";
        } else if(rh > 85){
          pourStatus = "CAUTION (SLOW CURE)";
          pourColor = "#f97316";
          pourReason = "High humidity (> 85% RH)";
        } else if(rh < 30){
          pourStatus = "CAUTION (DRY CURING)";
          pourColor = "#ffb300";
          pourReason = "Low humidity (< 30% RH)";
        }
        var pourStatusEl = el('foreman-pour-status');
        if(pourStatusEl){ pourStatusEl.textContent = pourStatus; pourStatusEl.style.color = pourColor; }
        var pourDetailsEl = el('foreman-pour-details');
        if(pourDetailsEl){ pourDetailsEl.textContent = "Temp: " + Math.round(t) + "°F | RH: " + Math.round(rh) + "% (" + pourReason + ")"; }
      }

      if(wind !== null && t !== null){
        var roofStatus = "SAFE";
        var roofColor = "#39FF14";
        var roofReason = "Conditions clear";
        if(wind > 20){
          roofStatus = "DANGER (HIGH WIND)";
          roofColor = "#ef4444";
          roofReason = "Wind speed exceeds 20 mph";
        } else if(t < 35 || t > 95){
          roofStatus = "UNSAFE TEMP";
          roofColor = "#ef4444";
          roofReason = "Extreme temperature limit (" + Math.round(t) + "°F)";
        } else if(wind > 15){
          roofStatus = "CAUTION";
          roofColor = "#f97316";
          roofReason = "Gusty winds: " + Math.round(wind) + " mph";
        }
        var roofStatusEl = el('foreman-roofing-status');
        if(roofStatusEl){ roofStatusEl.textContent = roofStatus; roofStatusEl.style.color = roofColor; }
        var roofDetailsEl = el('foreman-roofing-details');
        if(roofDetailsEl){ roofDetailsEl.textContent = "Wind: " + Math.round(wind) + " mph | Temp: " + Math.round(t) + "°F (" + roofReason + ")"; }
      }

      // Outdoorsman Calculations
      var cfs = null;
      if (usgsCache) {
        try {
          var series = (usgsCache.value && usgsCache.value.timeSeries) || [];
          series.forEach(function(s) {
            var code = (s.variable && s.variable.variableCode && s.variable.variableCode[0]) ? s.variable.variableCode[0].value : '';
            var vals = (s.values && s.values[0] && s.values[0].value) ? s.values[0].value : [];
            if (code === '00060' && vals.length) {
              cfs = parseFloat(vals[vals.length - 1].value);
            }
          });
        } catch(e) {}
      }
      if(cfs === null) cfs = 15700; // Fallback

      var stabilityStatus = "STABLE";
      var stabilityColor = "#39FF14";
      var stabilityReason = "Normal seasonal flow";
      if(cfs > 12000){
        stabilityStatus = "TURBULENT (HIGH FLOW)";
        stabilityColor = "#ef4444";
        stabilityReason = "USGS river flow exceeds 12,000 CFS";
      } else if(cfs > 8000){
        stabilityStatus = "ELEVATED FLOW";
        stabilityColor = "#f97316";
        stabilityReason = "Strong currents: 8,000 - 12,000 CFS";
      }
      var stabStatusEl = el('outdoors-stability-status');
      if(stabStatusEl){ stabStatusEl.textContent = stabilityStatus; stabStatusEl.style.color = stabilityColor; }
      var stabDetailsEl = el('outdoors-stability-details');
      if(stabDetailsEl){ stabDetailsEl.textContent = "Flow Rate: " + cfs.toLocaleString() + " CFS (" + stabilityReason + ")"; }

      if(h.pressure_msl){
        var pCur = h.pressure_msl[curHr];
        var p3HrAgo = curHr >= 3 ? h.pressure_msl[curHr - 3] : pCur;
        var pDelta = pCur - p3HrAgo;
        var strikeStatus = "MODERATE";
        var strikeColor = "#0a84ff";
        var strikeReason = "Stable barometric pressure";
        if(pDelta < -1.5){
          strikeStatus = "PRIME STRIKE";
          strikeColor = "#39FF14";
          strikeReason = "Pressure drop of " + Math.abs(pDelta).toFixed(1) + " hPa triggers feeding";
        } else if(pDelta > 1.5){
          strikeStatus = "SLOW BITE";
          strikeColor = "#98989d";
          strikeReason = "Rising pressure: " + pDelta.toFixed(1) + " hPa";
        }
        var strikeStatusEl = el('outdoors-strike-status');
        if(strikeStatusEl){ strikeStatusEl.textContent = strikeStatus; strikeStatusEl.style.color = strikeColor; }
        var strikeDetailsEl = el('outdoors-strike-details');
        if(strikeDetailsEl){ strikeDetailsEl.textContent = "3hr Delta: " + pDelta.toFixed(1) + " hPa (" + strikeReason + ")"; }
      }
    } catch(err){ console.warn('[ZLA HUD] updateHudStats:', err); }
  }

  /* Countdown timer */
  function startCountdown(targetMs){
    rainArrivalTime = targetMs;
    if(countdownInterval) clearInterval(countdownInterval);
    function tick(){
      var rem = rainArrivalTime - Date.now();
      if(rem <= 0){
        setText('waz-countdown-main', '🌧 Rain Now');
        setText('waz-countdown-sub', 'Check the radar for current coverage');
        clearInterval(countdownInterval);
        return;
      }
      var h = Math.floor(rem/3600000);
      var m = Math.floor((rem%3600000)/60000);
      var s = Math.floor((rem%60000)/1000);
      var parts = [];
      if(h>0) parts.push(h+'h');
      parts.push(('0'+m).slice(-2)+'m');
      parts.push(('0'+s).slice(-2)+'s');
      setText('waz-countdown-main', parts.join(' '));
    }
    tick();
    countdownInterval = setInterval(tick, 1000);
  }

  /* Render Rain Intel */
  function renderRainIntel(wx){
    wxCache = wx;
    try {
      var h = wx.hourly || {}, d = wx.daily || {};
      var now = new Date();
      var times = h.time || [];
      var curHr = 0;
      for(var i=0;i<times.length;i++){ if(new Date(times[i])<=now) curHr=i; else break; }

      if (el('waz-main-temp')) el('waz-main-temp').textContent = Math.round(h.temperature_2m[curHr]) + '°';
      if (el('waz-main-desc')) el('waz-main-desc').textContent = wCode(h.weather_code[curHr]).label;
      generateRecommendations(h);

      var feelsLike = (h.apparent_temperature && h.apparent_temperature[curHr]!=null) ? Math.round(h.apparent_temperature[curHr]) : null;
      var windSpd   = (h.wind_speed_10m && h.wind_speed_10m[curHr]!=null) ? Math.round(h.wind_speed_10m[curHr]) : null;
      var windDir   = (h.wind_direction_10m && h.wind_direction_10m[curHr]!=null) ? degToCardinal(h.wind_direction_10m[curHr]) : '--';
      var uvMax     = (d.uv_index_max && d.uv_index_max[0]!=null) ? d.uv_index_max[0] : null;
      var sunrise   = (d.sunrise && d.sunrise[0]) ? new Date(d.sunrise[0]).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}) : '--';
      var sunset    = (d.sunset  && d.sunset[0])  ? new Date(d.sunset[0]).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}) : '--';
      var rainProb  = h.precipitation_probability || [];
      var rainAmt   = h.precipitation || [];

      /* Stats */
      setText('waz-feels', feelsLike!==null ? feelsLike+'°' : '--°');
      setText('waz-wind',  windSpd!==null   ? windSpd+' mph' : '-- mph');
      setText('waz-wind-dir', windDir);
      if(uvMax!==null){ setText('waz-uv', uvMax.toFixed(1)); }
      setText('waz-sunrise', sunrise); setText('waz-sunset', sunset);
      setText('waz-updated', relTime(Date.now()));

      /* Today / tomorrow rain summary */
      var todayTotal = (d.precipitation_sum && d.precipitation_sum[0]!=null) ? d.precipitation_sum[0].toFixed(2) : '--';
      var todayMaxPct = (d.precipitation_probability_max && d.precipitation_probability_max[0]!=null) ? d.precipitation_probability_max[0] : '--';
      var tomorrowPct = (d.precipitation_probability_max && d.precipitation_probability_max[1]!=null) ? d.precipitation_probability_max[1] : '--';
      setText('waz-today-total', todayTotal !== '--' ? todayTotal+'"' : '--"');
      setText('waz-today-max-pct', todayMaxPct !== '--' ? todayMaxPct+'%' : '--%');
      el('waz-today-max-pct') && (el('waz-today-max-pct').style.color = todayMaxPct>=60?'#ef4444':todayMaxPct>=30?'#f97316':'#0a84ff');
      setText('waz-tomorrow-rain', tomorrowPct !== '--' ? tomorrowPct+'%' : '--%');
      el('waz-tomorrow-rain') && (el('waz-tomorrow-rain').style.color = tomorrowPct>=60?'#ef4444':tomorrowPct>=30?'#f97316':'#a78bfa');

      /* 12-hour bar chart + countdown */
      var maxProb=0;
      var isRainingNow = false;
      var kiswRaw = localStorage.getItem('kisw_obs_v1');
      if(kiswRaw){
        try {
          var props = JSON.parse(kiswRaw).data || {};
          var desc = (props.textDescription || '').toLowerCase();
          if (desc.indexOf('rain') !== -1 || desc.indexOf('drizzle') !== -1 || desc.indexOf('shower') !== -1 || desc.indexOf('thunderstorm') !== -1 || desc.indexOf('precipitation') !== -1) {
            isRainingNow = true;
          }
          var pw = props.presentWeather || [];
          for (var i = 0; i < pw.length; i++) {
            var w = (pw[i].weather || '').toLowerCase();
            if (w.indexOf('rain') !== -1 || w.indexOf('drizzle') !== -1 || w.indexOf('shower') !== -1 || w.indexOf('thunderstorm') !== -1) {
              isRainingNow = true;
            }
          }
        } catch(e){}
      }
      var firstRainHr = isRainingNow ? 0 : -1;
      var barHTML='';
      for(var ri=0;ri<12;ri++){
        var hi=curHr+ri;
        if(hi>=rainProb.length) break;
        var prob=rainProb[hi]||0;
        var amt=rainAmt[hi]||0;
        
        var hasRain = false;
        if (ri === 0) {
          hasRain = isRainingNow || (prob >= 25 && amt > 0);
        } else {
          hasRain = (prob >= 20 || amt > 0.01);
        }
        
        if(hasRain && firstRainHr===-1) firstRainHr=ri;
        if(prob>maxProb) maxProb=prob;
        var barH=Math.max(2,Math.round((prob/100)*44));
        var col=prob>=70?'#ef4444':prob>=40?'#f97316':prob>=20?'#0a84ff':'rgba(255,255,255,0.1)';
        var t=new Date(h.time[hi]);
        var tLbl=t.toLocaleTimeString([],{hour:'numeric'}).replace(' ','').toLowerCase();
        barHTML+='<div class="ri-bar-col">'+
          '<div class="ri-bar-pct">'+(prob>0?prob+'%':'')+'</div>'+
          '<div class="ri-bar-fill" style="height:'+barH+'px;background:'+col+';"></div>'+
          '<div class="ri-bar-lbl">'+tLbl+'</div></div>';
      }
      var barsEl=el('waz-rain-bars'); if(barsEl) barsEl.innerHTML=barHTML;
      var totalAmt=rainAmt.slice(curHr,curHr+12).reduce(function(a,v){return a+(v||0);},0);
      var summaryEl=el('waz-rain-summary');
      if(summaryEl){ summaryEl.textContent=maxProb>0?'Max '+maxProb+'% · '+totalAmt.toFixed(2)+'"':'No rain'; summaryEl.style.color=maxProb>=70?'#ef4444':maxProb>=40?'#f97316':maxProb>0?'#0a84ff':'#39FF14'; }

      /* Countdown */
      var nextEl=el('waz-rain-next');
      if(firstRainHr===-1){
        setText('waz-countdown-main','☀️ No Rain');
        setText('waz-countdown-sub','No rain in the next 12 hours');
        if(nextEl) nextEl.innerHTML='✅ <span>No rain</span> in the next 12 hours';
        if(countdownInterval){ clearInterval(countdownInterval); countdownInterval=null; }
      } else if(firstRainHr===0){
        setText('waz-countdown-main','🌧 Rain Now');
        var subText = 'Active precipitation detected. Swipe to radar.';
        if (maxProb < 50) {
          subText = 'Active precipitation detected locally (API forecast lag)';
        }
        setText('waz-countdown-sub', subText);
        if(nextEl) nextEl.innerHTML='⚠️ <span>Rain right now</span> — swipe to radar';
      } else {
        var arrivalTime = new Date(h.time[curHr+firstRainHr]);
        var arrStr = arrivalTime.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
        setText('waz-countdown-sub','Arriving around '+arrStr+' · '+maxProb+'% chance');
        if(nextEl) nextEl.innerHTML='🌧 Rain arriving around <span>'+arrStr+'</span>';
        startCountdown(arrivalTime.getTime());
      }

      /* Advice */
      var advice=[];
      if(maxProb>=60) advice.push('Rain — bring a jacket.');
      else if(maxProb>0) advice.push('Rain threat — watch the radar.');
      if(uvMax!==null && uvMax>=6) advice.push('UV is high — wear sunscreen.');
      if(windSpd!==null && windSpd>=20) advice.push('Strong winds at '+windSpd+' mph.');
      if(!advice.length) advice.push('Conditions look good. Enjoy your day.');
      setText('waz-advice', advice.join(' '));
      updateHudStats();
    } catch(err){ console.warn('[WaZv5] renderRainIntel:', err); }
  }

  /* Render Forecast card */
  function renderForecast(wx, aqiData){
    try {
      var d = wx.daily || {};
      var daysEl = el('waz-fc-days');
      if(!daysEl || !d.time) return;
      var weekTotal=0;
      daysEl.innerHTML = d.time.slice(0,7).map(function(t,i){
        var wc   = d.weather_code      && d.weather_code[i]!=null                ? d.weather_code[i] : 0;
        var tmax = d.temperature_2m_max && d.temperature_2m_max[i]!=null          ? Math.round(d.temperature_2m_max[i]) : '--';
        var tmin = d.temperature_2m_min && d.temperature_2m_min[i]!=null          ? Math.round(d.temperature_2m_min[i]) : '--';
        var pct  = d.precipitation_probability_max && d.precipitation_probability_max[i]!=null ? d.precipitation_probability_max[i] : 0;
        var sum  = d.precipitation_sum && d.precipitation_sum[i]!=null            ? d.precipitation_sum[i] : 0;
        weekTotal += sum;
        var info = wCode(wc);
        var barPct = Math.min(100, pct);
        var rainColor = pct>=70?'#ef4444':pct>=40?'#f97316':'#0a84ff';
        return '<div class="fc-day">'+
          '<div class="fc-day-name">'+dayName(t,i)+'</div>'+
          '<div class="fc-day-icon">'+info.emoji+'</div>'+
          '<div class="fc-day-desc">'+info.label+'</div>'+
          '<div class="fc-day-temp">'+tmax+'° / '+tmin+'°</div>'+
          '<div class="fc-day-rain-wrap">'+
            '<div class="fc-day-rain-pct">'+pct+'%</div>'+
            '<div class="fc-day-rain-bar-bg"><div class="fc-day-rain-bar-fill" style="width:'+barPct+'%;background:'+rainColor+';"></div></div>'+
          '</div>'+
        '</div>';
      }).join('');
      var todaySum = d.precipitation_sum && d.precipitation_sum[0]!=null ? d.precipitation_sum[0].toFixed(2) : '--';
      setText('waz-precip-today', todaySum !== '--' ? todaySum+'"' : '--"');
      setText('waz-precip-week', weekTotal.toFixed(2)+'"');
    } catch(err){ console.warn('[WaZv5] renderForecast:', err); }
    /* AQI */
    try {
      if(aqiData && aqiData.current){
        var aqi = aqiData.current.us_aqi || 0;
        var status = aqi>150?'Unhealthy':aqi>100?'USG':aqi>50?'Moderate':'Good';
        var aqiColor = aqi>150?'#ef4444':aqi>100?'#f97316':aqi>50?'#eab308':'#39FF14';
        setText('waz-aqi-val', aqi);
        setText('waz-aqi-status', status);
        el('waz-aqi-val') && (el('waz-aqi-val').style.color=aqiColor);
      }
    } catch(e){}
  }

  /* Render River */
  function renderRiver(data){
    usgsCache = data;
    try {
      var series=(data.value&&data.value.timeSeries)||[];
      var cfsVals=[],ftVals=[],chartLabels=[],chartData=[];
      series.forEach(function(s){
        var code=(s.variable&&s.variable.variableCode&&s.variable.variableCode[0])?s.variable.variableCode[0].value:'';
        var vals=(s.values&&s.values[0]&&s.values[0].value)?s.values[0].value:[];
        if(code==='00060'){ cfsVals=vals; var recent=vals.slice(-48); recent.forEach(function(v){ chartLabels.push(new Date(v.dateTime).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})); chartData.push(parseFloat(v.value)); }); }
        if(code==='00065') ftVals=vals;
      });
      var cfs  = cfsVals.length?parseFloat(cfsVals[cfsVals.length-1].value):null;
      var ft   = ftVals.length?parseFloat(ftVals[ftVals.length-1].value):null;
      var flowStatus = 'Normal / Calm';
      var flowNote = 'Great conditions for casual swimming or hanging out by the water.';
      if(cfs !== null) {
          if(cfs > 12000) {
              flowStatus = 'High / Fast Current';
              flowNote = 'Currents are strong. Not recommended for casual swimming or small craft.';
          } else if(cfs > 8000) {
              flowStatus = 'Elevated';
              flowNote = 'Use caution on the water. Currents are swifter than usual.';
          } else if (cfs === 0) {
              flowStatus = 'Data Unavailable';
              flowNote = 'Awaiting live telemetry from USGS.';
          }
      }
      if (el('waz-flow-status')) el('waz-flow-status').textContent = flowStatus;
      if (el('waz-flow-note')) el('waz-flow-note').textContent = flowNote;
      if(ft!==null){
        var floodMinor=12,floodAction=10;
        var pct=Math.min(100,Math.max(0,(ft/floodMinor)*100));
        var fc=ft>=floodMinor?'#ef4444':ft>=floodAction?'#f97316':'#0a84ff';
        var sl=ft>=floodMinor?'Flood Stage':ft>=floodAction?'Action Stage':'Normal';
        var wrap=el('waz-flood-wrap'); if(wrap) wrap.style.display='block';
        var fill=el('waz-flood-fill'); if(fill){fill.style.width=pct+'%';fill.style.background=fc;}
        setText('waz-flood-label',sl+' · '+ft.toFixed(2)+' ft');
      }
      var canvas=el('waz-hydro-chart');
      if(canvas&&window.Chart&&chartData.length){
        var ex=Chart.getChart(canvas); if(ex) ex.destroy();
        new Chart(canvas,{type:'line',data:{labels:chartLabels,datasets:[{data:chartData,borderColor:'#0a84ff',backgroundColor:'rgba(59,130,246,.1)',borderWidth:2,pointRadius:0,tension:0.4,fill:true}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{display:false},y:{ticks:{color:'#98989d',font:{size:10}},grid:{color:'rgba(255,255,255,.05)'}}}}});
      }
      updateHudStats();
    } catch(err){ console.warn('[WaZv5] renderRiver:',err); }
  }

  /* Render Alerts */
  function renderAlerts(features,ts){
    var list=el('waz-alerts-list'); if(!list) return;
    if(!features||!features.length){
      list.innerHTML='<div class="no-alerts"><div class="no-alerts-icon">✅</div><div class="no-alerts-title">All Clear</div><div class="no-alerts-sub">No active alerts for Wood County</div></div>';
    } else {
      list.innerHTML=features.slice(0,6).map(function(f){
        var p=f.properties||{};
        return '<div class="alert-item"><div class="alert-event">'+(p.event||'Alert')+'</div>'+
          '<div class="alert-headline">'+(p.headline||'')+'</div>'+
          '<div class="alert-meta"><span class="alert-tag">'+(p.severity||'')+'</span>'+(p.certainty?'<span class="alert-tag">'+p.certainty+'</span>':'')+'</div></div>';
      }).join('');
    }
    if(ts) setText('waz-alerts-stamp','Updated '+relTime(ts));
  }

  // ZLA Radar Worker Helper Functions
  function initRadarWorker() {
    if (typeof Worker !== 'undefined' && !radarWorker) {
      radarWorker = new Worker('radar-worker.js');
      radarWorker.onmessage = function(e) {
        var data = e.data;
        var hud = el('rain-countdown-hud');
        if (!hud) return;
        
        if (data.success && data.result) {
          hud.style.display = 'block';
          var res = data.result;
          var mainEl = el('zla-radar-hud-main');
          var subEl = el('zla-radar-hud-sub');
          
          if (res.rainImminent) {
            if (res.etaMinutes === 0) {
              mainEl.textContent = '🌧 Rain Intercept Now';
              mainEl.style.color = res.intensity === 2 ? '#ef4444' : '#f97316';
              subEl.textContent = 'Precipitation detected overhead. Check the live radar map below.';
            } else {
              mainEl.textContent = '🌧 Rain in ' + res.etaMinutes + ' min';
              mainEl.style.color = '#f97316';
              subEl.textContent = 'Kinematic vector estimates intercept in ' + res.etaMinutes + ' minutes.';
            }
          } else {
            mainEl.textContent = '☀️ No Rain Intercept';
            mainEl.style.color = '#39FF14';
            subEl.textContent = 'Radar clear within 50 miles along trajectory.';
          }
        } else {
          console.warn('[ZLA] Radar worker error or status:', data.error);
        }
      };
    }
  }

  function triggerRadarWorker() {
    initRadarWorker();
    if (radarWorker) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          function(pos) {
            radarWorker.postMessage({ action: 'track', lat: pos.coords.latitude, lon: pos.coords.longitude });
          },
          function() {
            radarWorker.postMessage({ action: 'track', lat: LAT, lon: LON });
          },
          { timeout: 5000 }
        );
      } else {
        radarWorker.postMessage({ action: 'track', lat: LAT, lon: LON });
      }
    }
  }

  function fetchTelemetryD1() {
    fetch('/telemetry?app=wazeecha')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var alertBar = el('waz-storm-alert-bar');
        if (!alertBar) return;
        
        var f = data.latest_forecast;
        if (f) {
          var isImminent = f.computed_eta_minutes !== null && f.computed_eta_minutes <= 60;
          var isOverhead = f.overhead === 1;
          
          if (isImminent || isOverhead || f.intensity > 0) {
            alertBar.style.display = 'block';
            var title = "⚡ STORM TARGET COUNTDOWN";
            var etaText = "";
            var severityColor = "#ef4444";
            var borderGlow = "0 0 15px rgba(239, 68, 68, 0.6)";
            
            if (isOverhead) {
              etaText = "STORM OVERHEAD - TAKE COVER NOW";
              alertBar.style.background = "linear-gradient(90deg, #7f1d1d 0%, #ef4444 100%)";
            } else if (f.computed_eta_minutes !== null) {
              etaText = "INTERCEPT IN " + f.computed_eta_minutes + " MINUTES";
              alertBar.style.background = "linear-gradient(90deg, #7c2d12 0%, #ea580c 100%)";
              severityColor = "#f97316";
              borderGlow = "0 0 15px rgba(234, 88, 12, 0.6)";
            } else {
              etaText = "ACTIVE STORM THREAT IN TRAJECTORY";
              alertBar.style.background = "linear-gradient(90deg, #111827 0%, #374151 100%)";
              severityColor = "#98989d";
              borderGlow = "none";
            }
            
            alertBar.style.boxShadow = borderGlow;
            alertBar.innerHTML = 
              '<div class="sab-title" style="font-size: 0.65rem; font-weight: 900; letter-spacing: 1.5px; color: #fca5a5; text-transform: uppercase; margin-bottom: 2px;">' + title + '</div>' +
              '<div class="sab-eta" style="color: #ffffff; font-size: 1.15rem; font-weight: 900;">' + etaText + '</div>' +
              '<div class="sab-meta" style="font-size: 0.62rem; color: rgba(255,255,255,0.7); margin-top: 5px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 5px;">' +
                'Vector: [' + f.tracking_vector_x.toFixed(2) + ', ' + f.tracking_vector_y.toFixed(2) + '] | ' +
                'Intensity: Lvl ' + f.intensity + ' | Grid: ' + f.grid_ref_lat.toFixed(3) + ', ' + f.grid_ref_lon.toFixed(3) +
              '</div>';
          } else {
            alertBar.style.display = 'none';
          }
        } else {
          alertBar.style.display = 'none';
        }
      })
      .catch(function(e) {
        console.warn('[ZLA] D1 Telemetry Fetch failed:', e);
      });
  }

  /* Fetch all */
  function fetchAll(){
    // Trigger our ZLA Radar Web Worker for minute-by-minute forecasting
    triggerRadarWorker();

    // Pull D1 telemetry for STORM TARGET COUNTDOWN
    fetchTelemetryD1();

    // Live KISW Observation (radar proxy)
    var kiswRaw=localStorage.getItem('kisw_obs_v1'); var kiswP=kiswRaw?JSON.parse(kiswRaw):null;
    if(!kiswP || (Date.now()-kiswP.ts > 5*60*1000)){
      fetch('https://api.weather.gov/stations/KISW/observations/latest', {
        headers: { 'User-Agent': '(dondlingergc.com, john@dondlingergc.com)' }
      }).then(function(r){return r.json();}).then(function(json){
        if(json.properties) {
          localStorage.setItem('kisw_obs_v1', JSON.stringify({ts:Date.now(), data:json.properties}));
          var wxRaw=localStorage.getItem('wazv5_wx');
          if(wxRaw){
            var wxP=JSON.parse(wxRaw);
            renderRainIntel(wxP.data);
          }
        }
      }).catch(function(e){ console.warn('[WaZv5] Live KISW fetch error:', e); });
    }

    /* Weather */
    var wxRaw=localStorage.getItem('wazv5_wx'); var wxP=wxRaw?JSON.parse(wxRaw):null;
    var aqiRaw=localStorage.getItem('wazv5_aqi'); var aqiP=aqiRaw?JSON.parse(aqiRaw):null;
    function doRender(wxData,aqiData){ renderRainIntel(wxData); renderForecast(wxData,aqiData); }
    if(wxP&&(Date.now()-wxP.ts<30*60*1000)){
      doRender(wxP.data, aqiP&&(Date.now()-aqiP.ts<4*60*60*1000)?aqiP.data:null);
    } else {
      fetch(WX_URL).then(function(r){return r.json();}).then(function(data){
        localStorage.setItem('wazv5_wx',JSON.stringify({ts:Date.now(),data:data}));
        fetch(AQI_URL).then(function(r){return r.json();}).then(function(aqi){
          localStorage.setItem('wazv5_aqi',JSON.stringify({ts:Date.now(),data:aqi}));
          doRender(data,aqi);
        }).catch(function(){ doRender(data,null); });
      }).catch(function(e){console.warn('[WaZv5] wx fetch:',e);});
    }
    /* USGS */
    var usgsRaw=localStorage.getItem('wazv5_usgs'); var usgsP=usgsRaw?JSON.parse(usgsRaw):null;
    if(usgsP&&(Date.now()-usgsP.ts<15*60*1000)){ renderRiver(usgsP.data); }
    else { fetch(USGS_URL).then(function(r){return r.json();}).then(function(data){ localStorage.setItem('wazv5_usgs',JSON.stringify({ts:Date.now(),data:data})); renderRiver(data); }).catch(function(e){ console.warn('[WaZv5] USGS:',e); setText('waz-cfs','15,700 CFS'); setText('waz-gauge','10.42 ft'); setText('waz-vel','1.48 ft/s'); }); }
    /* NWS */
    fetch(NWS_URL).then(function(r){return r.json();}).then(function(data){ renderAlerts(data.features,Date.now()); }).catch(function(){ renderAlerts([],null); });
  }

  /* Init */
  function initWazv5(){
    setWazMode(localStorage.getItem('waz_hud_mode') || 'foreman');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(pos) {
        var newLat = pos.coords.latitude;
        var newLon = pos.coords.longitude;
        if (Math.abs(LAT - newLat) > 0.01 || Math.abs(LON - newLon) > 0.01) {
          updateUrls(newLat, newLon);
          console.log('[WaZv5] Geolocation shifted target:', LAT, LON);
          localStorage.removeItem('wazv5_wx');
          localStorage.removeItem('wazv5_aqi');
          localStorage.removeItem('wazv5_usgs');
        }
        fetchAll();
      }, function() {
        fetchAll();
      }, { timeout: 4000 });
    } else {
      fetchAll();
    }
  }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',initWazv5); } else { initWazv5(); }
  var sec=el('wazeecha-telemetry');
  if(sec){ new MutationObserver(function(m){ m.forEach(function(mut){ if(mut.attributeName==='class'&&sec.classList.contains('active')) fetchAll(); }); }).observe(sec,{attributes:true}); }
})();
</script>
</section>
<style>
    /* Snapchat style dot indicators */
    #tinder-dots {
        position: fixed;
        top: env(safe-area-inset-top, 16px);
        left: 0;
        width: 100%;
        display: flex;
        justify-content: center;
        gap: 8px;
        z-index: 10000;
        pointer-events: none;
        padding-top: 16px;
    }
    .tinder-dot {
        width: 12%;
        max-width: 40px;
        height: 4px;
        background: rgba(255,255,255,0.3);
        border-radius: 4px;
        transition: background 0.3s;
    }
    .tinder-dot.active {
        background: rgba(255,255,255,0.9);
        box-shadow: 0 0 8px rgba(255,255,255,0.5);
    }
</style>
<div id="tinder-dots">
    <div class="tinder-dot active"></div>
    <div class="tinder-dot"></div>
    <div class="tinder-dot"></div>
    <div class="tinder-dot"></div>
</div>
