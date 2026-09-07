import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { RootStackParamList } from '@/shared/navigation/types';
import { serviceTrees, getCategoriesByTree } from '@/shared/data/services';
import {
  useProviderApplicationQuery,
  useSetProviderServicesMutation,
} from '@/shared/api/providerHooks';
import { PressableScale } from '@/shared/components/PressableScale';
import { AppIcon } from '@/shared/components/AppIcon';

export function ProviderApplicationServiceSelectScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ProviderApplicationServices'>>();
  const applicationQuery = useProviderApplicationQuery(route.params.applicationId);
  const application = applicationQuery.data;
  const setServices = useSetProviderServicesMutation(route.params.applicationId);
  const [selectedTree, setSelectedTree] = useState<string | null>(
    serviceTrees[0]?.id ?? null,
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    application?.categoryIds[0] ?? null,
  );

  useEffect(() => {
    if (application) setSelectedCategoryId(application.categoryIds[0] ?? null);
  }, [application?.id, application?.categoryIds.join('|')]);

  const categories = useMemo(
    () => (selectedTree ? getCategoriesByTree(selectedTree as never) : []),
    [selectedTree],
  );

  const onContinue = async () => {
    if (!selectedCategoryId) return;
    try {
      await setServices.mutateAsync({ categoryIds: [selectedCategoryId] });
      navigation.navigate('ProviderApplicationForm', {
        applicationId: route.params.applicationId,
      });
    } catch (error) {
      Alert.alert(
        'Could not save services',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  if (applicationQuery.isLoading) {
    return (
      <ScreenContainer tabAware={false}>
        <Text style={{ color: theme.colors.textSecondary, padding: 20 }}>Loading services…</Text>
      </ScreenContainer>
    );
  }

  if (applicationQuery.isError || !application) {
    return (
      <ScreenContainer tabAware={false}>
        <View style={styles.state}>
          <Text style={[styles.stateTitle, { color: theme.colors.textPrimary }]}>We couldn’t open this business</Text>
          <Text style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>
            {applicationQuery.error instanceof Error
              ? applicationQuery.error.message
              : 'Please check your connection and try again.'}
          </Text>
          <Button title="Try again" onPress={() => void applicationQuery.refetch()} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer tabAware={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          Choose your primary service
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Set up one service for this business. You can add another business or
          professional service from your portfolio at any time.
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.treeRow}>
          {serviceTrees.map(tree => (
            <PressableScale
              key={tree.id}
              onPress={() => setSelectedTree(tree.id)}
              style={[
                styles.treeChip,
                {
                  backgroundColor:
                    selectedTree === tree.id
                      ? theme.colors.primarySoft
                      : theme.colors.surface,
                  borderColor:
                    selectedTree === tree.id
                      ? `${theme.colors.primary}45`
                      : theme.colors.borderSoft,
                },
              ]}>
              <AppIcon
                name={tree.icon}
                size={16}
                color={
                  selectedTree === tree.id
                    ? theme.colors.primaryMuted
                    : theme.colors.textSecondary
                }
              />
              <Text
                style={{
                  color:
                    selectedTree === tree.id
                      ? theme.colors.primaryMuted
                      : theme.colors.textSecondary,
                  fontSize: 13,
                  fontWeight: '700',
                }}>
                {tree.name}
              </Text>
            </PressableScale>
          ))}
        </ScrollView>
        {selectedTree ? (
          <View style={styles.list}>
            {categories.map(cat => {
              const active = selectedCategoryId === cat.id;
              return (
                <PressableScale
                  key={cat.id}
                  onPress={() => setSelectedCategoryId(cat.id)}
                  style={[
                    styles.item,
                    {
                      borderColor: active
                        ? `${theme.colors.primary}55`
                        : theme.colors.borderSoft,
                      backgroundColor: active
                        ? theme.colors.primarySoft
                        : theme.colors.surface,
                    },
                  ]}>
                  <View style={[styles.categoryIcon, { backgroundColor: active ? `${theme.colors.primary}22` : theme.colors.surfaceMuted }]}>
                    <AppIcon name="clipboard-list" size={19} color={active ? theme.colors.primaryMuted : theme.colors.textSecondary} />
                  </View>
                  <View style={styles.categoryCopy}>
                    <Text style={[styles.categoryName, { color: theme.colors.textPrimary }]}>{cat.name}</Text>
                    <Text style={{ color: theme.colors.textSecondary }}>
                      {active ? 'Primary service selected' : 'Choose this service'}
                    </Text>
                  </View>
                  <AppIcon name={active ? 'check-circle' : 'chevron-right'} size={20} color={active ? theme.colors.primaryMuted : theme.colors.textTertiary} />
                </PressableScale>
              );
            })}
          </View>
        ) : null}
        <Text style={[styles.selectionNote, { color: theme.colors.textSecondary }]}>
          {selectedCategoryId ? '1 primary service selected' : 'Select one service to continue'}
        </Text>
        <Button
          title="Continue to business profile"
          onPress={onContinue}
          disabled={!selectedCategoryId || setServices.isPending}
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
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  treeRow: {
    marginVertical: 8,
  },
  treeChip: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  list: {
    gap: 8,
  },
  item: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  categoryIcon: {
    alignItems: 'center',
    borderRadius: 15,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  categoryCopy: {
    flex: 1,
    gap: 3,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '800',
  },
  selectionNote: {
    fontSize: 13,
    fontWeight: '600',
  },
  state: {
    alignItems: 'center',
    flex: 1,
    gap: 14,
    justifyContent: 'center',
    padding: 24,
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
});
