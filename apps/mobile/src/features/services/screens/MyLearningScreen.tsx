import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import { marketplaceCourses } from '@/shared/data/services';

export function MyLearningScreen() {
  const theme = useTheme();
  const enrolled = marketplaceCourses.filter(c => c.enrolled || c.progress != null);
  const list = enrolled.length ? enrolled : marketplaceCourses.slice(0, 2);

  if (list.length === 0) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState icon="clipboard" title="No courses yet" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable tabAware={false}>
      {list.map(course => (
        <Card key={course.id} elevated style={{ gap: 6 }}>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            {course.title}
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
            {course.instructor} · {course.duration}
          </Text>
          <View
            style={[
              styles.track,
              { backgroundColor: theme.colors.surface, borderRadius: theme.radius.pill },
            ]}>
            <View
              style={[
                styles.fill,
                {
                  width: `${course.progress ?? 20}%`,
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.radius.pill,
                },
              ]}
            />
          </View>
          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
            {course.progress ?? 20}% complete
          </Text>
        </Card>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, overflow: 'hidden', marginTop: 8 },
  fill: { height: '100%' },
});
