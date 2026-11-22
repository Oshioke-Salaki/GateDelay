import { themeInitializationScript } from "@/lib/theme";

// A same-origin external script works with script-src 'self', without unsafe-inline.
export const dynamic = "force-static";
export function GET() {
  return new Response(themeInitializationScript, {
    headers: { "Content-Type": "application/javascript; charset=utf-8" },
  });
}
