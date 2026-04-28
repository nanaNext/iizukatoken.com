#!/usr/bin/env node
/**
 * Fresh server start - clears all require cache
 */

// Clear all require cache
delete require.cache[require.resolve('../src/modules/faq/faq.repository')];
delete require.cache[require.resolve('../src/modules/faq/faq.controller')];
delete require.cache[require.resolve('../src/modules/faq/faq.routes')];

// Force garbage collection
if (global.gc) {
  global.gc();
}

console.log('');
console.log('========================================');
console.log('Starting Fresh Server (All Cache Cleared)');
console.log('========================================');
console.log('');

// Now start the app
require('./index.js');
