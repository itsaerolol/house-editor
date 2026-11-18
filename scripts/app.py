import sys, json, subprocess
subprocess.run(['/home/claude/farmhouse-editor/scripts/ensure_vite.sh'])
from playwright.sync_api import sync_playwright
# usage: shots.py name=js[;mode] ...   each step: "name|js|wait_ms"
steps = [a.split('|') for a in sys.argv[1:]]
W, H = (1500, 900)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': W, 'height': H})
    logs = []
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type in ('error',) else None)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.add_init_script("if(!sessionStorage.getItem('c')){localStorage.clear();sessionStorage.setItem('c','1')}")
    pg.goto('http://127.0.0.1:5199/?q=' + (__import__('os').environ.get('Q','low')))
    pg.wait_for_timeout(1200)
    for st in steps:
        name, js = st[0], st[1]
        wait = int(st[2]) if len(st) > 2 else 4500
        if js:
            r = pg.evaluate(js)
            if r is not None: print(name, '->', r)
        pg.wait_for_timeout(wait)
        pg.screenshot(path=f'shots/{name}.png', timeout=120000)
    for l in logs[:25]:
        print(l[:400])
    b.close()
