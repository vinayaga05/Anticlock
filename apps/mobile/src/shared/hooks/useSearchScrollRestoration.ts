import { useCallback, useRef, useState } from 'react';
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
} from 'react-native';

/** Keeps a screen's place when temporary live-search results are cleared. */
export function useSearchScrollRestoration() {
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const offsetY = useRef(0);
  const savedOffsetY = useRef(0);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      offsetY.current = event.nativeEvent.contentOffset.y;
    },
    [],
  );

  const onChangeText = useCallback(
    (nextQuery: string) => {
      const wasSearching = Boolean(searchQuery.trim());
      const willSearch = Boolean(nextQuery.trim());

      if (!wasSearching && willSearch) savedOffsetY.current = offsetY.current;
      setSearchQuery(nextQuery);

      if (wasSearching && !willSearch) {
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({
            y: savedOffsetY.current,
            animated: false,
          });
        });
      }
    },
    [searchQuery],
  );

  return { searchQuery, onChangeText, scrollRef, onScroll };
}
