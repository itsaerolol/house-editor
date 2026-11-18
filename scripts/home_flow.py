import sys, subprocess
subprocess.run(['/home/claude/farmhouse-editor/scripts/ensure_vite.sh'])
from playwright.sync_api import sync_playwright
W, H = 390, 844
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': W, 'height': H}, is_mobile=True, has_touch=True, device_scale_factor=1)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:5199/?q=low')
    pg.wait_for_selector('.hero-actions .go', timeout=120000)
    print('hero ok')
    pg.click('text=Blank lot')
    pg.wait_for_selector('.home', state='detached', timeout=60000)
    print('blank opened; home closed')
    # dismiss coach if present, open More -> Home
    pg.evaluate("document.querySelector('.coach .go, .coach button')?.click()")
    pg.wait_for_timeout(1500)
    pg.evaluate("document.querySelector('.topbar .orb[aria-label=More]')?.click()")
    pg.wait_for_timeout(800)
    pg.click('text=Home & saved houses')
    pg.wait_for_selector('.home', timeout=60000)
    pg.wait_for_selector('.hcard:not(.new)', timeout=60000)
    print('cards:', pg.locator('.hcard:not(.new)').count())
    print('hero name:', pg.inner_text('.hero-info h2'))
    pg.screenshot(path='shots/home_two.png')
    # rename the hero
    pg.click('.in-hero .hcard-more'); pg.click('text=Rename')
    pg.fill('.hero-rename', 'Garden cottage'); pg.keyboard.press('Enter')
    pg.wait_for_timeout(1500)
    print('renamed ->', pg.inner_text('.hero-info h2'))
    # duplicate
    pg.click('.in-hero .hcard-more'); pg.click('text=Duplicate')
    pg.wait_for_timeout(1500)
    print('cards after dup:', pg.locator('.hcard:not(.new)').count())
    pg.screenshot(path='shots/home_dup.png')
    # reload: persistence
    pg.reload()
    pg.wait_for_selector('.hcard:not(.new)', timeout=120000)
    print('after reload cards:', pg.locator('.hcard:not(.new)').count(), '| hero:', pg.inner_text('.hero-info h2'))
    names = pg.locator('.hcard-name').all_inner_texts()
    print('names:', names)
    # open the other house
    pg.click('.hcard:not(.new) .hcard-name')
    pg.wait_for_selector('.home', state='detached', timeout=60000)
    st = pg.evaluate("(()=>{const p=window.__store.getState().hist.project;return p.name+' walls:'+Object.keys(p.walls).length})()")
    print('opened ->', st)
    # delete flow
    pg.evaluate("document.querySelector('.topbar .orb[aria-label=More]')?.click()")
    pg.wait_for_timeout(600)
    pg.click('text=Home & saved houses')
    pg.wait_for_selector('.hcard:not(.new)')
    pg.click('.hcard:not(.new) .hcard-more'); pg.click('text=Delete'); pg.click('.hmenu .solid')
    pg.wait_for_timeout(1500)
    print('after delete cards:', pg.locator('.hcard:not(.new)').count())
    print('errors:', errs[:5])
    b.close()
