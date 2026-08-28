export type TeamJoinPolicy = 'open' | 'request';

export type TeamPlayerRole = 'player' | 'coach' | 'staff';

export type ChallengeStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';

export type ChallengeOrganizerType = 'team' | 'user' | 'platform';

export type ParticipationStatus = 'active' | 'completed' | 'withdrawn';

export type TeamJoinRequestStatus = 'pending' | 'accepted' | 'rejected';

export type Team = {
  id: string;
  name: string;
  logoUrl: string;
  coverUrl: string;
  sport: string;
  sportTags: string[];
  location: string;
  description: string;
  ownerId: string;
  adminIds: string[];
  coachPlayerId?: string;
  captainPlayerId?: string;
  memberIds: string[];
  joinPolicy: TeamJoinPolicy;
  eventIds: string[];
  challengeIds: string[];
  memberCount: number;
};

export type TeamPlayer = {
  id: string;
  teamId: string;
  name: string;
  imageUrl?: string;
  role: TeamPlayerRole;
  position?: string;
  jerseyNumber?: number;
  ageGroup?: string;
  skillLevel?: string;
  isCaptain: boolean;
  isActive: boolean;
};

export type TeamJoinRequest = {
  id: string;
  teamId: string;
  userId: string;
  userName: string;
  requestedAt: string;
  status: TeamJoinRequestStatus;
};

export type Challenge = {
  id: string;
  title: string;
  coverUrl: string;
  description: string;
  category: string;
  sportTags: string[];
  rules: string;
  goalLabel: string;
  startDate: string;
  endDate: string;
  location: string;
  organizerType: ChallengeOrganizerType;
  organizerId: string;
  organizerName: string;
  eligibility: string;
  minTeamSize?: number;
  maxTeamSize?: number;
  maxParticipants?: number;
  rewards: string[];
  status: ChallengeStatus;
  linkedEventIds: string[];
  /** Teams that have joined (team-oriented challenges). */
  teamCount: number;
  participantCount: number;
  requiresTeam: boolean;
};

export type ChallengeParticipation = {
  id: string;
  challengeId: string;
  userId: string;
  teamId?: string;
  eventId?: string;
  joinedAt: string;
  progress: number;
  progressLabel?: string;
  status: ParticipationStatus;
  result?: string;
};

export type TeamEligibility = {
  eligible: boolean;
  reason?: string;
};

export const SPORT_TAGS = [
  'Cricket',
  'Football',
  'Hockey',
  'Badminton',
  'Running',
  'Cycling',
] as const;

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
