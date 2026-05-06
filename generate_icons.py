#!/usr/bin/env python3
"""
LoyaltyOS — Générateur d'icônes PWA
Seulement 2 fichiers nécessaires : icon-192.png et icon-512.png

Exécuter : python3 generate_icons.py
Dépendances : pip install cairosvg
"""

import os

SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#0D0B1E"/>
  <circle cx="256" cy="220" r="100" fill="none" stroke="#7B5EFF" stroke-width="24" opacity="0.3"/>
  <text x="256" y="275" font-family="Arial Black,sans-serif" font-size="220" font-weight="900"
        fill="#9B8BFF" text-anchor="middle">L</text>
  <circle cx="360" cy="148" r="30" fill="#7B5EFF"/>
  <text x="360" y="148" font-size="26" text-anchor="middle" dominant-baseline="middle" fill="#fff">&#x2726;</text>
</svg>"""

os.makedirs('icons', exist_ok=True)

try:
    import cairosvg
    for size in [192, 512]:
        cairosvg.svg2png(bytestring=SVG.encode(), write_to=f'icons/icon-{size}.png',
                         output_width=size, output_height=size)
        print(f"✓ icons/icon-{size}.png")
    print("\n2 icônes créées — PWA prête !")
except ImportError:
    print("pip install cairosvg  puis relancez")
    print("\nAlternative en ligne : https://realfavicongenerator.net")
    print("→ Uploadez votre logo → téléchargez icon-192.png et icon-512.png → placez-les dans /icons/")
