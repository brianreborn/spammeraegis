# SpammerAegis alpha UAT (you, on this machine)

Channel is **0.1.0-alpha**. This is the first cut you can actually click through.

## Host (Firefox or Chrome)

```
cd C:\Users\brian\swarm-agents\spammeraegis
npm install
npm test
npm run dev
```

Open **http://127.0.0.1:18080/** (port 18080 so we do not collide with other `:8080` ADB forwards).

Expected on first load: sample case **Repeat Knock**.

Walk:

1. **Desk** — stats, watchers, alerts. Rename the case.
2. **Alts** — `voidwatch` / `voidwatch3` cluster. Batch-flag.
3. **Queue** — open / copy intent links. Nothing should block on X by itself.
4. **Graph** — tap a node, dossier opens. No horizontal page scroll.
5. **Import** — “Import sample ZIP”, then optionally a real `twitter-YYYY-MM-DD-*.zip`.
6. **Crawl** — `@grok` is prefilled. Live lookup uses `api.fxtwitter.com` (public profile only).
7. **Capture** — Download the unsigned `.xpi`. In Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on.
8. **Export** — Gephi bundle + case JSON download.

Samsung Internet / Chrome on the **Note 9** (USB ADB):

```
# other agents: $HOME/$ADBUUID lock file. Default UUID = 27841130ae1c7ece
npm run dev
npm run uat:note9
```

That script acquires `$HOME\27841130ae1c7ece`, `adb reverse tcp:18080 tcp:18080`, opens the desk on the phone, screenshots, then **releases the lock**. If it prints `BUSY`, wait — another agent has the phone.

On the phone, open **http://127.0.0.1:18080/** if the activity did not already.

## Pass / fail

Pass if: demo loads, sample ZIP import replaces the demo, alts score, crawl returns a public profile or a clear error, exports download, the phone page is usable at ~720px wide.

Known limits (not fail): unsigned XPI is temporary; Vanadium has no extensions; live-check is not a follower dump; no AMO signature.
