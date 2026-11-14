import React, { useRef } from 'react';
import { useAuth } from '@/shared/context/AuthProvider';
import { getApiToken } from '@/shared/api/client';
import { useFitnessDataEpoch } from '@/features/fitness/fitnessSession';
import { FitnessHomeScreen } from '@/features/fitness/screens/FitnessHomeScreen';
import { FitnessAssessmentScreen } from '@/features/fitness/screens/FitnessAssessmentScreen';
import { FitnessPlanScreen } from '@/features/fitness/screens/FitnessPlanScreen';
import { FitnessWorkoutScreen } from '@/features/fitness/screens/FitnessWorkoutScreen';
import { FitnessMealsScreen } from '@/features/fitness/screens/FitnessMealsScreen';
import { FitnessLogScreen } from '@/features/fitness/screens/FitnessLogScreen';
import { FitnessProgressScreen } from '@/features/fitness/screens/FitnessProgressScreen';
import { FitnessPrivacyScreen } from '@/features/fitness/screens/FitnessPrivacyScreen';
import { FitnessHistoryScreen } from '@/features/fitness/screens/FitnessHistoryScreen';
import { FitnessExpertsScreen } from '@/features/fitness/experts/screens/FitnessExpertsScreen';
import { FitnessWorkspaceScreen } from '@/features/fitness/experts/screens/FitnessWorkspaceScreen';
import { FitnessSharingScreen } from '@/features/fitness/experts/screens/FitnessSharingScreen';
import { ServiceTreeScreen } from '@/features/services/screens/ServiceTreeScreen';

/** Remount private forms and native media after account/token/data deletion changes. */
export function fitnessRoute(Screen: React.ComponentType<any>) {
  return function FitnessRoute(props: any) {
    const { user } = useAuth(),
      token = getApiToken(),
      epoch = useFitnessDataEpoch();
    const identity = useRef({ userId: user?.id, token, generation: 0 });
    if (
      identity.current.userId !== user?.id ||
      identity.current.token !== token
    )
      identity.current = {
        userId: user?.id,
        token,
        generation: identity.current.generation + 1,
      };
    const Target =
      user && user.id !== 'temporary-guest' && token
        ? Screen
        : FitnessHomeScreen;
    return (
      <Target
        key={`${user?.id ?? 'signed-out'}:${
          identity.current.generation
        }:${epoch}:${JSON.stringify(props.route?.params ?? {})}`}
        {...props}
      />
    );
  };
}
export const FitnessHomeRoute = fitnessRoute(FitnessHomeScreen);
export const FitnessAssessmentRoute = fitnessRoute(FitnessAssessmentScreen);
export const FitnessPlanRoute = fitnessRoute(FitnessPlanScreen);
export const FitnessWorkoutRoute = fitnessRoute(FitnessWorkoutScreen);
export const FitnessMealsRoute = fitnessRoute(FitnessMealsScreen);
export const FitnessLogRoute = fitnessRoute(FitnessLogScreen);
export const FitnessProgressRoute = fitnessRoute(FitnessProgressScreen);
export const FitnessPrivacyRoute = fitnessRoute(FitnessPrivacyScreen);
export const FitnessHistoryRoute = fitnessRoute(FitnessHistoryScreen);
export const FitnessExpertsRoute = fitnessRoute(FitnessExpertsScreen);
export const FitnessWorkspaceRoute = fitnessRoute(FitnessWorkspaceScreen);
export const FitnessSharingRoute = fitnessRoute(FitnessSharingScreen);
export function FitnessServiceTreeRoute(props: any) {
  return props.route?.params?.treeId === 'fitness' ? (
    <FitnessHomeRoute {...props} />
  ) : (
    <ServiceTreeScreen {...props} />
  );
}
