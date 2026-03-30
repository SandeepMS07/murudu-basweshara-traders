import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MB Groups",
    short_name: "MB Groups",
    description: "MB Groups purchase, sales, billing, and expense management.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0b0d",
    theme_color: "#0b0b0d",
    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
