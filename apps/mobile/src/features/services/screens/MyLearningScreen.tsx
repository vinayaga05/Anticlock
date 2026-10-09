import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import { useMyEnrollmentsQuery } from '@/shared/api';

export function MyLearningScreen() {
  const theme = useTheme();
  
  const { data: apiData, isLoading, error } = useMyEnrollmentsQuery();
  
  const list = apiData?.enrollments ?? [];

  if (isLoading) {
    return (
      <ScreenContainer tabAware={false}>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center' }]}>
          Loading your courses...
        </Text>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState 
          icon="clipboard" 
          title="Error loading courses"
          description={(error as Error).message}
        />
      </ScreenContainer>
    );
  }

  if (list.length === 0) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState icon="clipboard" title="No courses yet" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable tabAware={false}>
      {list.map(enrollment => {
          const progressPercent = enrollment.totalLessonsCount > 0 
            ? Math.round((enrollment.completedLessonsCount / enrollment.totalLessonsCount) * 100)
            : 0;
          
          return (
            <Card key={enrollment.id} elevated style={{ gap: 6 }}>
              <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
                {enrollment.courseName}
              </Text>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
                {enrollment.completedLessonsCount} of {enrollment.totalLessonsCount} lessons
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
                      width: `${progressPercent}%`,
                      backgroundColor: theme.colors.primary,
                      borderRadius: theme.radius.pill,
                    },
                  ]}
                />
              </View>
              <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
                {progressPercent}% complete
              </Text>
            </Card>
          );
        })}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, overflow: 'hidden', marginTop: 8 },
  fill: { height: '100%' },
});
