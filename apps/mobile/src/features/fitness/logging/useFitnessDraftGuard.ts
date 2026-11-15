import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  useNavigation,
  usePreventRemove,
  type NavigationAction,
} from '@react-navigation/native';
import { useAuth } from '@/shared/context/AuthProvider';
import { getApiToken } from '@/shared/api/client';
import { getFitnessDataEpoch, useFitnessDataEpoch } from '../fitnessSession';

/** Keeps private drafts in memory until their owner saves or explicitly discards them. */
export function useFitnessDraftGuard({
  dirty,
  busy = false,
  save,
  onError,
  detail,
}: {
  dirty: boolean;
  busy?: boolean;
  save: () => Promise<boolean>;
  onError: (message: string) => void;
  detail?: string;
}) {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const token = getApiToken();
  const epoch = useFitnessDataEpoch();
  const ownerKey = `${user?.id ?? 'signed-out'}:${token ?? ''}:${epoch}`;
  const owner = useRef({ key: ownerKey, token, epoch });
  const liveOwner = useRef(ownerKey);
  liveOwner.current = ownerKey;
  const callbacks = useRef({ busy, save, onError });
  callbacks.current = { busy, save, onError };
  const mounted = useRef(true),
    prompting = useRef(false),
    operation = useRef(false);
  const pendingAction = useRef<{
    action: NavigationAction;
    afterExit?: () => void;
  } | null>(null);
  const [allowExit, setAllowExit] = useState(false),
    [saving, setSaving] = useState(false);
  const isOwner = () =>
    mounted.current &&
    liveOwner.current === owner.current.key &&
    getApiToken() === owner.current.token &&
    getFitnessDataEpoch() === owner.current.epoch;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function exit(action: NavigationAction, afterExit?: () => void) {
    if (!isOwner()) return;
    pendingAction.current = { action, afterExit };
    setAllowExit(true);
  }
  useEffect(() => {
    if (!allowExit || !pendingAction.current) return;
    const pending = pendingAction.current;
    pendingAction.current = null;
    if (isOwner()) {
      navigation.dispatch(pending.action);
      pending.afterExit?.();
    }
  }, [allowExit, navigation]);
  usePreventRemove(
    !allowExit &&
      liveOwner.current === owner.current.key &&
      (dirty || saving || busy),
    ({ data }) => {
      if (
        !isOwner() ||
        prompting.current ||
        operation.current ||
        callbacks.current.busy
      )
        return;
      prompting.current = true;
      Alert.alert(
        'Save before leaving?',
        detail ?? 'Your changes are still here. Save them or keep editing.',
        [
          {
            text: 'Stay',
            style: 'cancel',
            onPress: () => {
              prompting.current = false;
            },
          },
          {
            text: 'Discard changes',
            style: 'destructive',
            onPress: () => {
              prompting.current = false;
              if (!operation.current && !callbacks.current.busy)
                exit(data.action);
            },
          },
          {
            text: 'Save & leave',
            onPress: () => {
              prompting.current = false;
              if (!isOwner() || operation.current || callbacks.current.busy)
                return;
              operation.current = true;
              setSaving(true);
              void Promise.resolve()
                .then(() => (isOwner() ? callbacks.current.save() : false))
                .then(saved => {
                  if (saved && isOwner()) exit(data.action);
                })
                .catch(problem => {
                  if (isOwner())
                    callbacks.current.onError(
                      (problem as Error).message ||
                        'Your entry could not be saved. Try again.',
                    );
                })
                .finally(() => {
                  operation.current = false;
                  if (mounted.current) setSaving(false);
                });
            },
          },
        ],
        {
          cancelable: true,
          onDismiss: () => {
            prompting.current = false;
          },
        },
      );
    },
  );
  function captureOperation() {
    const expected = owner.current;
    return () => {
      if (
        !mounted.current ||
        liveOwner.current !== expected.key ||
        getApiToken() !== expected.token ||
        getFitnessDataEpoch() !== expected.epoch
      )
        throw new Error('Your Fitness space changed. Reopen it to continue.');
    };
  }
  return {
    captureOperation,
    isActive: isOwner,
    saving,
    allowExit: (action: NavigationAction, afterExit?: () => void) =>
      exit(action, afterExit),
  };
}
