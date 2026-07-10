#!/usr/bin/env node
import assert from 'assert';
import { isAllowedHref } from './lib/safe-href.mjs';

assert.strictEqual(isAllowedHref('https://example.com/x'), true);
assert.strictEqual(isAllowedHref('/event/foo'), true);
assert.strictEqual(isAllowedHref('javascript:alert(1)'), false);
assert.strictEqual(isAllowedHref('data:text/html,hi'), false);
assert.strictEqual(isAllowedHref('//evil.example/'), false);

console.log('ok safeHref allowlist');
