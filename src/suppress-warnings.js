const originalWarn = console.warn;
console.warn = function(...args) {
    if (typeof args[0] === 'string' && args[0].includes('Multiple instances of Three.js')) return;
    originalWarn.apply(console, args);
};
