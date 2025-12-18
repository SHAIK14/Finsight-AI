/**
 * Dashboard Utilities
 *
 * Shared constants and utilities for dashboard components.
 * Extracted to avoid duplication across split component files.
 */

// API URL - uses environment variable with localhost fallback for development
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Environment-based logger - only logs in development mode
// This prevents console noise in production while keeping debug info available locally
const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args) => isDev && console.log(...args),
  error: (...args) => console.error(...args), // Always log errors
  warn: (...args) => isDev && console.warn(...args),
  info: (...args) => isDev && console.info(...args),
};
