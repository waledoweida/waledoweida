// Minimal request/response types for Vercel Node functions (Vercel adds body, query and cookies
// to Node's IncomingMessage). Kept local to avoid pulling @vercel/node and its dependency tree.
import type { IncomingMessage, ServerResponse } from 'http';

export interface ApiRequest extends IncomingMessage {
  body?: unknown;
  query: Record<string, string | string[] | undefined>;
}

export type ApiResponse = ServerResponse;
