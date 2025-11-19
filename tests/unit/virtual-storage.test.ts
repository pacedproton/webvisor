/**
 * Virtual Storage Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createVirtualStorage } from '../../src/core/virtual-platform/virtual-storage.js';

describe('VirtualStorage', () => {
  let storage: ReturnType<typeof createVirtualStorage>;

  beforeEach(() => {
    storage = createVirtualStorage();
  });

  describe('localStorage', () => {
    it('should set and get items', () => {
      storage.localStorage.setItem('key1', 'value1');
      expect(storage.localStorage.getItem('key1')).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      expect(storage.localStorage.getItem('nonexistent')).toBeNull();
    });

    it('should remove items', () => {
      storage.localStorage.setItem('key1', 'value1');
      storage.localStorage.removeItem('key1');

      expect(storage.localStorage.getItem('key1')).toBeNull();
    });

    it('should clear all items', () => {
      storage.localStorage.setItem('key1', 'value1');
      storage.localStorage.setItem('key2', 'value2');

      storage.localStorage.clear();

      expect(storage.localStorage.length).toBe(0);
      expect(storage.localStorage.getItem('key1')).toBeNull();
    });

    it('should report correct length', () => {
      expect(storage.localStorage.length).toBe(0);

      storage.localStorage.setItem('key1', 'value1');
      expect(storage.localStorage.length).toBe(1);

      storage.localStorage.setItem('key2', 'value2');
      expect(storage.localStorage.length).toBe(2);

      storage.localStorage.removeItem('key1');
      expect(storage.localStorage.length).toBe(1);
    });

    it('should get key by index', () => {
      storage.localStorage.setItem('key1', 'value1');
      storage.localStorage.setItem('key2', 'value2');

      const key0 = storage.localStorage.key(0);
      const key1 = storage.localStorage.key(1);

      expect([key0, key1]).toContain('key1');
      expect([key0, key1]).toContain('key2');
    });

    it('should return null for invalid index', () => {
      expect(storage.localStorage.key(999)).toBeNull();
    });

    it('should check if key exists', () => {
      storage.localStorage.setItem('key1', 'value1');

      expect(storage.localStorage.has('key1')).toBe(true);
      expect(storage.localStorage.has('nonexistent')).toBe(false);
    });

    it('should get all keys', () => {
      storage.localStorage.setItem('key1', 'value1');
      storage.localStorage.setItem('key2', 'value2');

      const keys = storage.localStorage.keys();

      expect(keys).toHaveLength(2);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });

    it('should get all values', () => {
      storage.localStorage.setItem('key1', 'value1');
      storage.localStorage.setItem('key2', 'value2');

      const values = storage.localStorage.values();

      expect(values).toHaveLength(2);
      expect(values).toContain('value1');
      expect(values).toContain('value2');
    });

    it('should get all entries', () => {
      storage.localStorage.setItem('key1', 'value1');
      storage.localStorage.setItem('key2', 'value2');

      const entries = storage.localStorage.entries();

      expect(entries).toHaveLength(2);
      expect(entries).toContainEqual(['key1', 'value1']);
      expect(entries).toContainEqual(['key2', 'value2']);
    });

    it('should calculate storage size', () => {
      expect(storage.localStorage.getSize()).toBe(0);

      storage.localStorage.setItem('key', 'value');
      expect(storage.localStorage.getSize()).toBeGreaterThan(0);
    });
  });

  describe('sessionStorage', () => {
    it('should work independently from localStorage', () => {
      storage.localStorage.setItem('key', 'local');
      storage.sessionStorage.setItem('key', 'session');

      expect(storage.localStorage.getItem('key')).toBe('local');
      expect(storage.sessionStorage.getItem('key')).toBe('session');
    });

    it('should have same API as localStorage', () => {
      storage.sessionStorage.setItem('key1', 'value1');
      expect(storage.sessionStorage.getItem('key1')).toBe('value1');

      storage.sessionStorage.removeItem('key1');
      expect(storage.sessionStorage.getItem('key1')).toBeNull();

      storage.sessionStorage.setItem('key2', 'value2');
      storage.sessionStorage.clear();
      expect(storage.sessionStorage.length).toBe(0);
    });
  });

  describe('Serialization', () => {
    it('should serialize localStorage', () => {
      storage.localStorage.setItem('key1', 'value1');
      storage.localStorage.setItem('key2', 'value2');

      const serialized = storage.localStorage.serialize();

      expect(serialized).toEqual({
        key1: 'value1',
        key2: 'value2',
      });
    });

    it('should deserialize localStorage', () => {
      const data = {
        key1: 'value1',
        key2: 'value2',
      };

      storage.localStorage.deserialize(data);

      expect(storage.localStorage.getItem('key1')).toBe('value1');
      expect(storage.localStorage.getItem('key2')).toBe('value2');
      expect(storage.localStorage.length).toBe(2);
    });

    it('should clear previous data when deserializing', () => {
      storage.localStorage.setItem('old', 'data');

      const data = { new: 'data' };
      storage.localStorage.deserialize(data);

      expect(storage.localStorage.getItem('old')).toBeNull();
      expect(storage.localStorage.getItem('new')).toBe('data');
      expect(storage.localStorage.length).toBe(1);
    });
  });

  describe('State Management', () => {
    it('should get state', () => {
      storage.localStorage.setItem('local', 'data');
      storage.sessionStorage.setItem('session', 'data');

      const state = storage.getState();

      expect(state.localStorage).toEqual({ local: 'data' });
      expect(state.sessionStorage).toEqual({ session: 'data' });
    });

    it('should set state', () => {
      const state = {
        localStorage: { key1: 'value1' },
        sessionStorage: { key2: 'value2' },
        indexedDB: { databases: [] },
      };

      storage.setState(state);

      expect(storage.localStorage.getItem('key1')).toBe('value1');
      expect(storage.sessionStorage.getItem('key2')).toBe('value2');
    });

    it('should export storage data', () => {
      storage.localStorage.setItem('key', 'value');

      const exported = storage.export();

      expect(exported).toContain('localStorage');
      expect(exported).toContain('sessionStorage');
    });

    it('should import storage data', () => {
      const data = JSON.stringify({
        localStorage: { imported: 'data' },
        sessionStorage: {},
        indexedDB: { databases: [] },
      });

      storage.import(data);

      expect(storage.localStorage.getItem('imported')).toBe('data');
    });
  });

  describe('Clear All', () => {
    it('should clear all storage', () => {
      storage.localStorage.setItem('local', 'data');
      storage.sessionStorage.setItem('session', 'data');

      storage.clear();

      expect(storage.localStorage.length).toBe(0);
      expect(storage.sessionStorage.length).toBe(0);
    });
  });

  describe('Total Size', () => {
    it('should calculate total storage size', () => {
      storage.localStorage.setItem('key1', 'value1');
      storage.sessionStorage.setItem('key2', 'value2');

      const totalSize = storage.getTotalSize();

      expect(totalSize).toBeGreaterThan(0);
      expect(totalSize).toBe(
        storage.localStorage.getSize() + storage.sessionStorage.getSize()
      );
    });
  });
});
