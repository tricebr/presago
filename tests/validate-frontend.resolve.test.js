const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');

const scripts = path.resolve(__dirname, '../scripts');
const helper = import(pathToFileURL(path.join(scripts, 'frontend-assets.mjs')).href);
const cases = [
  ['styles.css', 'styles.css'],
  ['styles.css?v=2', 'styles.css'],
  ['pages/../styles.css', 'styles.css'],
  ['https://example.invalid/styles.css', null],
  ['mailto:synthetic@example.invalid', null],
  ['#anchor', null],
  ['missing.css', 'missing.css'],
  ['styles.css#section', 'styles.css'],
  ['styles.css?v=2#section', 'styles.css'],
  ['tel:000', null],
  ['data:text/plain,fixture', null],
  ['HTTP://example.invalid', null],
];
for (const [reference, expected] of cases) {
  test(reference, async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'validator-assets-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(path.join(root, 'scripts'));
    fs.mkdirSync(path.join(root, 'frontend'));
    const page = path.join(root, 'frontend/index.html');
    const { resolveLocalAsset } = await helper;
    assert.equal(resolveLocalAsset(page, reference), expected === null ? null : path.join(root, 'frontend', expected));
    for (const name of ['validate-frontend.mjs', 'frontend-assets.mjs']) fs.copyFileSync(path.join(scripts, name), path.join(root, 'scripts', name));
    fs.writeFileSync(path.join(root, 'frontend/styles.css'), '/* synthetic */');
    fs.writeFileSync(page, '<html lang="en"><head><meta charset="utf-8"><meta name="viewport"><title>Fixture</title></head><body><a href="' + reference + '">link</a></body></html>');
    const run = spawnSync(process.execPath, [path.join(root, 'scripts/validate-frontend.mjs')], { cwd: root, encoding: 'utf8', timeout: 5000 });
    assert.ifError(run.error);
    assert.equal(run.status, expected === 'missing.css' ? 1 : 0, run.stderr);
    assert.deepEqual(run.stderr.split(/\r?\n/).filter((line) => line.startsWith('- ')),
      expected === 'missing.css' ? ["- frontend/index.html: references missing local asset 'missing.css'"] : []);
  });
}
