import { beforeAll, afterAll, jest } from '@jest/globals';

// This file runs before all tests

// Add any global test setup here
beforeAll(() => {
    // Global setup code
});

afterAll(() => {
    // Global cleanup code
});

// Silence console during tests unless explicitly needed
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};