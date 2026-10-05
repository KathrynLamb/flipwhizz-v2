// src/instrumentation.ts
//
// Next.js calls onRequestError for any error thrown while rendering a page
// or running a route/server action that nothing else caught. Routes wrapped
// with withAlerts() catch their own errors, so they won't double-alert.

export async function register() {
  // nothing to set up
}

export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Expected Next.js control-flow "errors" (redirect / notFound) aren't failures.
  const digest = (error as { digest?: string } | null)?.digest ?? "";
  if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")) {
    return;
  }

  try {
    const { sendAlert } = await import("@/lib/alerts");
    await sendAlert({
      area: `${context.routeType}:${context.routePath}`,
      title: `Uncaught error on ${context.routePath}`,
      severity: "error",
      error,
      context: { method: request.method, path: request.path, routerKind: context.routerKind },
    });
  } catch (err) {
    console.error("[instrumentation] failed to send alert:", err);
  }
}
