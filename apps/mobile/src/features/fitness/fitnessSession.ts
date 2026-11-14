import { useSyncExternalStore } from 'react';

let epoch = 0;
const subscribers = new Set<() => void>();
export function bumpFitnessDataEpoch() {
  epoch += 1;
  subscribers.forEach(listener => listener());
}
export function useFitnessDataEpoch() {
  return useSyncExternalStore(
    listener => {
      subscribers.add(listener);
      return () => {
        subscribers.delete(listener);
      };
    },
    () => epoch,
    () => epoch,
  );
}
