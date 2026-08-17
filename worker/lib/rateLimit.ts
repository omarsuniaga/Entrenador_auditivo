export interface RateLimitState {
  windowStartedAt: number;
  count: number;
}

export interface RateLimitOutcome {
  allowed: boolean;
  state: RateLimitState;
}

export function consumeRateLimit(
  current: RateLimitState,
  limit: number,
  windowMs: number,
  now = Date.now()
): RateLimitOutcome {
  const newWindow = now - current.windowStartedAt >= windowMs;
  const state = newWindow ? { windowStartedAt: now, count: 0 } : current;
  if (state.count >= limit) return { allowed: false, state };

  return { allowed: true, state: { ...state, count: state.count + 1 } };
}
