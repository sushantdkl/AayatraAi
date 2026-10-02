import { config } from "dotenv";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

config({ path: ".env.e2e.local" });
config();

const chrome =
  process.env.CHROME_PATH ??
  ["/opt/pw-browsers/chromium", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"].find((path) => existsSync(path));
const base = process.env.APP_ORIGIN ?? "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
});
await mkdir(".impeccable/review", { recursive: true });
try {
  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["mobile", 390, 844],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(`${base}/login`, { waitUntil: "networkidle" });
    const passwordField = page.getByLabel("Password", { exact: true });
    if ((await passwordField.getAttribute("type")) !== "password") throw new Error(`${name}: password is not initially hidden`);
    await page.getByRole("button", { name: "Show password" }).click();
    if ((await passwordField.getAttribute("type")) !== "text") throw new Error(`${name}: password visibility toggle did not show text`);
    await page.getByRole("button", { name: "Hide password" }).click();
    if ((await passwordField.getAttribute("type")) !== "password") throw new Error(`${name}: password visibility toggle did not hide text`);
    await page
      .getByLabel("Email address")
      .fill(process.env.E2E_EMAIL ?? process.env.BOOTSTRAP_EMAIL ?? "");
    await page
      .getByLabel("Password", { exact: true })
      .fill(process.env.E2E_PASSWORD ?? process.env.BOOTSTRAP_PASSWORD ?? "");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page
      .getByRole("heading", { name: "Who should I talk to right now?" })
      .waitFor();
    await page.getByText("Your sales desk is ready.").waitFor();
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: /Leads/ }).click();
    await page.getByRole("heading", { name: "All leads" }).waitFor();
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Campaigns" }).click();
    await page.getByRole("heading", { name: "Campaigns" }).waitFor();
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Pipeline" }).click();
    await page.getByRole("heading", { name: "Opportunity pipeline", exact: true }).waitFor();
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Overview" }).click();
    await page.screenshot({
      path: resolve(`.impeccable/review/${name}.png`),
      fullPage: true,
    });
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Sales automation" }).click();
    await page.getByRole("heading", { name: "Sales automation settings" }).waitFor();
    await page.getByText(/Tax status: PAN only/).waitFor();
    await page.getByRole("heading", { name: "Company → Tax & Registration" }).waitFor();
    await page.screenshot({ path: resolve(`.impeccable/review/company-${name}.png`), fullPage: true });
    await page.getByRole("tab", { name: "Feature claims" }).click();
    await page.getByText("Multi-branch operation").waitFor();
    await page.screenshot({ path: resolve(`.impeccable/review/features-${name}.png`), fullPage: true });
    await page.getByRole("tab", { name: "WhatsApp" }).click();
    await page.getByRole("heading", { name: "WhatsApp channel" }).waitFor();
    await page.getByRole("tab", { name: "Commercial catalogue" }).click();
    await page.getByText(/OWNER_APPROVED_POSTER_2026\) are canonical/).waitFor();
    await page.getByRole("tab", { name: "Demo applications" }).click();
    await page.getByText("No live demo will run until a target is checked and approved.").waitFor();
    await page.screenshot({ path: resolve(`.impeccable/review/automation-${name}.png`), fullPage: true });
    await page.getByRole("tab", { name: "Tax & sales limits" }).click();
    await page.getByRole("heading", { name: "Tax and sales limits" }).waitFor();
    await page.getByLabel("Tax treatment").waitFor();
    await page.screenshot({ path: resolve(`.impeccable/review/policy-${name}.png`), fullPage: true });
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Priority inbox" }).click();
    await page.getByRole("heading", { name: "Priority inbox" }).waitFor();
    await page.getByRole("button", { name: /^All/ }).click();
    const momo = page.locator(".inbox-list-row", { hasText: "E2E Momo Cafe" }).first();
    if (await momo.count()) {
      await momo.click();
      await page.getByText("Suggested reply", { exact: true }).waitFor();
      await page.getByRole("textbox", { name: "Suggested reply" }).waitFor();
    }
    await page.screenshot({ path: resolve(`.impeccable/review/inbox-${name}.png`), fullPage: true });
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Quotes & delivery" }).click();
    await page.getByRole("heading", { name: "Quotes & delivery" }).waitFor();
    await page.screenshot({ path: resolve(`.impeccable/review/lifecycle-${name}.png`), fullPage: true });
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    if (pageWidth > width + 1) throw new Error(`${name}: horizontal overflow ${pageWidth}px > ${width}px`);
    console.log(`${name}: authenticated dashboard rendered`);
    await context.close();
  }
} finally {
  await browser.close();
}
