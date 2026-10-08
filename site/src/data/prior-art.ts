// Structured prior-art catalog: the data behind the Prior work overview.
// Evidence lives in docs/research/prior-art/<slug>.md. Keep statuses in sync with those notes.

export type Lang = "en" | "fa";
export type Status = "full" | "partial" | "none" | "unknown";
export type Family = "renderer" | "transform" | "wrapper" | "prompt";
type L10n = Record<Lang, string>;

export interface Project {
  slug: string;
  name: string;
  repo: string;
  family: Family;
  kind: L10n;
  platform: L10n;
  shaping: L10n;
  bidi: L10n;
  license: string | null; // null = no LICENSE file in the repo
  /** Layers 1–9, in order. */
  layers: [Status, Status, Status, Status, Status, Status, Status, Status, Status];
  verdict: L10n;
}

const F = "full", P = "partial", N = "none", U = "unknown";

export const layers: L10n[] = [
  { en: "Encoding", fa: "رمزگذاری" },
  { en: "Input", fa: "ورودی" },
  { en: "Width", fa: "پهنا" },
  { en: "Shaping", fa: "شکل‌دهی" },
  { en: "Bidi", fa: "دوجهتی" },
  { en: "Cursor & copy", fa: "مکان‌نما و کپی" },
  { en: "Fonts", fa: "قلم‌ها" },
  { en: "Multi­plexers", fa: "مالتی‌پلکسر" },
  { en: "Apps & TUI", fa: "برنامه‌ها و TUI" },
];

export const families: Record<Family, L10n> = {
  renderer: { en: "Logical-buffer renderer", fa: "رندرکنندهٔ بافر منطقی" },
  transform: { en: "Text transformer", fa: "بازنویس متن" },
  wrapper: { en: "Wrapper", fa: "پوسته" },
  prompt: { en: "Prompt plugin", fa: "افزونهٔ پرامپتی" },
};

