// Resupply / road-access points along the PCT.
// Mile = PCT southbound→northbound cumulative miles (from Yogi's "Hiking the PCT").
// expectedDate is Athena's plan: 130-day schedule shifted +3 days (start 13 May 2026).
// AIRPORTS BELOW ARE ORD DIRECT ONLY. Drive times reflect that — some are long.
// Numbers are car-route estimates; verify before booking.

window.PCT_WAYPOINTS = [
  { day:   1, date: '2026-05-13', mile:  10.0, name: 'Cleef campsite (Day 1, short — confirm mile)', kind: 'camp',     road: '—',                          offTrail: '—',          airport: 'SAN', drive: '—' },
  { day:   3, date: '2026-05-15', mile:  41.5, name: 'Mount Laguna',                                  kind: 'resupply', road: 'Sunrise Hwy (S1)',           offTrail: 'on trail',   airport: 'SAN', drive: '~55 mi · 1h 15m' },
  { day:   7, date: '2026-05-19', mile: 109.5, name: 'Warner Springs',                                kind: 'resupply', road: 'Hwy 79',                     offTrail: '1.2 mi',     airport: 'SAN', drive: '~85 mi · 1h 45m' },
  { day:   9, date: '2026-05-21', mile: 151.9, name: 'Paradise Valley Café',                          kind: 'resupply', road: 'Hwy 74',                     offTrail: '~1 mi',      airport: 'PSP', drive: '~45 mi · 1h 15m (PSP summer service limited — verify)' },
  { day:  12, date: '2026-05-24', mile: 209.5, name: 'San Gorgonio Pass / I-10',                      kind: 'resupply', road: 'I-10 (Whitewater)',          offTrail: 'on trail',   airport: 'PSP', drive: '~18 mi · 25m (PSP summer service limited — verify)' },
  { day:  15, date: '2026-05-27', mile: 275.1, name: 'Big Bear / Van Dusen Canyon',                   kind: 'resupply', road: 'Hwy 18',                     offTrail: '~3 mi',      airport: 'ONT', drive: '~70 mi · 1h 45m' },
  { day:  19, date: '2026-05-31', mile: 363.4, name: 'Wrightwood',                                    kind: 'resupply', road: 'Hwy 2',                      offTrail: '4.5 mi',     airport: 'ONT', drive: '~50 mi · 1h 10m' },
  { day:  24, date: '2026-06-05', mile: 444.2, name: 'Acton KOA',                                     kind: 'resupply', road: 'Soledad Cyn Rd / Hwy 14',    offTrail: '~1 mi',      airport: 'LAX', drive: '~50 mi · 1h' },
  { day:  28, date: '2026-06-09', mile: 517.6, name: 'Hikertown',                                     kind: 'resupply', road: 'Hwy 138',                    offTrail: 'on trail',   airport: 'LAX', drive: '~85 mi · 2h' },
  { day:  30, date: '2026-06-11', mile: 558.5, name: 'Tehachapi (Willow Spr Rd)',                     kind: 'resupply', road: 'Willow Spr Rd / Hwy 58',     offTrail: '~8 mi',      airport: 'LAX', drive: '~110 mi · 2h' },
  { day:  34, date: '2026-06-15', mile: 653.2, name: 'Onyx / Walker Pass',                            kind: 'resupply', road: 'Hwy 178',                    offTrail: 'on trail',   airport: 'LAS', drive: '~210 mi · 3h 30m' },
  { day:  37, date: '2026-06-18', mile: 703.4, name: 'Kennedy Meadows S',                             kind: 'resupply', road: 'Sherman Pass Rd',            offTrail: '~0.7 mi',    airport: 'LAS', drive: '~280 mi · 5h (via 14/395)' },
  { day:  42, date: '2026-06-23', mile: 790.1, name: 'Kearsarge Pass → Independence',                 kind: 'resupply', road: 'Onion Valley Rd / Hwy 395',  offTrail: '~7.5 mi',    airport: 'LAS', drive: '~270 mi · 4h 30m (via 95/395)' },
  { day:  47, date: '2026-06-28', mile: 875.7, name: 'VVR (Vermilion Valley Resort)',                 kind: 'resupply', road: 'Kaiser Pass Rd / Hwy 168',   offTrail: '1.5 mi + ferry', airport: 'FAT', drive: '~75 mi · 2h 30m' },
  { day:  51, date: '2026-07-02', mile: 943.7, name: 'Tuolumne Meadows',                              kind: 'resupply', road: 'Hwy 120 (Tioga Pass)',       offTrail: 'on trail',   airport: 'RNO', drive: '~150 mi · 3h' },
  { day:  55, date: '2026-07-06', mile: 1018.1, name: 'Sonora Pass / KMN',                            kind: 'resupply', road: 'Hwy 108',                    offTrail: 'on trail',   airport: 'RNO', drive: '~115 mi · 2h 30m' },
  { day:  59, date: '2026-07-10', mile: 1091.2, name: 'South Lake Tahoe',                             kind: 'resupply', road: 'Hwy 50 (Echo Summit)',       offTrail: '~5 mi',      airport: 'RNO', drive: '~60 mi · 1h 15m' },
  { day:  63, date: '2026-07-14', mile: 1154.6, name: 'Donner Pass / Truckee',                        kind: 'resupply', road: 'I-80',                       offTrail: 'on trail',   airport: 'RNO', drive: '~40 mi · 45m' },
  { day:  65, date: '2026-07-16', mile: 1196.6, name: 'Sierra City',                                  kind: 'resupply', road: 'Hwy 49',                     offTrail: '~1.5 mi',    airport: 'RNO', drive: '~80 mi · 1h 40m' },
  { day:  69, date: '2026-07-20', mile: 1269.1, name: 'Quincy / Bucks Lake',                          kind: 'resupply', road: 'Bucks Lake Rd',              offTrail: '~3 mi',      airport: 'RNO', drive: '~120 mi · 2h 30m' },
  { day:  72, date: '2026-07-23', mile: 1332.3, name: 'Chester',                                      kind: 'resupply', road: 'Hwy 36',                     offTrail: 'on trail',   airport: 'RNO', drive: '~135 mi · 3h' },
  { day:  74, date: '2026-07-25', mile: 1378.3, name: 'Hat Creek / Old Station',                      kind: 'resupply', road: 'Hwy 44 / 89',                offTrail: 'on trail',   airport: 'SMF', drive: '~205 mi · 3h 45m' },
  { day:  76, date: '2026-07-27', mile: 1412.3, name: 'Burney',                                       kind: 'resupply', road: 'Hwy 89 / 299',               offTrail: '~7 mi',      airport: 'SMF', drive: '~220 mi · 4h' },
  { day:  80, date: '2026-07-31', mile: 1502.2, name: 'Castella / Castle Crags',                      kind: 'resupply', road: 'I-5',                        offTrail: '~0.5 mi',    airport: 'SMF', drive: '~225 mi · 3h 30m' },
  { day:  86, date: '2026-08-06', mile: 1600.7, name: 'Etna',                                         kind: 'resupply', road: 'Hwy 3 (Etna Summit)',        offTrail: '~10 mi',     airport: 'SMF', drive: '~285 mi · 4h 45m' },
  { day:  89, date: '2026-08-09', mile: 1656.9, name: 'Seiad Valley',                                 kind: 'resupply', road: 'Hwy 96',                     offTrail: 'on trail',   airport: 'PDX', drive: '~285 mi · 5h' },
  { day:  91, date: '2026-08-11', mile: 1719.7, name: 'Interstate 5 / Ashland',                       kind: 'resupply', road: 'I-5 (Mt Ashland exit)',      offTrail: '~12 mi',     airport: 'PDX', drive: '~270 mi · 4h 30m' },
  { day:  93, date: '2026-08-13', mile: 1774.2, name: 'Fish Lake Resort',                             kind: 'resupply', road: 'Hwy 140',                    offTrail: '~1.5 mi',    airport: 'PDX', drive: '~245 mi · 4h 30m' },
  { day:  95, date: '2026-08-15', mile: 1822.7, name: 'Mazama Village / Crater Lake',                 kind: 'resupply', road: 'Hwy 62',                     offTrail: 'on trail',   airport: 'PDX', drive: '~215 mi · 4h' },
  { day:  99, date: '2026-08-19', mile: 1907.6, name: 'Shelter Cove / Hwy 58',                        kind: 'resupply', road: 'Hwy 58 (Willamette Pass)',   offTrail: '~1.3 mi',    airport: 'PDX', drive: '~180 mi · 3h 30m' },
  { day: 101, date: '2026-08-21', mile: 1953.5, name: 'Elk Lake Resort',                              kind: 'resupply', road: 'Cascade Lakes Hwy',          offTrail: '~1.3 mi',    airport: 'PDX', drive: '~190 mi · 3h 45m' },
  { day: 103, date: '2026-08-23', mile: 1996.1, name: 'Big Lake YC / Santiam Pass',                   kind: 'resupply', road: 'Hwy 20',                     offTrail: '~2 mi',      airport: 'PDX', drive: '~115 mi · 2h 30m' },
  { day: 105, date: '2026-08-25', mile: 2048.2, name: 'Olallie Lake Resort',                          kind: 'resupply', road: 'FR 4220 (gravel)',           offTrail: 'on trail',   airport: 'PDX', drive: '~110 mi · 2h 45m' },
  { day: 107, date: '2026-08-27', mile: 2099.6, name: 'Timberline Lodge',                             kind: 'resupply', road: 'Hwy 26 (Mt Hood)',           offTrail: 'on trail',   airport: 'PDX', drive: '~65 mi · 1h 20m' },
  { day: 109, date: '2026-08-29', mile: 2149.3, name: 'Cascade Locks (Bridge of the Gods)',           kind: 'resupply', road: 'I-84',                       offTrail: 'on trail',   airport: 'PDX', drive: '~45 mi · 50m' },
  { day: 112, date: '2026-09-01', mile: 2231.5, name: 'Trout Lake',                                   kind: 'resupply', road: 'Road 23 / Hwy 141',          offTrail: '~13 mi hitch', airport: 'PDX', drive: '~85 mi · 2h' },
  { day: 116, date: '2026-09-05', mile: 2297.5, name: 'White Pass',                                   kind: 'resupply', road: 'Hwy 12',                     offTrail: 'on trail',   airport: 'SEA', drive: '~125 mi · 2h 30m' },
  { day: 121, date: '2026-09-10', mile: 2395.8, name: 'Snoqualmie Pass',                              kind: 'resupply', road: 'I-90',                       offTrail: 'on trail',   airport: 'SEA', drive: '~50 mi · 55m' },
  { day: 124, date: '2026-09-13', mile: 2466.7, name: 'Stevens Pass',                                 kind: 'resupply', road: 'Hwy 2',                      offTrail: 'on trail',   airport: 'SEA', drive: '~80 mi · 1h 45m' },
  { day: 127, date: '2026-09-16', mile: 2574.5, name: 'Stehekin',                                     kind: 'resupply', road: 'Lake Chelan ferry only',     offTrail: 'trail + ferry', airport: 'SEA', drive: 'ferry Stehekin→Chelan, then ~180 mi · 3h 30m (Hwy 2/I-90)' },
  { day: 130, date: '2026-09-19', mile: 2655.2, name: 'Northern Terminus / Manning Park',             kind: 'finish',   road: 'Crowsnest Hwy 3 (BC)',       offTrail: '~8 mi to lodge', airport: 'YVR', drive: '~150 mi · 3h' },
];

