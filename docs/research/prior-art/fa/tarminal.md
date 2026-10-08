# Tarminal
- **مخزن:** https://github.com/Moshe-ship/Tarminal · **کامیت خوانده‌شده:** `8c8ad7e` (۲۰۲۶-۰۴-۰۴، کلون سطحی) · **مجوز:** MIT (`LICENSE`، © 2026 Mousa Abu Mazin) · **زبان:** Swift 5.9 / SwiftUI · **سکو:** macOS 14+
- **دسته:** شبیه‌ساز ترمینال (پوستهٔ نازکی از برنامه پیرامون کتابخانهٔ SwiftTerm)

## این پروژه چیست
یک برنامهٔ ترمینال برای macOS با زبانه‌ها، پوسته‌ها (themes)، بازیابی نشست، اعلان‌ها و ابزارهای کمکی Touch ID، که با این شعار تبلیغ می‌شود: «Connected Arabic letters — proper shaping via Core Text (every other terminal breaks Arabic)». کل مخزن حدود ۱٫۵ هزار خط Swift در ۱۲ فایل است؛ تمام شبیه‌سازی و رندر ترمینال به **SwiftTerm 1.13.0** سپرده شده است (`Package.swift`؛ `Package.resolved` آن را روی rev `8e7a1e15` قفل کرده است).

## چگونه کار می‌کند (تأییدشده در کد)
- **معماری:** برنامهٔ SwiftUI ← `TerminalContainerView` (`NSViewRepresentable`) ← `TarminalTerminalView`، یک زیرکلاس ۲۰ خطی از `LocalProcessTerminalView` در SwiftTerm که فقط `bell(source:)` را بازنویسی می‌کند و `enableMetal()` را اضافه می‌کند (`Tarminal/Terminal/TarminalTerminalView.swift:5-19`).
- **PTY / فرایند:** `startProcess(executable: shell, args: ["--login"], environment: env …)` با `TERM=xterm-256color` از `Terminal.getEnvironmentVariables` (`Tarminal/Terminal/TerminalContainerView.swift:107-123`).
- **رندر:** رندرکنندهٔ Metal در SwiftTerm را با `setUseMetal(true)` روشن می‌کند (`TarminalTerminalView.swift:11-13`، `TerminalContainerView.swift:66-70`، `:135-139`).
- **قلم:** `tv.font = NSFont(name: theme.fontName, …) ?? NSFont.monospacedSystemFont(…)` (`TerminalContainerView.swift:160`)؛ طبق پیام کامیت، پیش‌فرض SF Mono با اندازهٔ 13pt است. هیچ قلم جایگزینی برای عربی پیکربندی نشده است.
- **کد عربی / راست‌به‌چپ در این مخزن: هیچ.** جست‌وجوی `rtl|bidi|arabic|harfbuzz|CTLine|CoreText|direction|ligature|shaping|persian|hebrew` با grep روی `Tarminal/` جز در اصلاح‌گرهای شکل در رابط کاربری، هیچ نتیجه‌ای ندارد. هیچ کدی برای شکل‌دهی (shaping)، دوجهتی (bidi)، پهنا، انتخاب یا ورودی وجود ندارد؛ ادعای «شکل‌دهی با Core Text» کاملاً به کاری برمی‌گردد که SwiftTerm در درون خودش انجام می‌دهد.
- **ورودی:** پیش‌فرض‌های SwiftTerm؛ برنامه فقط `optionAsMetaKey` را تنظیم می‌کند (`TerminalContainerView.swift:51`). فایل‌های رهاشده (drop) با گریز (escape) شل فرستاده می‌شوند (`:209-213`).
- **انتخاب/کپی:** پیش‌فرض‌های SwiftTerm؛ برنامه فقط `selectedTextBackgroundColor` را تنظیم می‌کند (`:162`).
- **تست‌ها:** هیچ. در `Package.swift` هیچ هدف تستی (test target) نیست.

## پوشش لایه‌ها
(وضعیت‌ها بازتاب همین مخزن‌اند؛ هر کاری که SwiftTerm انجام می‌دهد با `?` علامت خورده، چون این وابستگی در کلون نیست و خوانده نشد.)

