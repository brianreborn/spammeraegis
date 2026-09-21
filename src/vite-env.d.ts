/// <reference types="vite/client" />

declare module "@tanstack/react-start" {
  type ServerFn<TData, TResult> = (opts: { data: TData }) => Promise<TResult>;

  export function createServerFn(opts?: { method?: string }): {
    validator<T>(fn: (data: unknown) => T): {
      handler<R>(fn: (ctx: { data: T }) => Promise<R> | R): ServerFn<T, R>;
    };
    handler<R>(fn: (ctx: { data: unknown }) => Promise<R> | R): ServerFn<unknown, R>;
  };
}