export const projects: Project[] = [
  {
    slug: "rtlterminal", name: "RtlTerminal", repo: "https://github.com/mirbehnam/RtlTerminal",
    family: "renderer",
    kind: { en: "Terminal emulator", fa: "شبیه‌ساز ترمینال" },
    platform: { en: "Windows (WPF + ConPTY)", fa: "ویندوز (WPF + ConPTY)" },
    shaping: { en: "WPF, per word", fa: "WPF، واژه‌به‌واژه" },
    bidi: { en: "Hand-rolled heuristic", fa: "حدسی و دست‌ساز" },
    license: "MIT",
    layers: [P, P, P, F, P, F, P, N, P],
    verdict: {
      en: "The most serious prior art: logical buffer, logical copy and visual→logical mouse mapping. But its bidi isn't UAX #9, and it squashes words into cells.",
      fa: "جدی‌ترین کار پیشین: بافر منطقی، کپی منطقی و نگاشت کلیک به جای منطقی. اما دوجهتی‌اش UAX #9 نیست و واژه‌ها را در خانه‌ها فشرده می‌کند.",
    },
  },
  {
    slug: "termenal-web", name: "termenal-web", repo: "https://github.com/sbay-dev/termenal-web",
    family: "renderer",
    kind: { en: "Browser terminal (prototype)", fa: "ترمینال مرورگر (نمونهٔ اولیه)" },
    platform: { en: "Browser + Node PTY", fa: "مرورگر + Node PTY" },
    shaping: { en: "HarfBuzz, per bidi run", fa: "HarfBuzz، برای هر تکهٔ یک‌جهته" },
    bidi: { en: "UAX #9 levels; paragraph by majority", fa: "سطوح UAX #9؛ جهت پاراگراف با اکثریت" },
    license: "MIT",
    layers: [N, P, P, F, P, F, P, N, P],
    verdict: {
      en: "Best reference design: a per-row logical↔visual map with logical copy. The WASM core and WebGPU renderer it claims are not in the code.",
      fa: "بهترین طرح مرجع: نگاشت منطقی↔دیداری برای هر سطر و کپی منطقی. هستهٔ WASM و رندر WebGPU که ادعا می‌کند در کد نیست.",
    },
  },
  {
    slug: "termux-app-arabic", name: "termux-app-arabic", repo: "https://github.com/kimo0076/termux-app-arabic",
    family: "renderer",
    kind: { en: "Terminal emulator (fork)", fa: "شبیه‌ساز ترمینال (انشعاب)" },
    platform: { en: "Android", fa: "اندروید" },
    shaping: { en: "Platform HarfBuzz, full line", fa: "HarfBuzz سیستم، با کل سطر" },
    bidi: { en: "UAX #9 per row, base forced LTR", fa: "UAX #9 برای هر سطر، پایهٔ LTR" },
    license: "GPLv3",
    layers: [N, N, P, F, P, P, N, N, N],
    verdict: {
      en: "A ~300-line renderer proof of concept. Touch and selection are not mapped back, there are no tests, and it is applied unconditionally.",
      fa: "اثبات مفهومی در حدود ۳۰۰ خط، فقط در لایهٔ رندر. لمس و انتخاب به متن منطقی برنمی‌گردند، آزمونی ندارد و همیشه روشن است.",
    },
  },
  {
    slug: "tarminal", name: "Tarminal", repo: "https://github.com/Moshe-ship/Tarminal",
    family: "wrapper",
    kind: { en: "Terminal emulator (SwiftTerm shell)", fa: "شبیه‌ساز ترمینال (پوستهٔ SwiftTerm)" },
    platform: { en: "macOS", fa: "macOS" },
    shaping: { en: "None in repo", fa: "کدی در مخزن ندارد" },
    bidi: { en: "None", fa: "ندارد" },
    license: "MIT",
    layers: [U, U, U, U, N, U, P, N, U],
    verdict: {
      en: "A wrapper with no Arabic, bidi or width code of its own. The thing to study is SwiftTerm.",
      fa: "پوسته‌ای بدون هیچ کد عربی، دوجهتی یا پهنای خودش. آنچه باید مطالعه شود خود SwiftTerm است.",
    },
  },
  {
    slug: "terminal-ar", name: "Terminal-ar", repo: "https://github.com/yuossef21/Terminal-ar",
    family: "renderer",
    kind: { en: "Overlay over xterm.js (Electron)", fa: "لایهٔ رویی روی xterm.js (Electron)" },
    platform: { en: "Windows / Linux", fa: "ویندوز / لینوکس" },
    shaping: { en: "Chromium, per span", fa: "Chromium، برای هر بخش" },
    bidi: { en: "Heuristic, per span", fa: "حدسی، برای هر بخش" },
    license: null,
    layers: [N, N, N, P, P, P, P, N, P],
    verdict: {
      en: "Not reusable (claims MIT, ships no license). The mirrored cursor disagrees with the text, and there are no tests.",
      fa: "قابل استفاده نیست (ادعای MIT بدون فایل مجوز). مکان‌نمای آینه‌شده با متن نمی‌خواند و آزمونی ندارد.",
    },
  },
  {
    slug: "ar-terminal", name: "ar-terminal", repo: "https://github.com/alzahrani-khalid/ar-terminal",
    family: "renderer",
    kind: { en: "VS Code overlay + PTY transform", fa: "لایهٔ رویی VS Code + بازنویسی PTY" },
    platform: { en: "VS Code", fa: "VS Code" },
    shaping: { en: "Chromium / presentation forms", fa: "Chromium / فرم‌های نمایشی" },
    bidi: { en: "Blink per row / bidi-js baked in", fa: "Blink سطربه‌سطر / bidi-js پخته در متن" },
    license: null,
    layers: [N, P, N, P, P, P, P, N, P],
    verdict: {
      en: "Not reusable (no license). Its main path keeps copy logical but misaligns cursor and selection; its fallback path is the visual-order hack.",
      fa: "قابل استفاده نیست (بدون مجوز). مسیر اصلی کپی را منطقی نگه می‌دارد اما مکان‌نما و انتخاب ناهمخوان‌اند؛ مسیر دوم همان ترفند ترتیب دیداری است.",
    },
  },
  {
    slug: "estaterm", name: "estaterm", repo: "https://github.com/a1-t1/estaterm",
    family: "transform",
    kind: { en: "PTY proxy", fa: "پراکسی PTY" },
    platform: { en: "Linux", fa: "لینوکس" },
    shaping: { en: "FriBidi → presentation forms", fa: "FriBidi ← فرم‌های نمایشی" },
    bidi: { en: "UAX #9 (FriBidi), per chunk", fa: "UAX #9 (FriBidi)، تکه‌تکه" },
    license: "Apache-2.0",
    layers: [N, P, N, P, P, N, N, N, P],
    verdict: {
      en: "The textbook visual-order hack, and it steps aside on the alternate screen. Only its FriBidi call sequence is worth reusing.",
      fa: "نمونهٔ کلاسیک ترفند ترتیب دیداری که در صفحهٔ جایگزین کنار می‌کشد. فقط ترتیب فراخوانی FriBidi آن ارزش برداشتن دارد.",
    },
  },
  {
    slug: "bidiscope", name: "bidiscope", repo: "https://github.com/fmoed/bidiscope",
    family: "transform",
    kind: { en: "Library + xterm.js overlay", fa: "کتابخانه + لایهٔ رویی xterm.js" },
    platform: { en: "JS / browser", fa: "جاوااسکریپت / مرورگر" },
    shaping: { en: "Hand table → presentation forms", fa: "جدول دست‌ساز ← فرم‌های نمایشی" },
    bidi: { en: "Partial UAX #9 (no BD13)", fa: "UAX #9 ناقص (بدون BD13)" },
    license: "MIT",
    layers: [N, N, N, P, P, P, N, N, P],
    verdict: {
      en: "Right instinct (an overlay keeps the buffer logical), wrong execution. Its 99.91 % conformance claim is unverified.",
      fa: "ایدهٔ درست (لایهٔ رویی بافر را منطقی نگه می‌دارد)، اجرای نادرست. ادعای ۹۹٫۹۱٪ انطباقش اثبات نشده است.",
    },
  },
  {
    slug: "fa-console", name: "fa-console", repo: "https://github.com/Padandish/fa-console",
    family: "transform",
    kind: { en: "Python stdout wrapper", fa: "پوشش stdout پایتون" },
    platform: { en: "Windows console", fa: "کنسول ویندوز" },
    shaping: { en: "arabic-reshaper → presentation forms", fa: "arabic-reshaper ← فرم‌های نمایشی" },
    bidi: { en: "python-bidi or whole-line reversal", fa: "python-bidi یا وارونه‌سازی کل سطر" },
    license: "MIT",
    layers: [F, P, N, P, P, P, P, N, N],
    verdict: {
      en: "Reusable for layer 1 (UTF-8 setup, ي/ك → ی/ک folding). Its display path is a visual-order hack that corrupts ANSI.",
      fa: "برای لایهٔ ۱ ارزشمند است (راه‌اندازی UTF-8، یکسان‌سازی ي/ك به ی/ک). بخش نمایشش ترفند ترتیب دیداری است و ANSI را خراب می‌کند.",
    },
  },
  {
    slug: "rtl-terminal", name: "rtl-terminal", repo: "https://github.com/Tal9392/rtl-terminal",
    family: "prompt",
    kind: { en: "Claude Code plugin (prompt only)", fa: "افزونهٔ Claude Code (فقط پرامپت)" },
    platform: { en: "Claude Code", fa: "Claude Code" },
    shaping: { en: "None", fa: "ندارد" },
    bidi: { en: "Asks the model to emit controls", fa: "از مدل می‌خواهد نویسهٔ کنترلی بگذارد" },
    license: "MIT",
    layers: [N, N, N, N, P, N, N, N, P],
    verdict: {
      en: "Markdown only: no hook, no detection, nothing enforced. Worth taking: isolating paths with LRI…PDI, and its test corpus.",
      fa: "فقط چند فایل Markdown: بدون هوک، بدون تشخیص، بدون هیچ اجبار. ارزش برداشتن: جداسازی مسیرها با LRI…PDI و مجموعه‌آزمونش.",
    },
  },
];

