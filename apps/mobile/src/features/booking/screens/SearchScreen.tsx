import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { useTheme } from '@/shared/hooks/useTheme';
import { searchCatalog } from '@/shared/data/services';

export function SearchScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [q, setQ] = useState('');

  const results = useMemo(() => searchCatalog(q), [q]);

  const hasAny =
    results.categories.length +
      results.providers.length +
      results.products.length +
      results.events.length +
      results.courses.length >
    0;

  const Section = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <View style={{ gap: 8 }}>
      <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>{title}</Text>
      {children}
    </View>
  );

  const Row = ({
    title,
    subtitle,
    icon,
    onPress,
  }: {
    title: string;
    subtitle: string;
    icon: IconName;
    onPress: () => void;
  }) => (
    <Card
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View
        style={[
          styles.icon,
          {
            backgroundColor: theme.colors.primarySoft,
            borderRadius: theme.radius.sm,
          },
        ]}>
        <AppIcon name={icon} size={18} color={theme.colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[theme.typography.body, { color: theme.colors.textPrimary, fontWeight: '600' }]}>
          {title}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
          {subtitle}
        </Text>
      </View>
      <AppIcon name="chevron-right" size={16} color={theme.colors.textTertiary} />
    </Card>
  );

  return (
    <ScreenContainer scrollable tabAware={false}>
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.pill,
          },
        ]}>
        <AppIcon name="search" size={18} color={theme.colors.textTertiary} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Services, providers, products, trips, courses"
          placeholderTextColor={theme.colors.textTertiary}
          style={[theme.typography.body, { flex: 1, color: theme.colors.textPrimary }]}
          autoFocus
        />
      </View>

      {!hasAny ? (
        <EmptyState icon="search" title="No matches" description="Try another keyword." />
      ) : (
        <>
          {results.categories.length > 0 ? (
            <Section title="Categories">
              {results.categories.slice(0, 6).map(c => (
                <Row
                  key={c.id}
                  title={c.name}
                  subtitle={c.description}
                  icon={(c.icon as IconName) || 'search'}
                  onPress={() =>
                    navigation.navigate('ServiceCategory', {
                      treeId: c.treeId,
                      categoryId: c.id,
                    })
                  }
                />
              ))}
            </Section>
          ) : null}

          {results.providers.length > 0 ? (
            <Section title="Providers">
              {results.providers.slice(0, 6).map(p => (
                <Row
                  key={p.id}
                  title={p.name}
                  subtitle={p.type}
                  icon="user"
                  onPress={() =>
                    navigation.navigate('UniversalDetail', {
                      entityType: 'provider',
                      entityId: p.id,
                      categoryId: p.categoryIds[0],
                    })
                  }
                />
              ))}
            </Section>
          ) : null}

          {results.products.length > 0 ? (
            <Section title="Products">
              {results.products.slice(0, 6).map(p => (
                <Row
                  key={p.id}
                  title={p.name}
                  subtitle={`Rs ${p.price}`}
                  icon="shopping-bag"
                  onPress={() => navigation.navigate('ProductDetail', { productId: p.id })}
                />
              ))}
            </Section>
          ) : null}

          {results.events.length > 0 ? (
            <Section title="Trips & events">
              {results.events.slice(0, 4).map(e => (
                <Row
                  key={e.id}
                  title={e.title}
                  subtitle={e.destination}
                  icon="globe"
                  onPress={() => navigation.navigate('EventDetail', { eventId: e.id })}
                />
              ))}
            </Section>
          ) : null}

          {results.courses.length > 0 ? (
            <Section title="Courses">
              {results.courses.slice(0, 4).map(c => (
                <Row
                  key={c.id}
                  title={c.title}
                  subtitle={c.instructor}
                  icon="clipboard"
                  onPress={() => navigation.navigate('CourseDetail', { courseId: c.id })}
                />
              ))}
            </Section>
          ) : null}
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
