import {
  BookingRecord,
  Community,
  Conversation,
  Doctor,
  FitnessClass,
  LabProvider,
  LabTest,
  Message,
  ReelItem,
  ReportTile,
  ServiceTile,
  ShopProduct,
} from '@/shared/types';

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

export const reels: ReelItem[] = [
  {
    id: 'reel-1',
    title: 'Morning mobility',
    author: 'coach.sathish',
    caption: '5-minute warm-up before sports training #anticlock #fitness',
    videoUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    posterUrl: img('photo-1571019614242-c5c5dee9f50b', 720, 1280),
    likeCount: 1280,
    commentCount: 42,
    bookTarget: { kind: 'fitness', id: 'fit-sathish-am' },
  },
  {
    id: 'reel-2',
    title: 'GP tips',
    author: 'dr.remya',
    caption: 'When to book an online consult vs clinic visit',
    videoUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    posterUrl: img('photo-1559839734-2b71ea197ec2', 720, 1280),
    likeCount: 890,
    commentCount: 31,
    bookTarget: { kind: 'doctor', id: 'doc-remya' },
  },
  {
    id: 'reel-3',
    title: 'Lab prep',
    author: 'thyrocare.care',
    caption: 'How to prepare for Vitamin B12 fasting tests',
    videoUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    posterUrl: img('photo-1582719471384-894fbb16e074', 720, 1280),
    likeCount: 640,
    commentCount: 18,
    bookTarget: { kind: 'lab', id: 'lab-thyrocare' },
  },
];

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
  { id: 'svc-doc', label: 'Doctor Consultation', icon: '🩺', route: 'Doctors' },
  { id: 'svc-physio', label: 'Physiotherapy', icon: '🦴', route: 'PhysioHub' },
  { id: 'svc-nurse', label: 'Nursing Service', icon: '👩‍⚕️', route: 'Search' },
  { id: 'svc-diag', label: 'Diagnostics', icon: '🔬', route: 'DiagnosticsHub' },
  { id: 'svc-pharma', label: 'Pharmacy', icon: '💊', route: 'Shop' },
];

export const diagnosticTests: ServiceTile[] = [
  { id: 'd1', label: 'Blood Test', icon: '🩸' },
  { id: 'd2', label: 'CT Scan', icon: '🖥️' },
  { id: 'd3', label: 'X-Ray', icon: '📷' },
  { id: 'd4', label: 'MRI Scan', icon: '🧲' },
  { id: 'd5', label: 'Ultrasound Scan', icon: '📡' },
  { id: 'd6', label: 'ECG', icon: '❤️' },
  { id: 'd7', label: 'Echo Cardiogram', icon: '💓' },
  { id: 'd8', label: 'Pap Smear Test', icon: '🧪' },
  { id: 'd9', label: 'Endoscopy', icon: '🔍' },
  { id: 'd10', label: 'Mammography', icon: '🏥' },
  { id: 'd11', label: 'Colonoscopy', icon: '🧬' },
  { id: 'd12', label: 'Genetic Test', icon: '🧫' },
  { id: 'd13', label: 'Biopsy', icon: '🔬' },
  { id: 'd14', label: 'PET Scan', icon: '⚛️' },
  { id: 'd15', label: 'Pre-Natal Test', icon: '👶' },
];

export const doctorSpecialties: ServiceTile[] = [
  { id: 's1', label: 'General Physician', icon: '👨‍⚕️' },
  { id: 's2', label: 'Gastroenterologist', icon: '🫁' },
  { id: 's3', label: 'Endocrinologist', icon: '⚖️' },
  { id: 's4', label: 'Orthopedician', icon: '🦴' },
  { id: 's5', label: 'Pediatrician', icon: '👶' },
  { id: 's6', label: 'Ophthalmologist', icon: '👁️' },
  { id: 's7', label: 'Rheumatologist', icon: '🦵' },
  { id: 's8', label: 'Urologist', icon: '💧' },
  { id: 's9', label: 'Anesthesiologist', icon: '💉' },
  { id: 's10', label: 'Psychiatrist', icon: '🧠' },
  { id: 's11', label: 'Cardiologist', icon: '❤️' },
  { id: 's12', label: 'Neurologist', icon: '🧬' },
  { id: 's13', label: 'Dermatologist', icon: '✨' },
  { id: 's14', label: 'Oncologist', icon: '🎗️' },
  { id: 's15', label: 'Pulmonologist', icon: '🌬️' },
];

