// Parses Kubernetes resource quantity strings (cpu/memory) into base units.

/** CPU quantity ("500m", "2", "2000000n") -> cores. */
export function cpuToCores(qty: string | undefined): number {
  if (!qty) return 0;
  if (qty.endsWith('n')) return parseFloat(qty) / 1e9;
  if (qty.endsWith('u')) return parseFloat(qty) / 1e6;
  if (qty.endsWith('m')) return parseFloat(qty) / 1e3;
  return parseFloat(qty);
}

const MEMORY_SUFFIXES: Record<string, number> = {
  Ki: 1024,
  Mi: 1024 ** 2,
  Gi: 1024 ** 3,
  Ti: 1024 ** 4,
  K: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
};

/** Memory quantity ("128Mi", "2Gi", "1024") -> bytes. */
export function memoryToBytes(qty: string | undefined): number {
  if (!qty) return 0;
  const match = qty.match(/^(\d+(?:\.\d+)?)([A-Za-z]*)$/);
  if (!match) return 0;
  const [, num, suffix] = match;
  const multiplier = suffix ? MEMORY_SUFFIXES[suffix] ?? 1 : 1;
  return parseFloat(num) * multiplier;
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

export function formatCores(cores: number): string {
  if (cores < 1) return `${Math.round(cores * 1000)}m`;
  return `${cores.toFixed(2)}`;
}

export function percent(used: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, (used / total) * 100);
}
