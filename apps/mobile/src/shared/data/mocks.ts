import {
  BookingRecord,
  Community,
  Conversation,
  Doctor,
  FitnessClass,
  KnockNotification,
  LabProvider,
  LabTest,
  Message,
  ReelItem,
  ReportTile,
  ServiceTile,
  ShopProduct,
} from '@/shared/types';
import { buildClipsReelsFromManifest } from '@/shared/data/cloudflareVideos';
import manifest from '@/shared/data/cloudflare-videos.manifest.json';

const img = (id: string, w = 800, h = 1000) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

export const doctors: Doctor[] = [
  {
    id: 'doc-remya',
    name: 'Dr. Remya',
    qualification: 'MBBS, MD',
    specialty: 'General Physician',
    languages: ['Tamil', 'English', 'Telugu', 'Malayalam'],
    experienceYears: 11,
    fee: 300,
    registration: 'TSMC 18193',
    about:
      'Experienced general physician focused on preventive care, chronic disease management, and patient-first consultations across clinic, home, and online modes.',
    education: ['MBBS', 'MD - Physiologist', 'Dr. MGR Medical University'],
    imageUrl: img('photo-1559839734-2b71ea197ec2', 600, 600),
    rating: 4.8,
    online: true,
    modes: ['online', 'center', 'home'],
    nextSlot: '22 Oct 6:30 PM',
    patientsServed: '3.2k+',
  },
  {
    id: 'doc-sathish',
    name: 'Dr. Sathish Kumar',
    qualification: 'MPT',
    specialty: 'Physiotherapy - Sports',
    languages: ['Tamil', 'English'],
    experienceYears: 10,
    fee: 300,
    registration: 'PT-4821',
    about:
      'Sports physiotherapist helping athletes recover faster with tailored rehab plans and on-field support.',
    education: ['BPT', 'MPT Sports'],
    imageUrl: img('photo-1612349317150-e413f6a5b16d', 600, 600),
    rating: 4.7,
    online: true,
    modes: ['center', 'home', 'online'],
    nextSlot: '22 Oct 10:00 AM',
    patientsServed: '2.1k+',
  },
];

export const labs: LabProvider[] = [
  {
    id: 'lab-apollo',
    name: 'Apollo Diagnostics',
    location: 'Tambaram',
    distanceKm: 3,
    experienceYears: 8,
    imageUrl: img('photo-1579684385127-1ef15d508118', 400, 400),
    collection: 'Center / Home Collection',
    rating: 4.6,
  },
  {
    id: 'lab-thyrocare',
    name: 'Thyrocare Lab and Diagnostics',
    location: 'Tambaram, Chennai-60045',
    distanceKm: 4,
    experienceYears: 10,
    imageUrl: img('photo-1582719471384-894fbb16e074', 400, 400),
    collection: 'Center / Home Collection',
    rating: 4.7,
  },
  {
    id: 'lab-aarthi',
    name: 'Aarthi Scans & Labs',
    location: 'Medavakkam',
    distanceKm: 3,
    experienceYears: 8,
    imageUrl: img('photo-1581595220892-b0739db3b8c4', 400, 400),
    collection: 'Center collection',
    rating: 4.5,
  },
  {
    id: 'lab-anderson',
    name: 'Anderson Diagnostics',
    location: 'Chengalpattu',
    distanceKm: 5,
    experienceYears: 9,
    imageUrl: img('photo-1516549655169-df83a0774514', 400, 400),
    collection: 'Center / Home Collection',
    rating: 4.4,
  },
];

export const labTests: LabTest[] = [
  {
    id: 'test-b12',
    name: 'Vitamin B12',
    priceFrom: 400,
    reportHours: '10-12 Hours',
    availableAt: 'Home / Center',
  },
  {
    id: 'test-platelet',
    name: 'Platelet Count',
    priceFrom: 350,
    reportHours: '8-10 Hours',
    availableAt: 'Home / Center',
  },
  {
    id: 'test-rbc',
    name: 'Total RBC',
    priceFrom: 300,
    reportHours: '8-10 Hours',
    availableAt: 'Center',
  },
  {
    id: 'test-uric',
    name: 'Uric Acid',
    priceFrom: 280,
    reportHours: '10-12 Hours',
    availableAt: 'Home / Center',
  },
];

