'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Flag,
  Languages,
  Mic2,
  Music2,
  Sparkles,
  Ticket,
  Timer,
  Utensils,
  UsersRound,
  Zap,
} from 'lucide-react';
import { EventArtwork } from '@/components/event/EventArtwork';
import { EventFloat, EventReveal } from '@/components/event/EventMotion';
import { EventPaymentPanel } from '@/components/event/EventPaymentPanel';
import { eventConfig } from '@/config/event';

type Language = 'en' | 'ta';

const invitationCopy = {
  en: {
    languageLabel: 'தமிழ்',
    nav: { programme: 'Programme', seminars: 'Seminars', entry: 'Entry' },
    hero: {
      academy: 'Anticlock Sports, Health & Fitness Academy',
      tagline: 'Fit people. Healthy society.',
      eyebrow: 'Awards · Knock app launch · expert seminars',
      date: 'Wednesday · 25 November 2026',
      title: 'Mupperum Vizha',
      annual: '10th Annual Celebration',
      description: 'A colourful day for the people shaping fitness, health and sport — with awards, learning and the Knock community in one place.',
      primaryAction: 'Explore the programme',
      secondaryAction: 'Reserve for ₹500',
      community: '500+ fitness and sports trainers, practitioners and students',
      posterLabel: 'Official programme poster',
      posterCaption: 'The original artwork keeps every organiser, guest, session and visual detail together.',
    },
    pass: {
      presenting: 'Academy presents',
      admit: 'Admit one',
      title: 'Mupperum Vizha',
      annual: '10th Annual Celebration',
      awards: 'Awards for achievers',
      launch: 'Knock app launch ceremony',
      entry: 'UPI entry',
      verify: 'manual verification',
    },
    highlights: [
      { label: 'Community', value: '500+ participants' },
      { label: 'Learning', value: 'Fitness seminars' },
      { label: 'Celebration', value: 'Achiever awards' },
    ],
    programme: {
      eyebrow: 'The day at a glance',
      title: 'A programme built for the fitness community.',
      description: 'Learn from specialists, celebrate achievers and connect with people who care about healthier lives.',
      schedule: [
        { time: '9:00 AM', title: 'Ceremony opens' },
        { time: '10:00 AM', title: 'Expert seminars begin' },
        { time: '12:00 PM', title: 'Tamil Thai Vazhthu' },
        { time: '1:00 PM', title: 'Lunch' },
        { time: '2:00 PM', title: 'Vote of thanks' },
        { time: '2:15 PM', title: 'National Anthem' },
      ],
      sessionsTitle: 'Featured sessions',
      sessions: [
        { time: '10:00 AM', title: 'Dietary Supplements & Evidence-Based Science', speaker: 'Dr. Anitha' },
        { time: '11:00 AM', title: 'Wearable Technology & Data Tracking', speaker: 'Dr. Sathish' },
      ],
      hosts: 'Welcome by Dr. Sathish Kumar, Founder — Anticlock Groups · Chaired by Dr. Balamurali Krishnan, Director — PRC Groups.',
    },
    seminars: {
      eyebrow: 'Seminar details',
      title: 'Practical knowledge for stronger, healthier lives.',
      description: 'A focused mix of muscle science, fat loss, recovery and data-informed coaching.',
      tracks: [
        {
          title: 'Muscular hypertrophy',
          label: 'Strength & growth',
          points: [
            'Advanced intensity techniques: drop sets, cluster sets and rest-pause',
            'Blood flow restriction (BFR) training',
            'Periodization for hypertrophy',
            'Mind-muscle connection & biomechanics',
            'Eccentric overload training',
          ],
        },
        {
          title: 'Weight loss & fat loss',
          label: 'Metabolic health',
          points: [
            'Metabolic resistance training (MRT)',
            'Advanced HIIT protocols',
            'Concurrent training optimization',
            'Non-exercise activity thermogenesis (NEAT)',
            'EPOC — the afterburn effect',
          ],
        },
        {
          title: 'Wearables & data tracking',
          label: 'Smarter coaching',
          points: [
            'Smart watches, smart rings and CGM',
            'Nutrition & metabolic tracking',
            'HRV, sleep, SpO₂ and VO₂ max',
            'Performance, recovery & data-driven plans',
          ],
        },
      ],
      breakdown: {
        eyebrow: '60-minute breakdown',
        items: [
          ['00–05 min', 'Training trends'],
          ['05–20 min', 'Hypertrophy masterclass — BFR & advanced intensity'],
          ['20–35 min', 'Advanced fat loss — HIIT & EPOC'],
          ['35–50 min', 'Smart muscle gaining — volume & programming'],
          ['50–60 min', 'Q&A and closing'],
        ],
      },
    },
    faq: {
      eyebrow: 'Good to know',
      title: 'Everything you need before you join.',
      items: [
        ['Who is this for?', 'Fitness and sports trainers, practitioners, students and anyone invested in healthier living.'],
        ['What is the entry fee?', '₹500 per participant, payable through UPI.'],
        ['How do I receive my invitation?', 'Pay by UPI, share the payment screenshot or transaction ID, then receive a verified invitation on WhatsApp and email.'],
        ['Can I view this in Tamil?', 'Yes. Use the English / தமிழ் switch at the top of this invitation at any time.'],
      ],
    },
    cta: { title: 'Come learn, celebrate and move forward together.', action: 'Reserve your invitation' },
    footer: 'Anticlock Sports, Health & Fitness Academy · Invitation issued after payment verification.',
  },
  ta: {
    languageLabel: 'English',
    nav: { programme: 'நிகழ்ச்சி நிரல்', seminars: 'கருத்தரங்குகள்', entry: 'பதிவு' },
    hero: {
      academy: 'ஆன்டிக்ளாக் விளையாட்டு, ஆரோக்கியம் மற்றும் உடற்பயிற்சி அகாடமி',
      tagline: 'ஆரோக்கியமான மக்கள். ஆரோக்கியமான சமூகம்.',
      eyebrow: 'விருதுகள் · நாக் செயலி வெளியீடு · சிறப்பு கருத்தரங்குகள்',
      date: 'புதன்கிழமை · 25 நவம்பர் 2026',
      title: 'முப்பெரும் விழா',
      annual: '10ஆம் ஆண்டு விழா',
      description: 'உடற்பயிற்சி, ஆரோக்கியம் மற்றும் விளையாட்டை உருவாக்கும் மக்களுக்கான வண்ணமயமான நாள் — விருதுகள், கற்றல் மற்றும் நாக் சமூகத்துடன்.',
      primaryAction: 'நிகழ்ச்சி நிரலைப் பார்க்க',
      secondaryAction: '₹500-க்கு பதிவு செய்ய',
      community: 'ஃபிட்னஸ் மற்றும் விளையாட்டுத் துறையைச் சார்ந்த 500+ பயிற்சியாளர்கள் மற்றும் மாணவர்கள்',
      posterLabel: 'அதிகாரப்பூர்வ நிகழ்ச்சி போஸ்டர்',
      posterCaption: 'அசல் போஸ்டரில் அனைத்து ஒருங்கிணைப்பாளர், விருந்தினர், அமர்வு மற்றும் காட்சி விவரங்களும் இடம்பெற்றுள்ளன.',
    },
    pass: {
      presenting: 'அகாடமி வழங்கும்',
      admit: 'ஒரு நுழைவு',
      title: 'முப்பெரும் விழா',
      annual: '10ஆம் ஆண்டு விழா',
      awards: 'சாதனையாளர்களுக்கான விருதுகள்',
      launch: 'நாக் செயலி வெளியீட்டு விழா',
      entry: 'UPI பதிவு',
      verify: 'கைமுறை சரிபார்ப்பு',
    },
    highlights: [
      { label: 'சமூகம்', value: '500+ பங்கேற்பாளர்கள்' },
      { label: 'கற்றல்', value: 'ஃபிட்னஸ் கருத்தரங்குகள்' },
      { label: 'கொண்டாட்டம்', value: 'சாதனையாளர் விருதுகள்' },
    ],
    programme: {
      eyebrow: 'ஒரு பார்வையில் நாள்',
      title: 'ஃபிட்னஸ் சமூகத்திற்காக வடிவமைக்கப்பட்ட நிகழ்ச்சி நிரல்.',
      description: 'சிறப்பு நிபுணர்களிடம் கற்றுக்கொள்ளுங்கள், சாதனையாளர்களைக் கொண்டாடுங்கள், ஆரோக்கியமான வாழ்வை விரும்பும் மக்களுடன் இணையுங்கள்.',
      schedule: [
        { time: 'காலை 9:00', title: 'விழா தொடக்கம்' },
        { time: 'காலை 10:00', title: 'சிறப்பு கருத்தரங்குகள் தொடக்கம்' },
        { time: 'மதியம் 12:00', title: 'தமிழ் தாய் வாழ்த்து' },
        { time: 'பிற்பகல் 1:00', title: 'மதிய விருந்து' },
        { time: 'பிற்பகல் 2:00', title: 'நன்றியுரை' },
        { time: 'பிற்பகல் 2:15', title: 'தேசிய கீதம்' },
      ],
      sessionsTitle: 'சிறப்பு அமர்வுகள்',
      sessions: [
        { time: 'காலை 10:00', title: 'உணவுச் சேர்க்கைகள் மற்றும் ஆதார அடிப்படையிலான அறிவியல்', speaker: 'டாக்டர் அனிதா' },
        { time: 'காலை 11:00', title: 'அணியக்கூடிய தொழில்நுட்பம் மற்றும் தரவு கண்காணிப்பு', speaker: 'டாக்டர் சதீஷ்' },
      ],
      hosts: 'வரவேற்புரை: டாக்டர் சதீஷ் குமார், நிறுவனர் — ஆன்டிக்ளாக் குழுமம் · தலைமையுரை: டாக்டர் பாலமுரளி கிருஷ்ணன், இயக்குநர் — PRC குழுமம்.',
    },
    seminars: {
      eyebrow: 'கருத்தரங்கு விவரங்கள்',
      title: 'வலிமையான, ஆரோக்கியமான வாழ்வுக்கான பயனுள்ள அறிவு.',
      description: 'தசை அறிவியல், கொழுப்பு குறைப்பு, மீட்பு மற்றும் தரவு சார்ந்த பயிற்சியின் சிறந்த கலவை.',
      tracks: [
        {
          title: 'தசை வளர்ச்சி',
          label: 'வலிமை மற்றும் வளர்ச்சி',
          points: [
            'மேம்பட்ட இன்டென்சிட்டி நுட்பங்கள்: டிராப் செட்ஸ், கிளஸ்டர் செட்ஸ், ரெஸ்ட்-பாஸ்',
            'ரத்த ஓட்டக் கட்டுப்பாடு (BFR) பயிற்சி',
            'தசை வளர்ச்சிக்கான திட்டமிடல்',
            'மனம்–தசை தொடர்பு மற்றும் உடலியக்கம்',
            'எசென்ட்ரிக் ஓவர்லோட் பயிற்சி',
          ],
        },
        {
          title: 'உடல் எடை மற்றும் கொழுப்பு குறைப்பு',
          label: 'மெட்டபாலிக் ஆரோக்கியம்',
          points: [
            'மெட்டபாலிக் ரெசிஸ்டன்ஸ் பயிற்சி (MRT)',
            'மேம்பட்ட HIIT முறைகள்',
            'ஒருங்கிணைந்த பயிற்சி மேம்பாடு',
            'உடற்பயிற்சி அல்லாத செயல்பாட்டு வெப்ப உற்பத்தி (NEAT)',
            'EPOC — ஆஃப்டர்பர்ன் விளைவு',
          ],
        },
        {
          title: 'அணியக்கூடிய கருவிகள் மற்றும் தரவு கண்காணிப்பு',
          label: 'சிறந்த பயிற்சி',
          points: [
            'ஸ்மார்ட் கடிகாரம், ஸ்மார்ட் ரிங் மற்றும் CGM',
            'ஊட்டச்சத்து மற்றும் மெட்டபாலிக் கண்காணிப்பு',
            'HRV, தூக்கம், SpO₂ மற்றும் VO₂ மேக்ஸ்',
            'செயல்திறன், மீட்பு மற்றும் தரவு சார்ந்த திட்டங்கள்',
          ],
        },
      ],
      breakdown: {
        eyebrow: '60 நிமிட திட்டம்',
        items: [
          ['00–05 நிமி', 'பயிற்சியின் புதிய போக்குகள்'],
          ['05–20 நிமி', 'தசை வளர்ச்சி மாஸ்டர்கிளாஸ் — BFR மற்றும் மேம்பட்ட இன்டென்சிட்டி'],
          ['20–35 நிமி', 'மேம்பட்ட கொழுப்பு குறைப்பு — HIIT மற்றும் EPOC'],
          ['35–50 நிமி', 'சிறந்த தசை வளர்ச்சி — வால்யூம் மற்றும் ப்ரோகிராமிங்'],
          ['50–60 நிமி', 'கேள்வி பதில் மற்றும் நிறைவு'],
        ],
      },
    },
    faq: {
      eyebrow: 'தெரிந்துகொள்ள வேண்டியது',
      title: 'பங்கேற்பதற்கு முன் தேவையான அனைத்தும்.',
      items: [
        ['யாருக்கான நிகழ்வு இது?', 'ஃபிட்னஸ் மற்றும் விளையாட்டு பயிற்சியாளர்கள், மாணவர்கள் மற்றும் ஆரோக்கியமான வாழ்வில் அக்கறையுள்ள அனைவருக்கும்.'],
        ['பதிவுக் கட்டணம் என்ன?', 'ஒரு பங்கேற்பாளருக்கு ₹500. UPI மூலம் செலுத்தலாம்.'],
        ['அழைப்பிதழ் எப்படி கிடைக்கும்?', 'UPI மூலம் செலுத்தி, பணம் செலுத்திய ஸ்கிரீன்ஷாட் அல்லது பரிவர்த்தனை எண்ணை பகிருங்கள். சரிபார்ப்புக்குப் பிறகு WhatsApp மற்றும் மின்னஞ்சலில் அழைப்பிதழ் கிடைக்கும்.'],
        ['தமிழில் பார்க்க முடியுமா?', 'முடியும். இந்த அழைப்பிதழின் மேல் பகுதியில் உள்ள English / தமிழ் மாற்றியை எப்போது வேண்டுமானாலும் பயன்படுத்தலாம்.'],
      ],
    },
    cta: { title: 'கற்றுக்கொள்ளுங்கள், கொண்டாடுங்கள், ஒன்றாக முன்னேறுங்கள்.', action: 'அழைப்பிதழை பதிவு செய்யுங்கள்' },
    footer: 'ஆன்டிக்ளாக் விளையாட்டு, ஆரோக்கியம் மற்றும் உடற்பயிற்சி அகாடமி · பணம் செலுத்தியதை சரிபார்த்த பிறகு அழைப்பிதழ் வழங்கப்படும்.',
  },
} as const;

