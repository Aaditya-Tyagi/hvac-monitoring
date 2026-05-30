import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

// Single shared MMKV instance for config and history. v4 uses createMMKV()
// factory; the result is the same key-value API (getString/set/delete).
export const storage = createMMKV({ id: 'hvac-monitor' });

// Adapter so Zustand's `persist` middleware can use MMKV directly.
export const mmkvStorage: StateStorage = {
  getItem: (name) => {
    const v = storage.getString(name);
    return v ?? null;
  },
  setItem: (name, value) => storage.set(name, value),
  removeItem: (name) => { storage.remove(name); },
};