// Airports — ORD direct only. Coords for plotting.
window.PCT_AIRPORTS = {
  SAN: { name: 'San Diego Intl',         lat: 32.7338, lon: -117.1933, fromORD: 'direct on AA, UA (year-round)' },
  LAX: { name: 'Los Angeles Intl',       lat: 33.9416, lon: -118.4085, fromORD: 'direct on AA, UA (multiple daily)' },
  ONT: { name: 'Ontario CA Intl',        lat: 34.0560, lon: -117.6012, fromORD: 'direct on AA, UA' },
  PSP: { name: 'Palm Springs Intl',      lat: 33.8297, lon: -116.5067, fromORD: 'direct on AA, UA — heavy winter; summer schedule reduced (verify)' },
  LAS: { name: 'Harry Reid Intl',        lat: 36.0840, lon: -115.1537, fromORD: 'direct on AA, UA, F9, NK, B6 (multiple daily)' },
  FAT: { name: 'Fresno Yosemite Intl',   lat: 36.7762, lon: -119.7181, fromORD: 'direct on UA (seasonal/limited — verify)' },
  SMF: { name: 'Sacramento Intl',        lat: 38.6954, lon: -121.5908, fromORD: 'direct on AA, UA' },
  RNO: { name: 'Reno-Tahoe Intl',        lat: 39.4990, lon: -119.7681, fromORD: 'direct on AA, UA' },
  PDX: { name: 'Portland Intl',          lat: 45.5898, lon: -122.5951, fromORD: 'direct on AA, UA, Alaska' },
  SEA: { name: 'Seattle-Tacoma Intl',    lat: 47.4502, lon: -122.3088, fromORD: 'direct on AA, UA, Alaska' },
  YVR: { name: 'Vancouver Intl BC',      lat: 49.1939, lon: -123.1844, fromORD: 'direct on UA, Air Canada' },
};
