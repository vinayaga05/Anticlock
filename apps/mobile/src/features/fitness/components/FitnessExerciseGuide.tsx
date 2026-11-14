import React, { useState } from 'react';
import { Linking } from 'react-native';
import { FitnessAction, FitnessNotice, FitnessText } from './FitnessUI';

// Reviewed public instruction pages, never a media URL supplied by a plan or
// a user. Opening one sends no assessment, account, log or health query fields.
const guides: Record<string, { url: string; label: string }> = {
  'Chair sit-to-stand': {
    url: 'https://www.nhs.uk/live-well/exercise/strength-exercises/',
    label: 'View NHS sit-to-stand images',
  },
  'Wall push-up': {
    url: 'https://www.nhs.uk/live-well/exercise/strength-exercises/',
    label: 'View NHS wall press-up images',
  },
  'Gentle warm-up': {
    url: 'https://www.nhs.uk/live-well/exercise/strength-and-flex-exercise-plan-how-to-videos/',
    label: 'Watch NHS warm-up guidance',
  },
};
export function FitnessExerciseGuide({ name }: { name: string }) {
  const guide = guides[name];
  const [error, setError] = useState('');
  if (!guide) return null;
  return (
    <>
      <FitnessAction
        secondary
        icon="play"
        label={guide.label}
        onPress={() => {
          setError('');
          void Linking.openURL(guide.url).catch(() =>
            setError(
              'The instruction page could not be opened. Check your connection and try again.',
            ),
          );
        }}
      />
      <FitnessText muted>
        Opens general exercise guidance on the NHS website. It is not
        personalized instruction or medical clearance.
      </FitnessText>
      <FitnessNotice error message={error} />
    </>
  );
}
