"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type Query = Record<string, string | number | boolean | null | undefined>;

export function qs(params: Query) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export async function api<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown; query?: Query; silent?: boolean } = {},
): Promise<T> {
  const url = `/api/${path}${opts.query ? qs(opts.query) : ""}`;
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: opts.body ? { "content-type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    const msg = (json as { error?: string } | null)?.error ?? `সার্ভারে সমস্যা (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return json as T;
}

export function useQuery<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loader();
      if (mounted.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : "কিছু একটা ভুল হয়েছে");
    } finally {
      if (mounted.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  return { data, error, loading, refetch: run, setData };
}

/** Debounced value, used for search inputs */
export function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
