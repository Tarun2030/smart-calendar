import { NextRequest } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory rate limiter (for production, use Redis or similar)
const rateLimitMap = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100; // max requests per window

/**
 * Simple in-memory rate limiter.
 * For production, replace with Redis-based rate limiting.
 */
export async function rateLimit(
  request: NextRequest,
  options?: { windowMs?: number; maxRequests?: number }
): Promise<{ success: boolean; remaining: number }> {
  const windowMs = options?.windowMs ?? WINDOW_MS;
  const maxRequests = options?.maxRequests ?? MAX_REQUESTS;

  // Use IP or phone number as key
  const formData = await request.clone().formData().catch(() => null);
  const phoneNumber = formData?.get('From')?.toString() ?? '';
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
  const key = phoneNumber || ip;

  const now = Date.now();
  const entry = rateLimitMap.get(key);

  // Clean up expired entries periodically
  if (rateLimitMap.size > 10000) {
    const keysToDelete: string[] = [];
    rateLimitMap.forEach((v, k) => {
      if (v.resetAt < now) {
        keysToDelete.push(k);
      }
    });
    keysToDelete.forEach((k) => rateLimitMap.delete(k));
  }

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { success: false, remaining: 0 };
  }

  entry.count++;
  return { success: true, remaining: maxRequests - entry.count };
}
