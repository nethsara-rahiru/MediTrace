# JavaScript branch

`feature/javascript-conversion` is a separate JavaScript version of MedTrace.
It is not merged into `main`. The app screens, domain/database modules, hooks,
components, tests and Playwright configuration use JavaScript. React components
retain JSX in `.js` files, compiled by Expo's normal Babel pipeline.

## Switching to this version

```sh
git fetch origin
git switch feature/javascript-conversion
npm ci
npx expo start --clear
```

Use Node.js 24. Stop a running Metro server before switching between the
TypeScript and JavaScript branches, and reinstall from the branch's lockfile.
Do not clear app storage: the database schema, migrations and local medicine data
remain compatible. Supabase URLs, public connection settings, access policies and
publication behavior are retained. No new SQL or database reset is required.

## Conversion details

- Type annotations, type-only imports/exports, interfaces, generics and assertions
  were removed without changing runtime validation or medicine extraction rules.
- Two modules containing only type declarations were removed. Runtime field
  definitions and evidence helpers remain in `src/domain/extraction/types.js`.
- Relative ES module imports include `.js` for direct Node execution.
- The standard package import `#medtrace-crypto` selects the existing native
  secure-random implementation on React Native and Web Crypto on Node/web.
  This preserves Android behavior despite explicit JavaScript import extensions.
- `metro.config.cjs` preserves Expo's CommonJS configuration while the project
  uses standard ES modules. Its SQLite web isolation headers are unchanged.
- TypeScript-only direct development dependencies and `tsconfig.json` were removed;
  Expo's typed-route generation was disabled. Third-party packages may still ship
  their own declarations or internal TypeScript tooling.
- Tests run with Node's built-in runner, without `tsx` or a TypeScript compiler.
  `npm run check:js` parses JavaScript/JSX, rejects TypeScript source in the project
  directories and checks relative and conditional imports. It does not provide
  TypeScript's former compile-time type guarantees. Runtime validation remains.
- CI and documentation use the JavaScript filenames and checks.

## Checks

```sh
npm run check:js
npm test
npm run format:check
npm run export:web
npm run test:e2e
```

The automated suite exercises the same SQLite repositories, barcode parsing,
verification, online identity lookup and upload queue as the TypeScript baseline.
Browser fixtures block unmocked Supabase requests. Exporting Android with source
maps also allows checking that `src/cloud/random.native.js` is selected. Native
camera and notification behavior still require a physical device, as before.

To return to the original version, switch to `main`, run `npm ci`, and restart
Expo with a cleared Metro cache. This branch does not change `main`.
