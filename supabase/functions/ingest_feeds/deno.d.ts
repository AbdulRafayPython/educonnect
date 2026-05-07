// Ambient declarations to silence the Node-targeted TypeScript language server
// in editors that don't run the Deno extension. The runtime (Deno) does not
// need any of this — it resolves the URL imports and `Deno` global natively.
//
// Safe to keep in the repo: it has no effect on `supabase functions deploy`,
// which uses Deno's own module resolution.

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: { get: (key: string) => string | undefined };
};

declare module "@supabase/supabase-js" {
  // deno-lint-ignore no-explicit-any
  export const createClient: any;
  // deno-lint-ignore no-explicit-any
  export type SupabaseClient = any;
}

declare module "fast-xml-parser" {
  // deno-lint-ignore no-explicit-any
  export const XMLParser: any;
}
