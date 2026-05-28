import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#f7f4ee",
    description: "Voice-first AI interview practice with Que.",
    display: "standalone",
    icons: [
      {
        sizes: "any",
        src: "/brand/quesiq-icon.png",
        type: "image/png",
      },
    ],
    name: "QuesIQ Interview",
    orientation: "portrait",
    scope: "/",
    short_name: "QuesIQ",
    start_url: "/",
    theme_color: "#f7f4ee",
  };
}
