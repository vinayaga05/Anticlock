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
import { useCourseQuery, useEnrollCourseMutation, isApiEnabled } from '@/shared/api';

export function CourseDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'CourseDetail'>>();
  
  const { data: apiCourse, isLoading, error } = useCourseQuery(route.params.courseId);
  const enrollMutation = useEnrollCourseMutation(route.params.courseId);
  
  const mockCourse = getCourse(route.params.courseId);
  const course = isApiEnabled && apiCourse ? apiCourse : mockCourse;

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
          subtitle={(error as Error).message}
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
    if (!isApiEnabled || !apiCourse) {
      Alert.alert('Enrolled', `You are enrolled in ${mockCourse?.title || 'this course'}.`, [
        { text: 'My learning', onPress: () => navigation.navigate('MyLearning') },
      ]);
      return;
    }

    try {
      await enrollMutation.mutateAsync();
      Alert.alert('Enrolled', `You are enrolled in ${course.name}.`, [
        { text: 'My learning', onPress: () => navigation.navigate('MyLearning') },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to enroll in course');
    }
  };

  const displayTitle = 'name' in course ? course.name : course.title;
  const displayInstructor = 'instructorName' in course ? course.instructorName : course.instructor;
  const displayPrice = 'price' in course && typeof course.price === 'number' 
    ? `₹${(course.price / 100).toFixed(2)}`
    : `Rs ${mockCourse?.price || 0}`;
  const imageUrl = 'imageUrl' in course ? course.imageUrl : mockCourse?.imageUrl;
  
  const lessons = 'lessons' in course ? course.lessons : [];
  const learningOutcomes = 'learningOutcomes' in course ? course.learningOutcomes : mockCourse?.curriculum || [];

  return (
    <ScreenContainer scrollable tabAware={false}>
      {imageUrl && <Image source={{ uri: imageUrl }} style={styles.hero} />}
      <Text style={[theme.typography.largeTitle, { color: theme.colors.textPrimary }]}>
        {displayTitle}
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
        {displayInstructor}
        {' · '}
        {'difficulty' in course ? course.difficulty : mockCourse?.level}
      </Text>
      <Text style={[theme.typography.title, { color: theme.colors.primary, marginTop: 8 }]}>
        {displayPrice}
      </Text>

      <Card style={{ gap: 8, marginTop: 12 }}>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
          {isApiEnabled && lessons.length > 0 ? 'Lessons' : 'Curriculum'}
        </Text>
        {isApiEnabled && lessons.length > 0 ? (
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

      {!isApiEnabled && (
        <Card style={{ marginTop: 12, backgroundColor: theme.colors.warning + '20' }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            Using mock data - API is disabled
          </Text>
        </Card>
      )}

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
