const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadInstallUi(installed = false) {
  const events = {};
  const button = { hidden: true, addEventListener: (name, handler) => { button[name] = handler; } };
  const display = { matches: installed, addEventListener: (name, handler) => { display[name] = handler; } };
  const window = { navigator: {}, matchMedia: () => display, addEventListener: (name, handler) => { events[name] = handler; } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../pwa.js'), 'utf8'), {
    document: { getElementById: () => button }, window,
  });
  return { events, button, display };
}

test('installation offer is shown, consumed once, and can be offered again after dismissal', async () => {
  const { events, button } = loadInstallUi();
  assert.equal(button.hidden, true);
  let prompts = 0;
  let prevented = false;
  const offer = {
    preventDefault() { prevented = true; },
    async prompt() { prompts++; },
    userChoice: Promise.resolve({ outcome: 'dismissed' }),
  };
  events.beforeinstallprompt(offer);
  assert.equal(prevented, true);
  assert.equal(button.hidden, false);
  await button.click();
  await button.click();
  assert.equal(prompts, 1);
  assert.equal(button.hidden, true);
  events.beforeinstallprompt(offer);
  assert.equal(button.hidden, false);
  events.appinstalled();
  assert.equal(button.hidden, true);
  await button.click();
  assert.equal(prompts, 1);
});

test('standalone launches never offer installation and display changes hide an offer', () => {
  const installed = loadInstallUi(true);
  installed.events.beforeinstallprompt({ preventDefault() { assert.fail('already installed'); } });
  assert.equal(installed.button.hidden, true);
  const browser = loadInstallUi();
  browser.events.beforeinstallprompt({ preventDefault() {} });
  browser.display.matches = true;
  browser.display.change();
  assert.equal(browser.button.hidden, true);
});

test('failed browser prompts are handled and cannot be reused', async () => {
  const { events, button } = loadInstallUi();
  let calls = 0;
  events.beforeinstallprompt({ preventDefault() {}, async prompt() { calls++; throw new Error('expired'); } });
  await button.click();
  await button.click();
  assert.equal(calls, 1);
  assert.equal(button.hidden, true);
});

test('manifest icons exist as PNGs with their declared dimensions', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.webmanifest'), 'utf8'));
  for (const icon of manifest.icons) {
    const data = fs.readFileSync(path.join(__dirname, '..', icon.src));
    assert.equal(data.subarray(1, 4).toString(), 'PNG');
    assert.equal(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`, icon.sizes);
  }
});
