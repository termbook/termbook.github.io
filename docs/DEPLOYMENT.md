# Deployment

Everything is done on the GitHub website. You never need a terminal.

## How it works
When changes reach the `main` branch, the **Deploy** workflow runs. It installs the tools, runs the tests (scoring, attendance, student rules and the Firestore security rules), builds the site with your Firebase settings, checks links, makes a Lighthouse report and publishes to GitHub Pages at https://termbook.github.io/.

One-time setting: **Settings > Pages > Build and deployment > Source > GitHub Actions**.

## Reviewing a pull request and going live
1. Open the **Pull requests** tab and click the request.
2. Open **Checks**. Every item needs a green tick. The **site-preview** download under the run summary holds the built site if you want to inspect it.
3. Click **Merge pull request**, then **Confirm merge**. The site updates in about 3 minutes.
4. To discard it instead, click **Close pull request**. The live site never changes.

## Checking a deployment
Open the **Actions** tab. Green tick = live. Red cross = click the run, click the red step, and read the last lines. The most common causes:
- **Lint or tests failed**: the message names the file and test.
- **Rules tests failed**: `firestore.rules` was edited incorrectly (for example the quotes around the owner UID were removed).
- **Pages not enabled**: do the one-time setting above.

## Updating content
Edit a file with the pencil icon on GitHub, commit to a new branch, and open a pull request. See `CUSTOMIZING.md` for what to edit.

## Rolling back
Open **Pull requests > Closed**, open the one that caused the problem, and click **Revert**. GitHub creates a new pull request that undoes it. Merge it.

## Custom domain
1. Buy a domain. In **Settings > Pages > Custom domain** type it and click **Save**.
2. At your domain provider add the DNS records GitHub shows (usually four `A` records and a `CNAME` for `www`).
3. Tick **Enforce HTTPS** when it becomes available.
4. In Firebase **Authentication > Settings > Authorized domains** add the new domain, and add it to the API key restriction (see `FIREBASE_LOGIN_SETUP.md`, Part 9).
5. Update the `canonical` links in `public/index.html`, `public/sitemap.xml` and `public/robots.txt`.

## Quotas and abuse (Firebase free plan)
- Free daily limits include 50,000 document reads and 20,000 writes. Termbook caches data on the device and loads a class at a time to stay inside them.
- Loading the full student list as admin reads every student once per session. A school of 1,000 students uses about 1,000 reads each time it is opened cold.
- Publishing a term writes one report per student.
- Risks: someone repeatedly guessing parent codes, or scripted account creation. Recommended: turn on **Firebase App Check** (Build > App Check) and watch **Usage** in Firestore.
