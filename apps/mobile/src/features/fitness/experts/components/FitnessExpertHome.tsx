import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type {
  FitnessConsultation,
  FitnessWorkspace,
} from '@anticlock/contracts';
import { useFitnessQuery } from '../../api/fitnessApi';
import {
  FitnessAction,
  FitnessCard,
  FitnessSection,
  FitnessText,
} from '../../components/FitnessUI';
export function FitnessExpertHome() {
  const nav = useNavigation<any>();
  const sessions = useFitnessQuery<{ consultations: FitnessConsultation[] }>(
    '/consultations',
  );
  const workspace = useFitnessQuery<FitnessWorkspace>('/workspace');
  const next = sessions.data?.consultations
    .filter(
      s =>
        ['confirmed', 'pending', 'reschedule_requested'].includes(s.status) &&
        new Date(s.endsAt ?? s.startsAt).getTime() > Date.now(),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  return (
    <FitnessCard>
      <FitnessSection
        title="A little expert support"
        caption="Choose a professional. Share only what you select."
      />
      {next && (
        <>
          <FitnessText>
            {next.providerName} · {new Date(next.startsAt).toLocaleString()}
          </FitnessText>
          <FitnessAction
            secondary
            label="View consultation"
            onPress={() =>
              nav.navigate('BookingDetail', { bookingId: next.bookingId })
            }
          />
        </>
      )}
      <FitnessAction
        label="Find a trainer or nutritionist"
        onPress={() => nav.navigate('FitnessExperts')}
      />
      {Boolean(workspace.data?.providers.length) && (
        <FitnessAction
          secondary
          label="Open expert workspace"
          onPress={() => nav.navigate('FitnessWorkspace')}
        />
      )}
    </FitnessCard>
  );
}