export const lessons: { title: L10n; body: L10n }[] = [
  {
    title: { en: "Rewriting the text always costs", fa: "بازنویسی متن همیشه هزینه دارد" },
    body: {
      en: "Every tool that wrote presentation forms or visual order into the terminal broke copy, search or escape sequences, and gave up on full-screen apps. The renderers that kept a logical buffer got copy right.",
      fa: "هر ابزاری که فرم‌های نمایشی یا ترتیب دیداری را در ترمینال نوشت، کپی، جست‌وجو یا دنباله‌های کنترلی را شکست و از برنامه‌های تمام‌صفحه دست کشید. رندرکننده‌هایی که بافر را منطقی نگه داشتند، کپی را درست انجام دادند.",
    },
  },
  {
    title: { en: "Width is unsolved", fa: "مسئلهٔ پهنا حل نشده است" },
    body: {
      en: "No project fits shaped Persian to the cell grid. Glyphs are squashed, clipped, or allowed to overflow. This is the core research question.",
      fa: "هیچ پروژه‌ای متن شکل‌داده‌شدهٔ فارسی را با شبکهٔ خانه‌ها هماهنگ نمی‌کند؛ گلیف‌ها فشرده، بریده یا سرریز می‌شوند. این پرسش اصلی پژوهش است.",
    },
  },
  {
    title: { en: "Multiplexers: 0 of 10", fa: "مالتی‌پلکسرها: صفر از ده" },
    body: {
      en: "Every terminal-side implementation treats a physical row as the bidi paragraph, so a tmux or Zellij split would merge RTL runs across pane borders. Nobody has looked.",
      fa: "همهٔ پیاده‌سازی‌های سمت ترمینال هر سطر فیزیکی را یک پاراگراف دوجهتی می‌گیرند؛ پس در قاب‌بندی tmux یا Zellij، تکه‌های راست‌به‌چپ از مرز قاب‌ها رد می‌شوند. کسی به آن نپرداخته است.",
    },
  },
  {
    title: { en: "Nobody negotiates who owns bidi", fa: "کسی بر سر مالکیت دوجهتی توافق نمی‌کند" },
    body: {
      en: "All of them apply bidi unconditionally or by guesswork, including inside full-screen apps. None uses the explicit modes of the BiDi in Terminal Emulators draft.",
      fa: "همه دوجهتی را بی‌قیدوشرط یا حدسی اعمال می‌کنند، حتی درون برنامه‌های تمام‌صفحه. هیچ‌کدام از حالت‌های صریح پیش‌نویس BiDi in Terminal Emulators استفاده نمی‌کند.",
    },
  },
  {
    title: { en: "Input is ignored", fa: "ورودی نادیده گرفته شده است" },
    body: {
      en: "No project handles IME composition, ZWNJ entry or logical cursor movement while typing.",
      fa: "هیچ پروژه‌ای ترکیب IME، ورود نیم‌فاصله یا حرکت منطقی مکان‌نما هنگام تایپ را مدیریت نمی‌کند.",
    },
  },
  {
    title: { en: "READMEs overstate", fa: "READMEها اغراق می‌کنند" },
    body: {
      en: "Five projects claim more than their code does, and two claim MIT without a license file. Our scorecard measures; it never repeats claims, including our own.",
      fa: "پنج پروژه بیش از آنچه کدشان دارد ادعا می‌کنند و دو پروژه بدون فایل مجوز ادعای MIT دارند. کارنامهٔ ما اندازه می‌گیرد و ادعا را تکرار نمی‌کند، حتی ادعای خودمان را.",
    },
  },
];

