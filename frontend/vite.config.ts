import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Vite 配置：React 插件 + Tailwind v4 插件 + @ 别名指向 src
// dev server 跑 5173，/api 代理到后端 8000，避免 CORS 麻烦（虽然后端已开 CORS）
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        // 用 127.0.0.1 强制 IPv4：uvicorn 默认只监听 IPv4，
        // 若写 localhost，Node 会优先解析成 IPv6 ::1 → ECONNREFUSED ::1:8000
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
