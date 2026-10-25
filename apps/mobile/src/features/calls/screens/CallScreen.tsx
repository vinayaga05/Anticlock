import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import {
  CallContent,
  CallingState,
  RingingCallContent,
  StreamCall,
  type Call,
  type CallContentProps,
} from '@stream-io/video-react-native-sdk';
import { PressableScale } from '@/shared/components/PressableScale';
import { createVideoCall } from '@/shared/api/messagesClient';
import { useStreamChat } from '@/shared/providers/StreamChatProvider';
import { RootStackParamList } from '@/shared/navigation/types';

function AudioCallContent(props: CallContentProps) {
  return <CallContent {...props} initialInCallManagerAudioMode="audio" />;
}

async function requestOutgoingPermissions(mode: 'audio' | 'video') {
  if (Platform.OS !== 'android') return;
  const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (mode === 'video') permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA);
  const result = await PermissionsAndroid.requestMultiple(permissions);
  const denied = permissions.some(
    permission => result[permission] !== PermissionsAndroid.RESULTS.GRANTED,
  );
  if (denied) {
    throw new Error(
      `${mode === 'video' ? 'Camera and microphone' : 'Microphone'} access is required for this call.`,
    );
  }
}

export function CallScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Call'>>();
  const { videoClient, isVideoReady, error: streamError } = useStreamChat();
  const [call, setCall] = useState<Call | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { mode, incoming, callId, callType, targetProfile, viewerProfile } = route.params;
  const AcceptedCallContent = useMemo(
    () => (mode === 'audio' ? AudioCallContent : CallContent),
    [mode],
  );

  useEffect(() => {
    if (!videoClient || !isVideoReady) return;
    let cancelled = false;
    let activeCall: Call | null = null;

    async function prepare() {
      try {
        setError(null);
        if (incoming) {
          if (!callId || !callType) throw new Error('This incoming call is unavailable.');
          activeCall = videoClient!.call(callType, callId, { reuseInstance: true });
        } else {
          if (!targetProfile || !viewerProfile) {
            throw new Error('The profile for this call is unavailable.');
          }
          await requestOutgoingPermissions(mode);
          const created = await createVideoCall(targetProfile, viewerProfile, mode);
          activeCall = videoClient!.call(created.callType, created.callId, { reuseInstance: true });
          if (mode === 'audio') await activeCall.camera.disable();
          await activeCall.get({ ring: true, video: mode === 'video' });
        }
        if (!cancelled) setCall(activeCall);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Could not start this call.');
      }
    }

    void prepare();
    return () => {
      cancelled = true;
      if (activeCall && activeCall.state.callingState !== CallingState.LEFT) {
        activeCall.leave().catch(() => undefined);
      }
    };
  }, [
    videoClient,
    isVideoReady,
    incoming,
    callId,
    callType,
    targetProfile?.id,
    targetProfile?.type,
    viewerProfile?.id,
    viewerProfile?.type,
    mode,
  ]);

  if (error || streamError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Call unavailable</Text>
        <Text style={styles.errorText}>{error ?? streamError}</Text>
        <PressableScale style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backLabel}>Back</Text>
        </PressableScale>
      </View>
    );
  }

  if (!call) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loading}>{isVideoReady ? 'Starting call…' : 'Connecting calls…'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StreamCall call={call}>
        <RingingCallContent
          CallContent={AcceptedCallContent}
          onBackPress={() => navigation.goBack()}
        />
      </StreamCall>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1220' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 28,
    backgroundColor: '#0B1220',
  },
  loading: { color: 'rgba(255,255,255,0.78)', fontSize: 16 },
  errorTitle: { color: '#fff', fontSize: 23, fontWeight: '800' },
  errorText: { color: 'rgba(255,255,255,0.72)', fontSize: 15, textAlign: 'center' },
  backButton: {
    marginTop: 8,
    minWidth: 112,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
  },
  backLabel: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
