/**
 * Supresi otomatis Node.js ExperimentalWarning khusus untuk node:sqlite bawaan Node 22+.
 * Dijalankan sebelum database dimuat agar log console terminal produksi tetap bersih.
 */
if (typeof process !== 'undefined' && typeof process.emitWarning === 'function') {
  const originalEmitWarning = process.emitWarning;
  process.emitWarning = function (warning: string | Error, ...args: unknown[]) {
    if (typeof warning === 'string' && warning.includes('SQLite is an experimental feature')) {
      return;
    }
    if (
      typeof warning === 'object' &&
      warning !== null &&
      'name' in warning &&
      warning.name === 'ExperimentalWarning' &&
      'message' in warning &&
      typeof warning.message === 'string' &&
      warning.message.includes('SQLite')
    ) {
      return;
    }
    return Reflect.apply(originalEmitWarning, process, [warning, ...args]);
  };
}

export {};
