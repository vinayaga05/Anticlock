import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useAssistantStore } from '@/features/assistant/store/assistantStore';

export function FloatingAssistantButton() {
  const theme = useTheme();
  const enabled = useAssistantStore(s => s.enabled);
  const open = useAssistantStore(s => s.open);
  const openAssistant = useAssistantStore(s => s.openAssistant);

  if (!enabled || open) return null;

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <PressableScale
        accessibilityLabel="Open Genie"
        onPress={() => openAssistant()}
        style={[
          styles.button,
          {
            backgroundColor: theme.colors.primary,
            ...theme.shadows.float,
          },
        ]}>
        <AppIcon name="sparkles" size={22} color="#fff" />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 16,
    bottom: 88,
    zIndex: 120,
    elevation: 120,
  },
  button: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
