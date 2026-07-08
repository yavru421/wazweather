import os
import math
from PIL import Image, ImageDraw, ImageFont

def generate_radar_gif(output_path):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    frames = []
    width, height = 400, 400
    
    # 20 frames total
    for i in range(20):
        img = Image.new('RGB', (width, height), color=(18, 20, 28))
        draw = ImageDraw.Draw(img)
        
        # Draw some radar sweep effect
        center = (width//2, height//2)
        radius = 150
        draw.ellipse([center[0]-radius, center[1]-radius, center[0]+radius, center[1]+radius], outline=(40, 45, 60), width=4)
        
        angle = (i / 20.0) * 360
        rad = math.radians(angle)
        end_x = center[0] + radius * math.cos(rad)
        end_y = center[1] + radius * math.sin(rad)
        draw.line([center, (end_x, end_y)], fill=(10, 132, 255), width=3)
        
        # Lightning strike on specific frames
        if i in [5, 6, 12]:
            # Draw lightning bolt
            lightning = [(200, 50), (180, 150), (220, 150), (170, 250), (210, 240), (190, 320)]
            draw.line(lightning, fill=(255, 255, 255), width=8)
            draw.line(lightning, fill=(255, 179, 0), width=4)
            # Flash background
            overlay = Image.new('RGBA', (width, height), color=(255, 255, 255, 100))
            img.paste(overlay, (0,0), overlay)
            
        # Draw WazWeather Text
        try:
            # Fallback to default if no specific font
            font = ImageFont.load_default()
        except:
            font = None
            
        text = "WAZWEATHER"
        # We can just draw basic text
        draw.text((160, 360), text, fill=(255, 255, 255))
        
        frames.append(img)
        
    frames[0].save(
        output_path,
        save_all=True,
        append_images=frames[1:],
        optimize=False,
        duration=100,
        loop=0
    )
    print(f"GIF saved to {output_path}")

if __name__ == '__main__':
    generate_radar_gif(r'c:\dev\wazweather\wwwroot\assets\radar-share.gif')
