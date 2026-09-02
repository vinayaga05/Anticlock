import React, { useState } from 'react';
import { Alert, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { PressableScale } from '@/shared/components/PressableScale';
import { useAssistantStore } from '@/features/assistant/store/assistantStore';
import {
  useDeleteAllAssistantHistory,
  useExportAssistantData,
} from '@/features/assistant/hooks/assistantHooks';

export function AssistantPrivacySection() {
  const theme = useTheme();
  const enabled = useAssistantStore(s => s.enabled);
  const setEnabled = useAssistantStore(s => s.setEnabled);
  const clearMessages = useAssistantStore(s => s.clearMessages);
  const openAssistant = useAssistantStore(s => s.openAssistant);
  const deleteAll = useDeleteAllAssistantHistory();
  const exportData = useExportAssistantData();
  const [busy, setBusy] = useState(false);

  const confirmDeleteAll = () => {
    Alert.alert(
      'Delete Genie history',
      'This permanently deletes all Genie conversations.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteAll.mutateAsync();
              clearMessages();
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const handleExport = async () => {
    setBusy(true);
    try {
      const result = await exportData.mutateAsync();
      await Share.share({
        message: JSON.stringify(result.data, null, 2),
        title: 'Genie export',
      });
    } catch {
      Alert.alert('Export failed', 'Could not export Genie data right now.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
        Genie
      </Text>
      <View style={[styles.row, { borderColor: theme.colors.borderSoft }]}>
        <Text style={[styles.label, { color: theme.colors.textPrimary }]}>
          Enable Genie
        </Text>
        <Switch value={enabled} onValueChange={setEnabled} />
      </View>
      <PressableScale
        disabled={!enabled || busy}
        onPress={() => openAssistant()}
        style={styles.action}>
        <Text style={[styles.actionText, { color: theme.colors.primary }]}>
          Open Genie
        </Text>
      </PressableScale>
      <PressableScale disabled={busy} onPress={handleExport} style={styles.action}>
        <Text style={[styles.actionText, { color: theme.colors.textPrimary }]}>
          Export conversation data
        </Text>
      </PressableScale>
      <PressableScale disabled={busy} onPress={confirmDeleteAll} style={styles.action}>
        <Text style={[styles.actionText, { color: theme.colors.error }]}>
          Delete all Genie history
        </Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 20,
    gap: 4,
  },
  heading: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 15,
  },
  action: {
    paddingVertical: 12,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
