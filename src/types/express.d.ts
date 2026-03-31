// Minimal Express type declarations.
// The express package ships no TypeScript types and @types/express is not
// installed; this file provides just enough surface area for the web server
// files to type-check.
//
// Only add declarations for what the project actually uses.

declare module "express" {
  import type { IncomingMessage, ServerResponse, Server } from "http";

  export interface Request extends IncomingMessage {
    params: Record<string, string>;
    query: Record<string, string | string[] | undefined>;
    body: unknown;
    path: string;
    originalUrl: string;
    headers: Record<string, string | string[] | undefined> & { host?: string; cookie?: string; authorization?: string; accept?: string };
    get(name: string): string | undefined;
  }

  export interface Response extends ServerResponse {
    status(code: number): this;
    json(body: unknown): this;
    send(body: unknown): this;
    sendFile(path: string): void;
    redirect(url: string): void;
    redirect(status: number, url: string): void;
    setHeader(name: string, value: string | string[]): this;
    end(): this;
    cookie(name: string, value: string, options?: Record<string, unknown>): this;
    clearCookie(name: string): this;
  }

  export type NextFunction = (err?: unknown) => void;

  export interface RequestHandler {
    (req: Request, res: Response, next: NextFunction): void;
  }

  export interface ErrorRequestHandler {
    (err: unknown, req: Request, res: Response, next: NextFunction): void;
  }

  export interface RouterOptions {
    strict?: boolean;
    caseSensitive?: boolean;
  }

  export interface Router {
    get(path: string, ...handlers: RequestHandler[]): this;
    post(path: string, ...handlers: RequestHandler[]): this;
    put(path: string, ...handlers: RequestHandler[]): this;
    delete(path: string, ...handlers: RequestHandler[]): this;
    use(handler: RequestHandler): this;
    use(path: string, ...handlers: (RequestHandler | Router)[]): this;
    param(name: string, handler: RequestHandler): this;
  }

  export interface Application extends Router {
    use(handler: RequestHandler): this;
    use(path: string, ...handlers: (RequestHandler | Router)[]): this;
    listen(port: number, host: string, callback?: () => void): Server;
    listen(port: number, callback?: () => void): Server;
    set(setting: string, val: unknown): this;
  }

  interface ExpressFactory {
    (): Application;
    /** Creates a new router instance. */
    Router(options?: RouterOptions): Router;
    json(): RequestHandler;
    urlencoded(options: { extended: boolean }): RequestHandler;
    static(root: string, options?: Record<string, unknown>): RequestHandler;
  }

  const express: ExpressFactory;
  export default express;
}
