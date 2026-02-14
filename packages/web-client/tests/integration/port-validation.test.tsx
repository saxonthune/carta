/**
 * Test: Port Validation Logic
 *
 * Verifies that port connection validation works correctly:
 * - Same-direction pairs (source-source, sink-sink) are blocked
 * - Relay acts as source but bypasses compatibility
 * - Intercept acts as sink but bypasses compatibility
 * - Bidirectional is compatible with everything
 * - Plain source+sink require compatibleWith match
 *
 * This tests the PortRegistry.canConnect() logic.
 */

import { describe, it, expect } from 'vitest';
import { PortRegistry } from '@carta/domain';
import type { PortSchema } from '@carta/domain';

describe('Port Validation', () => {
  // Create test port schemas for different scenarios
  const testSchemas: PortSchema[] = [
    // Standard source/sink pair
    {
      id: 'data-out',
      displayName: 'Data Out',
      semanticDescription: 'Outputs data',
      polarity: 'source',
      compatibleWith: ['data-in'],
      color: '#22c55e',
    },
    {
      id: 'data-in',
      displayName: 'Data In',
      semanticDescription: 'Receives data',
      polarity: 'sink',
      compatibleWith: ['data-out'],
      color: '#3b82f6',
    },
    // Another source/sink pair (incompatible with first pair)
    {
      id: 'event-out',
      displayName: 'Event Out',
      semanticDescription: 'Emits events',
      polarity: 'source',
      compatibleWith: ['event-in'],
      color: '#f59e0b',
    },
    {
      id: 'event-in',
      displayName: 'Event In',
      semanticDescription: 'Handles events',
      polarity: 'sink',
      compatibleWith: ['event-in'], // Intentionally wrong to test mismatch
      color: '#ef4444',
    },
    // Bidirectional port
    {
      id: 'symmetric',
      displayName: 'Symmetric',
      semanticDescription: 'Bidirectional connection',
      polarity: 'bidirectional',
      compatibleWith: [],
      color: '#6366f1',
    },
    // Relay port (acts as source, bypasses compatibility)
    {
      id: 'relay',
      displayName: 'Relay',
      semanticDescription: 'Pass-through output',
      polarity: 'relay',
      compatibleWith: [],
      color: '#f59e0b',
    },
    // Intercept port (acts as sink, bypasses compatibility)
    {
      id: 'intercept',
      displayName: 'Intercept',
      semanticDescription: 'Interceptor input',
      polarity: 'intercept',
      compatibleWith: [],
      color: '#f59e0b',
    },
    // Wildcard compatibility port
    {
      id: 'universal-out',
      displayName: 'Universal Out',
      semanticDescription: 'Connects to any sink',
      polarity: 'source',
      compatibleWith: ['*'],
      color: '#ec4899',
    },
  ];

  describe('polarity blocking', () => {
    it('should block source-to-source connections', () => {
      const registry = new PortRegistry(testSchemas);

      // data-out (source) to event-out (source) should be blocked
      expect(registry.canConnect('data-out', 'event-out')).toBe(false);
      expect(registry.canConnect('event-out', 'data-out')).toBe(false);
    });

    it('should block sink-to-sink connections', () => {
      const registry = new PortRegistry(testSchemas);

      // data-in (sink) to event-in (sink) should be blocked
      expect(registry.canConnect('data-in', 'event-in')).toBe(false);
      expect(registry.canConnect('event-in', 'data-in')).toBe(false);
    });

    it('should allow source-to-sink connections (when compatible)', () => {
      const registry = new PortRegistry(testSchemas);

      // data-out (source) to data-in (sink) should work
      expect(registry.canConnect('data-out', 'data-in')).toBe(true);
      expect(registry.canConnect('data-in', 'data-out')).toBe(true);
    });
  });

  describe('relay polarity', () => {
    it('should block relay-to-relay (both act as source)', () => {
      const registry = new PortRegistry(testSchemas);

      expect(registry.canConnect('relay', 'relay')).toBe(false);
    });

    it('should block relay-to-source (both effective source)', () => {
      const registry = new PortRegistry(testSchemas);

      expect(registry.canConnect('relay', 'data-out')).toBe(false);
      expect(registry.canConnect('data-out', 'relay')).toBe(false);
    });

    it('should allow relay-to-sink (bypasses compatibility)', () => {
      const registry = new PortRegistry(testSchemas);

      // Relay should connect to any sink, even without compatibleWith
      expect(registry.canConnect('relay', 'data-in')).toBe(true);
      expect(registry.canConnect('relay', 'event-in')).toBe(true);
    });

    it('should allow sink-to-relay', () => {
      const registry = new PortRegistry(testSchemas);

      expect(registry.canConnect('data-in', 'relay')).toBe(true);
    });
  });

  describe('intercept polarity', () => {
    it('should block intercept-to-intercept (both act as sink)', () => {
      const registry = new PortRegistry(testSchemas);

      expect(registry.canConnect('intercept', 'intercept')).toBe(false);
    });

    it('should block intercept-to-sink (both effective sink)', () => {
      const registry = new PortRegistry(testSchemas);

      expect(registry.canConnect('intercept', 'data-in')).toBe(false);
      expect(registry.canConnect('data-in', 'intercept')).toBe(false);
    });

    it('should allow intercept-to-source (bypasses compatibility)', () => {
      const registry = new PortRegistry(testSchemas);

      // Intercept should accept any source, even without compatibleWith
      expect(registry.canConnect('intercept', 'data-out')).toBe(true);
      expect(registry.canConnect('intercept', 'event-out')).toBe(true);
    });

    it('should allow source-to-intercept', () => {
      const registry = new PortRegistry(testSchemas);

      expect(registry.canConnect('data-out', 'intercept')).toBe(true);
    });
  });

  describe('bidirectional polarity', () => {
    it('should allow bidirectional-to-source', () => {
      const registry = new PortRegistry(testSchemas);

      expect(registry.canConnect('symmetric', 'data-out')).toBe(true);
    });

    it('should allow bidirectional-to-sink', () => {
      const registry = new PortRegistry(testSchemas);

      expect(registry.canConnect('symmetric', 'data-in')).toBe(true);
    });

    it('should allow bidirectional-to-bidirectional', () => {
      const registry = new PortRegistry(testSchemas);

      expect(registry.canConnect('symmetric', 'symmetric')).toBe(true);
    });

    it('should allow bidirectional-to-relay', () => {
      const registry = new PortRegistry(testSchemas);

      expect(registry.canConnect('symmetric', 'relay')).toBe(true);
    });

    it('should allow bidirectional-to-intercept', () => {
      const registry = new PortRegistry(testSchemas);

      expect(registry.canConnect('symmetric', 'intercept')).toBe(true);
    });
  });

  describe('compatibleWith matching', () => {
    it('should allow connection when source lists target in compatibleWith', () => {
      const registry = new PortRegistry(testSchemas);

      // data-out has compatibleWith: ['data-in']
      expect(registry.canConnect('data-out', 'data-in')).toBe(true);
    });

    it('should allow connection when target lists source in compatibleWith', () => {
      const registry = new PortRegistry(testSchemas);

      // data-in has compatibleWith: ['data-out']
      expect(registry.canConnect('data-in', 'data-out')).toBe(true);
    });

    it('should block connection when neither side lists the other', () => {
      const registry = new PortRegistry(testSchemas);

      // data-out has compatibleWith: ['data-in'], not event-in
      // event-in has compatibleWith: ['event-in'], not data-out
      expect(registry.canConnect('data-out', 'event-in')).toBe(false);
    });

    it('should allow connection with wildcard compatibleWith', () => {
      const registry = new PortRegistry(testSchemas);

      // universal-out has compatibleWith: ['*']
      expect(registry.canConnect('universal-out', 'data-in')).toBe(true);
      expect(registry.canConnect('universal-out', 'event-in')).toBe(true);
    });
  });

  describe('unknown port types', () => {
    it('should deny connection with unknown source port', () => {
      const registry = new PortRegistry(testSchemas);

      expect(registry.canConnect('unknown-port', 'data-in')).toBe(false);
    });

    it('should deny connection with unknown target port', () => {
      const registry = new PortRegistry(testSchemas);

      expect(registry.canConnect('data-out', 'unknown-port')).toBe(false);
    });

    it('should deny connection with both unknown ports', () => {
      const registry = new PortRegistry(testSchemas);

      expect(registry.canConnect('unknown-1', 'unknown-2')).toBe(false);
    });
  });

  describe('relay and intercept interaction', () => {
    it('should allow relay-to-intercept (source-like to sink-like)', () => {
      const registry = new PortRegistry(testSchemas);

      expect(registry.canConnect('relay', 'intercept')).toBe(true);
    });

    it('should allow intercept-to-relay (sink-like to source-like)', () => {
      const registry = new PortRegistry(testSchemas);

      expect(registry.canConnect('intercept', 'relay')).toBe(true);
    });
  });
});
