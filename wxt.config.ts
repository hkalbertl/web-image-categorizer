import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: "src",
  manifest: ({ browser, manifestVersion, mode, command }) => {
    return {
      name: "Web Image Categorizer",
      short_name: "WIC",
      permissions: ["activeTab", "storage", "contextMenus", "notifications"],
      host_permissions: [
        "*://*/*"
      ],
      browser_specific_settings: 'firefox' === browser ? {
        gecko: {
          id: "{bea31321-7d20-4dc1-a53f-5affb7b85a24}",
          strict_min_version: "127.0"
        }
      } : undefined,
    };
  },
});
