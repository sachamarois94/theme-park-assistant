import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Theme Park Assistant",
    short_name: "Park Assistant",
    description: "Live queue intelligence and day planning for Orlando Disney and Universal parks.",
    start_url: "/",
    display: "standalone",
    background_color: "#040812",
    theme_color: "#040812",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/apple-touch-icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any"
      }
    ]
  };
}
