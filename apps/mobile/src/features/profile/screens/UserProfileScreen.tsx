import React from 'react';
import { RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '@/shared/navigation/types';
import { PublisherProfileView } from '@/features/profile/components/PublisherProfileView';

/** All profiles use the server-backed publisher identity and social state. */
export function UserProfileScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Profile'>>();
  const params = route.params;
  return (
    <PublisherProfileView
      profileType={params?.profileType ?? 'personal'}
      profileId={params?.profileId ?? params?.userId}
    />
  );
}