export const physioSpecialties: ServiceTile[] = [
  { id: 'p1', label: 'Orthopedic Physiotherapist', icon: '🦴' },
  { id: 'p2', label: 'Sports Physiotherapist', icon: '🏃' },
  { id: 'p3', label: 'Gynaecological Therapist', icon: '💜' },
  { id: 'p4', label: 'Pediatric Physiotherapist', icon: '🧸' },
  { id: 'p5', label: 'Neurological Therapist', icon: '🧠' },
  { id: 'p6', label: "Women's Health Therapist", icon: '🌸' },
  { id: 'p7', label: 'Intensive Care Therapist', icon: '🏥' },
  { id: 'p8', label: 'Manual Therapist', icon: '👐' },
  { id: 'p9', label: 'Palliative Care Therapist', icon: '🤝' },
  { id: 'p10', label: 'Posture Correction Therapist', icon: '🧍' },
  { id: 'p11', label: 'Geriatric Care Therapist', icon: '👵' },
  { id: 'p12', label: 'Dry Needle Therapist', icon: '🪡' },
  { id: 'p13', label: 'Cardio Respiratory Therapist', icon: '💓' },
  { id: 'p14', label: 'Chiropractic Therapist', icon: '🌀' },
  { id: 'p15', label: 'Hydrotherapy Therapist', icon: '💧' },
];

export const reportTiles: ReportTile[] = [
  {
    id: 'r1',
    title: 'Health Services',
    items: ['Doctor Consultation E-Consult', 'Order Medicines'],
  },
  {
    id: 'r2',
    title: 'Fitness & Yoga',
    items: ['Yoga Classes & Guides', 'Workout Routines & Plans'],
  },
  {
    id: 'r3',
    title: 'Sports',
    items: ['Football News & Matches', 'Cricket Updates & Scores'],
  },
  {
    id: 'r4',
    title: 'Events',
    items: ['Adventure Activities', 'Tours & Expeditions'],
  },
  {
    id: 'r5',
    title: 'Products',
    items: ['Apparel & T-shirts', 'Protein & Supplements'],
  },
  {
    id: 'r6',
    title: 'Wellness',
    items: ['Nutrition & Diet Plans', 'Therapy & Mental Health'],
  },
  {
    id: 'r7',
    title: 'Natural Medicine',
    items: ['Siddha Medicine & Healing', 'Ayurveda & Herbal Remedies'],
  },
  {
    id: 'r8',
    title: 'Traditional Sports',
    items: ['Silambam Martial Arts', 'Mallakhamb Acrobatics'],
  },
  {
    id: 'r9',
    title: 'Devotional',
    items: ['Meditation & Chanting', 'Music, Dance & Kirtan'],
  },
];

export const liveTracking = [
  { id: 'walk', label: 'Walk', icon: '🚶' },
  { id: 'run', label: 'Run', icon: '🏃' },
  { id: 'cycle', label: 'Cycle', icon: '🚴' },
  { id: 'swim', label: 'Swim', icon: '🏊' },
  { id: 'hike', label: 'Hike', icon: '🥾' },
];

export const fitnessTracking = [
  { id: 'routines', label: 'Routines', icon: '📋' },
  { id: 'food', label: 'Food', icon: '🍽️' },
  { id: 'strength', label: 'Strength', icon: '💪' },
  { id: 'cardio', label: 'Cardio', icon: '🏃‍♂️' },
  { id: 'flexibility', label: 'Flexibility', icon: '🤸' },
  { id: 'sleep', label: 'Sleep', icon: '😴' },
  { id: 'dee', label: 'DEE', icon: '🧍' },
  { id: 'water', label: 'Water intake', icon: '💧' },
  { id: 'vitals', label: 'Vital signs', icon: '❤️‍🩹' },
  { id: 'body', label: 'Body composition', icon: '⚖️' },
];

export const partners = ['Thyrocare', 'Aarthi Scans', 'Anderson'];

export const timeSlots = [
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '1:00 PM',
  '2:00 PM',
];
