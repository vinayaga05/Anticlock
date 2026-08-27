import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { MarketplaceCourse } from '@/shared/data/services';
import { Card } from '@/shared/components/Card';

export function CourseCard({
  course,
  onPress,
}: {
  course: MarketplaceCourse;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Card onPress={onPress} style={{ flexDirection: 'row', gap: 12 }} elevated>
      <Image source={{ uri: course.imageUrl }} style={styles.image} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[theme.typography.body, { color: theme.colors.textPrimary, fontWeight: '700' }]}>
          {course.title}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
          {course.instructor} · {course.level}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
          {course.duration} · {course.mode}
        </Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.primary, fontWeight: '700' }]}>
          Rs {course.price}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  image: { width: 72, height: 72, borderRadius: 14 },
});
