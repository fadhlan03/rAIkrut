// This shim replaces the native 'canvas' package when bundling with Turbopack.
// It exports an empty object so any code importing 'canvas' continues to work
// without failing at runtime in environments where the native bindings are unavailable.
export default {}; 