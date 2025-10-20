import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

/**
 * Staging Mode Configuration
 * 
 * This is a production build optimized for debugging in sandbox environments:
 * - No file watchers (works in sandbox)
 * - Source maps enabled (for debugging)
 * - Minimal minification (readable code)
 * - Console logs preserved
 * - React DevTools enabled
 */

const plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime()];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  
  // Staging-specific build configuration
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    
    // Enable source maps for debugging
    sourcemap: true,
    
    // Minimal minification to keep code readable
    minify: 'esbuild',
    
    // Keep original variable names
    target: 'esnext',
    
    // Rollup options for better debugging
    rollupOptions: {
      output: {
        // Preserve module structure
        manualChunks: undefined,
        
        // Keep readable names
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    
    // Don't clear console in production
    logLevel: 'info',
  },
  
  // Define staging mode
  define: {
    'process.env.NODE_ENV': JSON.stringify('staging'),
    '__DEV__': true,
  },
  
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});

