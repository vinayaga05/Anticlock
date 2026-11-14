import React, { useEffect } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useActiveProfile } from '@/shared/publishing/useActiveProfile';
import { identityProfileType } from '@/shared/publishing/publisherSelection';
import { UserProfileScreen } from '@/features/profile/screens/UserProfileScreen';
import { UniversalDetailScreen } from '@/features/services/screens/UniversalDetailScreen';
import { businessProfileDestination, legacyBusinessDestination, type BusinessProfileDestination } from './businessNavigation';
import type { RootStackParamList } from './types';

function useBusinessRedirect(destination: BusinessProfileDestination | null) {
  const navigation = useNavigation<any>();
  const providerId = destination?.params.providerId;
  const categoryId = destination?.params.categoryId;
  useEffect(() => {
    if (providerId) navigation.replace('BusinessProfile', { providerId, ...(categoryId ? { categoryId } : {}) });
  }, [navigation, providerId, categoryId]);
}

/** Old business profile links cannot render the personal/social profile UI. */
export function ProfileRouteScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Profile'>>();
  const { active } = useActiveProfile();
  const explicit = route.params?.profileId || route.params?.userId;
  const destination = legacyBusinessDestination('Profile', route.params)
    ?? (!explicit && active && identityProfileType(active) === 'business' ? businessProfileDestination(active.id) : null);
  useBusinessRedirect(destination);
  return destination ? null : <UserProfileScreen />;
}

/** Keep demo Details while redirecting historic live-provider links. */
export function UniversalDetailRouteScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'UniversalDetail'>>();
  const destination = legacyBusinessDestination('UniversalDetail', route.params);
  useBusinessRedirect(destination);
  return destination ? null : <UniversalDetailScreen />;
}
