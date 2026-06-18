const re = /var\((--[a-z0-9-]+),\s*\d+px\)/g;
const s = 'padding-left: calc(var(--space-md) + var(--scrollbar-width, 6px));';
const m = s.match(re);
console.log('match:', m);
console.log('replace result:', s.replace(re, 'var($1)'));
