// Contract: https://api.lulu.com/api-docs/openapi-specs/openapi_public.yml
// Lulu requires separate interior and cover PDFs. Never submit a Gelato PDF here.
export type LuluEnvironment = "sandbox" | "production";
export class LuluClient {
  private readonly base: string;
  constructor(private readonly config: { clientKey: string; clientSecret: string; environment: LuluEnvironment }, private readonly fetcher: typeof fetch = fetch) {
    this.base = config.environment === "production" ? "https://api.lulu.com" : "https://api.sandbox.lulu.com";
  }
  async request<T>(path: string, body?: unknown): Promise<T> {
    if (!this.config.clientKey || !this.config.clientSecret) throw new Error("Lulu credentials are not configured");
    const auth = await this.fetcher(`${this.base}/auth/realms/glasstree/protocol/openid-connect/token`, {
      method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${this.config.clientKey}:${this.config.clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials", signal: AbortSignal.timeout(20000), cache: "no-store",
    });
    if (!auth.ok) throw new Error(`Lulu authentication failed (${auth.status})`);
    const token = await auth.json() as { access_token?: string };
    if (!token.access_token) throw new Error("Lulu authentication returned no token");
    const response = await this.fetcher(`${this.base}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000), cache: "no-store",
    });
    // Do not retry mutations automatically: a timeout can mean the job was accepted.
    if (!response.ok) throw new Error(`Lulu request failed (${response.status}) at ${path}`);
    return response.json() as Promise<T>;
  }
  coverDimensions(podPackageId: string, pageCount: number) {
    return this.request<{ width: string; height: string; unit: string }>("/cover-dimensions/", { pod_package_id: podPackageId, interior_page_count: pageCount, unit: "pt" });
  }
  validateInterior(url: string, podPackageId: string) {
    return this.request<{ id: number; status: string }>("/validate-interior/", { source_url: url, pod_package_id: podPackageId });
  }
  validateCover(url: string, podPackageId: string, pageCount: number) {
    return this.request<{ id: number; status: string }>("/validate-cover/", { source_url: url, pod_package_id: podPackageId, interior_page_count: pageCount });
  }
}
export function luluClient() {
  const environment = process.env.LULU_ENVIRONMENT ?? "sandbox";
  if (environment !== "sandbox" && environment !== "production") throw new Error("Invalid LULU_ENVIRONMENT");
  return new LuluClient({ clientKey: process.env.LULU_CLIENT_KEY ?? "", clientSecret: process.env.LULU_CLIENT_SECRET ?? "", environment });
}
export function luluPrintEnabled() {
  try { colouringPodPackageId(); } catch { return false; }
  return process.env.LULU_PRINT_ENABLED === "true" && process.env.LULU_ENVIRONMENT === "production" && Boolean(process.env.LULU_CLIENT_KEY && process.env.LULU_CLIENT_SECRET && process.env.LULU_COLOURING_POD_PACKAGE_ID && process.env.LULU_CONTACT_EMAIL && process.env.LULU_SHIPPING_LEVEL);
}
export function luluAdminSandboxEnabled(isAdmin: boolean): boolean {
  if (!isAdmin || process.env.LULU_ENVIRONMENT !== "sandbox" || !process.env.LULU_CLIENT_KEY || !process.env.LULU_CLIENT_SECRET) return false;
  try { colouringPodPackageId(); return true; } catch { return false; }
}
export function colouringPurchaseError(bookType: string, productType: string, isAdmin = false): string | null {
  if (bookType !== "colouring_storybook" || productType === "digital") return null;
  if (productType === "gift") return "Colouring storybooks are available as a digital book or paperback. Choose one of those formats.";
  return (luluPrintEnabled() || luluAdminSandboxEnabled(isAdmin)) ? null : "Printed colouring storybooks are not available yet. You can choose the digital edition to print at home.";
}
export type ColouringBinding = "PB" | "CO";

// 8.5-inch square B&W, 60# uncoated white; retain the exact configured Lulu ID.
export function colouringPackage(id: string) {
  const match = /^0850X0850BW(?:STD|PRE)(PB|CO)060UW\d{3}[MG]XX$/.exec(id.replaceAll(".", ""));
  if (!match) throw new Error("This exporter supports only 8.5-inch square B&W perfect-bound or coil-bound paperback on 60# uncoated white paper. Check the Lulu package ID.");
  const binding = match[1] as ColouringBinding;
  return { id, binding, maxPages: binding === "CO" ? 470 : 800 };
}
export function colouringPodPackageId() {
  const id = process.env.LULU_COLOURING_POD_PACKAGE_ID;
  if (!id) throw new Error("Select and configure a Lulu colouring paperback in LULU_COLOURING_POD_PACKAGE_ID");
  return colouringPackage(id).id;
}
export function validateColouringPageCount(id: string, pageCount: number) {
  const product = colouringPackage(id);
  const minimum = product.binding === "CO" ? 2 : 32;
  if (!Number.isInteger(pageCount) || pageCount < minimum || pageCount > product.maxPages || pageCount % 2 !== 0) {
    throw new Error(`This Lulu ${product.binding === "CO" ? "coil-bound" : "perfect-bound"} product requires an even interior page count from ${minimum} to ${product.maxPages}.`);
  }
}
