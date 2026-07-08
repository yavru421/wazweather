import re

file_path = r'c:\dev\wazweather\wwwroot\index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add html2canvas CDN
if 'html2canvas' not in content:
    content = content.replace('<!-- ════ v5 SELF-CONTAINED SCRIPT ════ -->', '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>\n<!-- ════ v5 SELF-CONTAINED SCRIPT ════ -->')

# 2. Fix top bar (remove the old share button)
old_top_bar = """  <div style="display:flex;align-items:center;">
    <button id="waz-share-btn" aria-label="Share WaZWeather" style="background:transparent;border:none;color:#ffffff;cursor:pointer;margin-right:12px;padding:4px;display:flex;align-items:center;justify-content:center;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
    </button>
    <button id="waz-close-btn" onclick="resetActiveGateway()" aria-label="Close WaZWeather">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>"""

new_top_bar = """  <button id="waz-close-btn" style="pointer-events:auto;" onclick="resetActiveGateway()" aria-label="Close WaZWeather">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  </button>"""
content = content.replace(old_top_bar, new_top_bar)


# 3. Add share buttons to cards
share_btn_html = """<div class="card-share-btn" onclick="shareCard(this)" style="position:absolute;top:15px;right:15px;width:32px;height:32px;background:rgba(255,255,255,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:10;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg></div>"""

# Card 1 (Overview)
content = content.replace('<div id="waz-overview" class="waz-card waz-scroll">', f'<div id="waz-overview" class="waz-card waz-scroll" data-share-text="Live weather from WazWeather:">\n  {share_btn_html}')

# Card 2 (Rain)
content = content.replace('<div id="waz-rain-card" class="waz-card waz-scroll">', f'<div id="waz-rain-card" class="waz-card waz-scroll" data-share-text="Rain tracking live on WazWeather:">\n  {share_btn_html}')

# Card 3 (Radar) - Special radar share
content = content.replace('<div id="waz-radar" class="waz-card">', f'<div id="waz-radar" class="waz-card" data-share-text="Severe weather tracked! Check out the live interactive radar on WazWeather:">\n  <div class="card-share-btn radar-share" onclick="shareRadar()" style="position:absolute;top:15px;right:15px;width:32px;height:32px;background:rgba(0,0,0,0.5);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:10;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg></div>')

# Card 4 (River)
content = content.replace('<div id="waz-river" class="waz-card waz-scroll">', f'<div id="waz-river" class="waz-card waz-scroll" data-share-text="Current river flow status from WazWeather:">\n  {share_btn_html}')

# Card 7 (Insights)
content = content.replace('<div id="waz-smart-insights" class="waz-card waz-scroll" style="padding-top:40px;">', f'<div id="waz-smart-insights" class="waz-card waz-scroll" style="padding-top:40px;" data-share-text="WazWeather Insights:">\n  {share_btn_html}')


# 4. JS share logic
js_share_logic = """
  /* Dynamic Sharing */
  window.shareCard = function(btn) {
    if(!window.html2canvas) { alert('Screenshot engine loading...'); return; }
    var card = btn.closest('.waz-card');
    var shareText = card.getAttribute('data-share-text') || 'WazWeather Update:';
    shareText += ' ' + window.location.origin;
    
    // hide the button temporarily for the screenshot
    btn.style.display = 'none';
    
    html2canvas(card, { backgroundColor: '#12141c', scale: 2 }).then(function(canvas) {
      btn.style.display = 'flex';
      canvas.toBlob(function(blob) {
        if(!blob) return;
        var file = new File([blob], 'wazweather_share.png', { type: 'image/png' });
        if(navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({
            text: shareText,
            files: [file]
          }).catch(function(e){ console.warn(e); });
        } else {
          navigator.clipboard.writeText(shareText);
          alert('Link copied! (Your browser does not support image sharing)');
        }
      }, 'image/png');
    });
  };

  window.shareRadar = function() {
    fetch('/assets/radar-share.gif').then(function(res) {
      return res.blob();
    }).then(function(blob) {
      var file = new File([blob], 'radar-share.gif', { type: 'image/gif' });
      var shareText = 'Severe weather tracked! Check out the live interactive radar on WazWeather: ' + window.location.origin;
      if(navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          text: shareText,
          files: [file]
        }).catch(function(e){ console.warn(e); });
      } else {
        navigator.clipboard.writeText(shareText);
        alert('Link copied! (Your browser does not support GIF sharing)');
      }
    }).catch(function(e) {
      console.error(e);
      var shareText = 'Check out the live interactive radar on WazWeather: ' + window.location.origin;
      if(navigator.share) navigator.share({ text: shareText }).catch(function(e){});
      else navigator.clipboard.writeText(shareText);
    });
  };
"""

if 'window.shareCard =' not in content:
    content = content.replace('/* Dot sync */', f'{js_share_logic}\n  /* Dot sync */')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("index.html updated successfully!")
