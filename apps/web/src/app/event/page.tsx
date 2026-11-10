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
    <main className="min-h-screen overflow-hidden bg-[#fff4df] text-[#160b31]">
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

      <section className="relative isolate overflow-hidden bg-[#1b0b42] pt-28 sm:pt-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(31,215,192,0.94),transparent_19%),radial-gradient(circle_at_87%_18%,rgba(255,194,34,0.94),transparent_22%),radial-gradient(circle_at_86%_84%,rgba(255,95,76,0.96),transparent_28%),linear-gradient(135deg,#1b0b42_12%,#35125f_48%,#1b0b42_100%)]" />
        <div className="absolute left-[4%] top-[28%] h-16 w-7 rotate-[28deg] rounded-full bg-[#ffc62a]" />
        <div className="absolute left-[12%] top-[66%] h-6 w-16 -rotate-[36deg] rounded-full border-4 border-[#20dac5]" />
        <div className="absolute right-[7%] top-[23%] h-9 w-9 rotate-45 rounded-[0.7rem] bg-[#ff684d]" />
        <div className="absolute bottom-[12%] right-[14%] h-7 w-7 rounded-full bg-[#8e72ff]" />
        <div className="absolute bottom-[20%] left-[3%] text-5xl font-black text-[#ff684d]">✦</div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 sm:pb-24 lg:grid-cols-[1fr_0.9fr] lg:gap-16 lg:px-8 lg:pb-28 lg:pt-16">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white backdrop-blur-sm">
              <Sparkles size={14} className="text-[#ffc62a]" />
              {eventConfig.eyebrow}
            </div>

            <div className="mt-7 flex items-center justify-center gap-3 text-sm font-bold text-[#ffdc65] lg:justify-start">
              <CalendarDays size={18} />
              <time dateTime={eventConfig.isoDate}>{eventConfig.date}</time>
            </div>

            <h1 className="mt-5 max-w-3xl text-balance text-5xl font-black leading-[0.9] tracking-[-0.07em] text-white sm:text-7xl lg:text-[5.7rem]">
              A bright night
              <span className="block font-serif text-[#ffc62a] italic tracking-[-0.055em]">to feel alive.</span>
            </h1>
            <p className="mx-auto mt-7 max-w-xl text-balance text-lg leading-8 text-white/80 sm:text-xl lg:mx-0">
              {eventConfig.description} Come for the energy, stay for the people and the stories you&apos;ll make together.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
              <a href="#pay" className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-[#ffc62a] px-6 py-4 text-base font-black text-[#1b0b42] shadow-xl shadow-[#08001c]/30 transition hover:-translate-y-1 hover:bg-white sm:px-7">
                Reserve your invitation <ArrowRight size={19} className="transition group-hover:translate-x-1" />
              </a>
              <a href="#how-to-join" className="inline-flex items-center gap-2 px-5 py-4 text-base font-semibold text-white/80 transition hover:text-white">
                See how it works <ArrowDown size={18} />
              </a>
            </div>

            <div className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm font-semibold text-white/75 lg:justify-start">
              <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#20dac5]" /> Communities</span>
              <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#ff684d]" /> Clips</span>
              <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#ffc62a]" /> Real connection</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md py-5 sm:max-w-[31rem]">
            <div className="absolute -left-5 top-8 h-28 w-28 rounded-full bg-[#20dac5] blur-2xl" />
            <div className="absolute -bottom-4 -right-4 h-36 w-36 rounded-full bg-[#ff684d] blur-2xl" />
            <div className="relative overflow-hidden rounded-[2.35rem] bg-[#ffc62a] p-2 shadow-[0_30px_80px_rgba(4,0,18,0.42)] rotate-[-2deg] transition duration-500 hover:rotate-0">
              <div className="relative overflow-hidden rounded-[1.9rem] bg-[#fff7e9] p-6 text-[#1b0b42] sm:p-8">
                <div className="absolute inset-x-0 top-0 h-4 bg-[repeating-linear-gradient(135deg,#ff684d_0_13px,#fff7e9_13px_24px,#20dac5_24px_37px)]" />
                <div className="absolute -left-4 top-[56%] h-8 w-8 rounded-full bg-[#35125f]" />
                <div className="absolute -right-4 top-[56%] h-8 w-8 rounded-full bg-[#35125f]" />
                <div className="absolute right-7 top-8 text-3xl text-[#ff684d]">✦</div>
                <div className="absolute bottom-9 left-8 h-10 w-3 rotate-[29deg] rounded-full bg-[#20dac5]" />
                <div className="absolute bottom-10 right-8 h-4 w-12 -rotate-[24deg] rounded-full border-2 border-[#8e72ff]" />

                <div className="relative pt-3">
                  <div className="flex items-center justify-between text-[0.65rem] font-black uppercase tracking-[0.2em] text-[#704dba]">
                    <span>Knock presents</span>
                    <span>Admit one</span>
                  </div>
                  <div className="mt-8 flex items-end gap-4">
                    <span className="text-[7.5rem] font-black leading-[0.7] tracking-[-0.12em] text-[#ff684d] sm:text-[9rem]">25</span>
                    <div className="pb-1">
                      <p className="text-sm font-black uppercase tracking-[0.18em] text-[#1b0b42]">November</p>
                      <p className="mt-1 text-2xl font-black tracking-tight text-[#8e72ff]">2026</p>
                    </div>
                  </div>
                  <div className="mt-8 border-y-2 border-dashed border-[#1b0b42]/20 py-5">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[#704dba]">The Anticlock Experience</p>
                    <p className="mt-2 text-4xl font-black tracking-[-0.06em] text-[#1b0b42] sm:text-5xl">Knock Live</p>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-[#4d386f]">An invitation to step out, meet up, and make a little more of life.</p>
                  </div>
                  <div className="mt-6 flex items-end justify-between">
                    <div>
                      <p className="text-[0.65rem] font-black uppercase tracking-[0.17em] text-[#704dba]">Entry pass</p>
                      <p className="mt-1 text-3xl font-black text-[#1b0b42]">₹{eventConfig.fee}</p>
                    </div>
                    <div className="rounded-2xl bg-[#1b0b42] px-4 py-3 text-right text-xs font-bold text-white shadow-lg">
                      <p className="text-[#20dac5]">UPI entry</p>
                      <p className="mt-1 text-white/70">verification required</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="experience" className="scroll-mt-8 bg-[#fff0d9] py-20 text-[#1b0b42] sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.76fr_1.24fr] lg:gap-20">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e9523d]">Not another ordinary gathering</p>
              <h2 className="mt-5 max-w-md text-balance text-4xl font-black tracking-[-0.055em] sm:text-5xl">Feel the app beyond the screen.</h2>
              <p className="mt-6 max-w-md text-base leading-7 text-[#5c6965]">Knock is built around the things that make life fuller: the right people, the next discovery, and the confidence to say yes. This event brings that energy together in one place.</p>
              <a href="#pay" className="mt-8 inline-flex items-center gap-2 font-bold text-[#df4939] transition hover:gap-3">
                Get your invitation <ArrowRight size={18} />
              </a>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {experiencePillars.map((pillar) => {
                const Icon = pillar.icon;
                const accents = {
                  aqua: 'border-[#20dac5]/35 bg-[#d9fff8] text-[#087e72]',
                  coral: 'border-[#ff684d]/35 bg-[#ffe0d8] text-[#d44736]',
                  lime: 'border-[#ffc62a]/35 bg-[#fff3bc] text-[#9a6700]',
                } as const;
                return (
                  <article key={pillar.number} className={`group rounded-[1.75rem] border p-6 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#35125f]/10 sm:p-7 ${accents[pillar.accent]}`}>
                    <div className="flex items-center justify-between">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/75 shadow-sm"><Icon size={22} /></span>
                      <span className="text-sm font-black text-[#1b0b42]/35">{pillar.number}</span>
                    </div>
                    <h3 className="mt-12 text-xl font-bold tracking-tight">{pillar.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-[#1b0b42]/65">{pillar.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="how-to-join" className="scroll-mt-8 bg-[#32115e] py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#20dac5]">Simple by design</p>
            <h2 className="mt-5 text-balance text-4xl font-black tracking-[-0.055em] text-white sm:text-5xl">Three steps to your seat.</h2>
            <p className="mt-5 text-lg leading-8 text-white/60">No confusing checkout. A secure UPI payment, a quick proof, then your invitation.</p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {paymentSteps.map((step, index) => {
              const cardColors = ['bg-[#ff684d] text-[#2c083e]', 'bg-[#20dac5] text-[#092d39]', 'bg-[#ffc62a] text-[#2c083e]'];
              return (
              <article key={step.title} className={`relative overflow-hidden rounded-[1.75rem] p-7 shadow-xl shadow-black/10 sm:p-8 ${cardColors[index]}`}>
                <span className="absolute -right-3 -top-10 text-[9rem] font-black tracking-[-0.08em] text-black/[0.08]">0{index + 1}</span>
                <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 text-sm font-black">0{index + 1}</span>
                <h3 className="relative mt-16 text-2xl font-bold tracking-tight">{step.title}</h3>
                <p className="relative mt-3 max-w-sm text-sm leading-7 text-current/75">{step.description}</p>
              </article>
              );
            })}
          </div>
        </div>
      </section>

      <EventPaymentPanel />

      <section id="faq" className="relative scroll-mt-8 overflow-hidden bg-[#0b7696] py-20 sm:py-28">
        <div className="absolute left-[7%] top-16 h-8 w-20 -rotate-[30deg] rounded-full border-4 border-[#ffc62a]" />
        <div className="absolute bottom-14 right-[7%] text-5xl font-black text-[#ff684d]">✦</div>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#fff0a7]">Good to know</p>
            <h2 className="mt-5 text-4xl font-black tracking-[-0.055em] text-white sm:text-5xl">A few quick answers.</h2>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {faqs.map((faq, index) => (
              <article key={faq.question} className={`rounded-2xl border-2 p-6 shadow-lg ${index % 2 === 0 ? 'border-[#fff3c5] bg-[#fff8eb] text-[#1b0b42]' : 'border-[#1b0b42]/20 bg-[#20dac5] text-[#092d39]'}`}>
                <h3 className="flex gap-3 font-black"><CircleDot className="mt-0.5 shrink-0 text-[#ff684d]" size={17} />{faq.question}</h3>
                <p className="mt-3 pl-7 text-sm leading-6 text-current/70">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#ffc62a] px-4 py-16 text-[#1b0b42] sm:px-6 sm:py-20 lg:px-8">
        <div className="absolute left-[10%] top-0 h-56 w-56 rounded-full bg-[#20dac5]/70 blur-3xl" />
        <div className="absolute bottom-0 right-[12%] h-56 w-56 rounded-full bg-[#ff684d]/55 blur-3xl" />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center justify-between gap-8 text-center md:flex-row md:text-left">
          <div>
            <div className="flex items-center justify-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-[#704dba] md:justify-start"><Ticket size={17} /> 25 November 2026</div>
            <h2 className="mt-3 text-balance text-4xl font-black tracking-[-0.06em] sm:text-5xl">Make this one count.</h2>
          </div>
          <a href="#pay" className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[#1b0b42] px-6 py-4 font-black text-white shadow-xl shadow-[#1b0b42]/25 transition hover:-translate-y-1 hover:bg-[#8e72ff]">
            Pay ₹500 with UPI <ArrowRight size={19} />
          </a>
        </div>
      </section>

      <footer className="bg-[#1b0b42] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <a href="/" className="inline-flex items-center gap-2 text-sm font-bold text-white/90"><Zap size={16} className="text-[#ffc62a]" /> Knock</a>
          <p className="text-xs text-white/45">{eventConfig.name} · {eventConfig.date} · Invitation issued after payment verification.</p>
          <a href="#pay" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#20dac5] transition hover:text-white"><CheckCircle2 size={15} /> Join the experience</a>
        </div>
      </footer>
    </main>
  );
}
