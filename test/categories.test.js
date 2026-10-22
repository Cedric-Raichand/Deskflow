import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryFor, extensionOf, CATEGORY_NAMES } from '../src/categories.js';

test('maps common extensions to categories', () => {
  assert.equal(categoryFor('report.pdf'), 'Documents');
  assert.equal(categoryFor('photo.jpg'), 'Images');
  assert.equal(categoryFor('setup.exe'), 'Installers');
  assert.equal(categoryFor('archive.zip'), 'Archives');
  assert.equal(categoryFor('project.js'), 'Code');
});

test('extension matching is case-insensitive', () => {
  assert.equal(categoryFor('SCAN.PDF'), 'Documents');
  assert.equal(extensionOf('Photo.JPG'), '.jpg');
});

test('no extension or unknown extension goes to Other', () => {
  assert.equal(categoryFor('Makefile'), 'Other');
  assert.equal(categoryFor('data.xyz123'), 'Other');
});

test('only the last extension counts', () => {
  assert.equal(categoryFor('backup.tar.gz'), 'Archives');
});

test('Other is a known category name', () => {
  assert.ok(CATEGORY_NAMES.includes('Other'));
});