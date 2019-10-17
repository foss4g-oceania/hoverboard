# FOSS4G-Oceania releases

## Prerequisites

You need to get `.firebaserc`, `serviceAccount.dev.json` and `serviceAccount.prod.json` from Google Drive. Do not share these. Do not commit them (they are in .gitignore to prevent this happening accidentally). If these are shared or committed, let Richard know ASAP and new credentials will be generated. Place these files in the root directory of this project.

You need to install npm.

You need to install firebase-tools: `npm install -g firebase-tools`. This shouldn't require super user permissions; if it does I recommend spending a few minutes addressing that separately.

## Deployment

In the following commands, substitute `{stage}` with the appropriate stage: `dev` or `prod`.

If you make changes to any of the Polymer (HTML/CSS/JS) components:

`npm run deploy:{stage}`

If you make changes to any of the Markdown documents or JSON files, to deploy these changes:

`npm run firestore:init:{stage}`

This will prompt for a `y` or `n` input to proceed: verify that you're deploying to the correct stage before continuing.

In practice, and if in doubt, simply run both commands as they are quite harmless, particularly if you deploy to `dev`, confirm that the change works without breaking existing functionality, and then deploy to `prod`:

`STAGE=dev && npm run deploy:$STAGE && npm run firestore:init:$STAGE`

If deployment issues arise, we can further develop our release practices (e.g. versioning, Github releases), but until then: YAGNI.

Note that part of the Firestore process includes storing a cached version of one table that has dynamic data (user-saved sessions), and then restoring the table after it is wiped. This happens automatically when running `npm run firestore:init:$STAGE`. The saved sessions contain a user ID that seems anonymous but I have not confirmed it to be so. Therefore treat this data (stored in `./featuredSessions.$STAGE.json` but git-ignored) as confidential information.
