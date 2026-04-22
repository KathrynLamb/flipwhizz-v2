import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/studio",
        "/orders",
        "/account",
        "/api/",
        "/login",
        "/signup",
        "/_next/"
      ],
    },
    sitemap: "https://www.flipwhizz.com/sitemap.xml",
  };
}