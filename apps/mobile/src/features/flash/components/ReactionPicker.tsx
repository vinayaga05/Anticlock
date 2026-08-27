import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { ReactionType } from '@/shared/data/flash/types';

export const REACTION_META: {
  id: ReactionType;
  label: string;
  icon: IconName;
  color: string;
}[] = [
  { id: 'like', label: 'Like', icon: 'heart', color: '#FB7185' },
  { id: 'love', label: 'Love', icon: 'love', color: '#F43F5E' },
  { id: 'support', label: 'Support', icon: 'support', color: '#14B8A6' },
  { id: 'useful', label: 'Useful', icon: 'useful', color: '#F59E0B' },
  { id: 'inspiring', label: 'Inspiring', icon: 'inspiring', color: '#818CF8' },
  { id: 'celebrate', label: 'Celebrate', icon: 'celebrate', color: '#F97316' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (reaction: ReactionType) => void;
  selected?: ReactionType | null;
};

export function ReactionPicker({ visible, onClose, onSelect, selected }: Props) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.backgroundElevated,
              borderRadius: theme.radius.xl,
              ...theme.shadows.float,
            },
          ]}>
          {REACTION_META.map(r => {
            const active = selected === r.id;
            return (
              <PressableScale
                key={r.id}
                onPress={() => {
                  onSelect(r.id);
                  onClose();
                }}
                accessibilityLabel={r.label}
                scaleTo={0.96}
                style={
                  active
                    ? [styles.item, { backgroundColor: theme.colors.primarySoft }]
                    : styles.item
                }>
                <AppIcon
                  name={r.icon}
                  size={22}
                  color={r.color}
                  strokeWidth={1.75}
                  fill={r.id === 'like' || r.id === 'love' ? r.color : 'none'}
                />
                <Text
                  style={[
                    theme.typography.caption,
                    {
                      color: active ? theme.colors.primary : theme.colors.textSecondary,
                      fontWeight: active ? '700' : '500',
                    },
                  ]}>
                  {r.label}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    maxWidth: 340,
  },
  item: {
    width: 72,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 12,
  },
});
