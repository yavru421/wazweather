from PIL import Image
import os

input_path = r'C:\Users\John\.gemini\antigravity\brain\09b0b1a2-c167-4121-8295-054fb40a5eaa\wazweather_icon_1783542175014.png'
out_192 = r'C:\dev\wazweather\wwwroot\icon-192.png'
out_512 = r'C:\dev\wazweather\wwwroot\icon-512.png'

with Image.open(input_path) as img:
    img.resize((192, 192), Image.Resampling.LANCZOS).save(out_192)
    img.resize((512, 512), Image.Resampling.LANCZOS).save(out_512)

print('Icons resized successfully.')
