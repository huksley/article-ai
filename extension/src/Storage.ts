// PRAGMA: keep-js, standalone
"use strict";

export class Storage {
  list() {
    return Object.keys(localStorage);
  }
  set(key: string, value: unknown) {
    return localStorage.setItem(key, String(value));
  }

  get(key: string, def?: string) {
    return localStorage.getItem(key) || def;
  }

  getBool(key: string, def: boolean): boolean {
    const val = localStorage.getItem(key);
    if (val === "true") return true;
    return def;
  }

  getInt(key: string, def: number): number {
    const val = localStorage.getItem(key);
    if (val) return parseInt(val, 10);
    return def;
  }

  remove(key: string) {
    return localStorage.removeItem(key);
  }
}
