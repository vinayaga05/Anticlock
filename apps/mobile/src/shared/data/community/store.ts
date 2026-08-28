import { create } from 'zustand';
import {
  seedChallenges,
  seedJoinRequests,
  seedParticipations,
  seedPlayers,
  seedTeams,
  eventChallengeLinks,
} from './seed';
import type {
  Challenge,
  ChallengeParticipation,
  Team,
  TeamEligibility,
  TeamJoinRequest,
  TeamPlayer,
  TeamPlayerRole,
} from './types';
import { CURRENT_USER_ID, CURRENT_USER_NAME } from './types';

type CommunityState = {
  teams: Team[];
  players: TeamPlayer[];
  challenges: Challenge[];
  participations: ChallengeParticipation[];
  joinRequests: TeamJoinRequest[];
  eventChallengeMap: Record<string, string>;

  getTeam: (id: string) => Team | undefined;
  getChallenge: (id: string) => Challenge | undefined;
  getPlayersForTeam: (teamId: string) => TeamPlayer[];
  getChallengesForTeam: (teamId: string) => Challenge[];
  getMyTeams: (userId?: string) => Team[];
  getDiscoverTeams: (opts?: { sportTag?: string | null }) => Team[];
  getPlayerCountForTeam: (teamId: string) => number;
  getParticipation: (
    challengeId: string,
    userId?: string,
  ) => ChallengeParticipation | undefined;
  getParticipationsForChallenge: (challengeId: string) => ChallengeParticipation[];
  getTeamsForChallenge: (challengeId: string) => Team[];
  getEligibleTeamsForChallenge: (challengeId: string, userId?: string) => Team[];
  getTeamEligibility: (teamId: string, challengeId: string) => TeamEligibility;
  getChallengeForEvent: (eventId: string) => Challenge | undefined;
  isMember: (teamId: string, userId?: string) => boolean;
  isTeamAdmin: (teamId: string, userId?: string) => boolean;

  joinTeam: (teamId: string) => 'joined' | 'requested' | 'already';
  resolveJoinRequest: (requestId: string, accept: boolean) => void;
  createTeam: (input: {
    name: string;
    sport: string;
    location: string;
    description: string;
  }) => Team;
  upsertPlayer: (
    teamId: string,
    input: {
      id?: string;
      name: string;
      role: TeamPlayerRole;
      position?: string;
      jerseyNumber?: number;
      ageGroup?: string;
      skillLevel?: string;
      isCaptain?: boolean;
      isActive?: boolean;
    },
  ) => TeamPlayer;
  removePlayer: (playerId: string) => void;
  setCaptain: (teamId: string, playerId: string) => void;
  joinChallenge: (
    challengeId: string,
    opts?: { eventId?: string; teamId?: string },
  ) => ChallengeParticipation;
  linkEventToChallenge: (eventId: string, challengeId: string) => void;
};

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function sportMatches(team: Team, challenge: Challenge): boolean {
  const tags = [team.sport, ...team.sportTags].map(t => t.toLowerCase());
  const challengeTags = [challenge.category, ...challenge.sportTags].map(t =>
    t.toLowerCase(),
  );
  return challengeTags.some(ct => tags.includes(ct));
}

