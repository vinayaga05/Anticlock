import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  NAVIGATION_CATALOG,
  findCatalogItem,
  validateNavigation,
} from '../NavigationCatalog.js';

describe('NavigationCatalog', () => {
  it('maps aliases to catalog items', () => {
    const item = findCatalogItem('bookmarks');
    assert.equal(item?.route, 'SavedHub');
  });

  it('allows authenticated navigation to saved hub', () => {
    const result = validateNavigation('SavedHub', {}, true);
    assert.equal(result.ok, true);
  });

  it('blocks guest access to saved hub', () => {
    const result = validateNavigation('SavedHub', {}, false);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'auth_required');
  });

  it('rejects unknown routes', () => {
    const result = validateNavigation('UnknownRoute', {}, true);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'invalid_route');
  });

  it('includes high-value routes from mobile navigator', () => {
    const routes = new Set(NAVIGATION_CATALOG.map(item => item.route));
    assert.ok(routes.has('Profile'));
    assert.ok(routes.has('SavedHub'));
    assert.ok(routes.has('Search'));
    assert.ok(routes.has('MyBookings'));
  });
});
