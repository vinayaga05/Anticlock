import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { RootStackParamList } from '@/shared/navigation/types';
import { serviceTrees, getCategoriesByTree } from '@/shared/data/services';
import {
  useMyProviderApplicationQuery,
  useSetProviderServicesMutation,
} from '@/shared/api/providerHooks';
import { PressableScale } from '@/shared/components/PressableScale';

export function ProviderApplicationServiceSelectScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ProviderApplicationServices'>>();
  const { data: application } = useMyProviderApplicationQuery();
  const setServices = useSetProviderServicesMutation(route.params.applicationId);
  const [selectedTree, setSelectedTree] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(application?.categoryIds ?? []),
  );

  const categories = useMemo(
    () => (selectedTree ? getCategoriesByTree(selectedTree as never) : []),
    [selectedTree],
  );

  const toggle = (categoryId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const onContinue = async () => {
    await setServices.mutateAsync({ categoryIds: Array.from(selected) });
    navigation.navigate('ProviderApplicationForm', {
      applicationId: route.params.applicationId,
    });
  };

  return (
    <ScreenContainer tabAware={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          Select services
        </Text>
        <Text style={{ color: theme.colors.textSecondary }}>
          Choose one or more services you offer. Forms adapt based on your selection.
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.treeRow}>
          {serviceTrees.map(tree => (
            <Button
              key={tree.id}
              title={tree.name}
              variant={selectedTree === tree.id ? 'primary' : 'secondary'}
              onPress={() => setSelectedTree(tree.id)}
              style={styles.treeChip}
            />
          ))}
        </ScrollView>
        {selectedTree ? (
          <View style={styles.list}>
            {categories.map(cat => {
              const active = selected.has(cat.id);
              return (
                <PressableScale
                  key={cat.id}
                  onPress={() => toggle(cat.id)}
                  style={[
                    styles.item,
                    {
                      borderColor: theme.colors.borderSoft,
                      backgroundColor: active
                        ? `${theme.colors.primary}18`
                        : theme.colors.surface,
                    },
                  ]}>
                  <Text style={{ color: theme.colors.textPrimary }}>{cat.name}</Text>
                  <Text style={{ color: theme.colors.textSecondary }}>
                    {active ? 'Selected' : 'Tap to select'}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        ) : null}
        <Text style={{ color: theme.colors.textSecondary }}>
          {selected.size} service(s) selected
        </Text>
        <Button
          title="Continue"
          onPress={onContinue}
          disabled={selected.size === 0 || setServices.isPending}
          loading={setServices.isPending}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  treeRow: {
    marginVertical: 8,
  },
  treeChip: {
    marginRight: 8,
  },
  list: {
    gap: 8,
  },
  item: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
});
