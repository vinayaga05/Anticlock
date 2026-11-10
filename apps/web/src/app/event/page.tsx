import type { Metadata } from 'next';
import Image from 'next/image';
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  MessageCircle,
  Play,
  Sparkles,
  Ticket,
  UsersRound,
  Zap,
} from 'lucide-react';
import { EventPaymentPanel } from '@/components/event/EventPaymentPanel';
import { eventConfig } from '@/config/event';
import { generateMetadata } from '@/lib/metadata';

export const metadata: Metadata = generateMetadata({
  title: `${eventConfig.name} — 25 November 2026`,
  description: `${eventConfig.description} Join with a verified ₹${eventConfig.fee} UPI payment.`,
});

const experiencePillars = [
  {
    icon: Play,
    number: '01',
    title: 'Discover what moves you',
    description: 'The social-first energy of Clips turns shared interests into real conversations.',
    accent: 'aqua',
  },
  {
    icon: UsersRound,
    number: '02',
    title: 'Find your people',
    description: 'Meet the communities behind fitness, wellness, travel, sport, and every lifestyle in between.',
    accent: 'coral',
  },
  {
    icon: MessageCircle,
    number: '03',
    title: 'Keep the connection going',
    description: 'Knock brings the conversation closer—before, during, and after the event.',
    accent: 'lime',
  },
] as const;

const paymentSteps = [
  {
    title: 'Pay with UPI',
    description: 'Scan the QR code or use the UPI ID to pay the ₹500 entry fee in any UPI app.',
  },
  {
    title: 'Share your proof',
    description: 'Send the payment screenshot or UPI transaction ID to the event team on WhatsApp or email.',
  },
  {
    title: 'Receive your invitation',
    description: 'Once the payment is verified, we will send your invitation to both WhatsApp and email.',
  },
];

const faqs = [
  {
    question: 'What is the entry fee?',
    answer: 'Entry is ₹500 per participant, payable through UPI.',
  },
  {
    question: 'Which payment apps can I use?',
    answer: 'Use any UPI-enabled app, including Google Pay, PhonePe, Paytm, BHIM, or your bank app.',
  },
  {
    question: 'How do I confirm my payment?',
    answer: 'After paying, send the payment screenshot or UPI transaction ID using the WhatsApp or email action in the payment section.',
  },
  {
    question: 'When will I receive my invitation?',
    answer: 'The event team sends it after manual payment verification, on WhatsApp and email.',
  },
];

