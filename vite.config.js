function adminRoute() {
  const rewriteAdminRequest = (request, _response, next) => {
    if (!request.url) {
      next();
      return;
    }

    const [pathname, query] = request.url.split("?", 2);
    if (pathname === "/admin/") {
      _response.writeHead(308, { Location: `/admin${query ? `?${query}` : ""}` });
      _response.end();
      return;
    }
    if (pathname === "/admin") {
      request.url = `/admin.html${query ? `?${query}` : ""}`;
    }
    next();
  };

  return {
    name: "admin-friendly-route",
    configureServer(server) {
      server.middlewares.use(rewriteAdminRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewriteAdminRequest);
    }
  };
}

export default {
  plugins: [adminRoute()],
  build: {
    rollupOptions: {
      input: ["index.html", "imovel.html", "admin.html"]
    }
  }
};
