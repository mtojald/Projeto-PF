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
  assert.match(server, /app\.delete\('\/api\/reviews\/:id'/);
  assert.match(client, /checkDuplicateReview/);
  assert.match(client, /deleteReview/);
  assert.match(client, /delete-review-btn/);
  assert.match(client, /reviewPinned/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.book_reviews/);
  assert.match(migration, /CHECK \(rating >= 0 AND rating <= 10\)/);
});

test('required static application files are present', () => {
  for (const file of ['index.html', 'style.css', 'app.js', 'db.js', 'server.js', 'schema.sql']) {
    assert.equal(fs.existsSync(path.join(appRoot, file)), true, `${file} should exist`);
  }
});

test('rental copy IDs are required and cannot be reused while active', () => {
  const server = read('server.js');
  const client = read('app.js');
  const db = read('db.js');
  const migrationPath = path.join(repoRoot, 'supabase', 'migrations', '20260822100000_add_rental_copy_id.sql');
  const migration = fs.readFileSync(migrationPath, 'utf8');

  assert.match(server, /copy_id/);
  assert.match(client, /Livro já alugado/);
  assert.match(db, /copy_id/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS rentals_active_copy_id_unique/);
  assert.match(migration, /WHERE status IN \('active', 'overdue'\)/);
});

test('rental table shows the copy ID in its own column', () => {
  const client = read('app.js');
  const index = read('index.html');

  assert.match(index, /<th>ID do livro \/ exemplar<\/th>/);
  assert.match(client, /<td><span class="mono-id"/);
  assert.match(client, /displayCopyId/);
});
