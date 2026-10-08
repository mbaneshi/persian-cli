import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://mbaneshi.github.io",
  base: "/persian-cli",
  integrations: [
    starlight({
      title: "persian-cli",
      description: "A research lab for making Persian a first-class language in the terminal.",
      defaultLocale: "root",
      locales: {
        root: { label: "English", lang: "en" },
        fa: { label: "فارسی", lang: "fa", dir: "rtl" },
      },
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/mbaneshi/persian-cli" },
      ],
      editLink: { baseUrl: "https://github.com/mbaneshi/persian-cli/edit/dev/site/" },
      customCss: ["@fontsource-variable/vazirmatn", "./src/styles/fa.css"],
      sidebar: [
        { label: "Start here", translations: { fa: "شروع" }, items: [{ slug: "problem-map" }] },
      ],
    }),
  ],
});
