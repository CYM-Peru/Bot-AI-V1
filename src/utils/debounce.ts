export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<T>) => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delay);
  };
  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  debounced.flush = (...args: Parameters<T>) => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      fn(...args);
    }
  };
  return debounced as T & { cancel: () => void; flush: (...args: Parameters<T>) => void };
}