export const reuse: { from: string; what: L10n; layers: string }[] = [
  {
    from: "termenal-web",
    what: { en: "Per-row colToVisual / visualToCol permutation; shaping per bidi run with explicit direction", fa: "جایگشت colToVisual / visualToCol برای هر سطر؛ شکل‌دهی هر تکهٔ یک‌جهته با جهت صریح" },
    layers: "5 · 6",
  },
  {
    from: "RtlTerminal",
    what: { en: "Logical selection offsets and visual→logical mouse mapping, with tests; zero width for marks and ZWNJ", fa: "انتخاب متن با جای منطقی و نگاشت کلیک به جای منطقی، همراه با آزمون؛ پهنای صفر برای اعراب و نیم‌فاصله" },
    layers: "3 · 6",
  },
  {
    from: "termux-app-arabic",
    what: { en: "Shape whole runs with full-line context; draw the cursor as an overlay; force an LTR base so reordering stays local", fa: "شکل‌دهی کل تکه با زمینهٔ کامل سطر؛ کشیدن مکان‌نما به‌صورت لایهٔ جدا؛ پایهٔ LTR تا جابه‌جایی محلی بماند" },
    layers: "4 · 5",
  },
  {
    from: "fa-console",
    what: { en: "UTF-8 setup; ي/ك → ی/ک and digit folding; the rule that program data stays logical", fa: "راه‌اندازی UTF-8؛ یکسان‌سازی ي/ك به ی/ک و رقم‌ها؛ قاعدهٔ «داده‌های برنامه منطقی می‌مانند»" },
    layers: "1",
  },
  {
    from: "estaterm",
    what: { en: "The FriBidi call sequence (not its output path)", fa: "ترتیب فراخوانی FriBidi (نه مسیر خروجی‌اش)" },
    layers: "5",
  },
  {
    from: "rtl-terminal",
    what: { en: "LRI…PDI isolation around paths and code; a before/after test corpus", fa: "جداسازی مسیرها و کد با LRI…PDI؛ مجموعه‌آزمون پیش و پس" },
    layers: "5 · tests",
  },
];
