// FILE: data/progress.js
// PURPOSE: Athena's actual trail progress. Hand-edited by Claude when Thomas
//   relays an update; the most recent entry drives the "last reported" marker.
// SOURCE: Thomas, as relayed from Athena.
// CAVEATS:
//   - Each entry: { date: 'YYYY-MM-DD', mile: <book mile>, loc: 'optional note' }
//   - Order on disk doesn't matter; the app sorts by date at load.
//   - SW is network-first on this file so a push to main lands on next refresh.

window.PCT_PROGRESS = [
  // Example (delete or replace when first real update arrives):
  // { date: '2026-05-13', mile: 10.0, loc: 'Cleef campsite' },
];
