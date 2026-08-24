# KOH-I-NOOR · monitoring rychlosti webu

Mini dashboard pro týdenní sledování rychlosti [eshop.koh-i-noor.cz](https://eshop.koh-i-noor.cz/). GitHub Actions každých 30 minut spustí Lighthouse na čtyřech veřejných stránkách (mobil i desktop), zapíše kompaktní JSON do repozitáře a webová appka na Netlify z něj kreslí graf a tabulku.

## Co se měří

| Stránka | URL |
| --- | --- |
| Homepage | https://eshop.koh-i-noor.cz/ |
| Kategorie | https://eshop.koh-i-noor.cz/cs/skolni-potreby |
| Produkt | https://eshop.koh-i-noor.cz/cs/produkt/barvy-brilantni-12?sid=2977 |
| Košík | https://eshop.koh-i-noor.cz/cs/Basket |

Košík se měří prázdný (čistý Chrome bez cookies). Cookie lišta e-shopu zůstává součástí first-load měření, stejně jako u reálného nového návštěvníka.

Ukládané hodnoty: Performance skóre, FCP, LCP, Speed Index, TBT, CLS, TTFB, čas, profil, URL a stav běhu. HTML reporty jdou jen do GitHub Actions artefaktů (3 dny) a do repozitáře se necommitují.

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

Workflow [`.github/workflows/lighthouse-monitor.yml`](.github/workflows/lighthouse-monitor.yml) běží každých 30 minut a jde spustit i ručně přes **Actions → Lighthouse monitor → Run workflow**.

Souběžné běhy jsou zakázané. GitHub cron není realtime služba, ve špičce může začít o několik minut později. V datech je vždy skutečný čas měření.

Po týdnu monitoring vypnete v záložce Actions (Disable workflow), nebo smažete soubor workflow.

## Nasazení na Netlify

1. Pushněte repo na GitHub (už je napojené na `boruvkamartin/KohinoorPerformance`).
2. V Netlify: **Add new site → Import an existing project** a vyberte tento repozitář.
3. Build command `npm run build`, publish directory `dist`. Stejné hodnoty jsou v [`netlify.toml`](netlify.toml).

Dashboard v produkci bere čerstvý JSON z `raw.githubusercontent.com`, takže se po každém měření nemusí znovu buildit Netlify. Repozitář proto musí zůstat veřejný, jinak GitHub raw soubor z prohlížeče nenačte. Záložní snapshot je soubor z posledního deploye.

## Jak číst barvy

Prahy kopírují Lighthouse / Core Web Vitals:

- zelená = good
- jantarová = needs improvement
- červená = poor

Chybný běh se objeví v tabulce a jako značka na ose grafu. Čára grafu používá jen úspěšná měření, takže jedna výpadeková půlhodina graf nerozbije. Historie v JSON se maže po 8 dnech.

## Bezpečnost

Veřejně jsou jen už známé URL e-shopu a naměřená čísla. Skript neukládá cookies, HTML, hlavičky, osobní údaje ani tajemství z prostředí.
