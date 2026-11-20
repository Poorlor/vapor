// https://steamcommunity.com/sharedfiles/filedetails/?id=3513823322
export const COLLECTOR_TIERS = [
  { count: 1, name: 'One-Stop Shopper', xp: 100 },
  { count: 5, name: 'Select Collector', xp: 125 },
  { count: 10, name: 'Adept Accumulator', xp: 150 },
  { count: 25, name: 'Sharp-Eyed Stockpiler', xp: 200 },
  { count: 50, name: 'Collection Agent', xp: 250 },
  { count: 100, name: 'Power Player', xp: 325 },
  { count: 250, name: 'Game Mechanic', xp: 500 },
  { count: 500, name: 'Director of Acquisitions', xp: 750 },
  { count: 1000, name: 'Game Industry Guardian', xp: 1250 },
  { count: 2000, name: 'Gaming God', xp: 2250 },
  { count: 3000, name: 'Accrual Expert', xp: 3250 },
  { count: 4000, name: 'Ambassador of Amassment', xp: 4250 },
  { count: 5000, name: 'Digital Deity', xp: 5250 },
  { count: 6000, name: 'Collection King', xp: 6250 },
  { count: 7000, name: 'Magnate of Amassment', xp: 7250 },
  { count: 8000, name: 'Stockpiler Supreme', xp: 8250 },
  { count: 9000, name: 'Almighty Aggregator', xp: 9250 },
  { count: 10000, name: 'Master Gatherer', xp: 10250 },
  { count: 11000, name: 'Omnipotent Assembler', xp: 11250 },
  { count: 12000, name: 'Acquisition Idol', xp: 12250 },
  ...Array.from({ length: 28 }, (_, i) => {
    const count = (i + 13) * 1000;
    return { count, name: `Game Collector: ${count.toLocaleString('en-US')}+`, xp: count + 250 };
  }),
];
