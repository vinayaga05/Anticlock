export interface ServiceTree {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'social' | 'marketplace' | 'community' | 'smart';
}

export interface NavItem {
  name: string;
  href: string;
}

export interface FAQ {
  question: string;
  answer: string;
}
