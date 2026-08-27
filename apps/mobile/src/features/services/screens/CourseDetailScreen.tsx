import React from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import { getCourse } from '@/shared/data/services';
import { RootStackParamList } from '@/shared/navigation/types';

export function CourseDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'CourseDetail'>>();
  const course = getCourse(route.params.courseId);

  if (!course) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState icon="clipboard" title="Course not found" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable tabAware={false}>
      <Image source={{ uri: course.imageUrl }} style={styles.hero} />
      <Text style={[theme.typography.largeTitle, { color: theme.colors.textPrimary }]}>
        {course.title}
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
        {course.instructor} · {course.level} · {course.mode}
      </Text>
      <Text style={[theme.typography.title, { color: theme.colors.primary, marginTop: 8 }]}>
        Rs {course.price}
      </Text>

      <Card style={{ gap: 8, marginTop: 12 }}>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
          Curriculum
        </Text>
        {course.curriculum.map(item => (
          <Text
            key={item}
            style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
            · {item}
          </Text>
        ))}
      </Card>

      <View style={{ marginTop: 16, gap: 10 }}>
        <Button
          title="Enroll now"
          icon="clipboard"
          onPress={() =>
            Alert.alert('Enrolled', `You are enrolled in ${course.title}.`, [
              { text: 'My learning', onPress: () => navigation.navigate('MyLearning') },
            ])
          }
        />
        <Button
          title="View my learning"
          variant="secondary"
          onPress={() => navigation.navigate('MyLearning')}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 200, borderRadius: 20, marginBottom: 16 },
});
