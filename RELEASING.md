# Releasing

This guide is for maintainers. It covers the Chrome Web Store.

## How a release works

1. Set `version` in `package.json` to the new version, and commit.
2. Push a tag with the same version: `git tag v0.2.0 && git push origin v0.2.0`.
3. The `Release` workflow runs `pnpm check`, builds the zips, and creates a draft GitHub release.
4. Read the draft release notes, then choose **Publish release** on GitHub.
5. The `Chrome Web Store` workflow uploads the Chrome zip from that release and submits it for review. Google publishes it after review.

Nothing goes to the store until a person publishes the GitHub release. The Chrome Web Store rejects a version that is not higher than the current one.

## First release

The store API can only update an item that already exists. Do the first release by hand.

1. Push the tag, as in steps 1 to 3 above.
2. Download `refined-threads-<version>-chrome.zip` from the draft release.
3. In the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole), create a new item and upload the zip. Fill in the store listing, the privacy tab, and the privacy policy URL, then submit it for review.
4. Publish the GitHub release. The `Chrome Web Store` workflow skips itself until `CHROME_EXTENSION_ID` is set, so it does not upload the same version again.
5. Do the one-time setup below.

## One-time setup for the workflow

The workflow signs in to Google with [Workload Identity Federation](https://github.com/google-github-actions/auth). GitHub gets a token that is valid for 10 minutes, and only for a job in the `chrome-web-store` environment of this repository. No key is stored in GitHub.

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
   | `CHROME_EXTENSION_ID`            | The 32-letter item ID from the Developer Dashboard                                                  |
   | `CHROME_PUBLISHER_ID`            | The ID in the dashboard URL, `chrome.google.com/webstore/devconsole/<publisher-id>`                 |
   | `CHROME_SERVICE_ACCOUNT`         | `chrome-web-store@<project-id>.iam.gserviceaccount.com`                                             |
   | `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/<project-number>/locations/global/workloadIdentityPools/github/providers/refined-threads` |

8. Check the setup. Run the `Chrome Web Store` workflow by hand with the tag of a published release and **dry-run** on. It signs in and uploads nothing.

   ```sh
   gh workflow run chrome-web-store.yml -f tag=v0.1.0 -f dry-run=true
   ```

## Submit again

If a submission failed, fix the cause and run the workflow by hand with the same tag and **dry-run** off. If a review for an older version is still pending, the submission fails. Cancel that review in the dashboard first.
