# KOH-I-NOOR · monitoring rychlosti webu

Mini dashboard pro sledování rychlosti [eshop.koh-i-noor.cz](https://eshop.koh-i-noor.cz/). GitHub Actions od 10:07 do 21:47 spouští Lighthouse (lab) každých 20 minut, ve zbytku dne každých 30 minut. Jednou denně stáhne Chrome UX Report (field data od reálných uživatelů Chrome). Dashboard běží na GitHub Pages.

## Co se měří

| Stránka | URL |
| --- | --- |
| Homepage | https://eshop.koh-i-noor.cz/ |
| Kategorie | https://eshop.koh-i-noor.cz/cs/skolni-potreby |
| Produkt | https://eshop.koh-i-noor.cz/cs/produkt/barvy-brilantni-12?sid=2977 |
| Košík | https://eshop.koh-i-noor.cz/cs/Basket |

Košík se měří prázdný (čistý Chrome bez cookies). Cookie lišta e-shopu zůstává součástí first-load měření, stejně jako u reálného nového návštěvníka.

Ukládané Lighthouse hodnoty: Performance skóre, FCP, LCP, Speed Index, TBT, CLS, TTFB, čas, profil, URL a stav běhu. HTML reporty jdou jen do GitHub Actions artefaktů (3 dny) a do repozitáře se necommitují.

## Lab vs field data

| Zdroj | Co to je | Obnova |
| --- | --- | --- |
| Lighthouse | Laboratorní test v čistém Chrome | 10:07–21:47 každých 20 min (07/27/47), jinak každých 30 min (07/37) |
| Chrome UX Report | Reální uživatelé Chrome, 75. percentil | jednou denně |

CrUX není denní snapshot. Google každý den zveřejní nový **28denní klouzavý průměr** (obvykle kolem 04:00 UTC / 6:00 SELČ, data bývají 1–2 dny stará). Historie je po týdnech a každý bod je zase 28denní okno. Stránka bez dostatku návštěv v CrUX není; dashboard pak ukáže origin celého e-shopu.

Field data potřebují bezplatný API klíč:

1. V Google Cloud zapněte [Chrome UX Report API](https://developers.google.com/web/tools/chrome-user-experience-report/api/guides/getting-started).
2. Do GitHub Secrets přidejte `CRUX_API_KEY`.
3. Spusťte **Actions → CrUX field data → Run workflow**, nebo počkejte na denní cron (05:20 UTC).

Lokálně: `CRUX_API_KEY=... npm run crux` (ve Windows PowerShell `$env:CRUX_API_KEY="..."; npm run crux`).

## Místní spuštění

```bash
npm install
npm run dev
```

Dashboard na `http://localhost:5173` čte `public/data/metrics.json`.

Ruční měření (potřebuje nainstalovaný Chrome):

```bash
npm run measure
```

Jen homepage v obou profilech:

```bash
npm run measure:smoke
```

Parser a retenční logiku ověří `npm test`. Produkční build je `npm run build`.

## GitHub Actions

Workflow [`.github/workflows/lighthouse-monitor.yml`](.github/workflows/lighthouse-monitor.yml) běží v `Europe/Prague`: od 10:07 do 21:47 v :07, :27 a :47, jinak v :07 a :37. Jde spustit i ručně přes **Actions → Lighthouse monitor → Run workflow**. Field data stahuje [`.github/workflows/crux-monitor.yml`](.github/workflows/crux-monitor.yml) jednou denně a také ručně (**CrUX field data**).

Souběžné běhy jsou zakázané. GitHub cron není realtime služba, ve špičce může začít o několik minut později. V datech je vždy skutečný čas měření.

Po týdnu monitoring vypnete v záložce Actions (Disable workflow), nebo smažete soubor workflow.

## Nasazení na GitHub Pages

1. V repozitáři otevřete **Settings → Pages**.
2. V **Build and deployment → Source** vyberte **GitHub Actions**.
3. Pushněte změny na `main`, nebo spusťte **Actions → Deploy dashboard to GitHub Pages → Run workflow**.
4. Dashboard bude na <https://boruvkamartin.github.io/KohinoorPerformance/>.

Deployment zajišťuje [`.github/workflows/pages.yml`](.github/workflows/pages.yml). Commity, které mění pouze `public/data/**`, nový deploy nespouštějí: dashboard bere čerstvý JSON přímo z `raw.githubusercontent.com`. Repozitář proto musí zůstat veřejný. Meta tagy `noindex` zůstávají aktivní, aby dashboard neindexovaly vyhledávače.

## Jak číst barvy

Prahy kopírují Lighthouse / Core Web Vitals:

- zelená = good
- jantarová = needs improvement
- červená = poor

Chybný běh se objeví v tabulce a jako značka na ose grafu. Čára grafu používá jen úspěšná měření, takže jedna výpadeková půlhodina graf nerozbije. Historie v JSON se maže po 8 dnech.

## Bezpečnost

Veřejně jsou jen už známé URL e-shopu a naměřená čísla. Skript neukládá cookies, HTML, hlavičky, osobní údaje ani tajemství z prostředí.
