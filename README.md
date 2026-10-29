<div align="center">

<img src="public/assets/icons/logo.svg" width="72" height="72" alt="Termbook logo">

# Termbook

**Free attendance registers and score sheets for Nigerian secondary schools.**

[![Deploy](https://github.com/termbook/termbook.github.io/actions/workflows/deploy.yml/badge.svg)](https://github.com/termbook/termbook.github.io/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[Live site](https://termbook.github.io/) · [Documentation](docs/) · [Report an issue](https://github.com/termbook/termbook.github.io/issues)

</div>

## About

Termbook gives each school a daily AM/PM attendance register and per-subject score sheets with term report cards. School admins, teachers and parents each see only what their role allows. It runs in the browser, installs on a phone, and keeps working offline.

## Features

- Daily AM/PM register with weekly and term reports, an at-risk flag and CSV export.
- Score sheets with continuous assessment, exam, bonus marks, grades, positions, annual totals and Excel export.
- Printable student report cards in the Oyo State layout, with conduct ratings, comments and attendance, published to parents only when the school releases the term.
- School setup: classes, arms, subjects, session and term, score weights and grade boundaries.
- Student management for admins: full list, promote, move, tag as no longer in school, soft-delete and restore, and bulk import from a downloadable CSV or Excel template.
- Teacher registration with admin approval and role assignment.
- Parent access by admission number and a revocable code.
- Progress tracking with charts for each student and for a whole class or subject, for class teachers, subject teachers, admins, the owner and, for their own child, parents.
- Parent accounts that link several children (even at different schools), follow attendance, send absence notes and update the child's family and health details.
- Platform owner tools: school verification, audit log, national holidays and backups.
- Light and dark themes, installable PWA, print styles for report cards.

## How to use it

Open https://termbook.github.io/ and register as a school admin, a teacher or a parent. Step-by-step guides: [admin](docs/ADMIN_GUIDE.md), [teacher](docs/TEACHER_GUIDE.md), [parent](docs/PARENT_GUIDE.md).

## Tech stack

Plain JavaScript modules bundled with Vite, Firebase Authentication and Firestore (free plan), SheetJS for Excel export, Vitest for tests, GitHub Actions and GitHub Pages for delivery. Fonts: Plus Jakarta Sans and Young Serif (SIL Open Font License).

## Project structure

```
app/                 App entry page
public/              Landing page, 404, styles, fonts, icons, manifest, service worker, states and LGAs data
src/lib/             Scoring, attendance, student rules, report builder, Firebase data layer
src/views/           Screens: auth, admin, students, attendance, scores, reports, parent, owner
tests/               Unit tests and Firestore security rules tests
docs/                Guides for owners, admins, teachers and parents
firestore.rules      Security rules
.github/workflows/   Deploy, pull request checks and CodeQL
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

Access is enforced by Firestore security rules. See [SECURITY.md](SECURITY.md) to report a vulnerability.

## License and credits

[MIT](LICENSE). Fonts by their respective authors under the SIL Open Font License. Nigerian states and local governments compiled from the MIT-licensed `nigeria-states-lgas` package.