const trackStyles = [
  'border-[#ffbd26] bg-[#fff4c7] text-[#24205b]',
  'border-[#f06658] bg-[#ffe1db] text-[#5b1734]',
  'border-[#1aa8bd] bg-[#d8f7fb] text-[#073b59]',
] as const;

const highlightArtwork = ['community', 'strength', 'trophy'] as const;
const scheduleIcons = [Flag, Mic2, Music2, Utensils, Mic2, Music2] as const;

export function EventInvitation() {
  const [language, setLanguage] = useState<Language>('en');
  const copy = invitationCopy[language];
  const isTamil = language === 'ta';

  return (
    <main
      lang={language}
      className="event-invitation min-h-screen overflow-hidden bg-[#f9fcff] text-[#111b4b]"
      style={isTamil ? { fontFamily: '"Noto Sans Tamil", "Tamil Sangam MN", sans-serif' } : undefined}
    >
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <a href="/" className="inline-flex min-w-0 items-center gap-2.5" aria-label="Go to Anticlock home">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/50 bg-white shadow-lg shadow-[#0b5f9d]/10">
              <span className="text-sm font-black text-[#e85b30]">A</span>
            </span>
            <span className="min-w-0 text-sm font-black leading-tight tracking-tight text-[#09235b] sm:text-base">ANTICLOCK <span className="hidden font-semibold sm:inline">ACADEMY</span></span>
          </a>

          <nav className="hidden items-center gap-6 text-sm font-bold text-[#09235b]/75 md:flex" aria-label="Event navigation">
            <a href="#programme" className="transition hover:text-[#d23848]">{copy.nav.programme}</a>
            <a href="#seminars" className="transition hover:text-[#d23848]">{copy.nav.seminars}</a>
            <a href="#pay" className="transition hover:text-[#d23848]">{copy.nav.entry}</a>
          </nav>

          <div className="inline-flex rounded-xl border border-[#09235b]/15 bg-white/80 p-1 shadow-sm backdrop-blur">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              aria-pressed={language === 'en'}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-black transition sm:px-3 ${language === 'en' ? 'bg-[#09235b] text-white' : 'text-[#09235b]/65 hover:text-[#09235b]'}`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLanguage('ta')}
              aria-pressed={language === 'ta'}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-black transition sm:px-3 ${language === 'ta' ? 'bg-[#09235b] text-white' : 'text-[#09235b]/65 hover:text-[#09235b]'}`}
            >
              தமிழ்
            </button>
          </div>
        </div>
      </header>

      <section className="relative isolate overflow-hidden bg-[#eaf9ff] pt-24 sm:pt-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_18%,rgba(17,181,218,0.36),transparent_23%),radial-gradient(circle_at_93%_12%,rgba(255,186,34,0.48),transparent_24%),radial-gradient(circle_at_88%_87%,rgba(238,70,103,0.3),transparent_26%),linear-gradient(135deg,#effcff_0%,#ffffff_48%,#fff8df_100%)]" />
        <div className="absolute left-[5%] top-[30%] h-16 w-7 rotate-[28deg] rounded-full bg-[#ff8e2b]" />
        <div className="absolute left-[14%] top-[74%] h-7 w-16 -rotate-[34deg] rounded-full border-4 border-[#11b5da]" />
        <div className="absolute right-[7%] top-[26%] h-10 w-10 rotate-45 rounded-[0.7rem] bg-[#e94c62]" />
        <div className="absolute bottom-[13%] right-[15%] h-8 w-8 rounded-full bg-[#6c5fe6]" />
        <div className="absolute bottom-[23%] left-[4%] text-5xl font-black text-[#f0a414]">✦</div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-8 sm:px-6 sm:pb-20 lg:grid-cols-[1fr_0.9fr] lg:gap-16 lg:px-8 lg:pb-24 lg:pt-14">
          <EventReveal className="text-center lg:text-left">
            <div className="flex items-center justify-center gap-3 lg:justify-start">
              <EventFloat className="shrink-0" delay={0.2}><EventArtwork kind="trophy" className="h-16 w-16" /></EventFloat>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#09235b]/15 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.13em] text-[#0b5f9d] shadow-sm">
                <Sparkles size={14} className="shrink-0 text-[#e94c62]" />
                {copy.hero.eyebrow}
              </div>
            </div>
            <p className="mt-5 text-sm font-black uppercase tracking-[0.11em] text-[#09235b] sm:text-base">{copy.hero.academy}</p>
            <p className="mt-2 text-base font-bold text-[#e25a27] sm:text-lg">{copy.hero.tagline}</p>

            <div className="mt-6 flex items-center justify-center gap-3 text-sm font-black text-[#0b5f9d] lg:justify-start">
              <EventArtwork kind="calendar" className="h-10 w-10 shrink-0" />
              <time dateTime={eventConfig.isoDate}>{copy.hero.date}</time>
            </div>

            <h1 className="mt-5 max-w-3xl text-balance text-5xl font-black leading-[0.9] tracking-[-0.07em] text-[#09235b] sm:text-7xl lg:text-[5.7rem]">
              {copy.hero.title}
              <span className="mt-2 block font-serif text-[#d23848] italic tracking-[-0.055em]">{copy.hero.annual}</span>
            </h1>
            <p className="mx-auto mt-7 max-w-xl text-balance text-lg leading-8 text-[#09235b]/75 sm:text-xl lg:mx-0">{copy.hero.description}</p>

            <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
              <a href="#programme" className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-[#09235b] px-6 py-4 text-base font-black text-white shadow-xl shadow-[#09235b]/20 transition hover:-translate-y-1 hover:bg-[#0b5f9d] sm:px-7">
                {copy.hero.primaryAction} <ArrowDown size={19} className="transition group-hover:translate-y-1" />
              </a>
              <a href="#pay" className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[#e94c62] bg-white px-6 py-4 text-base font-black text-[#c22d42] shadow-sm transition hover:-translate-y-1 hover:bg-[#fff0f1] sm:px-7">
                {copy.hero.secondaryAction} <ArrowRight size={19} />
              </a>
            </div>

            <div className="mt-8 flex items-start justify-center gap-2 text-left text-sm font-bold text-[#09235b]/70 lg:justify-start">
              <UsersRound size={18} className="mt-0.5 shrink-0 text-[#e25a27]" />
              <span>{copy.hero.community}</span>
            </div>
          </EventReveal>

          <EventReveal className="relative mx-auto w-full max-w-[25rem] py-3 sm:max-w-[30rem]" delay={0.12}>
          <figure>
            <div className="absolute -left-7 top-8 h-28 w-28 rounded-full bg-[#11b5da]/35 blur-2xl" />
            <div className="absolute -bottom-5 -right-5 h-36 w-36 rounded-full bg-[#e94c62]/30 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border-[6px] border-[#f4bb28] bg-white shadow-[0_30px_80px_rgba(9,35,91,0.28)] rotate-[-2deg] transition duration-500 hover:rotate-0">
              <Image
                src="/event/mupperum-vizha-poster.jpg"
                alt={`${copy.hero.posterLabel} — ${copy.hero.title}`}
                width={1024}
                height={1535}
                priority
                sizes="(max-width: 640px) calc(100vw - 2rem), 480px"
                className="h-auto w-full"
              />
            </div>
            <figcaption className="relative mt-4 rounded-2xl border border-[#09235b]/10 bg-white/85 px-4 py-3 text-center shadow-sm backdrop-blur">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-[#d23848]">{copy.hero.posterLabel}</p>
              <p className="mt-1 text-xs leading-5 text-[#415878]">{copy.hero.posterCaption}</p>
            </figcaption>
          </figure>
          </EventReveal>
        </div>
      </section>

      <section className="relative -mt-1 overflow-hidden bg-[#09235b] py-5 text-white">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-3 sm:px-6 lg:px-8">
          {copy.highlights.map((highlight, index) => (
            <EventReveal key={highlight.label} className="flex items-center justify-center gap-3 border-white/15 text-left sm:border-r sm:last:border-r-0" delay={index * 0.08}>
              <EventArtwork kind={highlightArtwork[index]} className="h-14 w-14 shrink-0" />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/55">{highlight.label}</p>
                <p className="mt-0.5 text-sm font-black">{highlight.value}</p>
              </div>
            </EventReveal>
          ))}
        </div>
      </section>

      <section id="programme" className="scroll-mt-8 bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
            <EventReveal>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d23848]">{copy.programme.eyebrow}</p>
              <h2 className="mt-5 max-w-md text-balance text-4xl font-black tracking-[-0.055em] text-[#09235b] sm:text-5xl">{copy.programme.title}</h2>
              <p className="mt-6 max-w-md text-base leading-7 text-[#415878]">{copy.programme.description}</p>
              <div className="mt-8 rounded-2xl border border-[#bceaf4] bg-[#eaf9ff] p-5 text-sm font-bold leading-7 text-[#0b5f9d]">
                <p>{copy.programme.hosts}</p>
              </div>
            </EventReveal>

            <div className="grid gap-4 sm:grid-cols-2">
              <EventReveal className="rounded-[1.75rem] border border-[#f1d97e] bg-[#fff8df] p-6 sm:p-7" delay={0.08}>
                <div className="flex items-center gap-3"><EventArtwork kind="calendar" className="h-16 w-16 shrink-0" /><h3 className="font-black text-[#09235b]">{copy.nav.programme}</h3></div>
                <ol className="mt-7 space-y-4">
                  {copy.programme.schedule.map((item, index) => {
                    const Icon = scheduleIcons[index];
                    return (
                      <li key={`${item.time}-${item.title}`} className="flex gap-3 text-sm">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[#b66b07] shadow-sm"><Icon size={17} aria-hidden="true" /></span>
                        <div><p className="font-black text-[#09235b]">{item.time}</p><p className="mt-0.5 text-[#415878]">{item.title}</p></div>
                      </li>
                    );
                  })}
                </ol>
              </EventReveal>

              <EventReveal className="rounded-[1.75rem] border border-[#ffb4a6] bg-[#fff0ed] p-6 sm:p-7" delay={0.16}>
                <div className="flex items-center gap-3"><EventArtwork kind="nutrition" className="h-16 w-16 shrink-0" /><h3 className="font-black text-[#7b101d]">{copy.programme.sessionsTitle}</h3></div>
                <div className="mt-7 space-y-5">
                  {copy.programme.sessions.map((session, index) => (
                    <article key={session.time} className="border-b border-[#7b101d]/10 pb-5 last:border-b-0 last:pb-0">
                      <div className="mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white bg-white shadow-sm">
                        {index === 0 ? <Image src="/app/products-protein-supplements.webp" alt="" width={64} height={64} className="h-full w-full object-cover" /> : <EventArtwork kind="watch" className="h-14 w-14" />}
                      </div>
                      <p className="text-xs font-black uppercase tracking-[0.13em] text-[#d23848]">{session.time}</p>
                      <h4 className="mt-2 font-black leading-6 text-[#7b101d]">{session.title}</h4>
                      <p className="mt-1 text-sm font-bold text-[#7b101d]/65">{session.speaker}</p>
                    </article>
                  ))}
                </div>
              </EventReveal>
            </div>
          </div>
        </div>
      </section>

      <section id="seminars" className="scroll-mt-8 bg-[#edfaff] py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <EventReveal className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0b8da8]">{copy.seminars.eyebrow}</p>
            <h2 className="mt-5 text-balance text-4xl font-black tracking-[-0.055em] text-[#09235b] sm:text-5xl">{copy.seminars.title}</h2>
            <p className="mt-5 text-lg leading-8 text-[#415878]">{copy.seminars.description}</p>
          </EventReveal>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {copy.seminars.tracks.map((track, index) => {
              return (
                <EventReveal key={track.title} className="h-full" delay={index * 0.08}>
                <article className={`event-card h-full rounded-[1.75rem] border-2 p-6 shadow-lg shadow-[#09235b]/5 sm:p-7 ${trackStyles[index]}`}>
                  <div className="flex items-center justify-between">
                    <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[1.35rem] border-2 border-white bg-white shadow-md">
                      {index < 2 ? <Image src={index === 0 ? '/app/fitness-bodybuilding.webp' : '/app/wellness-nutrition-sports.webp'} alt="" width={80} height={80} className="h-full w-full object-cover" /> : <EventArtwork kind="watch" className="h-[4.5rem] w-[4.5rem]" />}
                    </span>
                    <span className="text-xs font-black uppercase tracking-[0.14em] opacity-60">0{index + 1}</span>
                  </div>
                  <p className="mt-6 text-xs font-black uppercase tracking-[0.15em] opacity-70">{track.label}</p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight">{track.title}</h3>
                  <ul className="mt-5 space-y-3 text-sm leading-6">
                    {track.points.map((point) => <li key={point} className="flex gap-2.5"><CheckCircle2 size={17} className="mt-0.5 shrink-0" /> <span>{point}</span></li>)}
                  </ul>
                </article>
                </EventReveal>
              );
            })}
          </div>

          <EventReveal className="mt-7 overflow-hidden rounded-[1.75rem] bg-[#09235b] p-7 text-white shadow-xl shadow-[#09235b]/20 sm:p-9">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#6ee8e0]">{copy.seminars.breakdown.eyebrow}</p><h3 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{copy.seminars.breakdown.items[0][1]}</h3></div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-black text-[#f7c92d]"><Timer size={17} /> 60 min</span>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {copy.seminars.breakdown.items.map(([time, title]) => (
                <div key={time} className="event-card rounded-2xl border border-white/15 bg-white/5 p-4"><p className="text-xs font-black text-[#f7c92d]">{time}</p><p className="mt-2 text-sm font-bold leading-5 text-white/85">{title}</p></div>
              ))}
            </div>
          </EventReveal>
        </div>
      </section>

      <section id="faq" className="relative scroll-mt-8 overflow-hidden bg-[#0b7696] py-20 sm:py-28">
        <div className="absolute left-[7%] top-16 h-8 w-20 -rotate-[30deg] rounded-full border-4 border-[#ffc62a]" />
        <div className="absolute bottom-14 right-[7%] text-5xl font-black text-[#ff684d]">✦</div>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#fff0a7]">{copy.faq.eyebrow}</p><h2 className="mt-5 text-4xl font-black tracking-[-0.055em] text-white sm:text-5xl">{copy.faq.title}</h2></div>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {copy.faq.items.map(([question, answer], index) => (
              <EventReveal key={question} delay={index * 0.06}><article className={`event-card h-full rounded-2xl border-2 p-6 shadow-lg ${index % 2 === 0 ? 'border-[#fff3c5] bg-[#fff8eb] text-[#09235b]' : 'border-[#09235b]/20 bg-[#6ee8e0] text-[#073b59]'}`}>
                <h3 className="flex gap-3 font-black"><CircleDot className="mt-0.5 shrink-0 text-[#e94c62]" size={17} />{question}</h3><p className="mt-3 pl-7 text-sm leading-6 opacity-80">{answer}</p>
              </article>
              </EventReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[linear-gradient(100deg,#f7c92d_0%,#ffad2d_48%,#e94c62_100%)] px-4 py-16 text-[#09235b] sm:px-6 sm:py-20 lg:px-8">
        <div className="absolute left-[10%] top-0 h-56 w-56 rounded-full bg-[#6ee8e0]/60 blur-3xl" />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center justify-between gap-8 text-center md:flex-row md:text-left"><div><div className="flex items-center justify-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-[#7b101d] md:justify-start"><Languages size={17} /> English · தமிழ்</div><h2 className="mt-3 text-balance text-4xl font-black tracking-[-0.06em] sm:text-5xl">{copy.cta.title}</h2></div><a href="#pay" className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[#09235b] px-6 py-4 font-black text-white shadow-xl shadow-[#09235b]/25 transition hover:-translate-y-1 hover:bg-[#0b5f9d]">{copy.cta.action} <ArrowRight size={19} /></a></div>
      </section>

      <EventPaymentPanel language={language} compact />

      <footer className="bg-[#09235b] px-4 py-8 sm:px-6 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left"><a href="/" className="inline-flex items-center gap-2 text-sm font-black text-white"><Zap size={16} className="text-[#f7c92d]" /> Anticlock</a><p className="max-w-2xl text-xs leading-5 text-white/60">{copy.footer}</p><a href="#pay" className="inline-flex items-center gap-1.5 text-xs font-black text-[#6ee8e0] transition hover:text-white"><Ticket size={15} /> {copy.nav.entry}</a></div></footer>
    </main>
  );
}
