import re

file_path = r'c:\dev\wazweather\wwwroot\index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Colors
content = content.replace('background-color: #050a06', 'background-color: #12141c')
content = content.replace('background:#050a06', 'background:#12141c')
content = content.replace('#60a5fa', '#0a84ff')
content = content.replace('#3b82f6', '#0a84ff')
content = content.replace('#fbbf24', '#ffb300')
content = content.replace('#9ca3af', '#98989d')
content = content.replace('#fff', '#ffffff')

# 2. CSS Font Size Bumps
content = content.replace('font-size:.63rem', 'font-size:.85rem')
content = content.replace('font-size:.65rem', 'font-size:.85rem')
content = content.replace('font-size:.58rem', 'font-size:.75rem')
content = content.replace('font-size:.72rem', 'font-size:.9rem')
content = content.replace('font-size:.75rem', 'font-size:.95rem')
content = content.replace('font-size:.78rem', 'font-size:1rem')
content = content.replace('font-size:.8rem', 'font-size:1.05rem')
content = content.replace('font-size:.85rem', 'font-size:1.1rem')
content = content.replace('font-size:.95rem', 'font-size:1.2rem')
content = content.replace('font-size:1.15rem', 'font-size:1.4rem')
content = content.replace('font-size:1.4rem', 'font-size:1.8rem')
content = content.replace('font-size:1.7rem', 'font-size:2rem')
content = content.replace('font-size:2.4rem', 'font-size:3rem')
content = content.replace('font-size:2.8rem', 'font-size:3.5rem')

# 3. HTML: Dots (5 -> 7)
dots_target = """<!-- 5 Progress Dots -->
<div id="waz-dots">
  <div class="waz-dot active"></div>
  <div class="waz-dot"></div>
  <div class="waz-dot"></div>
  <div class="waz-dot"></div>
  <div class="waz-dot"></div>
</div>"""

dots_replacement = """<!-- 7 Progress Dots -->
<div id="waz-dots">
  <div class="waz-dot active"></div>
  <div class="waz-dot"></div>
  <div class="waz-dot"></div>
  <div class="waz-dot"></div>
  <div class="waz-dot"></div>
  <div class="waz-dot"></div>
  <div class="waz-dot"></div>
</div>"""
content = content.replace(dots_target, dots_replacement)

# 4. Extract Rain Arrival to Card 2, Extract Advice to Card 7
card1_start = content.find('<!-- ════ CARD 1: RAIN INTEL ════ -->')
card2_start = content.find('<!-- ════ CARD 2: RADAR (Split 68vh / rest) ════ -->')

if card1_start != -1 and card2_start != -1:
    old_card1 = content[card1_start:card2_start]
    
    new_card1 = """<!-- ════ CARD 1: OVERVIEW ════ -->
<div id="waz-overview" class="waz-card waz-scroll">
  <div class="ri-body">
    <div class="ri-source">
      <div><div class="ri-source-lbl">WazWeather · Local</div></div>
      <div id="waz-updated">—</div>
    </div>

    <!-- Main Temp Display -->
    <div style="text-align: center; margin: 40px 0;">
      <div id="waz-main-temp" style="font-size: 5rem; font-weight: 900; line-height: 1; letter-spacing: -3px; color: #ffffff;">--°</div>
      <div id="waz-main-desc" style="font-size: 1.2rem; font-weight: 700; color: #98989d; margin-top: 10px;">Loading...</div>
    </div>

    <!-- Compact stat strip -->
    <div class="ri-stat-strip">
      <div class="ri-stat"><div class="ri-stat-lbl" id="waz-lbl-feels">Feels Like</div><div class="ri-stat-val" id="waz-feels">--°</div></div>
      <div class="ri-stat"><div class="ri-stat-lbl">Wind</div><div class="ri-stat-val" id="waz-wind">-- mph</div><div class="ri-stat-sub" id="waz-wind-dir">--</div></div>
      <div class="ri-stat"><div class="ri-stat-lbl" id="waz-lbl-uv">UV Max</div><div class="ri-stat-val" id="waz-uv" style="color:#ffb300;">--</div></div>
    </div>

    <!-- Sun strip -->
    <div class="ri-sun-row">
      <div class="ri-sun-item"><span style="font-size:1.2rem;">🌅</span><div><div class="ri-sun-lbl">Sunrise</div><div class="ri-sun-val" id="waz-sunrise">--:--</div></div></div>
      <div class="ri-sun-sep"></div>
      <div class="ri-sun-item"><div style="text-align:right;"><div class="ri-sun-lbl">Sunset</div><div class="ri-sun-val" id="waz-sunset">--:--</div></div><span style="font-size:1.2rem;">🌇</span></div>
    </div>
  </div>
</div>

<!-- ════ CARD 2: RAIN ARRIVAL ════ -->
<div id="waz-rain-arrival" class="waz-card waz-scroll">
  <div class="ri-body">
    <div class="ri-source">
      <div><div class="ri-source-lbl">☔ Precipitation Intel</div></div>
    </div>

    <!-- Live countdown hero -->
    <div class="ri-countdown-hero" style="margin-top: 20px;">
      <div class="ri-countdown-label">🌧 Rain Arrival</div>
      <div id="waz-countdown-main">Checking…</div>
      <div id="waz-countdown-sub">Loading forecast data</div>
    </div>

    <!-- Today / Tomorrow strip -->
    <div class="ri-today-strip" style="margin-top: 20px;">
      <div class="ri-today-cell">
        <div class="ri-today-lbl">Today Rain</div>
        <div id="waz-today-total">--"</div>
      </div>
      <div class="ri-today-cell">
        <div class="ri-today-lbl">Max Chance</div>
        <div id="waz-today-max-pct">--%</div>
      </div>
      <div class="ri-today-cell">
        <div class="ri-today-lbl">Tomorrow</div>
        <div id="waz-tomorrow-rain">--%</div>
      </div>
    </div>

    <!-- 12-hr bar chart -->
    <div class="ri-bars-block" style="margin-top: 20px;">
      <div class="ri-bars-hdr">
        <span class="ri-bars-title">Next 12 Hours</span>
        <span id="waz-rain-summary">Loading…</span>
      </div>
      <div class="ri-bars" id="waz-rain-bars"></div>
      <div id="waz-rain-next">Checking…</div>
    </div>
  </div>
</div>

"""
    content = content.replace(old_card1, new_card1)