| لایه | وضعیت | شواهد |
|---|---|---|
| ۱ رمزگذاری و یکسان‌سازی | ? | کاملاً با SwiftTerm؛ اینجا کدی نیست |
| ۲ ورودی | ? | `NSTextInputClient` در SwiftTerm؛ برنامه فقط Option-as-Meta را تنظیم می‌کند (`TerminalContainerView.swift:51`) |
| ۳ پهنا | ? | wcwidth در SwiftTerm؛ اینجا چیزی نیست |
| ۴ شکل‌دهی | ? | README/CLAUDE.md ادعای Core Text از طریق SwiftTerm را دارند؛ در مخزن هیچ کد شکل‌دهی نیست؛ رندرکنندهٔ Metal به‌طور پیش‌فرض روشن است و رفتار شکل‌دهی‌اش تأیید نشده |
| ۵ دوجهتی | ❌ | هیچ کد دوجهتی ندارد؛ README حتی ادعای دوجهتی یا ترتیب RTL را هم ندارد — فقط «حروف پیوسته» |
| ۶ مکان‌نما، انتخاب و کپی | ? | پیش‌فرض‌های SwiftTerm |
| ۷ قلم‌ها | ◐ | قلم قابل انتخاب توسط کاربر با SF Mono به‌عنوان جایگزین (`:160`)؛ بدون زنجیرهٔ جایگزینی برای خط عربی |
| ۸ مالتی‌پلکسرها | ❌ | هیچ |
| ۹ برنامه‌ها و چارچوب‌های TUI | ? | شبیه‌سازی xterm را از SwiftTerm به ارث می‌برد؛ هیچ رسیدگی ویژه‌ای به RTL ندارد |

## ادعاشده اما تأییدنشده
- «Connected Arabic letters — proper shaping via Core Text (every other terminal breaks Arabic)» (بخش Features در `README.md`؛ بخش «What Works» در `CLAUDE.md`). در این مخزن پیاده نشده و به SwiftTerm وابسته است؛ و ادعای «هر ترمینال دیگری» در README نادرست است (mlterm، Konsole، VTE/GNOME Terminal با دوجهتی، iTerm2 تا حدی، و غیره).
- نمودار معماری «Core Text (Arabic shaping) + Metal (GPU rendering)» — برنامه Metal را به‌طور پیش‌فرض روشن می‌کند؛ این‌که مسیر Metal در SwiftTerm اجراهای عربی را شکل می‌دهد یا نه (در برابر جست‌وجوی سلول‌به‌سلول در اطلس گلیف) تأیید نشده و باید در خود SwiftTerm بررسی شود.
- هیچ ادعایی دربارهٔ ترتیب دوجهتی، مکان‌نما (cursor) در متن RTL یا کپی منطقی وجود ندارد.

## آنچه می‌آموزیم یا برمی‌داریم
- دانش RTL بسیار اندکی دارد؛ سرنخ مفید، **SwiftTerm** (MIT، Swift، macOS/iOS) به‌عنوان موضوع واقعی مطالعه است: یک بررسی پیگیرانه باید مسیر رسم `AppleTerminalView` در SwiftTerm (اجراهای `CTLine` در CoreText در برابر موقعیت‌دهی گلیف سلول‌به‌سلول) و رندرکنندهٔ Metal آن را بخواند تا ببیند آیا شکل‌دهی عربی سالم می‌ماند، و دوجهتی را کجا می‌شود وارد کرد.
- درسی دربارهٔ بازاریابی: کاربران عرب‌زبان «پیوسته بودن حروف» را به‌عنوان قابلیت اصلی بسیار ارزشمند می‌دانند، حتی بدون دوجهتی — شکل‌دهی به‌تنهایی برد بزرگی به حساب می‌آید.
- یک نکتهٔ مهندسی کوچک: کش‌کردن نمونه‌های ترمینال `NSView` تا بازسازی نما در SwiftUI باعث بسته‌شدن PTY نشود (`TerminalViewStore.swift`) — به RTL ربطی ندارد، ولی اگر روزی میزبانی با SwiftUI عرضه کنیم، به کار می‌آید.

## محدودیت‌ها و الگوهای نادرست
- **تبلیغات جلوتر از پیاده‌سازی:** تنها قابلیت عربی از یک وابستگی به ارث رسیده و اینجا تست نشده است؛ هیچ نمونهٔ تستی و هیچ تصویری از متن با جهت‌های مختلط در کد وجود ندارد.
- **بدون دوجهتی** — خطوط عربی/فارسی با حروف پیوسته اما به ترتیب LTR (که خواندنش وارونه است) نمایش داده می‌شوند، مگر این‌که SwiftTerm بازچینی کند؛ پس «عربی درست» در بهترین حالت نیمی از راه‌حل است.
- بدون تست، بدون تنظیمات ویژهٔ هر لایه (نه کلید RTL، نه قلم جایگزین برای عربی، نه کمکی برای ورود نیم‌فاصله (ZWNJ)).
- رندرکنندهٔ Metal به‌طور پیش‌فرض روشن است — ترمینال‌هایی که اطلس گلیف GPU دارند معمولاً سلول‌به‌سلول رندر می‌کنند، که شکل‌دهی Core Text را خنثی می‌کند؛ خطری تأییدنشده.
