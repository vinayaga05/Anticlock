import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';

export type ClipMoreAction =
  | 'save'
  | 'interested'
  | 'not_interested'
  | 'report'
  | 'block'
  | 'caption'
  | 'auto_scroll';

/** The exact profile to block; personal and business scopes must not blur. */
export type ClipBlockTarget = {
  type: 'user' | 'business';
  id: string;
  name?: string;
};

type Props = {
  visible: boolean;
  saved: boolean;
  autoScroll: boolean;
  /** Omit for legacy/editorial clips that are not tied to a profile. */
  blockTarget?: ClipBlockTarget | null;
  onClose: () => void;
  onAction: (action: ClipMoreAction) => void;
};

const ACTIONS: Array<{
  key: Exclude<ClipMoreAction, 'auto_scroll' | 'block'>;
  label: string;
  icon: IconName;
  destructive?: boolean;
}> = [
  { key: 'save', label: 'Save', icon: 'bookmark' },
  { key: 'interested', label: 'Interested', icon: 'interested' },
  { key: 'not_interested', label: 'Not interested', icon: 'unlike' },
  { key: 'report', label: 'Report', icon: 'report', destructive: true },
  { key: 'caption', label: 'Caption', icon: 'caption' },
];

export function ClipMoreSheet({
  visible,
  saved,
  autoScroll,
  blockTarget,
  onClose,
  onAction,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const actions = blockTarget
    ? [
        ...ACTIONS,
        {
          key: 'block' as const,
          label: `Block ${blockTarget.type === 'business' ? 'business' : 'user'}`,
          icon: blockTarget.type === 'business' ? ('shop' as const) : ('user' as const),
          destructive: true,
        },
      ]
    : ACTIONS;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
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
          onPress={e => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={[theme.typography.title, { color: theme.colors.textPrimary }]}>
            More
          </Text>
          {actions.map(action => {
            const active = action.key === 'save' && saved;
            const label =
              action.key === 'save' ? (saved ? 'Saved' : 'Save') : action.label;

            return (
              <PressableScale
                key={action.key}
                accessibilityLabel={label}
                onPress={() => onAction(action.key)}
                style={[
                  styles.row,
                  {
                    borderColor: theme.colors.borderSoft,
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.surface,
                  },
                ]}>
                <AppIcon
                  name={action.icon}
                  size={20}
                  color={
                    action.destructive
                      ? theme.colors.error
                      : active
                        ? theme.colors.primary
                        : theme.colors.textPrimary
                  }
                  strokeWidth={1.85}
                  fill={action.key === 'save' && saved ? theme.colors.primary : 'none'}
                />
                <Text
                  style={[
                    theme.typography.body,
                    {
                      color: action.destructive
                        ? theme.colors.error
                        : theme.colors.textPrimary,
                      fontWeight: '500',
                      flex: 1,
                    },
                  ]}>
                  {label}
                </Text>
              </PressableScale>
            );
          })}

          <View
            style={[
              styles.row,
              {
                borderColor: theme.colors.borderSoft,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surface,
              },
            ]}>
            <AppIcon
              name="auto-scroll"
              size={20}
              color={autoScroll ? theme.colors.primary : theme.colors.textPrimary}
              strokeWidth={1.85}
            />
            <Text
              style={[
                theme.typography.body,
                {
                  color: theme.colors.textPrimary,
                  fontWeight: '500',
                  flex: 1,
                },
              ]}>
              Auto scroll
            </Text>
            <Switch
              value={autoScroll}
              onValueChange={() => onAction('auto_scroll')}
              trackColor={{
                false: theme.colors.borderSoft,
                true: theme.colors.primary,
              }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={theme.colors.borderSoft}
              accessibilityLabel="Auto scroll"
            />
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
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.35)',
    marginBottom: 6,
  },
  row: {
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
