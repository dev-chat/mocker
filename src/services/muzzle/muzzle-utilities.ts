/**
 * Gets the amount of time remaining on a NodeJS Timeout.
 */
export function getRemainingTime(timeout: any) {
  return Math.ceil(
    timeout._idleStart + timeout._idleTimeout - process.uptime() * 1000
  );
}

/**
 * Gives us a random value between 30 seconds and 3 minutes.
 */
export function getTimeToMuzzle() {
  return Math.floor(Math.random() * (180000 - 30000 + 1) + 30000);
}

/**
 * Gives us a time string formatted as 1m20s to show the user.
 */
export function getTimeString(time: number) {
  const minutes = Math.floor(time / 60000);
  const seconds = ((time % 60000) / 1000).toFixed(0);
  return +seconds === 60
    ? minutes + 1 + "m00s"
    : minutes + "m" + (+seconds < 10 ? "0" : "") + seconds + "s";
}

/**
 * Generates a random number tells us if it is even.
 */
export function isRandomEven() {
  return Math.floor(Math.random() * 2) % 2 === 0;
}
