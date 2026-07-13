export const packetDocumentCss = String.raw`
.packet-canonical-document {
  --packet-jade: #1c744d;
  --packet-jade-dark: #114d35;
  --packet-jade-soft: #e9f2ec;
  --packet-navy: #0b1d2c;
  --packet-orange: #e5653f;
  --packet-ink: #202824;
  --packet-muted: #617068;
  --packet-rule: #d5ddd7;
  --packet-paper: #fbfaf7;
  --packet-soft: #f0f3ef;
  width: min(100%, 55rem);
  overflow: hidden;
  margin-inline: auto;
  border: 1px solid var(--packet-rule);
  border-radius: .4rem;
  background: var(--packet-paper);
  box-shadow: 0 28px 70px rgba(4, 16, 27, .32);
  color: var(--packet-ink);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.5;
}
.packet-canonical-document *, .packet-canonical-document *::before, .packet-canonical-document *::after { box-sizing: border-box; }
.packet-canonical-document h1, .packet-canonical-document h2, .packet-canonical-document h3, .packet-canonical-document h4, .packet-canonical-document p, .packet-canonical-document li, .packet-canonical-document dd, .packet-canonical-document strong, .packet-canonical-document small { overflow-wrap: anywhere; }
.packet-canonical-document p, .packet-canonical-document li, .packet-canonical-document dd { widows: 3; orphans: 3; }
.packet-canonical-document a { color: var(--packet-jade-dark); overflow-wrap: anywhere; }
.packet-section { border-top: 1px solid var(--packet-rule); background: var(--packet-paper); padding: 2.35rem clamp(1.25rem, 5vw, 3rem) 2.65rem; }
.packet-section--cover { position: relative; border-top: .38rem solid var(--packet-jade); background: var(--packet-navy); color: #fff; padding: 0; }
.packet-section--cover::before { position: absolute; inset: -.38rem 70% auto 0; height: .38rem; background: var(--packet-orange); content: ""; }
.packet-brand-header { display: flex; flex-wrap: wrap; gap: .55rem 1rem; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,.14); padding: 1.2rem clamp(1.25rem,5vw,3rem); }
.packet-brand-header strong { color: #fff; font-size: .9rem; font-weight: 900; letter-spacing: .13em; }
.packet-brand-header span { color: #bfd0c7; font-size: .58rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
.packet-cover-body { display: grid; gap: 1.8rem; padding: clamp(2.5rem,8vw,4.6rem) clamp(1.25rem,5vw,3rem) 3.2rem; }
.packet-cover-kicker, .packet-label { margin: 0; color: #71c99e; font-size: .62rem; font-weight: 900; letter-spacing: .11em; text-transform: uppercase; }
.packet-cover-body h1 { max-width: 39rem; margin: .35rem 0 0; color: #fff; font-family: Georgia,"Times New Roman",serif; font-size: clamp(2.2rem,8vw,3.7rem); font-weight: 600; letter-spacing: -.035em; line-height: 1.04; }
.packet-cover-project { margin: 1.25rem 0 0; color: #fff; font-size: 1.12rem; font-weight: 800; }
.packet-cover-location { margin: .35rem 0 0; color: #b9c9c1; font-size: .78rem; }
.packet-cover-identity { display: grid; gap: .8rem; margin: 0; border-top: 1px solid rgba(255,255,255,.16); padding-top: 1rem; }
.packet-cover-identity dt { color: #71c99e; font-size: .54rem; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
.packet-cover-identity dd { margin: .12rem 0 0; color: #fff; font-size: .74rem; font-weight: 750; overflow-wrap: anywhere; }
.packet-cover-note { margin: 0; border-top: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.05); color: #d6e1db; padding: 1rem clamp(1.25rem,5vw,3rem); font-size: .72rem; }
.packet-section-heading { display: grid; grid-template-columns: 2.2rem minmax(0,1fr); gap: .65rem; align-items: start; margin-bottom: 1rem; break-after: avoid; page-break-after: avoid; }
.packet-section-heading > span { padding-top: .35rem; color: var(--packet-orange); font-size: .68rem; font-weight: 900; letter-spacing: .1em; }
.packet-section-heading p { margin: 0 0 .12rem; color: var(--packet-jade); font-size: .55rem; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
.packet-section-heading h2 { margin: 0; color: var(--packet-navy); font-family: Georgia,"Times New Roman",serif; font-size: clamp(1.6rem,5vw,2rem); font-weight: 600; letter-spacing: -.02em; line-height: 1.18; }
.packet-section-intro { max-width: 43rem; margin: -.35rem 0 1.35rem 2.85rem; color: var(--packet-muted); font-size: .76rem; }
.packet-executive-summary { max-width: 45rem; margin: 0; color: #39443e; font-family: Georgia,"Times New Roman",serif; font-size: 1.05rem; line-height: 1.62; }
.packet-decision-lines, .packet-client-meta, .packet-readiness-metadata { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: .85rem 1.5rem; margin: 1.35rem 0 0; }
.packet-decision-lines > div, .packet-client-meta > div, .packet-readiness-metadata > div { border-top: 1px solid var(--packet-rule); padding-top: .65rem; break-inside: avoid; }
.packet-decision-lines dt, .packet-client-meta dt, .packet-readiness-metadata dt { color: var(--packet-muted); font-size: .57rem; font-weight: 900; letter-spacing: .09em; text-transform: uppercase; }
.packet-decision-lines dd, .packet-client-meta dd, .packet-readiness-metadata dd { margin: .22rem 0 0; font-weight: 700; overflow-wrap: anywhere; }
.packet-risk-strength-grid { display: grid; gap: .75rem; margin-top: 1.25rem; }
.packet-risk-strength-grid > div { border: 1px solid var(--packet-rule); background: #fff; padding: .9rem 1rem; break-inside: avoid; }
.packet-risk-strength-grid ul { margin: .55rem 0 0; padding-left: 1.2rem; }
.packet-current-status { display: grid; gap: .28rem; margin-top: 1.25rem; border-left: 4px solid var(--packet-jade); background: var(--packet-jade-soft); padding: 1rem 1.1rem; break-inside: avoid; }
.packet-current-status strong { color: var(--packet-jade-dark); font-size: 1.04rem; }
.packet-current-status span { color: var(--packet-muted); font-size: .72rem; }
.packet-editorial-list, .packet-client-records, .packet-client-timeline, .packet-dependency-map { display: grid; gap: .9rem; margin: 0; padding: 0; list-style: none; }
.packet-editorial-list li { display: grid; grid-template-columns: 5.2rem minmax(0,1fr); gap: 1rem; break-inside: avoid; page-break-inside: avoid; border-top: 1px solid var(--packet-rule); padding: .9rem 0; }
.packet-editorial-index { display: flex; gap: .45rem; align-items: baseline; justify-content: space-between; border-left: 3px solid var(--packet-orange); background: var(--packet-soft); color: var(--packet-jade); padding: .5rem .65rem; }
.packet-editorial-index span { font-size: .52rem; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
.packet-editorial-index strong { color: var(--packet-orange); font-size: .75rem; }
.packet-editorial-list li > div:last-child p { margin: 0; font-family: Georgia,"Times New Roman",serif; font-size: .92rem; line-height: 1.5; }
.packet-citations { display: inline-block; margin-top: .38rem; color: var(--packet-jade-dark); font-size: .56rem; font-weight: 800; text-transform: uppercase; }
.packet-empty { display: grid; grid-template-columns: minmax(9rem,.55fr) minmax(0,1fr); gap: 1rem; margin: 0; border-top: 1px solid var(--packet-rule); border-bottom: 1px solid var(--packet-rule); padding: .85rem 0; break-inside: avoid; }
.packet-empty strong { color: var(--packet-jade-dark); }
.packet-empty span { color: var(--packet-muted); }
.packet-dependency-map article { display: grid; grid-template-columns: repeat(4,minmax(0,1fr) auto); align-items: stretch; border: 1px solid var(--packet-rule); background: #fff; padding: .8rem; break-inside: avoid; page-break-inside: avoid; }
.packet-dependency-map article div { display: grid; gap: .28rem; align-content: start; padding: .55rem; }
.packet-dependency-map article div span { color: var(--packet-muted); font-size: .55rem; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
.packet-dependency-map article i { align-self: center; color: var(--packet-jade); font-style: normal; }
.packet-dependency-map article small { color: var(--packet-muted); font-size: .58rem; }
.packet-follow-up-kit { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: .9rem; }
.packet-follow-up-group { border: 1px solid var(--packet-rule); background: #fff; padding: 1rem; break-inside: avoid; page-break-inside: avoid; }
.packet-follow-up-group--wide { grid-column: 1 / -1; }
.packet-follow-up-group h3, .packet-follow-up-group h4 { margin: .25rem 0 .55rem; color: var(--packet-navy); break-after: avoid; }
.packet-follow-up-group p { margin: .4rem 0 0; }
.packet-follow-up-group ol, .packet-follow-up-group ul { margin: .55rem 0 0; padding-left: 1.2rem; }
.packet-follow-up-group--escalation { border-left: 4px solid var(--packet-orange); background: #fbf4e9; }
.packet-client-timeline { gap: 0; }
.packet-client-timeline > li { display: grid; grid-template-columns: 1.5rem 7.5rem minmax(0,1fr); gap: 0 .85rem; break-inside: avoid; page-break-inside: avoid; }
.packet-timeline-rail { position: relative; min-height: 100%; border-right: 1px solid var(--packet-rule); }
.packet-timeline-rail::before { position: absolute; top: .5rem; right: -.34rem; width: .62rem; height: .62rem; border: 2px solid var(--packet-paper); border-radius: 50%; background: var(--packet-orange); content: ""; }
.packet-timeline-rail span { color: var(--packet-muted); font-size: .5rem; font-weight: 900; }
.packet-timeline-date { display: grid; align-content: start; gap: .2rem; padding-top: .2rem; }
.packet-timeline-date time { color: var(--packet-navy); font-size: .72rem; font-weight: 850; }
.packet-timeline-date span { color: var(--packet-jade); font-size: .55rem; font-weight: 900; letter-spacing: .07em; text-transform: uppercase; }
.packet-client-timeline article { margin-bottom: 1.2rem; border: 1px solid var(--packet-rule); background: #fff; padding: .95rem 1rem; }
.packet-timeline-heading { display: flex; flex-wrap: wrap; gap: .7rem; align-items: flex-start; justify-content: space-between; }
.packet-timeline-heading h3 { margin: 0; color: var(--packet-navy); font-family: Georgia,"Times New Roman",serif; font-size: .96rem; }
.packet-timeline-heading div { display: flex; flex-wrap: wrap; gap: .3rem; }
.packet-pill { border: 1px solid var(--packet-rule); border-radius: 999px; color: var(--packet-muted); font-size: .52rem; font-weight: 800; padding: .18rem .38rem; text-transform: uppercase; }
.packet-timeline-evidence { margin-top: .75rem; border-top: 1px solid var(--packet-rule); padding-top: .65rem; }
.packet-timeline-evidence h4 { margin: 0; color: var(--packet-muted); font-size: .56rem; letter-spacing: .08em; text-transform: uppercase; }
.packet-timeline-evidence ul { display: grid; gap: .3rem; margin: .45rem 0 0; padding: 0; list-style: none; }
.packet-timeline-evidence li { color: var(--packet-muted); font-size: .68rem; }
.packet-client-records > li { position: relative; overflow: hidden; border: 1px solid var(--packet-rule); background: #fff; padding: 1.15rem 1.2rem 0; break-inside: avoid; page-break-inside: avoid; }
.packet-client-records > li::before { position: absolute; inset: 0 auto 0 0; width: .2rem; background: var(--packet-jade); content: ""; }
.packet-client-record-heading { display: flex; flex-wrap: wrap; gap: .8rem; align-items: flex-start; justify-content: space-between; }
.packet-client-record-heading p { margin: 0 0 .2rem; color: var(--packet-jade); font-size: .58rem; font-weight: 900; letter-spacing: .09em; text-transform: uppercase; }
.packet-client-record-heading h3 { margin: 0; color: var(--packet-navy); font-family: Georgia,"Times New Roman",serif; font-size: 1.04rem; }
.packet-verification-badge { border: 1px solid var(--packet-rule); border-radius: 999px; font-size: .56rem; font-weight: 900; padding: .24rem .5rem; text-transform: uppercase; }
.packet-verification-badge--verified { border-color: var(--packet-jade-dark); background: var(--packet-jade-soft); color: var(--packet-jade-dark); }
.packet-verification-badge--unverified { border-color: #b56a20; background: #fff8eb; color: #955412; }
.packet-verification-badge--disputed { border-color: #a2413a; background: #fff0ed; color: #8c332e; }
.packet-evidence-summary { margin: .82rem 0 0; color: #39443e; }
.packet-reviewer-note { display: grid; grid-template-columns: 6rem minmax(0,1fr); gap: .45rem; margin: .9rem -1.2rem 0; background: var(--packet-soft); padding: .72rem 1.2rem; }
.packet-reviewer-note span { color: var(--packet-muted); font-size: .56rem; font-weight: 900; letter-spacing: .09em; text-transform: uppercase; }
.packet-reviewer-note p { margin: 0; color: var(--packet-muted); font-size: .68rem; }
.packet-source-pending { color: #a25f1b; font-size: .68rem; }
.packet-source-list { border: 1px solid var(--packet-rule); background: #fff; }
.packet-source-list__heading, .packet-source-list__row { display: grid; grid-template-columns: 1.35fr 1fr 6rem; }
.packet-source-list__heading { background: var(--packet-navy); color: #fff; }
.packet-source-list__heading span { padding: .55rem .7rem; font-size: .54rem; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
.packet-source-list__row { border-top: 1px solid var(--packet-rule); break-inside: avoid; page-break-inside: avoid; }
.packet-source-list__row > div { min-width: 0; border-right: 1px solid var(--packet-rule); padding: .7rem; overflow-wrap: anywhere; }
.packet-source-list__row > div:last-child { border-right: 0; }
.packet-source-list__row strong { display: block; font-size: .72rem; }
.packet-source-list__row small { color: var(--packet-muted); font-size: .58rem; }
.packet-readiness-conclusion { margin: 0; border-left: 4px solid var(--packet-jade); background: var(--packet-jade-soft); color: var(--packet-jade-dark); padding: 1rem 1.1rem; font-family: Georgia,"Times New Roman",serif; font-size: 1rem; break-inside: avoid; }
.packet-methodology { margin: 1rem 0 0; color: #39443e; }
.packet-dashboard-metrics { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: .7rem; margin-top: 1.1rem; }
.packet-dashboard-metric { position: relative; border: 1px solid var(--packet-rule); background: #fff; padding: .9rem 1rem; break-inside: avoid; }
.packet-dashboard-metric::before { position: absolute; inset: 0 auto 0 0; width: .22rem; background: var(--packet-jade); content: ""; }
.packet-dashboard-metric--score { background: var(--packet-navy); color: #fff; }
.packet-dashboard-metric--score::before { background: var(--packet-orange); }
.packet-dashboard-metric > span { display: block; color: var(--packet-muted); font-size: .54rem; font-weight: 900; letter-spacing: .09em; text-transform: uppercase; }
.packet-dashboard-metric--score > span, .packet-dashboard-metric--score small { color: #bfd0c7; }
.packet-dashboard-metric strong { display: block; margin-top: .35rem; font-size: 1.12rem; }
.packet-dashboard-metric small { display: block; margin-top: .35rem; color: var(--packet-muted); font-size: .58rem; }
.packet-readiness-summary-grid { display: grid; grid-template-columns: 1.15fr .85fr; gap: .7rem; margin-top: .7rem; }
.packet-readiness-summary-grid > section { border: 1px solid var(--packet-rule); background: var(--packet-soft); padding: .9rem 1rem; break-inside: avoid; }
.packet-readiness-summary-grid ol { display: grid; gap: .45rem; margin: .6rem 0 0; padding-left: 1.1rem; }
.packet-readiness-summary-grid li span { display: block; color: var(--packet-muted); font-size: .65rem; }
.packet-readiness-summary-grid__action { border-color: var(--packet-jade-dark) !important; background: var(--packet-jade-dark) !important; color: #fff; }
.packet-readiness-summary-grid__action .packet-label { color: #8cdbb2; }
.packet-readiness-summary-grid__action > strong { display: block; margin-top: .55rem; }
.packet-readiness-summary-grid__action > p:last-child { color: #c8dbd1; font-size: .68rem; }
.packet-evidence-snapshot { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 1rem; align-items: center; margin-top: .7rem; border: 1px solid var(--packet-rule); background: #fff; padding: .9rem 1rem; break-inside: avoid; }
.packet-evidence-snapshot p { margin: .3rem 0 0; color: var(--packet-muted); font-size: .68rem; }
.packet-evidence-snapshot dl { display: flex; gap: .8rem; margin: 0; text-align: center; }
.packet-evidence-snapshot dt { color: var(--packet-muted); font-size: .5rem; font-weight: 900; text-transform: uppercase; }
.packet-evidence-snapshot dd { margin: .1rem 0 0; font-size: 1rem; font-weight: 850; }
.packet-readiness-factors { margin-top: 1rem; border: 1px solid var(--packet-rule); background: #fff; padding: 1rem; }
.packet-readiness-factors ul { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: .55rem; margin: .75rem 0 0; padding: 0; list-style: none; }
.packet-readiness-factors li { display: grid; grid-template-columns: auto 1fr; gap: .2rem .5rem; background: var(--packet-soft); padding: .7rem; break-inside: avoid; }
.packet-readiness-factors li > span { grid-row: 1 / 3; color: #a25f1b; font-size: .54rem; font-weight: 900; text-transform: uppercase; }
.packet-readiness-factors li.is-passed > span { color: var(--packet-jade); }
.packet-readiness-factors small { grid-column: 2; color: var(--packet-muted); font-size: .62rem; }
.packet-readiness-notes { margin: 1rem 0 0; border-left: 3px solid #b56a20; background: #fbf4e9; color: #6c573e; padding: .8rem 1rem .8rem 1.8rem; font-size: .68rem; }
.packet-disclaimer { margin: 1.2rem 0 0; border-top: 1px solid var(--packet-rule); color: var(--packet-muted); padding-top: 1rem; font-size: .72rem; }
.packet-disclosure { margin: 0; border: 1px solid var(--packet-rule); background: var(--packet-soft); padding: 1rem; break-inside: avoid; }
.packet-disclosure--applies { border-left: 4px solid var(--packet-orange); background: #fbf4e9; }
.packet-client-footer { display: flex; flex-wrap: wrap; gap: .75rem; justify-content: space-between; border-top: 5px solid var(--packet-navy); color: var(--packet-muted); font-size: .62rem; padding: 1rem clamp(1.25rem,5vw,3rem) 1.25rem; }
@media (min-width: 701px) {
  .packet-cover-body { grid-template-columns: minmax(0,1.35fr) minmax(13rem,.65fr); }
  .packet-cover-identity { border-top: 0; border-left: 1px solid rgba(255,255,255,.16); padding-top: 0; padding-left: 1.45rem; }
}
@media (max-width: 700px) {
  .packet-cover-body, .packet-decision-lines, .packet-client-meta, .packet-readiness-metadata, .packet-follow-up-kit, .packet-dashboard-metrics, .packet-readiness-summary-grid, .packet-evidence-snapshot, .packet-readiness-factors ul { grid-template-columns: 1fr; }
  .packet-dependency-map article, .packet-source-list__row { grid-template-columns: 1fr; }
  .packet-dependency-map article i { justify-self: center; }
  .packet-source-list__heading { display: none; }
  .packet-source-list__row > div { border-right: 0; border-bottom: 1px solid var(--packet-rule); }
  .packet-client-timeline > li { grid-template-columns: 1.5rem minmax(0,1fr); }
  .packet-timeline-date, .packet-client-timeline article { grid-column: 2; }
  .packet-timeline-rail { grid-row: 1 / 3; }
}
@page { size: Letter; margin: .45in; }
@media print {
  .packet-canonical-document { width: auto; overflow: visible; border: 0; border-radius: 0; box-shadow: none; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .packet-section { border-top: 1px solid var(--packet-rule); padding: .38in .42in .44in; }
  .packet-section--cover { min-height: 9.5in; break-after: page; page-break-after: always; padding: 0; }
  .packet-section-heading, .packet-section-heading + .packet-section-intro, h2, h3, h4 { break-after: avoid; page-break-after: avoid; }
  .packet-section-intro { orphans: 3; widows: 3; }
  .packet-editorial-list li, .packet-dependency-map article, .packet-follow-up-group, .packet-client-timeline > li, .packet-client-records > li, .packet-source-list__row, .packet-current-status, .packet-dashboard-metric, .packet-readiness-factors li, .packet-disclosure { break-inside: avoid; page-break-inside: avoid; }
  .packet-section--findings, .packet-section--timeline, .packet-section--supporting-evidence, .packet-section--methodology-readiness { break-before: page; page-break-before: always; }
  .packet-client-footer { break-inside: avoid; }
  .packet-canonical-document a { color: inherit; text-decoration: none; }
}
`;
