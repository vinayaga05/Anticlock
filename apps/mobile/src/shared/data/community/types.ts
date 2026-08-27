export type ClubJoinPolicy = 'open' | 'request';

export type ClubPlayerRole = 'player' | 'coach' | 'staff';

export type ChallengeStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';

export type ChallengeOrganizerType = 'club' | 'user' | 'platform';

export type ParticipationStatus = 'active' | 'completed' | 'withdrawn';

export type ClubJoinRequestStatus = 'pending' | 'accepted' | 'rejected';

export type Club = {
  id: string;
  name: string;
  logoUrl: string;
  coverUrl: string;
  sport: string;
  location: string;
  description: string;
  ownerId: string;
  adminIds: string[];
  coachPlayerId?: string;
  captainPlayerId?: string;
  memberIds: string[];
  joinPolicy: ClubJoinPolicy;
  eventIds: string[];
  challengeIds: string[];
  memberCount: number;
};

export type ClubPlayer = {
  id: string;
  clubId: string;
  name: string;
  imageUrl?: string;
  role: ClubPlayerRole;
  position?: string;
  jerseyNumber?: number;
  ageGroup?: string;
  skillLevel?: string;
  isCaptain: boolean;
  isActive: boolean;
};

export type ClubJoinRequest = {
  id: string;
  clubId: string;
  userId: string;
  userName: string;
  requestedAt: string;
  status: ClubJoinRequestStatus;
};

export type Challenge = {
  id: string;
  title: string;
  coverUrl: string;
  description: string;
  category: string;
  rules: string;
  goalLabel: string;
  startDate: string;
  endDate: string;
  organizerType: ChallengeOrganizerType;
  organizerId: string;
  organizerName: string;
  eligibility: string;
  maxParticipants?: number;
  rewards: string[];
  status: ChallengeStatus;
  linkedEventIds: string[];
  participantCount: number;
};

export type ChallengeParticipation = {
  id: string;
  challengeId: string;
  userId: string;
  clubId?: string;
  eventId?: string;
  joinedAt: string;
  progress: number;
  progressLabel?: string;
  status: ParticipationStatus;
  result?: string;
};

export const CURRENT_USER_ID = 'user-me';
export const CURRENT_USER_NAME = 'You';

export function challengeStatusLabel(status: ChallengeStatus): string {
  switch (status) {
    case 'upcoming':
      return 'Upcoming';
    case 'active':
      return 'Active';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
  }
}
