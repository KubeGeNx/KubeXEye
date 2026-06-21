import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Without this, every test's render() output stays in document.body for the rest of the file
// (RTL's auto-cleanup relies on `globals: true`, which we deliberately don't set), causing
// cross-test DOM contamination and bogus "multiple elements found" failures.
afterEach(() => {
  cleanup();
});
