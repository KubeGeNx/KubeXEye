import { describe, it, expect } from 'vitest';
import { cpuToCores, memoryToBytes, formatBytes, formatCores, percent } from './resourceUnits';

describe('cpuToCores', () => {
  it('parses millicores', () => {
    expect(cpuToCores('500m')).toBeCloseTo(0.5);
  });

  it('parses whole cores', () => {
    expect(cpuToCores('2')).toBe(2);
  });

  it('parses nanocores', () => {
    expect(cpuToCores('2000000000n')).toBeCloseTo(2);
  });

  it('parses microcores', () => {
    expect(cpuToCores('500000u')).toBeCloseTo(0.5);
  });

  it('returns 0 for undefined', () => {
    expect(cpuToCores(undefined)).toBe(0);
  });
});

describe('memoryToBytes', () => {
  it('parses Mi/Gi suffixes', () => {
    expect(memoryToBytes('128Mi')).toBe(128 * 1024 * 1024);
    expect(memoryToBytes('2Gi')).toBe(2 * 1024 ** 3);
  });

  it('parses decimal SI suffixes', () => {
    expect(memoryToBytes('2G')).toBe(2e9);
  });

  it('parses a bare number as bytes', () => {
    expect(memoryToBytes('1024')).toBe(1024);
  });

  it('returns 0 for undefined or unparseable input', () => {
    expect(memoryToBytes(undefined)).toBe(0);
    expect(memoryToBytes('not-a-quantity')).toBe(0);
  });
});

describe('formatBytes', () => {
  it('renders 0 as a bare zero', () => {
    expect(formatBytes(0)).toBe('0');
  });

  it('picks the largest sensible unit', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MiB');
    expect(formatBytes(1536 * 1024 * 1024)).toBe('1.5 GiB');
  });
});

describe('formatCores', () => {
  it('renders sub-core values in millicores', () => {
    expect(formatCores(0.25)).toBe('250m');
  });

  it('renders whole-and-above core values with two decimals', () => {
    expect(formatCores(2)).toBe('2.00');
  });
});

describe('percent', () => {
  it('computes a basic percentage', () => {
    expect(percent(50, 200)).toBe(25);
  });

  it('clamps at 100', () => {
    expect(percent(300, 200)).toBe(100);
  });

  it('returns 0 when total is 0 (avoids divide-by-zero)', () => {
    expect(percent(10, 0)).toBe(0);
  });
});
