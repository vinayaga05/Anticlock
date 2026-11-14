import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { useTheme } from '@/shared/hooks/useTheme';
import { useAuth } from '@/shared/context/AuthProvider';
import { useComplaintsQuery } from '@/shared/api/complaintHooks';

export function ComplaintsPanel() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { user, logout } = useAuth();
  const signedIn = Boolean(user && user.id !== 'temporary-guest');
  const query = useComplaintsQuery(signedIn);
  const refetch = query.refetch;
  useFocusEffect(useCallback(() => { if (signedIn) void refetch(); }, [signedIn, refetch]));
  const complaints = useMemo(() => {
    const unique = new Map((query.data?.pages ?? []).flatMap(page => page.complaints).map(item => [item.id, item]));
    return [...unique.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  }, [query.data]);
  const bodyStyle = [theme.typography.bodySmall, { color: theme.colors.textSecondary }];

  return (
    <View style={styles.panel}>
      <View style={styles.heading}>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>Complaints</Text>
        {signedIn ? <Button title="Add complaint" icon="plus" onPress={() => navigation.navigate('CreateComplaint')} /> : null}
      </View>
      {!signedIn ? (
        <>
          <Text style={bodyStyle}>Sign in to read and post complaints shared with the community.</Text>
          <Button title="Sign in" onPress={() => { void logout(); }} />
        </>
      ) : (
        <>
          <Text style={bodyStyle}>Complaints posted by the community, newest first.</Text>
          <Button title="Refresh complaints" variant="secondary" loading={query.isRefetching} disabled={query.isFetchingNextPage || query.isLoading} onPress={() => { void query.refetch(); }} />
          {query.isLoading ? <Text style={bodyStyle}>Loading complaints…</Text> : null}
          {query.isError && complaints.length === 0 ? (
            <>
              <Text accessibilityRole="alert" style={[theme.typography.bodySmall, { color: theme.colors.error }]}>Could not load complaints. Please try again.</Text>
              <Button title="Retry complaints" onPress={() => { void query.refetch(); }} />
            </>
          ) : !query.isLoading && complaints.length === 0 ? <Text style={bodyStyle}>No complaints yet. Add the first complaint.</Text> : null}
          {complaints.map(complaint => {
            const date = new Date(complaint.createdAt);
            return (
              <Card key={complaint.id}>
                <View style={{ gap: 10 }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{complaint.author.displayName || 'Participant'} · {Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Date unavailable'}</Text>
                  <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>{complaint.title}</Text>
                  <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>{complaint.description}</Text>
                </View>
              </Card>
            );
          })}
          {query.isRefetchError && complaints.length > 0 ? <Text accessibilityRole="alert" style={bodyStyle}>Could not refresh. The previous complaints are still shown.</Text> : null}
          {query.isFetchNextPageError ? <Text accessibilityRole="alert" style={bodyStyle}>Could not load more complaints. Please try again.</Text> : null}
          {query.hasNextPage ? <Button title={query.isFetchNextPageError ? 'Retry loading more' : 'Load more complaints'} loading={query.isFetchingNextPage} disabled={query.isFetching && !query.isFetchingNextPage} variant="secondary" onPress={() => { if (!query.isFetching) void query.fetchNextPage({ cancelRefetch: false }); }} /> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { paddingHorizontal: 16, marginTop: 12, gap: 16, paddingBottom: 24 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
});
