import { Request, Response, NextFunction } from "express";

/**
 * Strip HTML tags and control characters from a string.
 */
function sanitizeString(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")        // Strip HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "") // Strip control characters (preserve newlines/tabs)
    .trim();
}

/**
 * Recursively check an object for NoSQL injection patterns
 * and sanitize string values.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeObject(obj: any): any {
  if (typeof obj === "string") {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (obj !== null && typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      // Reject keys starting with $ or containing . (NoSQL injection vectors)
      if (key.startsWith("$") || key.includes(".")) {
        continue; // Silently drop suspicious keys
      }
      sanitized[key] = sanitizeObject(obj[key]);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Express middleware that sanitizes request body to prevent
 * NoSQL injection and XSS via stored HTML.
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }
  next();
};
