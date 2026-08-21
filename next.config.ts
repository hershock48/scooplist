import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
    NOINDEX until this is a launched product with its own domain. Same
    reasoning as every Glazed spec build: a half-launched tool ranking for a
    client's name helps nobody. Remove when Scooplist gets a real home.
  */
  async headers() {
    return [
      { source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