export const fitnessClasses: FitnessClass[] = [
  {
    id: 'fit-sathish-am',
    title: 'Sports Fitness Training',
    coach: 'Sathish Kumar',
    gym: 'ASP Gym',
    location: 'Velachery, Chennai-600042',
    durationMins: 60,
    level: 'Beginner',
    type: 'Yoga',
    schedule: 'Daily - 5:30 AM, 60 Min',
    imageUrl: img('photo-1571019614242-c5c5dee9f50b', 900, 600),
    about:
      'Join this Yoga class live for a better and healthier version of yourself. Guided warm-ups, focused workout, and cool-down.',
    needs: ['Yoga Mat', 'Towel', 'Comfortable Clothing', 'Water Bottle'],
    routine: [
      { label: 'Warm ups', mins: 5 },
      { label: 'Workout', mins: 35 },
      { label: 'Cool Down', mins: 5 },
    ],
    languages: ['Tamil', 'English', 'Telugu', 'Malayalam'],
    fee: 499,
  },
  {
    id: 'fit-band',
    title: 'Sports Fitness Training',
    coach: 'Sathish Kumar',
    gym: 'ASP Gym',
    location: 'Velachery, Chennai-600042',
    durationMins: 45,
    level: 'Intermediate',
    type: 'Strength',
    schedule: 'Alt. Day - 5:30 AM, 45 Min',
    imageUrl: img('photo-1517836357463-d25dfeac3438', 900, 600),
    about: 'Resistance-band strength circuit with coach cues for form and pacing.',
    needs: ['Resistance Band', 'Water Bottle'],
    routine: [
      { label: 'Warm ups', mins: 5 },
      { label: 'Workout', mins: 30 },
      { label: 'Cool Down', mins: 10 },
    ],
    languages: ['Tamil', 'English'],
    fee: 399,
  },
];

