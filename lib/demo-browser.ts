import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { chromium } from "playwright-core";

export type DemoInspection = {
  finalUrl: string;
  title: string;
  navigation: Array<{ text: string; href: string }>;
  capturedAt: string;
};

export interface DemoBrowserAdapter {
  inspect(baseUrl: string): Promise<DemoInspection>;
}

const forbidden = new BlockList();
for (const [subnet, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) forbidden.addSubnet(subnet, prefix, "ipv4");
for (const [subnet, prefix] of [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const)
  forbidden.addSubnet(subnet, prefix, "ipv6");

export async function assertAllowedDemoHost(urlString: string): Promise<{ origin: string; hostname: string; address: string }> {
  const url = new URL(urlString);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.port && url.port !== "443")
    throw new Error("Demo URLs require standard HTTPS without credentials or fragments");
  const hostname = url.hostname.toLowerCase();
  if (isIP(hostname) || hostname === "localhost" || hostname.endsWith(".local"))
    throw new Error("Demo URL host must be a public DNS name");
  const allowed = (process.env.DEMO_ALLOWED_HOSTS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(hostname)) throw new Error("Demo host is not on the exact-host allowlist");
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (!records.length || records.some((record) => forbidden.check(record.address, record.family === 4 ? "ipv4" : "ipv6")))
    throw new Error("Demo host does not resolve exclusively to public addresses");
  return { origin: url.origin, hostname, address: records[0].address };
}

export class PlaywrightDemoBrowser implements DemoBrowserAdapter {
  async inspect(baseUrl: string): Promise<DemoInspection> {
    const safe = await assertAllowedDemoHost(baseUrl);
    const executablePath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    const browser = await chromium.launch({ executablePath, headless: true, args: [`--host-resolver-rules=MAP ${safe.hostname} ${safe.address}`] });
    try {
      const context = await browser.newContext({ acceptDownloads: false, serviceWorkers: "block" });
      await context.route("**/*", (route) => {
        const requestUrl = new URL(route.request().url());
        if (requestUrl.origin !== safe.origin || !["GET", "HEAD"].includes(route.request().method()))
          return route.abort();
        return route.continue();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
      const finalUrl = page.url();
      if (new URL(finalUrl).origin !== safe.origin) throw new Error("Demo redirected outside its approved origin");
      const title = (await page.title()).slice(0, 200);
      const navigation = await page.locator("nav a, [role=navigation] a").evaluateAll((links) => links.slice(0, 80).map((link) => ({
        text: (link.textContent ?? "").trim().slice(0, 120), href: (link as HTMLAnchorElement).href,
      })));
      return { finalUrl, title, navigation, capturedAt: new Date().toISOString() };
    } finally { await browser.close(); }
  }
}

export class SyntheticDemoBrowser implements DemoBrowserAdapter {
  constructor(private readonly fixture: DemoInspection) {}
  async inspect(): Promise<DemoInspection> { return this.fixture; }
}
