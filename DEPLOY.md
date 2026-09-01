# Putting the site behind a sign-in

The site is currently on GitHub Pages, which has no access control of any kind.
There is no setting for it, a private repo does not change it, and a password
box in JavaScript is not protection: the password sits in the page source, and
every SVG and `manifest.json` is fetchable by URL regardless of what the page
shows. Anyone with the link can read everything.

Azure Static Web Apps fixes this properly. It puts an Entra ID sign-in in front
of **every route**, artwork included, before any file is served. Free tier
covers a site this size.

## What is already in the repo

- `docs/staticwebapp.config.json` requires an authenticated user for `/*` and
  sends anyone who is not signed in to the Entra login. It also disables the
  GitHub identity provider, so Microsoft accounts are the only way in.
- `.github/workflows/azure-static-web-apps.yml` builds `_site/` and deploys it
  on every push to `main`.
- `docs/robots.txt` and a `noindex` tag on each page, so search engines stop
  listing the Pages URL in the meantime.

`build-site.mjs` copies all of `docs/` into `_site/`, so the config file lands
at the app root where Azure expects it. Nothing else needed there.

## What you need to do

**1. Register the app in Entra.**
Azure portal, Entra ID, App registrations, New registration.

- Name: `Expressive Assets`
- Supported account types: **Accounts in this organizational directory only**.
  This is the setting that limits access to Microsoft, and it is the one worth
  getting right.
- Redirect URI: Web, `https://<your-site>.azurestaticapps.net/.auth/login/aad/callback`
  (fill in the real hostname after step 2, then come back and add it)

Copy the **Application (client) ID**. Then Certificates & secrets, New client
secret, and copy the **value** immediately, since it is only shown once.

**2. Create the Static Web App.**
Azure portal, Create a resource, Static Web App.

- Plan: Free
- Deployment source: GitHub, this repo, branch `main`
- Build presets: Custom. App location `_site`, Api location empty, Output
  location empty.

Azure will offer to create its own workflow file. Let it, then delete the file
it adds and keep the one already in the repo, or just point it at the existing
one. Either way the repo should end up with exactly one deploy workflow.

**3. Add the two settings.**
Static Web App resource, Settings, Environment variables (application settings):

- `AAD_CLIENT_ID` = the Application (client) ID from step 1
- `AAD_CLIENT_SECRET` = the secret value from step 1

**4. Set the tenant id.**
`docs/staticwebapp.config.json` has `REPLACE-WITH-YOUR-TENANT-ID` in
`openIdIssuer`. Put the **Directory (tenant) ID** from the app registration
overview page there.

This is worth being careful about. The account is `@teksystemsgs.com`, so the
registration lives in the TEKsystems directory rather than Microsoft's, and the
issuer has to name the same directory the registration is in or sign-in fails.
Whichever directory it is, that directory is also who can get in: single-tenant
plus this issuer means accounts in that one tenant and nobody else. If people in
the other org need access, they come in as guests in this one.

**5. Turn GitHub Pages off.**
Repo Settings, Pages, Source: None. Until you do this the old public URL keeps
serving the whole library alongside the protected one, and the protection means
nothing.

## Checking it worked

Open the `azurestaticapps.net` URL in a private window. You should be sent to a
Microsoft sign-in before you see anything. Then, in that same private window,
request an asset directly:

```
https://<your-site>.azurestaticapps.net/assets/icons/product/word/standard-48.svg
```

If that redirects to sign-in rather than returning the drawing, the artwork is
genuinely protected and not just the page around it. That is the test that
matters.

## Sharing it with someone outside

Invite them as a guest in Entra, or add a second identity provider in
`staticwebapp.config.json`. Do not solve it by making a route public: the moment
`/*` is not `authenticated`, everything under it is open again.
