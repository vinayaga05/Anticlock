import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { Card } from '@/shared/components/Card';
import { IconBadge } from '@/shared/components/IconBadge';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { useTheme } from '@/shared/hooks/useTheme';
import { softFill } from '@/shared/theme/colors';

const ACTIONS: {
  id: string;
  title: string;
  subtitle: string;
  icon: IconName;
  color: string;
  onPress: (nav: any) => void;
}[] = [
  {
    id: 'reel',
    title: 'Create Reel',
    subtitle: 'Share a health or fitness clip',
    icon: 'reels',
    color: '#F472B6',
    onPress: nav => nav.navigate('Main', { screen: 'PlayFeed' }),
  },
  {
    id: 'service',
    title: 'List Service',
    subtitle: 'Offer a professional service',
    icon: 'clipboard',
    color: '#14B8A6',
    onPress: nav => nav.navigate('ComingSoon', { title: 'List Service' }),
  },
  {
    id: 'product',
    title: 'Add Product',
    subtitle: 'Sell on Knock Shop',
    icon: 'shopping-bag',
    color: '#F59E0B',
    onPress: nav => nav.navigate('CreateExploreProduct'),
  },
  {
    id: 'event',
    title: 'Create Event',
    subtitle: 'Publish a trip or meetup',
    icon: 'globe',
    color: '#FB923C',
    onPress: nav => nav.navigate('CreateExploreEvent'),
  },
  {
    id: 'course',
    title: 'Create Course',
    subtitle: 'Launch a training program',
    icon: 'graduation-cap',
    color: '#818CF8',
    onPress: nav => nav.navigate('ComingSoon', { title: 'Create Course' }),
  },
  {
    id: 'book',
    title: 'Quick book',
    subtitle: 'Book doctor, lab, or class',
    icon: 'calendar',
    color: '#F97066',
    onPress: nav => nav.navigate('Doctors'),
  },
];

export function CreateScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  return (
    <ScreenContainer scrollable>
      <AppHeader title="Needs" />
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
        Request or list what you need — content, services, products, and bookings.
      </Text>
      {ACTIONS.map(action => (
        <Card
          key={action.id}
          onPress={() => action.onPress(navigation)}
          tint={softFill(action.color, 0.1)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <IconBadge name={action.icon} color={action.color} size="md" />
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
              {action.title}
            </Text>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
              {action.subtitle}
            </Text>
          </View>
          <AppIcon name="chevron-right" size={18} color={theme.colors.textTertiary} />
        </Card>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({});