export default function EventPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#080b0b] text-white">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <a href="/" className="inline-flex items-center gap-2.5" aria-label="Go to Knock home">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-white/10 shadow-lg shadow-aqua/10">
              <Image src="/brand/logo-square.png" alt="" width={40} height={40} priority />
            </span>
            <span className="text-lg font-black tracking-tight text-white">knock</span>
          </a>
          <nav className="hidden items-center gap-7 text-sm font-medium text-white/65 md:flex" aria-label="Event navigation">
            <a href="#experience" className="transition hover:text-white">Experience</a>
            <a href="#how-to-join" className="transition hover:text-white">How to join</a>
            <a href="#faq" className="transition hover:text-white">FAQ</a>
          </nav>
          <a href="#pay" className="rounded-full border border-aqua/40 bg-aqua px-4 py-2.5 text-sm font-bold text-[#07201d] shadow-lg shadow-aqua/20 transition hover:-translate-y-0.5 hover:bg-[#45d2c5] sm:px-5">
            Join for ₹500
          </a>
        </div>
      </header>

      <section className="relative isolate min-h-[780px] overflow-hidden border-b border-white/10 bg-[#080b0b] pt-28 sm:min-h-[820px] sm:pt-32">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(20,184,166,0.14),transparent_32%,rgba(249,112,102,0.13)_70%,rgba(132,204,22,0.09))]" />
        <div className="absolute left-[10%] top-28 h-[28rem] w-[28rem] rounded-full bg-aqua/20 blur-[120px]" />
        <div className="absolute bottom-[-12rem] right-[-7rem] h-[34rem] w-[34rem] rounded-full bg-coral/20 blur-[130px]" />
        <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
        <div className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.06]" />

        <div className="relative mx-auto flex max-w-7xl flex-col items-center px-4 pb-20 pt-20 text-center sm:px-6 sm:pb-24 lg:px-8 lg:pt-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white/80 backdrop-blur-sm">
            <Sparkles size={14} className="text-lime" />
            {eventConfig.eyebrow}
          </div>

          <div className="mt-8 flex items-center gap-3 rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-amber-100">
            <CalendarDays size={18} className="text-amber-300" />
            <time dateTime={eventConfig.isoDate}>{eventConfig.date}</time>
          </div>

          <h1 className="mt-7 max-w-5xl text-balance text-5xl font-black leading-[0.94] tracking-[-0.065em] text-white sm:text-7xl lg:text-[6.7rem]">
            Where lifestyle
            <span className="block bg-gradient-to-r from-aqua via-white to-coral bg-clip-text text-transparent"> comes alive.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-balance text-lg leading-8 text-white/70 sm:text-xl">
            {eventConfig.description} One date. One room. A world of people ready to make more of every moment.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <a href="#pay" className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-base font-bold text-[#111817] shadow-2xl shadow-white/10 transition hover:-translate-y-1 hover:bg-aqua sm:px-7">
              Reserve your invitation <ArrowRight size={19} className="transition group-hover:translate-x-1" />
            </a>
            <a href="#how-to-join" className="inline-flex items-center gap-2 px-5 py-4 text-base font-semibold text-white/75 transition hover:text-white">
              See how it works <ArrowDown size={18} />
            </a>
          </div>

          <div className="mt-16 grid w-full max-w-3xl grid-cols-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] text-left backdrop-blur-sm">
            {[
              { value: '25', label: 'November 2026' },
              { value: '₹500', label: 'UPI entry fee' },
              { value: '1', label: 'verified invitation' },
            ].map((item, index) => (
              <div key={item.label} className={`px-4 py-5 sm:px-7 ${index !== 0 ? 'border-l border-white/10' : ''}`}>
                <p className="text-2xl font-black tracking-tight text-white sm:text-3xl">{item.value}</p>
                <p className="mt-1 text-xs font-medium leading-5 text-white/55 sm:text-sm">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="experience" className="scroll-mt-8 bg-[#f7f8f4] py-20 text-[#111817] sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.76fr_1.24fr] lg:gap-20">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-aqua-deep">Not another ordinary gathering</p>
              <h2 className="mt-5 max-w-md text-balance text-4xl font-black tracking-[-0.055em] sm:text-5xl">Feel the app beyond the screen.</h2>
              <p className="mt-6 max-w-md text-base leading-7 text-[#5c6965]">Knock is built around the things that make life fuller: the right people, the next discovery, and the confidence to say yes. This event brings that energy together in one place.</p>
              <a href="#pay" className="mt-8 inline-flex items-center gap-2 font-bold text-aqua-deep transition hover:gap-3">
                Get your invitation <ArrowRight size={18} />
              </a>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {experiencePillars.map((pillar) => {
                const Icon = pillar.icon;
                const accents = {
                  aqua: 'bg-aqua/10 text-aqua-deep',
                  coral: 'bg-coral/10 text-coral-deep',
                  lime: 'bg-lime/15 text-lime-deep',
                } as const;
                return (
                  <article key={pillar.number} className="group rounded-[1.75rem] border border-[#e1e9e5] bg-white p-6 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#1a3530]/10 sm:p-7">
                    <div className="flex items-center justify-between">
                      <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${accents[pillar.accent]}`}><Icon size={22} /></span>
                      <span className="text-sm font-black text-[#c6d2ce]">{pillar.number}</span>
                    </div>
                    <h3 className="mt-12 text-xl font-bold tracking-tight">{pillar.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-[#66736f]">{pillar.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="how-to-join" className="scroll-mt-8 bg-[#111817] py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-aqua">Simple by design</p>
            <h2 className="mt-5 text-balance text-4xl font-black tracking-[-0.055em] text-white sm:text-5xl">Three steps to your seat.</h2>
            <p className="mt-5 text-lg leading-8 text-white/60">No confusing checkout. A secure UPI payment, a quick proof, then your invitation.</p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {paymentSteps.map((step, index) => (
              <article key={step.title} className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-7 sm:p-8">
                <span className="absolute -right-3 -top-10 text-[9rem] font-black tracking-[-0.08em] text-white/[0.035]">0{index + 1}</span>
                <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-aqua text-sm font-black text-[#08231f]">0{index + 1}</span>
                <h3 className="relative mt-16 text-2xl font-bold tracking-tight text-white">{step.title}</h3>
                <p className="relative mt-3 max-w-sm text-sm leading-7 text-white/60">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <EventPaymentPanel />

      <section id="faq" className="scroll-mt-8 border-t border-white/10 bg-[#080b0b] py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-aqua">Good to know</p>
            <h2 className="mt-5 text-4xl font-black tracking-[-0.055em] text-white sm:text-5xl">A few quick answers.</h2>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {faqs.map((faq) => (
              <article key={faq.question} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <h3 className="flex gap-3 font-bold text-white"><CircleDot className="mt-0.5 shrink-0 text-aqua" size={17} />{faq.question}</h3>
                <p className="mt-3 pl-7 text-sm leading-6 text-white/60">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-aqua px-4 py-16 text-[#08231f] sm:px-6 sm:py-20 lg:px-8">
        <div className="absolute left-[10%] top-0 h-56 w-56 rounded-full bg-lime/50 blur-3xl" />
        <div className="absolute bottom-0 right-[12%] h-56 w-56 rounded-full bg-coral/40 blur-3xl" />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center justify-between gap-8 text-center md:flex-row md:text-left">
          <div>
            <div className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-[#16534c] md:justify-start"><Ticket size={17} /> 25 November 2026</div>
            <h2 className="mt-3 text-balance text-4xl font-black tracking-[-0.06em] sm:text-5xl">Make this one count.</h2>
          </div>
          <a href="#pay" className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[#0a2420] px-6 py-4 font-bold text-white shadow-xl shadow-[#0a2420]/20 transition hover:-translate-y-1 hover:bg-black">
            Pay ₹500 with UPI <ArrowRight size={19} />
          </a>
        </div>
      </section>

      <footer className="bg-[#080b0b] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <a href="/" className="inline-flex items-center gap-2 text-sm font-bold text-white/90"><Zap size={16} className="text-aqua" /> Knock</a>
          <p className="text-xs text-white/45">{eventConfig.name} · {eventConfig.date} · Invitation issued after payment verification.</p>
          <a href="#pay" className="inline-flex items-center gap-1.5 text-xs font-semibold text-aqua transition hover:text-white"><CheckCircle2 size={15} /> Join the experience</a>
        </div>
      </footer>
    </main>
  );
}
