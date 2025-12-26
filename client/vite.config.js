import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      // Proxy API requests to Cell1 server (Beijing region - vtgate_cell1)
      '/api/cell1': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cell1/, ''),
      },
      // Proxy API requests to Cell2 server (HongKong region - vtgate_cell2)
      '/api/cell2': {
        target: 'http://localhost:8082',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cell2/, ''),
      },
      // Proxy API requests to Cell3 server (Backup region - vtgate_cell3)
      '/api/cell3': {
        target: 'http://localhost:8083',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cell3/, ''),
      },
      // Proxy HDFS WebHDFS requests to avoid CORS issues
      '/hdfs': {
        target: 'http://localhost:9870',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hdfs/, '/webhdfs/v1'),
        followRedirects: true,
      },
    },
  },
});
