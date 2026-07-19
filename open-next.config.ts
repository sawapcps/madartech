import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // تكوين التطبيق الأساسي
  override: {
    wrapper: "cloudflare-node",
    converter: "edge",
    proxyExternalRequest: "fetch",
    incrementalCache: "dummy",
    tagCache: "dummy",
    queue: "dummy",
  },
  // تكوين Middleware (لنتجاوزه حالياً)
  middleware: {
    external: true,
  },
});