export const useCommunityStore = create<CommunityState>((set, get) => ({
  teams: [...seedTeams],
  players: [...seedPlayers],
  challenges: [...seedChallenges],
  participations: [...seedParticipations],
  joinRequests: [...seedJoinRequests],
  eventChallengeMap: { ...eventChallengeLinks },

  getTeam: id => get().teams.find(t => t.id === id),
  getChallenge: id => get().challenges.find(c => c.id === id),
  getPlayersForTeam: teamId =>
    get().players.filter(p => p.teamId === teamId && p.isActive !== false),
  getChallengesForTeam: teamId => {
    const team = get().getTeam(teamId);
    if (!team) return [];
    return get().challenges.filter(c => team.challengeIds.includes(c.id));
  },
  getMyTeams: (userId = CURRENT_USER_ID) =>
    get().teams.filter(t => t.memberIds.includes(userId)),
  getDiscoverTeams: ({ sportTag } = {}) => {
    const mine = new Set(get().getMyTeams().map(t => t.id));
    return get().teams.filter(t => {
      if (mine.has(t.id)) return false;
      if (!sportTag || sportTag === 'More') return true;
      return (
        t.sport.toLowerCase() === sportTag.toLowerCase() ||
        t.sportTags.some(tag => tag.toLowerCase() === sportTag.toLowerCase())
      );
    });
  },
  getPlayerCountForTeam: teamId => get().getPlayersForTeam(teamId).length,
  getParticipation: (challengeId, userId = CURRENT_USER_ID) =>
    get().participations.find(
      p => p.challengeId === challengeId && p.userId === userId && p.status !== 'withdrawn',
    ),
  getParticipationsForChallenge: challengeId =>
    get().participations.filter(
      p => p.challengeId === challengeId && p.status !== 'withdrawn',
    ),
  getTeamsForChallenge: challengeId => {
    const teamIds = [
      ...new Set(
        get()
          .getParticipationsForChallenge(challengeId)
          .map(p => p.teamId)
          .filter((id): id is string => !!id),
      ),
    ];
    return teamIds.map(id => get().getTeam(id)).filter((t): t is Team => !!t);
  },
  getEligibleTeamsForChallenge: (challengeId, userId = CURRENT_USER_ID) =>
    get()
      .getMyTeams(userId)
      .filter(t => get().getTeamEligibility(t.id, challengeId).eligible),
  getTeamEligibility: (teamId, challengeId) => {
    const team = get().getTeam(teamId);
    const challenge = get().getChallenge(challengeId);
    if (!team || !challenge) return { eligible: false, reason: 'Not found' };

    if (!sportMatches(team, challenge)) {
      return {
        eligible: false,
        reason: `Sport mismatch — needs ${challenge.category}`,
      };
    }

    const count = get().getPlayerCountForTeam(teamId);
    if (challenge.minTeamSize != null && count < challenge.minTeamSize) {
      return {
        eligible: false,
        reason: `Not eligible — minimum ${challenge.minTeamSize} players`,
      };
    }
    if (challenge.maxTeamSize != null && count > challenge.maxTeamSize) {
      return {
        eligible: false,
        reason: `Not eligible — maximum ${challenge.maxTeamSize} players`,
      };
    }

    return { eligible: true };
  },
  getChallengeForEvent: eventId => {
    const challengeId = get().eventChallengeMap[eventId];
    if (!challengeId) return undefined;
    return get().getChallenge(challengeId);
  },
  isMember: (teamId, userId = CURRENT_USER_ID) => {
    const team = get().getTeam(teamId);
    return !!team?.memberIds.includes(userId);
  },
  isTeamAdmin: (teamId, userId = CURRENT_USER_ID) => {
    const team = get().getTeam(teamId);
    if (!team) return false;
    return team.ownerId === userId || team.adminIds.includes(userId);
  },

  joinTeam: teamId => {
    const team = get().getTeam(teamId);
    if (!team) return 'already';
    if (team.memberIds.includes(CURRENT_USER_ID)) return 'already';

    if (team.joinPolicy === 'request') {
      const exists = get().joinRequests.some(
        r =>
          r.teamId === teamId &&
          r.userId === CURRENT_USER_ID &&
          r.status === 'pending',
      );
      if (exists) return 'requested';
      set(state => ({
        joinRequests: [
          ...state.joinRequests,
          {
            id: uid('jr'),
            teamId,
            userId: CURRENT_USER_ID,
            userName: CURRENT_USER_NAME,
            requestedAt: new Date().toISOString().slice(0, 10),
            status: 'pending',
          },
        ],
      }));
      return 'requested';
    }

    set(state => ({
      teams: state.teams.map(t =>
        t.id === teamId
          ? {
              ...t,
              memberIds: [...t.memberIds, CURRENT_USER_ID],
              memberCount: t.memberCount + 1,
            }
          : t,
      ),
    }));
    return 'joined';
  },

  resolveJoinRequest: (requestId, accept) => {
    const req = get().joinRequests.find(r => r.id === requestId);
    if (!req || req.status !== 'pending') return;

    set(state => ({
      joinRequests: state.joinRequests.map(r =>
        r.id === requestId
          ? { ...r, status: accept ? 'accepted' : 'rejected' }
          : r,
      ),
      teams: accept
        ? state.teams.map(t =>
            t.id === req.teamId && !t.memberIds.includes(req.userId)
              ? {
                  ...t,
                  memberIds: [...t.memberIds, req.userId],
                  memberCount: t.memberCount + 1,
                }
              : t,
          )
        : state.teams,
    }));
  },

  createTeam: input => {
    const team: Team = {
      id: uid('team'),
      name: input.name,
      logoUrl: seedTeams[0].logoUrl,
      coverUrl: seedTeams[0].coverUrl,
      sport: input.sport,
      sportTags: [input.sport],
      location: input.location,
      description: input.description,
      ownerId: CURRENT_USER_ID,
      adminIds: [CURRENT_USER_ID],
      memberIds: [CURRENT_USER_ID],
      joinPolicy: 'open',
      eventIds: [],
      challengeIds: [],
      memberCount: 1,
    };
    set(state => ({ teams: [team, ...state.teams] }));
    return team;
  },

  upsertPlayer: (teamId, input) => {
    if (input.id) {
      let updated!: TeamPlayer;
      set(state => ({
        players: state.players.map(p => {
          if (p.id !== input.id) return p;
          updated = {
            ...p,
            name: input.name,
            role: input.role,
            position: input.position,
            jerseyNumber: input.jerseyNumber,
            ageGroup: input.ageGroup,
            skillLevel: input.skillLevel,
            isCaptain: input.isCaptain ?? p.isCaptain,
            isActive: input.isActive ?? p.isActive,
          };
          return updated;
        }),
        teams:
          input.isCaptain === true
            ? state.teams.map(t =>
                t.id === teamId ? { ...t, captainPlayerId: input.id } : t,
              )
            : state.teams,
      }));
      return updated;
    }

    const player: TeamPlayer = {
      id: uid('pl'),
      teamId,
      name: input.name,
      role: input.role,
      position: input.position,
      jerseyNumber: input.jerseyNumber,
      ageGroup: input.ageGroup,
      skillLevel: input.skillLevel,
      isCaptain: !!input.isCaptain,
      isActive: input.isActive !== false,
    };
    set(state => ({
      players: [...state.players, player],
      teams: player.isCaptain
        ? state.teams.map(t =>
            t.id === teamId ? { ...t, captainPlayerId: player.id } : t,
          )
        : state.teams,
    }));
    return player;
  },

  removePlayer: playerId => {
    set(state => ({
      players: state.players.map(p =>
        p.id === playerId ? { ...p, isActive: false } : p,
      ),
    }));
  },

  setCaptain: (teamId, playerId) => {
    set(state => ({
      teams: state.teams.map(t =>
        t.id === teamId ? { ...t, captainPlayerId: playerId } : t,
      ),
      players: state.players.map(p =>
        p.teamId === teamId ? { ...p, isCaptain: p.id === playerId } : p,
      ),
    }));
  },

  joinChallenge: (challengeId, opts) => {
    const existing = get().getParticipation(challengeId);
    if (existing) return existing;

    const challenge = get().getChallenge(challengeId);
    if (challenge?.requiresTeam && !opts?.teamId) {
      throw new Error('Team required for this challenge');
    }

    const participation: ChallengeParticipation = {
      id: uid('part'),
      challengeId,
      userId: CURRENT_USER_ID,
      teamId: opts?.teamId,
      eventId: opts?.eventId,
      joinedAt: new Date().toISOString().slice(0, 10),
      progress: 0,
      progressLabel: 'Just started',
      status: 'active',
    };

    const teamAlreadyJoined =
      opts?.teamId &&
      get()
        .getParticipationsForChallenge(challengeId)
        .some(p => p.teamId === opts.teamId);

    set(state => ({
      participations: [...state.participations, participation],
      challenges: state.challenges.map(c =>
        c.id === challengeId
          ? {
              ...c,
              participantCount: c.participantCount + 1,
              teamCount: teamAlreadyJoined ? c.teamCount : c.teamCount + (opts?.teamId ? 1 : 0),
              linkedEventIds:
                opts?.eventId && !c.linkedEventIds.includes(opts.eventId)
                  ? [...c.linkedEventIds, opts.eventId]
                  : c.linkedEventIds,
            }
          : c,
      ),
      teams:
        opts?.teamId && !teamAlreadyJoined
          ? state.teams.map(t =>
              t.id === opts.teamId && !t.challengeIds.includes(challengeId)
                ? { ...t, challengeIds: [...t.challengeIds, challengeId] }
                : t,
            )
          : state.teams,
      eventChallengeMap: opts?.eventId
        ? { ...state.eventChallengeMap, [opts.eventId]: challengeId }
        : state.eventChallengeMap,
    }));
    return participation;
  },

  linkEventToChallenge: (eventId, challengeId) => {
    set(state => ({
      eventChallengeMap: { ...state.eventChallengeMap, [eventId]: challengeId },
      challenges: state.challenges.map(c =>
        c.id === challengeId && !c.linkedEventIds.includes(eventId)
          ? { ...c, linkedEventIds: [...c.linkedEventIds, eventId] }
          : c,
      ),
    }));
  },
}));
