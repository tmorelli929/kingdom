import type { MetadataRoute } from "next";

// Lets the dashboard be added to a phone's home screen and open full screen, like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kingdom",
    short_name: "Kingdom",
    description: "Your calendar, training, habits and people in one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#111316",
    theme_color: "#111316",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
