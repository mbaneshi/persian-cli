// Publish docs/research/prior-art/*.md as site pages under /prior-work/.
// The repo notes are the single source of truth; the generated pages are gitignored.
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";

const ROOT = new URL("../../docs/research/prior-art/", import.meta.url).pathname;
const DOCS = new URL("../src/content/docs/", import.meta.url).pathname;
const REPO = "https://github.com/mbaneshi/persian-cli";

// English notes live at the root; translations in <locale>/ subfolders.
const LOCALES = [
  { dir: "", out: "prior-work", note: (src) => `Generated from [\`${src}\`](${REPO}/blob/dev/${src}). Back to the [prior-work overview](/persian-cli/prior-work/).`, desc: (t) => `Prior-art notes on ${t}, read in code and mapped onto the nine layers.` },
  { dir: "fa", out: "fa/prior-work", note: (src) => `این صفحه از [\`${src}\`](${REPO}/blob/dev/${src}) ساخته شده است. بازگشت به [نمای کلی کارهای پیشین](/persian-cli/fa/prior-work/).`, desc: (t) => `یادداشت‌های پژوهشی دربارهٔ ${t}، خوانده‌شده در سطح کد و نگاشته‌شده بر نُه لایه.` },
];

let total = 0;
for (const loc of LOCALES) {
const SRC = join(ROOT, loc.dir);
const OUT = join(DOCS, loc.out);
await mkdir(OUT, { recursive: true });
const files = (await readdir(SRC).catch(() => [])).filter((f) => f.endsWith(".md"));
total += files.length;

for (const file of files) {
  const slug = basename(file, ".md");
  const raw = await readFile(join(SRC, file), "utf8");
  const title = raw.match(/^#\s+(.+)$/m)?.[1].trim() ?? slug;
  const body = raw.replace(/^#\s+.+\n+/m, "");
  const source = `docs/research/prior-art/${loc.dir ? loc.dir + "/" : ""}${file}`;
  const page = [
    "---",
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(loc.desc(title))}`,
    `editUrl: ${JSON.stringify(`${REPO}/edit/dev/${source}`)}`,
    "---",
    "",
    `:::note`,
    loc.note(source),
    `:::`,
    "",
    body,
  ].join("\n");
  await writeFile(join(OUT, file), page);
}
}
console.log(`[sync-prior-art] ${total} pages → src/content/docs/{,fa/}prior-work/`);
