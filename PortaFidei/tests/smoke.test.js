'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
}

test('reviews are wired through the API, UI and Supabase migration', () => {
  const server = read('server.js');
  const client = read('app.js');
  const migrationPath = path.join(repoRoot, 'supabase', 'migrations', '20260817220000_add_book_reviews.sql');
  const migration = fs.readFileSync(migrationPath, 'utf8');

  assert.match(server, /app\.get\('\/api\/reviews'/);
  assert.match(server, /app\.post\('\/api\/reviews'/);
  assert.match(server, /app\.put\('\/api\/reviews\/:id'/);
  assert.match(client, /checkDuplicateReview/);
  assert.match(client, /reviewPinned/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.book_reviews/);
  assert.match(migration, /CHECK \(rating >= 0 AND rating <= 10\)/);
});

test('required static application files are present', () => {
  for (const file of ['index.html', 'style.css', 'app.js', 'db.js', 'server.js', 'schema.sql']) {
    assert.equal(fs.existsSync(path.join(appRoot, file)), true, `${file} should exist`);
  }
});
