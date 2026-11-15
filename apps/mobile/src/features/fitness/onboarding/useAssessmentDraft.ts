import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { FitnessProfile } from '@anticlock/contracts';
import { useAuth } from '@/shared/context/AuthProvider';
import { getApiToken } from '@/shared/api/client';
import { fitnessRequest, type FitnessSession } from '../api/fitnessApi';
import { useFitnessDataEpoch } from '../fitnessSession';
import {
  AssessmentDraftSaver,
  type AssessmentDraftState,
} from './assessmentDraftSaver';
import { initialAssessment } from './assessmentModel';

/** Owns hydration and writes under one captured account/token/data epoch. */
export function useAssessmentDraft() {
  const { user } = useAuth();
  const token = getApiToken();
  const epoch = useFitnessDataEpoch();
  const client = useQueryClient();
  const ownerKey = `${user?.id ?? 'signed-out'}:${token ?? ''}:${epoch}`;
  const liveOwner = useRef(ownerKey);
  liveOwner.current = ownerKey;
  const owner = useRef<{
    key: string;
    session: FitnessSession | null;
    saver: AssessmentDraftSaver;
  } | null>(null);
  if (!owner.current || owner.current.key !== ownerKey) {
    owner.current?.saver.dispose();
    const session =
      user && user.id !== 'temporary-guest' && token
        ? { userId: user.id, token }
        : null;
    const saver = new AssessmentDraftSaver(async (patch, signal) => {
      if (!session || liveOwner.current !== ownerKey)
        throw new Error('Your account changed. Reopen Fitness to continue.');
      const result = await fitnessRequest<{ profile: FitnessProfile }>(
        '/profile',
        { method: 'PATCH', body: JSON.stringify(patch), signal },
        session,
      );
      if (liveOwner.current !== ownerKey)
        throw new Error('Your account changed. Reopen Fitness to continue.');
      void client.invalidateQueries({ queryKey: ['fitness', session.userId] });
      return result;
    }, initialAssessment());
    owner.current = { key: ownerKey, session, saver };
  }
  const current = owner.current;
  const [observed, setObserved] = useState<{
    saver: AssessmentDraftSaver;
    state: AssessmentDraftState;
  }>({ saver: current.saver, state: current.saver.getSnapshot() });
  const [load, setLoad] = useState<{ key: string; error: string | null }>({
    key: ownerKey,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  const state =
    observed.saver === current.saver
      ? observed.state
      : current.saver.getSnapshot();
  useEffect(() => {
    current.saver.resume();
    setObserved({ saver: current.saver, state: current.saver.getSnapshot() });
    const unsubscribe = current.saver.subscribe(next => {
      if (liveOwner.current === current.key)
        setObserved({ saver: current.saver, state: next });
    });
    return () => {
      unsubscribe();
      current.saver.dispose();
    };
  }, [current]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoad({ key: current.key, error: null });
    if (!current.session) {
      setLoad({
        key: current.key,
        error: 'Sign in to save your private answers.',
      });
      return () => {
        active = false;
        controller.abort();
      };
    }
    void fitnessRequest<{ profile: FitnessProfile | null }>(
      '/profile',
      { signal: controller.signal },
      current.session,
    )
      .then(result => {
        if (
          active &&
          !controller.signal.aborted &&
          liveOwner.current === current.key
        )
          current.saver.hydrate(result.profile);
      })
      .catch(problem => {
        if (
          active &&
          !controller.signal.aborted &&
          liveOwner.current === current.key
        )
          setLoad({ key: current.key, error: (problem as Error).message });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [current, attempt]);
  const retryLoad = useCallback(() => setAttempt(value => value + 1), []);
  return {
    ...state,
    saver: current.saver,
    ownerKey,
    loadError: load.key === current.key ? load.error : null,
    retryLoad,
  };
}