const reelAvatar = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=200&h=200&q=80`;

const baseReels: ReelItem[] = [
  {
    id: 'reel-1',
    title: 'Morning mobility',
    author: 'coach.sathish',
    authorAvatarUrl: reelAvatar('photo-1507003211169-0a1dd7228f2d'),
    caption: '5-minute warm-up before sports training #anticlock #fitness',
    videoUrl: require('../assets/videos/clip-fitness.mp4'),
    posterUrl: '',
    likeCount: 1280,
    commentCount: 42,
    bookTarget: { kind: 'fitness', id: 'fit-sathish-am', cta: 'book' },
  },
  {
    id: 'reel-2',
    title: 'GP tips',
    author: 'dr.remya',
    authorAvatarUrl: reelAvatar('photo-1559839734-2b71ea197ec2'),
    caption: 'When to book an online consult vs clinic visit',
    videoUrl: require('../assets/videos/clip-health.mp4'),
    posterUrl: '',
    likeCount: 890,
    commentCount: 31,
    bookTarget: { kind: 'doctor', id: 'doc-remya', cta: 'book' },
  },
  {
    id: 'reel-3',
    title: 'Lab prep',
    author: 'thyrocare.care',
    authorAvatarUrl: reelAvatar('photo-1629909613654-28e377c37b09'),
    caption: 'How to prepare for Vitamin B12 fasting tests',
    videoUrl: require('../assets/videos/clip-short.mp4'),
    posterUrl: '',
    likeCount: 640,
    commentCount: 18,
    bookTarget: { kind: 'lab', id: 'lab-thyrocare', cta: 'book' },
  },
  {
    id: 'reel-4',
    title: 'Weekend trek',
    author: 'trailblaze.tours',
    authorAvatarUrl: reelAvatar('photo-1551632811-561732d1e306'),
    caption: 'Yercaud adventure seats filling fast #tours',
    videoUrl: require('../assets/videos/clip-fitness.mp4'),
    posterUrl: '',
    likeCount: 420,
    commentCount: 12,
    bookTarget: {
      entityType: 'event',
      entityId: 'evt-adventure-1',
      categoryId: 'tours.adventure',
      serviceTreeId: 'tours_events',
      cta: 'trip',
    },
  },
  {
    id: 'reel-5',
    title: 'Strength session',
    author: 'fit.ananya',
    authorAvatarUrl: reelAvatar('photo-1544367567-0f2fcb009e0b'),
    caption: 'Dumbbell circuit you can do at home #workout',
    videoUrl: require('../assets/videos/clip-short.mp4'),
    posterUrl: '',
    likeCount: 2100,
    commentCount: 88,
    bookTarget: { kind: 'fitness', id: 'fit-sathish-am', cta: 'book' },
  },
  {
    id: 'reel-6',
    title: 'Whey restock',
    author: 'shop.anticlock',
    authorAvatarUrl: reelAvatar('photo-1527980965255-d3b416303d12'),
    caption: 'Clean protein for post-workout recovery #products',
    videoUrl: require('../assets/videos/clip-health.mp4'),
    posterUrl: '',
    likeCount: 756,
    commentCount: 24,
    bookTarget: {
      entityType: 'product',
      entityId: 'prod-1',
      categoryId: 'ecom.fitness',
      cta: 'cart',
    },
  },
  {
    id: 'reel-7',
    title: 'Match warm-up',
    author: 'sports.hub',
    authorAvatarUrl: reelAvatar('photo-1517836357463-d25dfeac3438'),
    caption: 'Football drills before kickoff',
    videoUrl: require('../assets/videos/clip-fitness.mp4'),
    posterUrl: '',
    likeCount: 1540,
    commentCount: 61,
    bookTarget: { kind: 'fitness', id: 'fit-sathish-am', cta: 'book' },
  },
  {
    id: 'reel-8',
    title: 'Training tee drop',
    author: 'apparel.lab',
    authorAvatarUrl: reelAvatar('photo-1494790108377-be9c29b29330'),
    caption: 'Breathable tee for summer sessions #apparel',
    videoUrl: require('../assets/videos/clip-short.mp4'),
    posterUrl: '',
    likeCount: 980,
    commentCount: 37,
    bookTarget: {
      entityType: 'product',
      entityId: 'prod-2',
      categoryId: 'ecom.sports',
      cta: 'cart',
    },
  },
];

/** Clips feed — R2 bucket videos when manifest remoteEnabled, else bundled fallbacks. */
export const reels: ReelItem[] = buildClipsReelsFromManifest(
  manifest as import('@/shared/data/cloudflareVideos').CloudflareVideoManifest,
  baseReels,
);

export const communities: Community[] = [
  {
    id: 'com-sports',
    name: 'Sports Community',
    membersLabel: '12.5k Members',
    imageUrl: img('photo-1461896836934-ffe607ba6851', 900, 500),
    joined: false,
  },
  {
    id: 'com-cycling',
    name: 'Cycling Community',
    membersLabel: '8.2k Members',
    imageUrl: img('photo-1541625602330-2277a4c46182', 900, 500),
    joined: true,
  },
  {
    id: 'com-yoga',
    name: 'Yoga & Mindfulness',
    membersLabel: '15.1k Members',
    imageUrl: img('photo-1544367567-0f2fcb009e0b', 900, 500),
    joined: false,
  },
];

export const shopProducts: ShopProduct[] = [
  {
    id: 'prod-1',
    name: 'Fresh Veggie Basket',
    price: 499,
    imageUrl: img('photo-1540420773420-3366772f4999', 600, 600),
    category: 'Nutrition',
  },
  {
    id: 'prod-2',
    name: 'Whey Protein 1kg',
    price: 2499,
    imageUrl: img('photo-1593095948071-474c5cc2989d', 600, 600),
    category: 'Supplements',
  },
  {
    id: 'prod-3',
    name: 'Yoga Mat Pro',
    price: 899,
    imageUrl: img('photo-1601925260368-ae2f83cf8b7f', 600, 600),
    category: 'Apparel',
  },
  {
    id: 'prod-4',
    name: 'Multivitamin Pack',
    price: 699,
    imageUrl: img('photo-1584308666744-24d5c474f2ae', 600, 600),
    category: 'Pharmacy',
  },
];

export const knockNotifications: KnockNotification[] = [
  {
    id: 'kn-1',
    title: 'Booking confirmed',
    body: 'Dr. Ananya · Physiotherapy · Today 6:30 PM',
    time: '2h ago',
    read: false,
    icon: 'calendar',
  },
  {
    id: 'kn-2',
    title: 'Provider assigned',
    body: 'QuickFix Home accepted your AC Repair request.',
    time: '5h ago',
    read: false,
    icon: 'home',
  },
  {
    id: 'kn-3',
    title: 'Class reminder',
    body: 'Sports Fitness Training starts tomorrow at 5:30 AM.',
    time: 'Yesterday',
    read: true,
    icon: 'fitness',
  },
  {
    id: 'kn-4',
    title: 'New message',
    body: 'Coach Sathish: See you at 5:30 AM tomorrow.',
    time: 'Yesterday',
    read: true,
    icon: 'messages',
  },
];

export const conversations: Conversation[] = [
  {
    id: 'msg-1',
    name: 'Dr. Remya',
    preview: 'Your reports look fine. Stay hydrated.',
    time: '9:40 AM',
    unread: 2,
    avatarColor: '#2D9EB3',
  },
  {
    id: 'msg-2',
    name: 'Coach Sathish',
    preview: 'See you at 5:30 AM tomorrow.',
    time: 'Yesterday',
    unread: 0,
    avatarColor: '#8B1E3F',
  },
  {
    id: 'msg-3',
    name: 'Anticlock Support',
    preview: 'Booking confirmed for Friday.',
    time: 'Mon',
    unread: 1,
    avatarColor: '#288B22',
  },
];

export const messages: Message[] = [
  {
    id: 'm1',
    conversationId: 'msg-1',
    text: 'Hello doctor, I uploaded my reports.',
    fromMe: true,
    time: '9:32 AM',
  },
  {
    id: 'm2',
    conversationId: 'msg-1',
    text: 'Your reports look fine. Stay hydrated.',
    fromMe: false,
    time: '9:40 AM',
  },
];

export const bookings: BookingRecord[] = [
  {
    id: 'bk-1',
    kind: 'doctor',
    title: 'Dr. Sathish Kumar',
    subtitle: 'Physiotherapy - Sports',
    patientName: 'Sathish Kumar',
    patientAge: 42,
    when: '10 AM Friday 22-10-2025',
    place: 'Anticlock Clinic',
    amountPaid: 300,
    status: 'confirmed',
  },
];

export const homeServices: ServiceTile[] = [
  { id: 'svc-doc', label: 'Doctor Consultation', icon: 'doctor', route: 'Doctors' },
  { id: 'svc-physio', label: 'Physiotherapy', icon: 'physio', route: 'PhysioHub' },
  { id: 'svc-nurse', label: 'Nursing Service', icon: 'heart-pulse', route: 'Search' },
  { id: 'svc-diag', label: 'Diagnostics', icon: 'diagnostics', route: 'DiagnosticsHub' },
  { id: 'svc-pharma', label: 'Pharmacy', icon: 'pharmacy', route: 'Shop' },
];

export const diagnosticTests: ServiceTile[] = [
  { id: 'd1', label: 'Blood Test', icon: 'test-tube' },
  { id: 'd2', label: 'CT Scan', icon: 'monitor' },
  { id: 'd3', label: 'X-Ray', icon: 'camera' },
  { id: 'd4', label: 'MRI Scan', icon: 'activity' },
  { id: 'd5', label: 'Ultrasound Scan', icon: 'heart-pulse' },
  { id: 'd6', label: 'ECG', icon: 'heart' },
  { id: 'd7', label: 'Echo Cardiogram', icon: 'heart-pulse' },
  { id: 'd8', label: 'Pap Smear Test', icon: 'flask' },
  { id: 'd9', label: 'Endoscopy', icon: 'search' },
  { id: 'd10', label: 'Mammography', icon: 'hospital' },
  { id: 'd11', label: 'Colonoscopy', icon: 'clipboard' },
  { id: 'd12', label: 'Genetic Test', icon: 'flask' },
  { id: 'd13', label: 'Biopsy', icon: 'test-tube' },
  { id: 'd14', label: 'PET Scan', icon: 'activity' },
  { id: 'd15', label: 'Pre-Natal Test', icon: 'heart' },
];

export const doctorSpecialties: ServiceTile[] = [
  { id: 's1', label: 'General Physician', icon: 'doctor' },
  { id: 's2', label: 'Gastroenterologist', icon: 'hospital' },
  { id: 's3', label: 'Endocrinologist', icon: 'activity' },
  { id: 's4', label: 'Orthopedician', icon: 'accessibility' },
  { id: 's5', label: 'Pediatrician', icon: 'heart' },
  { id: 's6', label: 'Ophthalmologist', icon: 'search' },
  { id: 's7', label: 'Rheumatologist', icon: 'physio' },
  { id: 's8', label: 'Urologist', icon: 'droplet' },
  { id: 's9', label: 'Anesthesiologist', icon: 'pill' },
  { id: 's10', label: 'Psychiatrist', icon: 'users' },
  { id: 's11', label: 'Cardiologist', icon: 'heart-pulse' },
  { id: 's12', label: 'Neurologist', icon: 'activity' },
  { id: 's13', label: 'Dermatologist', icon: 'user' },
  { id: 's14', label: 'Oncologist', icon: 'hospital' },
  { id: 's15', label: 'Pulmonologist', icon: 'activity' },
];

export const physioSpecialties: ServiceTile[] = [
  { id: 'p1', label: 'Orthopedic Physiotherapist', icon: 'physio' },
  { id: 'p2', label: 'Sports Physiotherapist', icon: 'fitness' },
  { id: 'p3', label: 'Gynaecological Therapist', icon: 'heart' },
  { id: 'p4', label: 'Pediatric Physiotherapist', icon: 'accessibility' },
  { id: 'p5', label: 'Neurological Therapist', icon: 'activity' },
  { id: 'p6', label: "Women's Health Therapist", icon: 'heart-pulse' },
  { id: 'p7', label: 'Intensive Care Therapist', icon: 'hospital' },
  { id: 'p8', label: 'Manual Therapist', icon: 'physio' },
  { id: 'p9', label: 'Palliative Care Therapist', icon: 'heart' },
  { id: 'p10', label: 'Posture Correction Therapist', icon: 'accessibility' },
  { id: 'p11', label: 'Geriatric Care Therapist', icon: 'users' },
  { id: 'p12', label: 'Dry Needle Therapist', icon: 'activity' },
  { id: 'p13', label: 'Cardio Respiratory Therapist', icon: 'heart-pulse' },
  { id: 'p14', label: 'Chiropractic Therapist', icon: 'physio' },
  { id: 'p15', label: 'Hydrotherapy Therapist', icon: 'droplet' },
];

export const reportTiles: ReportTile[] = [
  {
    id: 'r1',
    title: 'Health Services',
    icon: 'doctor',
    items: ['Doctor Consultation E-Consult', 'Order Medicines'],
  },
  {
    id: 'r2',
    title: 'Fitness & Yoga',
    icon: 'fitness',
    items: ['Yoga Classes & Guides', 'Workout Routines & Plans'],
  },
  {
    id: 'r3',
    title: 'Sports',
    icon: 'activity',
    items: ['Football News & Matches', 'Cricket Updates & Scores'],
  },
  {
    id: 'r4',
    title: 'Events',
    icon: 'calendar',
    items: ['Adventure Activities', 'Tours & Expeditions'],
  },
  {
    id: 'r5',
    title: 'Products',
    icon: 'shopping-bag',
    items: ['Apparel & T-shirts', 'Protein & Supplements'],
  },
  {
    id: 'r6',
    title: 'Wellness',
    icon: 'heart',
    items: ['Nutrition & Diet Plans', 'Therapy & Mental Health'],
  },
  {
    id: 'r7',
    title: 'Natural Medicine',
    icon: 'leaf',
    items: ['Siddha Medicine & Healing', 'Ayurveda & Herbal Remedies'],
  },
  {
    id: 'r8',
    title: 'Traditional Sports',
    icon: 'users',
    items: ['Silambam Martial Arts', 'Mallakhamb Acrobatics'],
  },
  {
    id: 'r9',
    title: 'Devotional',
    icon: 'moon',
    items: ['Meditation & Chanting', 'Music, Dance & Kirtan'],
  },
];

export const liveTracking = [
  { id: 'walk', label: 'Walk', icon: 'footprints', value: '4.2k' },
  { id: 'run', label: 'Run', icon: 'activity', value: '32m' },
  { id: 'cycle', label: 'Cycle', icon: 'activity', value: '8km' },
  { id: 'swim', label: 'Swim', icon: 'droplet', value: '—' },
  { id: 'hike', label: 'Hike', icon: 'footprints', value: '—' },
];

export const fitnessTracking = [
  { id: 'routines', label: 'Routines', icon: 'clipboard' },
  { id: 'food', label: 'Food', icon: 'flame' },
  { id: 'strength', label: 'Strength', icon: 'fitness' },
  { id: 'cardio', label: 'Cardio', icon: 'heart-pulse' },
  { id: 'flexibility', label: 'Flexibility', icon: 'accessibility' },
  { id: 'sleep', label: 'Sleep', icon: 'moon' },
  { id: 'dee', label: 'DEE', icon: 'activity' },
  { id: 'water', label: 'Water', icon: 'droplet' },
  { id: 'vitals', label: 'Vitals', icon: 'heart-pulse' },
  { id: 'body', label: 'Body', icon: 'scale' },
];

export const healthMetrics = [
  { id: 'hr', label: 'Heart rate', value: '72', unit: 'bpm', icon: 'heart-pulse', tone: 'like' },
  { id: 'steps', label: 'Steps', value: '8,420', unit: 'today', icon: 'footprints', tone: 'primary' },
  { id: 'sleep', label: 'Sleep', value: '7.2', unit: 'hrs', icon: 'moon', tone: 'navy' },
  { id: 'calories', label: 'Calories', value: '486', unit: 'kcal', icon: 'flame', tone: 'orange' },
  { id: 'water', label: 'Water', value: '1.8', unit: 'L', icon: 'droplet', tone: 'primary' },
  { id: 'weight', label: 'Weight', value: '68.4', unit: 'kg', icon: 'scale', tone: 'navy' },
];

export const partners = ['Thyrocare', 'Aarthi Scans', 'Anderson'];

export const timeSlots = [
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '1:00 PM',
  '2:00 PM',
];
