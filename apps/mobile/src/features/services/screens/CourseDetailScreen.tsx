import React from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import { RootStackParamList } from '@/shared/navigation/types';
import { useCourseQuery, useEnrollCourseMutation } from '@/shared/api';

export function CourseDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'CourseDetail'>>();
  
  const { data: apiCourse, isLoading, error } = useCourseQuery(route.params.courseId);
  const enrollMutation = useEnrollCourseMutation(route.params.courseId);
  
  const course = apiCourse;

  if (isLoading) {
    return (
      <ScreenContainer tabAware={false}>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center' }]}>
          Loading course...
        </Text>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState 
          icon="clipboard" 
          title="Error loading course"
          description={(error as Error).message}
        />
      </ScreenContainer>
    );
  }

  if (!course) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState icon="clipboard" title="Course not found" />
      </ScreenContainer>
    );
  }

  const handleEnroll = async () => {
    try {
      await enrollMutation.mutateAsync();
      Alert.alert('Enrolled', `You are enrolled in ${course.name}.`, [
        { text: 'My learning', onPress: () => navigation.navigate('MyLearning') },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to enroll in course');
    }
  };

  const displayTitle = course.name;
  const displayInstructor = course.instructorName;
  const displayPrice = `₹${(course.price / 100).toFixed(2)}`;
  const imageUrl = course.imageUrl;
  const lessons = course.lessons;
  const learningOutcomes = course.learningOutcomes;

  return (
    <ScreenContainer scrollable tabAware={false}>
      {imageUrl && <Image source={{ uri: imageUrl }} style={styles.hero} />}
      <Text style={[theme.typography.largeTitle, { color: theme.colors.textPrimary }]}>
        {displayTitle}
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
        {displayInstructor}
        {' · '}
        {course.difficulty}
      </Text>
      <Text style={[theme.typography.title, { color: theme.colors.primary, marginTop: 8 }]}>
        {displayPrice}
      </Text>

      <Card style={{ gap: 8, marginTop: 12 }}>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
          {lessons.length > 0 ? 'Lessons' : 'Learning outcomes'}
        </Text>
        {lessons.length > 0 ? (
          lessons.map((lesson, idx) => (
            <Text
              key={lesson.id || idx}
              style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
              · {lesson.title} {lesson.durationMinutes && `(${lesson.durationMinutes} min)`}
            </Text>
          ))
        ) : (
          learningOutcomes.map((item, idx) => (
            <Text
              key={idx}
              style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
              · {item}
            </Text>
          ))
        )}
      </Card>

      <View style={{ marginTop: 16, gap: 10 }}>
        <Button
          title="Enroll now"
          icon="clipboard"
          onPress={handleEnroll}
          disabled={enrollMutation.isPending}
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
