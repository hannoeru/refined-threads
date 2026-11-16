# Releasing

This guide is for maintainers. It covers the Chrome Web Store, Firefox Add-ons, and Edge Add-ons.

## How a release works

1. On an up-to-date `main`, run `pnpm release` and choose the new version. Choose a minor version if there is a `feat` commit since the last tag, and a patch version if there are only fixes.
2. [bumpp](https://github.com/antfu-collective/bumpp) sets `version` in `package.json`, commits `chore: release v<version>`, tags `v<version>`, and pushes the commit and the tag.
3. The `Release` workflow runs `pnpm check`, builds the zips, and creates a draft GitHub release. [changelogithub](https://github.com/antfu/changelogithub) writes the notes from the Conventional Commits since the last tag: `feat` under Features, `fix` under Bug Fixes, and `perf` under Performance. Other commit types do not appear. If the workflow runs twice for one tag, delete the extra draft.
4. Read the draft release notes, then choose **Publish release** on GitHub.
5. The `Stores` workflow (`.github/workflows/stores.yml`) uploads the zips from that release to each store that is set up, and submits them for review. Each store publishes the version after its review.

Nothing goes to a store until a person publishes the GitHub release. Each store rejects a version that is not higher than its current one. A store's job skips itself until that store is set up, so you can add the stores one at a time.

Before a store release, run `node .agents/skills/store-listing/bin/check.mjs`. If it reports a problem, update the listing with the `store-listing` skill.

## Turn on a store

A store API can only update an item that already exists, so the first release in each store is done by hand.

| Store            | Item                                                          | Status                                                  |
| ---------------- | ------------------------------------------------------------- | ------------------------------------------------------- |
| Chrome Web Store | `eafpgdohgehofcogmadaoodifnjnaigk`                            | v0.2.0 submitted by hand. Do the setup below.           |
| Firefox Add-ons  | `refined-threads@hannoeru.me`, slug `refined-threads`, listed | v0.2.0 submitted by hand. Do the setup below.           |
| Edge Add-ons     | Not created yet                                               | Create the item by hand first, then do the setup below. |

To create an item by hand, download the zips from the GitHub release, create the item in the store's dashboard, and fill in the listing from `store/<store>/listing.md`. Chrome and Edge use `refined-threads-<version>-chrome.zip`. Firefox uses `refined-threads-<version>-firefox.zip` and `refined-threads-<version>-sources.zip`. Do the one-time setup below after the item exists.

Chrome and Firefox already have v0.2.0. After their setup is done, they get the next version that you release automatically. The Edge job skips itself until the Edge item exists and its variables are set.

Store variables must be **repository** variables, not environment variables, because the workflow reads them to decide whether to run a job. Store secrets go in the store's **environment**.

## Chrome Web Store setup

The Chrome job signs in to Google with [Workload Identity Federation](https://github.com/google-github-actions/auth). GitHub gets a token that is valid for 10 minutes, and only for a job in the `chrome-web-store` environment of this repository. No key is stored in GitHub.

You need a Google Cloud project and the `gcloud` CLI. Set these shell values first:

```sh
PROJECT_ID=your-project-id
REPO=hannoeru/refined-threads
SA=chrome-web-store
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
```

1. Turn on the APIs:

   ```sh
   gcloud services enable chromewebstore.googleapis.com iamcredentials.googleapis.com sts.googleapis.com --project "$PROJECT_ID"
   ```

2. Create the service account. It needs no Google Cloud roles.

   ```sh
   gcloud iam service-accounts create "$SA" --project "$PROJECT_ID"
   ```

3. Create a pool and a GitHub provider that accept only this repository:

   ```sh
   gcloud iam workload-identity-pools create github --project "$PROJECT_ID" --location global
   gcloud iam workload-identity-pools providers create-oidc refined-threads \
     --project "$PROJECT_ID" --location global --workload-identity-pool github \
     --issuer-uri https://token.actions.githubusercontent.com \
     --attribute-mapping 'google.subject=assertion.sub,attribute.repository=assertion.repository' \
     --attribute-condition "assertion.repository == '$REPO'"
   ```

4. Let only jobs in the `chrome-web-store` environment use the service account:

   ```sh
   gcloud iam service-accounts add-iam-policy-binding "$SA@$PROJECT_ID.iam.gserviceaccount.com" \
     --project "$PROJECT_ID" --role roles/iam.workloadIdentityUser \
     --member "principal://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/subject/repo:$REPO:environment:chrome-web-store"
   ```

5. In the Developer Dashboard, open **Account** and add `$SA@$PROJECT_ID.iam.gserviceaccount.com` as the service account. A publisher can have one service account.

6. On GitHub, open **Settings > Environments** and create the `chrome-web-store` environment. To approve each upload by hand, add yourself as a required reviewer.

7. Add four repository variables, in **Settings > Secrets and variables > Actions > Variables**. None of them is a secret.

   | Variable                         | Value                                                                                               |
   | -------------------------------- | --------------------------------------------------------------------------------------------------- |
   | `CHROME_EXTENSION_ID`            | `eafpgdohgehofcogmadaoodifnjnaigk`                                                                  |
   | `CHROME_PUBLISHER_ID`            | The ID in the dashboard URL, `chrome.google.com/webstore/devconsole/<publisher-id>`                 |
   | `CHROME_SERVICE_ACCOUNT`         | `chrome-web-store@<project-id>.iam.gserviceaccount.com`                                             |
   | `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/<project-number>/locations/global/workloadIdentityPools/github/providers/refined-threads` |

8. Check the setup. Run the workflow by hand with the tag of a published release and **dry-run** on. It signs in and uploads nothing.

   ```sh
   gh workflow run stores.yml -f tag=v0.2.0 -f store=chrome -f dry-run=true
   ```

## Firefox Add-ons setup

The Firefox job signs in with an AMO API key. The add-on ID, `refined-threads@hannoeru.me`, is in the workflow.

1. Create a key at [addons.mozilla.org/developers/addon/api/key](https://addons.mozilla.org/developers/addon/api/key/).
2. On GitHub, create the `firefox-add-ons` environment. Add two environment secrets: `FIREFOX_JWT_ISSUER` (the JWT issuer) and `FIREFOX_JWT_SECRET` (the JWT secret).
3. Add the repository variable `FIREFOX_LISTED` with the value `true`.
4. Check the setup. A dry run signs in and uploads nothing.

   ```sh
   gh workflow run stores.yml -f tag=v0.2.0 -f store=firefox -f dry-run=true
   ```

Each upload also sends the sources zip, because the add-on is built with a bundler. Mozilla's reviewers rebuild it with the steps in the notes to reviewer.

## Edge Add-ons setup

The Edge job signs in with a Partner Center API key.

1. In Partner Center, open **Microsoft Edge > Publish API**, and create API credentials. Note the client ID and the API key. Partner Center shows when the key expires. Create a new key and update the secret before that date.
2. Open the extension in Partner Center, and copy its product ID.
3. On GitHub, create the `edge-add-ons` environment. Add the environment secret `EDGE_API_KEY`.
4. Add the repository variables `EDGE_PRODUCT_ID` and `EDGE_CLIENT_ID`.
5. Run a dry run. For Edge, a dry run only checks that the zip exists. It does not sign in, so the first real upload is the first test of the key.

   ```sh
   gh workflow run stores.yml -f tag=v0.2.0 -f store=edge -f dry-run=true
   ```

## Submit again

If a submission failed, fix the cause and run the workflow by hand with the same tag, the failed store, and **dry-run** off. If a review for an older version is still pending in the Chrome Web Store, the submission fails. Cancel that review in the dashboard first.
