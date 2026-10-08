import { storage } from '@/shared/services/storage';
import { createPublisherSelectionStore } from './publisherSelection';

/** MMKV-backed selection/draft store (survives app relaunch). */
export const publisherSelectionStore = createPublisherSelectionStore(storage);
