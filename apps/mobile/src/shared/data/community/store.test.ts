const mockSaved = new Map<string, string>();
jest.mock('@/shared/services/storage', () => ({ storage: { getString: (key: string) => mockSaved.get(key), set: (key: string, value: string) => mockSaved.set(key, value) } }));
import { useCommunityStore } from './store';

it('retains team photos on creation and permits independent admin edits', () => {
  const team = useCommunityStore.getState().createTeam({ name: 'Test team', sport: 'Cricket', location: 'Chennai', description: '', logoUrl: 'https://cdn.example/logo.jpg', coverUrl: 'https://cdn.example/cover.jpg' });
  useCommunityStore.getState().updateTeamPhotos(team.id, { coverUrl: 'https://cdn.example/new.jpg' });
  expect(useCommunityStore.getState().getTeam(team.id)).toMatchObject({ logoUrl: team.logoUrl, coverUrl: 'https://cdn.example/new.jpg' });
  expect(JSON.parse(mockSaved.get('nexus_teams_v1')!)[0]).toMatchObject({ id: team.id, coverUrl: 'https://cdn.example/new.jpg' });
  useCommunityStore.setState(state => ({ teams: state.teams.map(value => value.id === team.id ? { ...value, ownerId: 'other', adminIds: [] } : value) }));
  useCommunityStore.getState().updateTeamPhotos(team.id, { logoUrl: 'https://cdn.example/blocked.jpg' });
  expect(useCommunityStore.getState().getTeam(team.id)?.logoUrl).toBe(team.logoUrl);
});