# 5. Hydrology Card Update
hydro_target = """<div class="river-sub-grid">
        <div class="river-sub-cell"><div class="river-sub-lbl">River Depth</div><div id="waz-gauge" class="river-sub-val" style="color:#a78bfa;">-- ft</div></div>
        <div class="river-sub-cell"><div class="river-sub-lbl">Velocity Est.</div><div id="waz-vel" class="river-sub-val" style="color:#34d399;">-- ft/s</div></div>
      </div>"""

hydro_replace = """<div class="river-sub-grid">
        <div class="river-sub-cell" style="grid-column: span 2;"><div class="river-sub-lbl">River Flow Status</div><div id="waz-flow-status" class="river-sub-val" style="color:#ffffff; font-size: 1.8rem;">--</div><div id="waz-flow-note" style="color:#98989d; font-size:1.05rem; margin-top:5px;">Loading...</div></div>
      </div>"""
content = content.replace(hydro_target, hydro_replace)

cfs_target = """<div class="river-cfs-lbl">Current Flow Rate</div>
      <div style="display:flex;align-items:baseline;gap:5px;">
        <div id="waz-cfs" class="river-cfs-val">-- CFS</div>
        <div id="waz-trend"></div>
      </div>"""
content = content.replace(cfs_target, "")

# 6. Append Card 7 (Recommendations) before Scripts
script_start = content.find('<!-- ════ v5 SELF-CONTAINED SCRIPT ════ -->')
if script_start != -1:
    card7 = """<!-- ════ CARD 7: RECOMMENDATIONS ════ -->
<div id="waz-recommendations" class="waz-card waz-scroll">
  <div class="ri-body">
    <div class="ri-source">
      <div><div class="ri-source-lbl">💡 Smart Insights</div></div>
    </div>
    
    <div id="waz-smart-insights-container" style="display:flex; flex-direction:column; gap:15px; margin-top:20px;">
        <!-- Populated by JS -->
        <div class="ri-advice">
          <div class="ri-advice-lbl" style="color:#0a84ff;">Analyzing...</div>
          <div style="color:#ffffff; font-size:1rem; font-weight:500;">Generating smart insights based on current conditions.</div>
        </div>
    </div>
  </div>
</div>

"""
    content = content[:script_start] + card7 + content[script_start:]


# 7. JavaScript logic rewrite for Hydrology and Recommendations
js_new_logic = """
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
        insights.push({title: '🧥 Layer Up', text: 'Warm afternoon, but it\\'s going to get chilly fast after sunset. Pack a light jacket.'});
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
"""

content = content.replace("function updateHudStats(){", js_new_logic + "\\n\\n  function updateHudStats(){")

# Inject logic to update waz-main-temp and call generateRecommendations
render_rain_intel = """function renderRainIntel(data){"""
inject_main = """function renderRainIntel(data){
    var h = data.hourly;
    var now = new Date();
    var curHr = 0;
    for(var i=0; i<h.time.length; i++){ if(new Date(h.time[i]) <= now) curHr = i; else break; }
    
    if (el('waz-main-temp')) el('waz-main-temp').textContent = Math.round(h.temperature_2m[curHr]) + '°';
    if (el('waz-main-desc')) el('waz-main-desc').textContent = wCode(h.weather_code[curHr]).label;
    
    generateRecommendations(h);
"""
content = content.replace(render_rain_intel, inject_main)

# Rewrite Hydrology USGS parsing
update_river = """var cfs = 0, gauge = 0;"""
new_update_river = """var cfs = 0, gauge = 0;"""
content = content.replace(update_river, new_update_river)

river_logic_target = """if(cfs>0){ setText('waz-cfs', cfs.toLocaleString()); }
    if(gauge>0){ setText('waz-gauge', gauge.toFixed(2)+' ft'); }
    var vel = cfs>0 && gauge>0 ? (cfs/(gauge*200)).toFixed(1) : '--';
    setText('waz-vel', vel+' ft/s');"""

river_logic_replace = """var flowStatus = 'Normal / Calm';
    var flowNote = 'Great conditions for casual swimming or hanging out by the water.';
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
    if (el('waz-flow-status')) el('waz-flow-status').textContent = flowStatus;
    if (el('waz-flow-note')) el('waz-flow-note').textContent = flowNote;"""
    
content = content.replace(river_logic_target, river_logic_replace)

# Remove the industrial logic update inside updateHudStats
start_idx = content.find('// Foreman Calculations')
end_idx = content.find("} catch(err){ console.warn('[ZLA]")
if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + "\\n      // Mainstream UI doesn't need Foreman HUD\\n    " + content[end_idx:]


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Transformation complete.")
