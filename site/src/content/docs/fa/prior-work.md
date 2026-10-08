---
title: کارهای پیشین
description: ده تلاش پیشین برای فارسی و راست‌به‌چپ در ترمینال؛ هر کدام در سطح کد خوانده و بر نُه لایهٔ ما نگاشته شده است.
---

چند پروژه پیش‌تر بخش‌هایی از این مسئله را هدف گرفته‌اند. ما **کد** هر کدام را خواندیم، نه فقط README آن را، و آن را بر [نُه لایه](/persian-cli/fa/problem-map/) نگاشتیم. فهرست کامل با شواهد در سطح فایل در [`docs/research/prior-art.md`](https://github.com/mbaneshi/persian-cli/blob/dev/docs/research/prior-art.md) آمده است.

## فهرست

| پروژه | نوع | شکل‌دهی | دوجهتی | داوری |
|---|---|---|---|---|
| [RtlTerminal](https://github.com/mbaneshi/persian-cli/blob/dev/docs/research/prior-art/rtlterminal.md) | ترمینال ویندوز | WPF، واژه‌به‌واژه | حدسی | جدی‌ترین: بافر منطقی و کپی درست، اما بدون UAX #9 و با فشردن گلیف‌ها در خانه‌ها |
| [termenal-web](https://github.com/mbaneshi/persian-cli/blob/dev/docs/research/prior-art/termenal-web.md) | ترمینال مرورگر | HarfBuzz | سطوح UAX #9 | بهترین طرح مرجع: نگاشت منطقی↔دیداری برای هر سطر |
| [termux-app-arabic](https://github.com/mbaneshi/persian-cli/blob/dev/docs/research/prior-art/termux-app-arabic.md) | ترمینال اندروید | HarfBuzz | UAX #9 در هر سطر | اثبات مفهوم، فقط در لایهٔ رندر |
| [Tarminal](https://github.com/mbaneshi/persian-cli/blob/dev/docs/research/prior-art/tarminal.md) | ترمینال macOS | (کدی در مخزن نیست) | ندارد | پوسته‌ای روی SwiftTerm |
| [Terminal-ar](https://github.com/mbaneshi/persian-cli/blob/dev/docs/research/prior-art/terminal-ar.md) | لایهٔ رویی Electron | Chromium | حدسی | قابل استفاده نیست (بدون مجوز) |
| [ar-terminal](https://github.com/mbaneshi/persian-cli/blob/dev/docs/research/prior-art/ar-terminal.md) | لایهٔ رویی VS Code | Chromium / فرم‌های نمایشی | سطربه‌سطر | قابل استفاده نیست (بدون مجوز) |
| [estaterm](https://github.com/mbaneshi/persian-cli/blob/dev/docs/research/prior-art/estaterm.md) | پراکسی PTY | فرم‌های نمایشی | FriBidi | ترفند ترتیب دیداری |
| [bidiscope](https://github.com/mbaneshi/persian-cli/blob/dev/docs/research/prior-art/bidiscope.md) | کتابخانهٔ xterm.js | فرم‌های نمایشی | UAX #9 ناقص | ایدهٔ درست، اجرای نادرست |
| [fa-console](https://github.com/mbaneshi/persian-cli/blob/dev/docs/research/prior-art/fa-console.md) | پوشش stdout پایتون | فرم‌های نمایشی | python-bidi | یکسان‌سازی خوب در لایهٔ ۱ |
| [rtl-terminal](https://github.com/mbaneshi/persian-cli/blob/dev/docs/research/prior-art/rtl-terminal.md) | افزونهٔ Claude Code | — | نویسه‌های کنترلی از راه پرامپت | دست‌کاری محتوا؛ مجموعه‌آزمون مفید |

## آنچه این پروژه‌ها به ما می‌گویند

۱. **بازنویسی متن همیشه هزینه دارد.** هر ابزاری که فرم‌های نمایشی یا ترتیب دیداری را در ترمینال نوشت، کپی، جست‌وجو یا دنباله‌های کنترلی را شکست و از برنامه‌های تمام‌صفحه دست کشید. رندرکننده‌هایی که بافر را منطقی نگه داشتند، کپی را درست انجام دادند.

۲. **مسئلهٔ پهنا حل نشده است.** هیچ پروژه‌ای متن شکل‌داده‌شدهٔ فارسی را با شبکهٔ خانه‌ها هماهنگ نمی‌کند؛ گلیف‌ها فشرده، بریده یا سرریز می‌شوند.

۳. **مالتی‌پلکسرها دست‌نخورده مانده‌اند.** هیچ‌یک از این ده پروژه tmux یا Zellij را در نظر نگرفته است.

۴. **کسی بر سر مالکیت دوجهتی توافق نمی‌کند.** همه آن را بی‌قیدوشرط یا حدسی اعمال می‌کنند، حتی درون برنامه‌های تمام‌صفحه.

۵. **ورودی نادیده گرفته شده است.** هیچ پروژه‌ای ترکیب IME یا ورود نیم‌فاصله را مدیریت نمی‌کند.

۶. **READMEها اغراق می‌کنند.** برای همین کارنامهٔ ما اندازه می‌گیرد و به ادعا اعتماد نمی‌کند.

## کارهای پیشین خودمان

پیش از این آزمایشگاه، یک رندرکنندهٔ کارت عنوان فارسی برای Blender ساختیم (arabic-reshaper و python-bidi) و در کنارش شکل‌دهی واقعی با HarfBuzz را آزمودیم. دو درس مستقیم به این پروژه می‌رسد: **شکستن سطرها به ترتیب منطقی و سپس اعمال دوجهتی برای هر سطر**، و **جدا کردن تکه‌های دوجهتی پیش از شکل‌دهی**؛ HarfBuzz به‌تنهایی «API» را «IPA» نشان داد. جزئیات: [`our-earlier-work.md`](https://github.com/mbaneshi/persian-cli/blob/dev/docs/research/prior-art/our-earlier-work.md).
