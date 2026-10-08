// Publish docs/research/prior-art/*.md as site pages under /prior-work/.
// The repo notes are the single source of truth; the generated pages are gitignored.
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";

const SRC = new URL("../../docs/research/prior-art/", import.meta.url).pathname;
const OUT = new URL("../src/content/docs/prior-work/", import.meta.url).pathname;
const REPO = "https://github.com/mbaneshi/persian-cli";

await mkdir(OUT, { recursive: true });
const files = (await readdir(SRC)).filter((f) => f.endsWith(".md"));

for (const file of files) {
  const slug = basename(file, ".md");
  const raw = await readFile(join(SRC, file), "utf8");
  const title = raw.match(/^#\s+(.+)$/m)?.[1].trim() ?? slug;
  const body = raw.replace(/^#\s+.+\n+/m, "");
  const source = `docs/research/prior-art/${file}`;
  const page = [
    "---",
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(`Prior-art notes on ${title}, read in code and mapped onto the nine layers.`)}`,
    `editUrl: ${JSON.stringify(`${REPO}/edit/dev/${source}`)}`,
    "---",
    "",
    `:::note`,
    `Generated from [\`${source}\`](${REPO}/blob/dev/${source}). Back to the [prior-work overview](/persian-cli/prior-work/).`,
    `:::`,
    "",
    body,
  ].join("\n");
  await writeFile(join(OUT, file), page);
}
console.log(`[sync-prior-art] ${files.length} pages → src/content/docs/prior-work/`);
