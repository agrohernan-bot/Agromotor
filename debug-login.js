const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const EMAIL = 'agrohernan@gmail.com';
const PASS  = process.argv[2];

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--ignore-certificate-errors'],
    ignoreHTTPSErrors: true,
  });
  const page = await browser.newPage();
  await page.setViewport({width:1440,height:900});

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[CONSOLE ERR]', msg.text().slice(0,200));
  });
  page.on('pageerror', e => console.log('[PAGEERROR]', e.message));
  page.on('requestfailed', r => console.log('[REQ FAILED]', r.url().slice(0,80), r.failure().errorText));

  console.log('1. Loading index...');
  const resp = await page.goto('https://agromotor.com.ar', {waitUntil:'networkidle2', timeout:30000});
  console.log('   Status:', resp.status(), 'URL:', page.url());
  const title = await page.title();
  console.log('   Title:', title);
  await page.screenshot({path:'/tmp/am-review/d1-index.png'});

  // Get key selectors
  const els = await page.evaluate(() => {
    return {
      emailInput: !!document.querySelector('#email'),
      emailInput2: !!document.querySelector('input[type="email"]'),
      passInput: !!document.querySelector('#password'),
      passInput2: !!document.querySelector('input[type="password"]'),
      forms: document.querySelectorAll('form').length,
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.id || b.className || b.textContent.trim().slice(0,20)),
      bodyHTML: document.body.innerHTML.slice(0, 500),
    };
  });
  console.log('   DOM elements:', JSON.stringify(els, null, 2));

  if (els.emailInput || els.emailInput2) {
    const emailSel = els.emailInput ? '#email' : 'input[type="email"]';
    const passSel  = els.passInput  ? '#password' : 'input[type="password"]';

    console.log('2. Filling login form...');
    await page.type(emailSel, EMAIL);
    await page.type(passSel, PASS);
    await page.screenshot({path:'/tmp/am-review/d2-login-filled.png'});

    // Find submit
    const btnId = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(b => b.id === 'btnLogin' || b.type === 'submit' || /iniciar|login|entrar|ingresar/i.test(b.textContent));
      return b ? (b.id || b.textContent.trim().slice(0,30)) : null;
    });
    console.log('   Login button:', btnId);

    const loginBtn = await page.$('#btnLogin, button[type="submit"]') || await page.$('button');
    if (loginBtn) {
      console.log('3. Clicking login...');
      await Promise.all([
        page.waitForNavigation({timeout:20000, waitUntil:'networkidle2'}).catch(e => console.log('   Nav:', e.message)),
        loginBtn.click()
      ]);
      await new Promise(r => setTimeout(r, 3000));
      console.log('   URL after login:', page.url());
      await page.screenshot({path:'/tmp/am-review/d3-post-login.png'});

      const appCheck = await page.evaluate(() => ({
        url: location.href,
        title: document.title,
        bodyClass: document.body.className,
        bodyLen: document.body.innerHTML.length,
        moduleCount: document.querySelectorAll('.module-panel').length,
        firstModule: document.querySelector('.module-panel') ? document.querySelector('.module-panel').id : null,
        htmlSnippet: document.body.innerHTML.slice(0, 300),
      }));
      console.log('   App state:', JSON.stringify(appCheck, null, 2));
    }
  } else {
    console.log('   No login form found! Going directly to app.html...');
    await page.goto('https://agromotor.com.ar/app.html', {waitUntil:'networkidle2', timeout:30000});
    await new Promise(r => setTimeout(r, 5000));
    console.log('   URL:', page.url());
    const appState = await page.evaluate(() => ({
      moduleCount: document.querySelectorAll('.module-panel').length,
      bodyLen: document.body.innerHTML.length,
    }));
    console.log('   App state:', JSON.stringify(appState));
    await page.screenshot({path:'/tmp/am-review/d3-app-direct.png'});
  }

  await browser.close();
  console.log('Done. Screenshots in /tmp/am-review/');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
