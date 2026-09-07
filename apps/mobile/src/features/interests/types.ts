export type InterestOption = {
  id: string;
  name: string;
  imageUrl?: string;
  sortOrder: number;
  isActive: boolean;
};

export type MyInterestsResponse = {
  options: InterestOption[];
  selectedInterestIds: string[];
  minSelections: number;
  needsOnboarding: boolean;
};

export type UpdateMyInterestsRequest = {
  interestIds: string[];
};
