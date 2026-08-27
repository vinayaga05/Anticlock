import React from 'react';
import { RouteProp, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { EmptyState } from '@/shared/components/EmptyState';
import { RootStackParamList } from '@/shared/navigation/types';

export function ComingSoonScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'ComingSoon'>>();
  return (
    <ScreenContainer tabAware={false}>
      <EmptyState
        icon="plus"
        title={route.params.title}
        description="This compose flow is stubbed for the marketplace demo."
      />
    </ScreenContainer>
  );
}
