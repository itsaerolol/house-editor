import sys, subprocess
subprocess.run(['/home/claude/farmhouse-editor/scripts/ensure_vite.sh'])
from playwright.sync_api import sync_playwright
# usage: pv.py "<query>" out.png [W H]
q, out = sys.argv[1], sys.argv[2]
W = int(sys.argv[3]) if len(sys.argv) > 3 else 1200
H = int(sys.argv[4]) if len(sys.argv) > 4 else 760
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': W, 'height': H})
    logs = []
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.goto(f'http://127.0.0.1:5199/preview.html?{q}')
    try:
        pg.wait_for_function('window.__ready === true', timeout=90000)
    except Exception as e:
        logs.append(f'[timeout] {e}')
    pg.wait_for_timeout(300)
    pg.screenshot(path=out, timeout=120000)
    for l in logs[:12]:
        if 'GPU stall' in l or 'WebGL' in l and 'warning' in l: continue
        print(l[:300])
    b.close()
