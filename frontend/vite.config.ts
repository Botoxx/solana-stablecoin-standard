import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({ include: ["buffer", "crypto", "stream", "util"] }),
  ],
  optimizeDeps: {
    include: ["@coral-xyz/anchor", "@solana/web3.js", "buffer"],
  },
  build: {
    rollupOptions: {
      output: { manualChunks: { solana: ["@solana/web3.js", "@coral-xyz/anchor"] } },
    },
  },
});
