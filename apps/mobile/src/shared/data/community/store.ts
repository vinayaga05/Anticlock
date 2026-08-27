import { create } from 'zustand';
import {
  seedChallenges,
  seedClubs,
  seedJoinRequests,
  seedParticipations,
  seedPlayers,
  eventChallengeLinks,
} from './seed';
import type {
  Challenge,
  ChallengeParticipation,
  Club,
  ClubJoinRequest,
  ClubPlayer,
  ClubPlayerRole,
} from './types';
import { CURRENT_USER_ID, CURRENT_USER_NAME } from './types';

type CommunityState = {
  clubs: Club[];
  players: ClubPlayer[];
  challenges: Challenge[];
  participations: ChallengeParticipation[];
  joinRequests: ClubJoinRequest[];
  eventChallengeMap: Record<string, string>;

  getClub: (id: string) => Club | undefined;
  getChallenge: (id: string) => Challenge | undefined;
  getPlayersForClub: (clubId: string) => ClubPlayer[];
  getChallengesForClub: (clubId: string) => Challenge[];
  getParticipation: (
    challengeId: string,
    userId?: string,
  ) => ChallengeParticipation | undefined;
  getChallengeForEvent: (eventId: string) => Challenge | undefined;
  isMember: (clubId: string, userId?: string) => boolean;
  isClubAdmin: (clubId: string, userId?: string) => boolean;

  joinClub: (clubId: string) => 'joined' | 'requested' | 'already';
  resolveJoinRequest: (requestId: string, accept: boolean) => void;
  createClub: (input: {
    name: string;
    sport: string;
    location: string;
    description: string;
  }) => Club;
  upsertPlayer: (
    clubId: string,
    input: {
      id?: string;
      name: string;
      role: ClubPlayerRole;
      position?: string;
      jerseyNumber?: number;
      ageGroup?: string;
      skillLevel?: string;
      isCaptain?: boolean;
      isActive?: boolean;
    },
  ) => ClubPlayer;
  removePlayer: (playerId: string) => void;
  setCaptain: (clubId: string, playerId: string) => void;
  joinChallenge: (
    challengeId: string,
    opts?: { eventId?: string; clubId?: string },
  ) => ChallengeParticipation;
  linkEventToChallenge: (eventId: string, challengeId: string) => void;
};

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export const useCommunityStore = create<CommunityState>((set, get) => ({
  clubs: [...seedClubs],
  players: [...seedPlayers],
  challenges: [...seedChallenges],
  participations: [...seedParticipations],
  joinRequests: [...seedJoinRequests],
  eventChallengeMap: { ...eventChallengeLinks },

  getClub: id => get().clubs.find(c => c.id === id),
  getChallenge: id => get().challenges.find(c => c.id === id),
  getPlayersForClub: clubId =>
    get().players.filter(p => p.clubId === clubId && p.isActive !== false),
  getChallengesForClub: clubId => {
    const club = get().getClub(clubId);
    if (!club) return [];
    return get().challenges.filter(c => club.challengeIds.includes(c.id));
  },
  getParticipation: (challengeId, userId = CURRENT_USER_ID) =>
    get().participations.find(
      p => p.challengeId === challengeId && p.userId === userId && p.status !== 'withdrawn',
    ),
  getChallengeForEvent: eventId => {
    const challengeId = get().eventChallengeMap[eventId];
    if (!challengeId) return undefined;
    return get().getChallenge(challengeId);
  },
  isMember: (clubId, userId = CURRENT_USER_ID) => {
    const club = get().getClub(clubId);
    return !!club?.memberIds.includes(userId);
  },
  isClubAdmin: (clubId, userId = CURRENT_USER_ID) => {
    const club = get().getClub(clubId);
    if (!club) return false;
    return club.ownerId === userId || club.adminIds.includes(userId);
  },

  joinClub: clubId => {
    const club = get().getClub(clubId);
    if (!club) return 'already';
    if (club.memberIds.includes(CURRENT_USER_ID)) return 'already';

    if (club.joinPolicy === 'request') {
      const exists = get().joinRequests.some(
        r =>
          r.clubId === clubId &&
          r.userId === CURRENT_USER_ID &&
          r.status === 'pending',
      );
      if (exists) return 'requested';
      set(state => ({
        joinRequests: [
          ...state.joinRequests,
          {
            id: uid('jr'),
            clubId,
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
      clubs: state.clubs.map(c =>
        c.id === clubId
          ? {
              ...c,
              memberIds: [...c.memberIds, CURRENT_USER_ID],
              memberCount: c.memberCount + 1,
            }
          : c,
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
      clubs: accept
        ? state.clubs.map(c =>
            c.id === req.clubId && !c.memberIds.includes(req.userId)
              ? {
                  ...c,
                  memberIds: [...c.memberIds, req.userId],
                  memberCount: c.memberCount + 1,
                }
              : c,
          )
        : state.clubs,
    }));
  },

  createClub: input => {
    const club: Club = {
      id: uid('club'),
      name: input.name,
      logoUrl: seedClubs[0].logoUrl,
      coverUrl: seedClubs[0].coverUrl,
      sport: input.sport,
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
    set(state => ({ clubs: [club, ...state.clubs] }));
    return club;
  },

  upsertPlayer: (clubId, input) => {
    if (input.id) {
      let updated!: ClubPlayer;
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
        clubs:
          input.isCaptain === true
            ? state.clubs.map(c =>
                c.id === clubId ? { ...c, captainPlayerId: input.id } : c,
              )
            : state.clubs,
      }));
      return updated;
    }

    const player: ClubPlayer = {
      id: uid('pl'),
      clubId,
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
      clubs: player.isCaptain
        ? state.clubs.map(c =>
            c.id === clubId ? { ...c, captainPlayerId: player.id } : c,
          )
        : state.clubs,
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

  setCaptain: (clubId, playerId) => {
    set(state => ({
      clubs: state.clubs.map(c =>
        c.id === clubId ? { ...c, captainPlayerId: playerId } : c,
      ),
      players: state.players.map(p =>
        p.clubId === clubId
          ? { ...p, isCaptain: p.id === playerId }
          : p,
      ),
    }));
  },

  joinChallenge: (challengeId, opts) => {
    const existing = get().getParticipation(challengeId);
    if (existing) return existing;

    const participation: ChallengeParticipation = {
      id: uid('part'),
      challengeId,
      userId: CURRENT_USER_ID,
      clubId: opts?.clubId,
      eventId: opts?.eventId,
      joinedAt: new Date().toISOString().slice(0, 10),
      progress: 0,
      progressLabel: 'Just started',
      status: 'active',
    };

    set(state => ({
      participations: [...state.participations, participation],
      challenges: state.challenges.map(c =>
        c.id === challengeId
          ? {
              ...c,
              participantCount: c.participantCount + 1,
              linkedEventIds:
                opts?.eventId && !c.linkedEventIds.includes(opts.eventId)
                  ? [...c.linkedEventIds, opts.eventId]
                  : c.linkedEventIds,
            }
          : c,
      ),
      eventChallengeMap:
        opts?.eventId
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
