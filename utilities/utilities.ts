export async function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function last_501() {
  const now = new Date();
  const past = new Date(now.getTime() - 501 * 1000); // subtract 500 seconds

  // Format as HH:MM:SS
  const hh = String(past.getHours()).padStart(2, '0');
  const mm = String(past.getMinutes()).padStart(2, '0');
  const ss = String(past.getSeconds()).padStart(2, '0');

  return `${hh}:${mm}:${ss}`;
}
