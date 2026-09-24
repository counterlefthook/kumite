import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kumite",
    short_name: "Kumite",
    description: "Workouts, desk sets, and the week's goals.",
    start_url: "/",
    display: "standalone",
    background_color: "#150c0a",
    theme_color: "#150c0a",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
