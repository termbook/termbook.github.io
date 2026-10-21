# Security

## Reporting a vulnerability
Please do not open a public issue. Use GitHub's **Report a vulnerability** option under the **Security** tab of this repository.

## How data is protected
- Access control is enforced by Firestore security rules (`firestore.rules`), tested in CI with the Firebase emulator.
- The Firebase web configuration is an identifier, not a secret. Never commit service account keys or private keys.
- Student data is children's data and is never public. Only a minimal school directory (name, state, local government, class and subject lists) is public.
