export function debounce<T extends (...args: never[]) => void>(fn: T, waitMs: number) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const debounced = (...args: Parameters<T>) => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      timeoutId = undefined;
      fn(...args);
    }, waitMs);
  };

  debounced.cancel = () => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    timeoutId = undefined;
  };

  debounced.flush = (...args: Parameters<T>) => {
    debounced.cancel();
    fn(...args);
  };

  return debounced;
}
