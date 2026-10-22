const PREFIX = 'reef:';

// Storage can throw (private mode, blocked site data), so every access is guarded.
export function load(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function save(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    // Ignore: persistence is a convenience, not a requirement.
  }
}
