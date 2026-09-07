import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';

export type GuidedReportVideoReason =
  | 'harmful_content'
  | 'bullying'
  | 'harassment'
  | 'violent_or_assault_content'
  | 'adult_or_pornographic_material'
  | 'hate_speech'
  | 'misinformation'
  | 'illegal_activity'
  | 'child_exploitation'
  | 'privacy_violation'
  | 'spam_or_scams';

export const REPORT_VIDEO_REASONS: ReadonlyArray<{
  value: GuidedReportVideoReason;
  label: string;
}> = [
  { value: 'harmful_content', label: 'Harmful content' },
  { value: 'bullying', label: 'Bullying' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'violent_or_assault_content', label: 'Violent or assault content' },
  { value: 'adult_or_pornographic_material', label: 'Adult or pornographic material' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'illegal_activity', label: 'Illegal activity' },
  { value: 'child_exploitation', label: 'Child exploitation' },
  { value: 'privacy_violation', label: 'Privacy violation' },
  { value: 'spam_or_scams', label: 'Spam or scams' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Resolve only after the report has been accepted by the API. */
  onSubmit: (reason: GuidedReportVideoReason) => Promise<void> | void;
};

/**
 * One focused, reusable report flow for Clips. The selected enum value—not a
 * UI label—is sent to the API, which keeps moderation routing reliable when
 * app copy is localized or refined later.
 */
export function GuidedReportVideoSheet({ visible, onClose, onSubmit }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<GuidedReportVideoReason | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setReason(null);
      setSubmitting(false);
      setError(null);
    }
  }, [visible]);

  const submit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(reason);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not send your report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={submitting ? undefined : onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={submitting ? undefined : onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.backgroundElevated,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
          ]}
          onPress={event => event.stopPropagation()}>
          <View style={[styles.handle, { backgroundColor: theme.colors.borderSoft }]} />
          <View style={styles.headingRow}>
            <View
              style={[
                styles.headingIcon,
                { backgroundColor: `${theme.colors.error}1A` },
              ]}>
              <AppIcon name="report" size={19} color={theme.colors.error} />
            </View>
            <View style={styles.headingText}>
              <Text style={[theme.typography.title, { color: theme.colors.textPrimary }]}>
                Report video
              </Text>
              <Text style={[styles.prompt, { color: theme.colors.textSecondary }]}>
                Please tell us why you are reporting this video. Select the reason that best fits.
              </Text>
            </View>
          </View>

          <ScrollView
            style={styles.reasonList}
            contentContainerStyle={styles.reasonListContent}
            showsVerticalScrollIndicator={false}>
            {REPORT_VIDEO_REASONS.map(option => {
              const selected = option.value === reason;
              return (
                <PressableScale
                  key={option.value}
                  accessibilityLabel={`Report reason: ${option.label}`}
                  onPress={() => {
                    setReason(option.value);
                    setError(null);
                  }}
                  style={[
                    styles.reasonRow,
                    {
                      borderColor: selected
                        ? theme.colors.primary
                        : theme.colors.borderSoft,
                      backgroundColor: selected
                        ? theme.colors.primarySoft
                        : theme.colors.surface,
                    },
                  ]}>
                  <View
                    style={[
                      styles.radio,
                      {
                        borderColor: selected
                          ? theme.colors.primary
                          : theme.colors.textSecondary,
                      },
                    ]}>
                    {selected ? (
                      <View
                        style={[
                          styles.radioDot,
                          { backgroundColor: theme.colors.primary },
                        ]}
                      />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.reasonLabel,
                      {
                        color: theme.colors.textPrimary,
                        fontWeight: selected ? '700' : '500',
                      },
                    ]}>
                    {option.label}
                  </Text>
                </PressableScale>
              );
            })}
          </ScrollView>

          {error ? (
            <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
          ) : null}
          <View style={styles.footer}>
            <PressableScale
              accessibilityLabel="Cancel report"
              disabled={submitting}
              onPress={onClose}
              style={[
                styles.footerButton,
                {
                  borderColor: theme.colors.borderSoft,
                  backgroundColor: theme.colors.surface,
                },
              ]}>
              <Text style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>
                Cancel
              </Text>
            </PressableScale>
            <PressableScale
              accessibilityLabel="Submit video report"
              disabled={!reason || submitting}
              onPress={submit}
              style={[
                styles.footerButton,
                {
                  backgroundColor: theme.colors.error,
                  opacity: reason && !submitting ? 1 : 0.48,
                },
              ]}>
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Report</Text>
              )}
            </PressableScale>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    maxHeight: '88%',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    borderRadius: 2,
    height: 4,
    marginBottom: 14,
    width: 38,
  },
  headingRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  headingIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headingText: {
    flex: 1,
    gap: 4,
  },
  prompt: {
    fontSize: 13,
    lineHeight: 18,
  },
  reasonList: {
    flexGrow: 0,
  },
  reasonListContent: {
    gap: 7,
    paddingBottom: 10,
  },
  reasonRow: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 11,
    minHeight: 49,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  radio: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  radioDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  reasonLabel: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  error: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
  },
  footerButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
});
