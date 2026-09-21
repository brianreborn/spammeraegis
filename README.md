# SpammerAegis 0.1.0-alpha

Local-first X / Twitter forensics desk. Import an official archive ZIP, live-check handles for odd returns, cluster alts, queue the people who will not stop watching, export Gephi + twitter-forensics NDJSON. Storage stays in the browser.

Companion to [twitter-forensics](https://github.com/brianreborn/twitter-forensics) and [twitter-archive-tools](https://github.com/brianreborn/twitter-archive-tools).

## Run it (UAT)

```
npm install
npm test
npm run dev
```

Open http://127.0.0.1:18080/ — walkthrough in [`UAT.md`](UAT.md). Note 9 USB: `npm run uat:note9` (takes `$HOME/$ADBUUID` first).

## Field kit (Firefox)

Unsigned `.xpi` for **standard Firefox**:

1. Download `spammeraegis-field-kit-0.1.0.xpi` from the desk (Capture / Crawl / Alpha).
2. `about:debugging#/runtime/this-firefox`
3. **Load Temporary Add-on** → pick the `.xpi`
4. Open an x.com profile, use the toolbar button

It unloads when Firefox restarts. Permanent install needs Mozilla signing. GrapheneOS Vanadium has no extensions — use the desk plus the bookmarklet.

Source for the add-on is in [`extension/`](extension/). Pack an unsigned XPI from that folder (files at zip root, not nested):

```
node scripts/pack-xpi.mjs
```

writes `dist/spammeraegis-field-kit-0.1.0.xpi`. The desk Download button packs the same `extension/` sources in-browser.

## What this cut ships

1. Returning alts after a block (handle stems, bios, shared follows, co-blocks)
2. Watchers who still follow a case owner
3. Action queue with intent links (no silent remote blocks)
4. Relationship graph
5. Field capture without logging in
6. Offline X archive ZIP import (`block.js`, `mute.js`, followers/following, YTD)
7. Multi-archive clustering
8. Gephi CSV/GEXF + forensics NDJSON + case JSON export
9. Batch-flag from multi-archive patterns
10. Live-check (public profile sample; full follower dumps still come from imported NDJSON)

## Limits

- No X login, no remote case store, no auto-block.
- Alt scores are evidence, not proof.
- Live lookup is a public profile proxy, not a firehose.

## License

BSD 2-Clause. Same terms as twitter-forensics.
