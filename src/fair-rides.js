// Going on a ride: which ride is in reach, how long a turn lasts, and how the camera watches it.
//
// Kept as plain numbers and strings so the prompt, the camera move and the tests can share them without
// building the fair. The rides themselves live in fair.js; this file only decides *when* and *how*.

import { RIDES, RIDE_ASK } from './fair-rules.js';

export const RIDE_INFO = {
  wheel: {
    name: 'چرخ‌وفلک',
    invite: 'یالا، چرخ‌وفلک سوار شیم',
    line: 'از بالای چرخ‌وفلک، همه‌ی شهر مثل یه جعبه‌ی فانوس بود.',
    seconds: 9,
    // camera: how far out and how high, relative to the ride, and how far it travels round it
    view: { radius: 15, height: 8.5, lookHeight: 6.5, sweep: 0.9 },
    boost: 2.2,
    freq: 523.25,
  },
  carousel: {
    name: 'اسب چوبی',
    invite: 'بریم اسب‌سواری کنیم',
    line: 'اسبِ من از اسبِ تو جلو زد؛ طبق معمول اشتباه حساب کردم.',
    seconds: 8,
    view: { radius: 9.5, height: 4.6, lookHeight: 2.6, sweep: 1.5 },
    boost: 2.6,
    freq: 587.33,
  },
  swings: {
    name: 'قایق تاب',
    invite: 'تاب بازی کنیم؟',
    line: 'هر بار که تاب می‌رفت بالا، یه ستاره از آسمون کم می‌شد.',
    seconds: 8,
    view: { radius: 10, height: 5.2, lookHeight: 3.2, sweep: 1.2 },
    boost: 2.4,
    freq: 659.25,
  },
  helter: {
    name: 'سرسره‌ی مارپیچ',
    invite: 'سرسره رو بریم؟',
    line: 'پایین سرسره، لباسم پر از بوی شکر بود.',
    seconds: 7,
    view: { radius: 8, height: 5.0, lookHeight: 4.2, sweep: 1.8 },
    boost: 2.0,
    freq: 783.99,
  },
};

export const RIDE_IDS = Object.keys(RIDE_INFO);

// When the couple stands anywhere on the fair's ground, which ride is close enough to offer?
// The nearest one that is in reach wins, so two neighbouring rides never fight over the prompt.
export function rideInReach(x, z, extra = 0) {
  let best = null;
  let bestDist = Infinity;
  for (const [id, spot] of Object.entries(RIDE_ASK)) {
    const d = Math.hypot(x - spot.x, z - spot.z);
    if (d <= spot.radius + extra && d < bestDist) {
      bestDist = d;
      best = id;
    }
  }
  return best;
}

// The camera's route for a ride: an arc around the ride, starting just off the lane and ending on the
// other side, so the couple appear to be carried round with it.
export function rideCameraPath(id, from) {
  const ride = RIDES[id];
  const info = RIDE_INFO[id];
  const { radius, height, lookHeight, sweep } = info.view;
  // The arc is centred on the ride, and it starts *behind the couple* looking at them: the turn begins
  // on the ground, where they stepped in, and orbits as the ride takes them.
  const startAngle = Math.atan2(from.z - ride.z, from.x - ride.x);
  const angle = startAngle + sweep;
  const seat = RIDE_ASK[id];
  return {
    from: { x: from.x, y: Math.max(2.4, from.y), z: from.z },
    to: {
      x: ride.x + Math.cos(angle) * radius,
      y: height,
      z: ride.z + Math.sin(angle) * radius,
    },
    // the look target starts on the couple at their seat spot, and ends on the ride itself
    lookFrom: { x: seat.x, y: 1.6, z: seat.z },
    lookTo: { x: ride.x, y: lookHeight, z: ride.z },
    // which way the couple face while they are carried: outward, away from the ride's hub
    face: Math.atan2(seat.x - ride.x, seat.z - ride.z),
  };
}

// How much to speed a ride up while the couple are on it.
export function rideSpeed(activeId, id) {
  if (activeId && activeId === id) return RIDE_INFO[id].boost;
  return 1;
}

// A sweet line for the moment a ride is over: the ride's own line, and every fourth ride an extra one.
export function rideLine(id, ridesTaken) {
  const line = RIDE_INFO[id] ? RIDE_INFO[id].line : '';
  if (ridesTaken > 0 && ridesTaken % 4 === 0) {
    return `${line} چهار بار سوار شدیم و هنوز دلمون می‌خواد.`;
  }
  return line;
}

// The first visit to the fair gets its own line, so arriving somewhere new is noticed.
export const FAIR_ARRIVAL = 'شهربازیِ ما؛ چراغ‌هاش رو برای همین شب روشن کردن.';
export const FAIR_HINT = 'هر جایی از شهربازی که وایسی، یه سوارِ آماده هست.';
