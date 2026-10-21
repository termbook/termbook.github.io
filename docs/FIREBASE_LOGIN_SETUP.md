# Firebase and login setup (for absolute beginners)

Termbook stores accounts and school records in Firebase, Google's free service. You will click through the Firebase website and the GitHub website. You never need a terminal. Plan about 40 minutes.

**Words you will meet** are explained in the glossary at the end.

---

## Part 1: Create the Firebase project

1. Go to https://console.firebase.google.com and sign in with your Google account.
2. Click **Create a project** (or **Add project**).
3. Type a name, for example `termbook`. Click **Continue**.
4. Turn **Google Analytics** off (you do not need it). Click **Create project**, then **Continue** when it finishes.

**You should see:** the project's home page with your project name at the top left.

## Part 2: Register the web app and copy its settings

1. On the project home page, click the **web icon** (`</>`) under "Get started by adding Firebase to your app".
2. App nickname: `termbook-web`. Leave "Firebase Hosting" **unticked**. Click **Register app**.
3. You will see a block of code with `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId` and `appId`. **Keep this page open**, or find it later at **Project settings (gear icon) > General > Your apps**.

**You should see:** six values. They are identifiers, not passwords. The security rules protect your data, not the secrecy of these values.

## Part 3: Turn on sign-in

1. In the left menu click **Build > Authentication**, then **Get started**.
2. Open the **Sign-in method** tab.
3. Click **Email/Password**, switch **Enable** on, leave "Email link" off, click **Save**.
4. (Optional) Click **Google**, switch **Enable** on, choose a support email, click **Save**.
5. Open **Settings > Authorized domains**. Click **Add domain** and type `termbook.github.io`. Click **Add**.

**You should see:** Email/Password (and Google) listed as **Enabled**, and `termbook.github.io` in the authorized domains list.

## Part 4: Create the database

1. Left menu: **Build > Firestore Database**, then **Create database**.
2. Choose a location close to Nigeria. If offered, pick a European region such as `eur3`. This cannot be changed later. Click **Next**.
3. Choose **Start in production mode**. Click **Create**.

**You should see:** an empty database with tabs Data, Rules, Indexes, Usage.

## Part 5: Publish the security rules

1. In your GitHub repository, open the file `firestore.rules` and click **Raw**. Select all the text and copy it.
2. In Firebase, open **Firestore Database > Rules**. Delete everything in the editor, paste the copied text, and click **Publish**.
3. **Do not close this step yet.** Part 7 tells you to change one word in these rules.

**You should see:** "Rules published" and a recent publish time.

## Part 6: Add the six settings to GitHub

1. In your GitHub repository click **Settings > Secrets and variables > Actions**.
2. Click **New repository secret**. Add these six, one at a time, copying the value from Part 2 (without quotes):

| Name | Value from |
|---|---|
| `FIREBASE_API_KEY` | `apiKey` |
| `FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `FIREBASE_PROJECT_ID` | `projectId` |
| `FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `FIREBASE_APP_ID` | `appId` |

**You should see:** six secrets listed under "Repository secrets" (the values are hidden).

## Part 7: Create the Owner account

You are the Owner. The rules know you by your Firebase user ID, so we do this in order.

1. Open https://termbook.github.io/app/#/register (after the first deployment, Part 8). Create an account with your email and a strong password. Open the verification email and click the link.
2. Come back to the app and press **I have verified my email**. You will see the "Who are you?" screen. Do not choose anything yet.
3. In Firebase open **Authentication > Users**. Find your email and click the copy icon next to **User UID**.
4. In GitHub open `firestore.rules`, click the **pencil icon**, and replace `REPLACE_WITH_OWNER_UID` (keep the quotes) with your UID. Click **Commit changes**.
5. Copy the whole updated file again (Part 5, step 1) and paste it over the rules in Firebase, then click **Publish**.
6. Reload the app. You should land on the **Schools** page for the Owner.

**You should see:** a navigation with Schools, Audit and Settings.

## Part 7b: Create two indexes

Firebase needs two search indexes. Open **Firestore Database > Indexes > Composite > Add index**:

1. Collection ID `attendance`, fields `classKey` (Ascending) then `date` (Ascending), Query scope **Collection**. Save.
2. Collection ID `audit`, fields `schoolId` (Ascending) then `at` (Descending), Query scope **Collection**. Save.

Indexes take a few minutes. If a screen later says it needs an index, open the browser's console (F12) and click the link in the error: it creates the index for you.

## Part 8: Deploy

1. In GitHub open **Settings > Pages**. Under **Build and deployment > Source** choose **GitHub Actions**.
2. Open the **Actions** tab, click **Deploy** in the left list, then **Run workflow > Run workflow**.
3. Wait for the yellow circle to become a green tick (about 3 minutes).

**You should see:** a green tick, and https://termbook.github.io/ showing the landing page.

## Part 9: Protect your API key

1. Go to https://console.cloud.google.com, choose your Firebase project at the top.
2. Open **APIs & Services > Credentials**, click the **Browser key** (created by Firebase).
3. Under **Application restrictions** choose **Websites**, add `termbook.github.io/*` and `localhost/*`. Click **Save**.

## How to test that login works
1. Open the live site in a private window and click **Register**. Create a test account with another email.
2. You should get a verification email. After verifying you reach "Who are you?".
3. Log out and log in again. You should return to the same screen.
4. Try **Forgot password?** and check that the email arrives.

## Common errors and fixes
| What you see | Fix |
|---|---|
| `auth/unauthorized-domain` | Part 3, step 5: add `termbook.github.io` to Authorized domains. |
| `auth/invalid-api-key` or "API key not valid" | The `FIREBASE_API_KEY` secret is wrong, or the key restriction in Part 9 is missing your domain. Re-copy the value, then run **Deploy** again. |
| `permission-denied` | The rules were not published (Part 5), the Owner UID is wrong, or you have not been approved yet. |
| Google popup blocked | Allow pop-ups for the site in your browser, then try again. |
| "Not verified yet" | Open the link in the verification email first, then press the button. Check spam. |
| "Not connected yet" screen on the live site | The six secrets are missing or misspelled. Fix them and run **Deploy** again. |
| A screen asks for an index | Do Part 7b. |

## What NOT to share or commit
- Never share your Firebase or Google password, or paste a **service account key** (a `.json` file with `private_key`) anywhere.
- Never commit a `.env` file. Termbook does not need one.
- The six settings above are not secret, but keep them in GitHub secrets so the site is built correctly.

## Glossary
- **Firebase**: Google's service that stores accounts and data for the app.
- **Firestore**: the database part of Firebase.
- **Authentication**: the login part of Firebase.
- **Security rules**: the lock that decides who can read or write which data.
- **GitHub Actions**: GitHub's helper that tests and publishes your site.
- **Repository secret**: a value GitHub keeps hidden and gives to the build.
- **UID**: the long unique ID Firebase gives every account.
