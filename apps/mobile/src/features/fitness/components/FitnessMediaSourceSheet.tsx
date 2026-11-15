import React, { useEffect, useRef, useState } from 'react';
import { FitnessSheet } from './FitnessControls';
import { FitnessAction, FitnessNotice, FitnessText } from './FitnessUI';
import {
  pickFitnessMedia,
  type FitnessMediaSource,
  type PickedFitnessMedia,
} from '../logging/fitnessMediaPicker';
import { useFitnessLoggingPreferences } from '../logging/fitnessLoggingPreferences';
export function FitnessMediaSourceSheet({
  visible,
  onClose,
  onChoose,
  allowVideo = false,
}: {
  visible: boolean;
  onClose: () => void;
  onChoose: (asset: PickedFitnessMedia) => void;
  allowVideo?: boolean;
}) {
  const preferences = useFitnessLoggingPreferences(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const activeScope = useRef(preferences.scope);
  const picking = useRef(false);
  const mounted = useRef(true);
  activeScope.current = preferences.scope;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function choose(source: FitnessMediaSource) {
    if (picking.current) return;
    picking.current = true;
    const scope = preferences.scope;
    setError('');
    setBusy(true);
    try {
      const file = await pickFitnessMedia(source, allowVideo);
      if (!mounted.current || activeScope.current !== scope) return;
      if (file) {
        preferences.acknowledgeMediaNotice();
        onClose();
        onChoose(file);
      }
    } catch (e) {
      if (mounted.current && activeScope.current === scope)
        setError((e as Error).message);
    } finally {
      picking.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <FitnessSheet
      visible={visible}
      title={allowVideo ? 'Add private media' : 'Add a private photo'}
      onClose={() => {
        if (!picking.current) onClose();
      }}
    >
      {!preferences.mediaNoticeSeen && (
        <FitnessText muted>
          Private to your Fitness space. Nothing appears on your public profile.
          You choose any expert sharing separately.
        </FitnessText>
      )}
      <FitnessAction
        label="Take photo"
        icon="camera"
        secondary
        busy={busy}
        onPress={() => {
          void choose('camera');
        }}
      />
      {allowVideo && (
        <FitnessAction
          label="Record video"
          icon="video"
          secondary
          disabled={busy}
          onPress={() => {
            void choose('video');
          }}
        />
      )}
      <FitnessAction
        label={allowVideo ? 'Choose from gallery' : 'Choose photo from gallery'}
        icon="image"
        secondary
        disabled={busy}
        onPress={() => {
          void choose('library');
        }}
      />
      <FitnessNotice error message={error} />
    </FitnessSheet>
  );
}
