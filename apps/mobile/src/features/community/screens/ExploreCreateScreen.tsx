import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { Card } from '@/shared/components/Card';
import { AppIcon } from '@/shared/components/AppIcon';
import { useTheme } from '@/shared/hooks/useTheme';

export function ExploreCreateScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  return (
    <ScreenContainer scrollable tabAware={false}>
      <AppHeader title="Create" showBrand={false} showActions={false} />
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
        What do you want to create?
      </Text>
      <Text
        style={[
          theme.typography.caption,
          { color: theme.colors.textTertiary, marginTop: -4 },
        ]}>
        Submissions stay visible to followers while Admin reviews them for public Explore.
      </Text>

      <Card
        onPress={() => navigation.navigate('CreateExploreEvent')}
        style={styles.option}>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.md },
          ]}>
          <AppIcon name="calendar" size={24} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            Create Event
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
            Meetups, workshops, rides, and trips
          </Text>
        </View>
        <AppIcon name="chevron-right" size={18} color={theme.colors.textTertiary} />
      </Card>

      <Card
        onPress={() => navigation.navigate('CreateExploreProduct')}
        style={styles.option}>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: '#FEF3C7', borderRadius: theme.radius.md },
          ]}>
          <AppIcon name="shopping-bag" size={24} color="#B45309" />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            Post Product
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
            Sell gear, wellness products, and more
          </Text>
        </View>
        <AppIcon name="chevron-right" size={18} color={theme.colors.textTertiary} />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
