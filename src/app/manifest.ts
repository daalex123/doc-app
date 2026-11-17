import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Deyon Dispensary & Pharmacy",
    short_name: "Deyon Dispensary & Pharmacy",
    description: "Book doctor appointments and manage your medical history.",
    id: "/portal",
    start_url: "/portal?source=pwa",
    scope: "/",
    lang: "en",
    categories: ["medical", "health"],
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#5a88c6",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
