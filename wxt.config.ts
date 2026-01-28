import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: "src",
  manifest: ({ browser, manifestVersion, mode, command }) => {
    const isFireFox = 'firefox' === browser;
    const permissions = ["activeTab", "storage", "contextMenus", "notifications"];
    if (!isFireFox) {
      // FireFox does not support offscreen
      permissions.push("offscreen");
    }
    return {
      name: "Web Image Categorizer",
      short_name: "WIC",
      permissions,
      host_permissions: [
        "*://*/*"
      ],
      browser_specific_settings: isFireFox ? {
        gecko: {
          id: "{8276cdb0-d7d9-4e1b-87a0-1f5f1726d806}",
          strict_min_version: "142.0",
          data_collection_permissions: {
            required: ["none"]
          }
        }
      } : undefined,
    };
  },
  vite: (env) => ({
    esbuild: {
      // Drop console log messages when running commands: build / zip
      pure: ['build', 'build:firefox', 'zip', 'zip:firefox'].includes(env.command)
        ? ['console.log', 'console.debug', 'console.trace'] : [],
    },
  }),
});
