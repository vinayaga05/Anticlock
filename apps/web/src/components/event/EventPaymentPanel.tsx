'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Check,
  Copy,
  ExternalLink,
  Mail,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Ticket,
} from 'lucide-react';
import {
  eventConfig,
  eventPayment,
  getEmailProofLink,
  getUpiPaymentLink,
  getWhatsAppProofLink,
} from '@/config/event';

function ProofLink({
  href,
  children,
  className,
  disabledTitle,
}: {
  href: string;
  children: React.ReactNode;
  className: string;
  disabledTitle: string;
}) {
  if (!href) {
    return (
      <span
        aria-disabled="true"
        className={`${className} cursor-not-allowed opacity-45`}
        title={disabledTitle}
      >
        {children}
      </span>
    );
  }

  return (
    <a href={href} className={className} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
      {children}
    </a>
  );
}

const paymentCopy = {
  en: {
    admission: 'Event admission',
    title: 'Your invitation starts here.',
    description: 'Pay the entry fee with any UPI app. Then send your screenshot or transaction ID so our team can verify it and share your invitation.',
    oneEntry: 'one entry · UPI only',
    steps: ['Scan the QR or open your preferred UPI app.', 'Pay the exact entry fee of ₹500.', 'Share the proof of payment below.'],
    verified: 'Payment is verified manually. Your spot is confirmed when you receive the invitation from the event team.',
    scan: 'Scan to pay',
    pay: 'Pay ₹500 by UPI',
    apps: 'Works with Google Pay, PhonePe, Paytm, BHIM, and other UPI apps.',
    qrAlt: 'UPI QR code',
    qrComing: 'Your UPI QR will appear here',
    qrDemo: 'This live demo keeps payment disabled until the event team adds real UPI details.',
    upiComing: 'UPI ID coming soon',
    openUpi: 'Open a UPI app',
    demo: 'Demo mode — the organizer’s UPI details are being set up.',
    paid: 'Already paid?',
    proof: 'Send the screenshot or UPI transaction ID. We’ll reply with your invitation through WhatsApp and email after verification.',
    whatsapp: 'Send on WhatsApp',
    email: 'Email proof',
    contactsDemo: 'Demo mode keeps proof-of-payment links disabled until event contact details are added.',
    copy: 'Copy UPI ID',
    copied: 'UPI ID copied',
    disabledTitle: 'Event contact details must be added before this action can be used.',
  },
  ta: {
    admission: 'நிகழ்வு பதிவு',
    title: 'உங்கள் அழைப்பிதழ் இங்கே தொடங்குகிறது.',
    description: 'எந்த UPI செயலியிலும் பதிவுக் கட்டணத்தை செலுத்துங்கள். பின்னர் ஸ்கிரீன்ஷாட் அல்லது பரிவர்த்தனை எண்ணை பகிருங்கள்; எங்கள் குழு சரிபார்த்து அழைப்பிதழை அனுப்பும்.',
    oneEntry: 'ஒரு பதிவு · UPI மட்டும்',
    steps: ['QR குறியீட்டை ஸ்கேன் செய்யுங்கள் அல்லது விருப்பமான UPI செயலியைத் திறக்கவும்.', '₹500 பதிவுக் கட்டணத்தை செலுத்துங்கள்.', 'பணம் செலுத்திய ஆதாரத்தை கீழே பகிருங்கள்.'],
    verified: 'பணம் செலுத்தியது கைமுறையாகச் சரிபார்க்கப்படும். நிகழ்வுக் குழுவிடமிருந்து அழைப்பிதழ் வந்ததும் உங்கள் இடம் உறுதியாகும்.',
    scan: 'செலுத்த ஸ்கேன் செய்யவும்',
    pay: 'UPI மூலம் ₹500 செலுத்துங்கள்',
    apps: 'Google Pay, PhonePe, Paytm, BHIM மற்றும் மற்ற UPI செயலிகளுடன் செயல்படும்.',
    qrAlt: 'UPI QR குறியீடு',
    qrComing: 'உங்கள் UPI QR இங்கே வரும்',
    qrDemo: 'நிகழ்வுக் குழு உண்மையான UPI விவரங்களைச் சேர்க்கும் வரை இந்த நேரடி டெமோவில் பணம் செலுத்துதல் முடக்கப்பட்டுள்ளது.',
    upiComing: 'UPI ஐடி விரைவில் வரும்',
    openUpi: 'UPI செயலியைத் திறக்கவும்',
    demo: 'டெமோ நிலை — ஒருங்கிணைப்பாளரின் UPI விவரங்கள் அமைக்கப்படுகின்றன.',
    paid: 'ஏற்கனவே செலுத்திவிட்டீர்களா?',
    proof: 'பணம் செலுத்திய ஸ்கிரீன்ஷாட் அல்லது UPI பரிவர்த்தனை எண்ணை அனுப்புங்கள். சரிபார்த்த பிறகு WhatsApp மற்றும் மின்னஞ்சல் மூலம் அழைப்பிதழை அனுப்புவோம்.',
    whatsapp: 'WhatsApp-ல் அனுப்பவும்',
    email: 'மின்னஞ்சல் ஆதாரம்',
    contactsDemo: 'நிகழ்வுத் தொடர்பு விவரங்கள் சேர்க்கப்படும் வரை டெமோ நிலையில் பணம் செலுத்திய ஆதார இணைப்புகள் முடக்கப்பட்டுள்ளன.',
    copy: 'UPI ஐடியை நகலெடுக்கவும்',
    copied: 'UPI ஐடி நகலெடுக்கப்பட்டது',
    disabledTitle: 'இந்த செயலைப் பயன்படுத்துவதற்கு முன் நிகழ்வுத் தொடர்பு விவரங்கள் சேர்க்கப்பட வேண்டும்.',
  },
} as const;

export function EventPaymentPanel({
  language = 'en',
  compact = false,
}: {
  language?: 'en' | 'ta';
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = paymentCopy[language];
  const upiLink = getUpiPaymentLink();
  const whatsappLink = getWhatsAppProofLink();
  const emailLink = getEmailProofLink();
  const hasUpiId = Boolean(eventPayment.upiId);
  const hasQr = Boolean(eventPayment.qrImageUrl || upiLink);
  const isDemoPayment = !hasQr;

  async function copyUpiId() {
    if (!eventPayment.upiId) {
      return;
    }

    try {
      await navigator.clipboard.writeText(eventPayment.upiId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  if (compact) {
    return (
      <section id="pay" aria-labelledby="payment-heading" className="relative scroll-mt-8 overflow-hidden bg-[#fff6e4] py-12 sm:py-16">
        <div className="absolute left-[7%] top-8 h-12 w-5 rotate-[28deg] rounded-full bg-[#20dac5]" />
        <div className="absolute bottom-8 right-[8%] text-4xl font-black text-[#ff684d]">✦</div>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[1.75rem] border-4 border-[#1b0b42] bg-white shadow-[0_24px_65px_rgba(61,20,86,0.18)]">
            <div className="grid lg:grid-cols-[1.05fr_0.95fr_0.9fr]">
              <div className="relative overflow-hidden bg-[#ff684d] p-6 text-[#1b0b42] sm:p-8">
                <div className="absolute -left-12 -top-16 h-44 w-44 rounded-full bg-[#ffc62a]/70 blur-3xl" />
                <div className="relative">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#1b0b42]/20 bg-white/45 px-3 py-1.5 text-xs font-black uppercase tracking-[0.15em]"><Ticket size={15} /> {copy.admission}</span>
                  <h2 id="payment-heading" className="mt-4 text-2xl font-black tracking-[-0.045em] sm:text-3xl">{copy.title}</h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-[#1b0b42]/75">{copy.description}</p>
                </div>
              </div>

              <div className="border-y-2 border-dashed border-[#1b0b42]/15 bg-[#fffdf8] p-6 sm:p-8 lg:border-x-2 lg:border-y-0">
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#8e72ff]">{copy.scan}</p><h3 className="mt-1 text-xl font-black text-[#1b0b42]">{copy.pay}</h3></div><span className="rounded-xl bg-[#20dac5] p-2.5 text-[#1b0b42]"><QrCode size={21} /></span></div>
                <div className="mt-5 flex items-center gap-4 rounded-2xl border border-dashed border-[#ff684d]/45 bg-[#fff8eb] p-4">
                  {eventPayment.qrImageUrl ? (
                    <img src={eventPayment.qrImageUrl} alt={`${copy.qrAlt} — ${eventConfig.name}`} className="h-24 w-24 rounded-xl bg-white object-contain p-2 shadow-sm" />
                  ) : upiLink ? (
                    <QRCodeSVG value={upiLink} size={96} level="H" includeMargin bgColor="#ffffff" fgColor="#101918" title={`${copy.qrAlt} — ${eventConfig.name}`} className="shrink-0 rounded-xl bg-white p-1 shadow-sm" />
                  ) : (
                    <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-[#8e72ff] text-white shadow-lg shadow-[#8e72ff]/25"><QrCode size={38} /></span>
                  )}
                  <div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.14em] text-[#8e72ff]">UPI ID</p><code className="mt-1 block truncate text-sm font-black text-[#1b0b42]">{eventPayment.upiId || copy.upiComing}</code>{!hasQr && <p className="mt-2 text-xs leading-5 text-[#685579]">{copy.qrDemo}</p>}</div>
                </div>
              </div>

              <div className="bg-[#f3efff] p-6 sm:p-8">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ffc62a] text-[#1b0b42]"><Check size={18} /></span>
                <h3 className="mt-4 font-black text-[#1b0b42]">{copy.paid}</h3>
                <p className="mt-2 text-sm leading-6 text-[#685579]">{copy.proof}</p>
                <div className="mt-4 grid gap-2">
                  <ProofLink href={whatsappLink} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#20b97f] px-3 py-2.5 text-sm font-black text-[#07352b] transition hover:bg-[#20dac5]" disabledTitle={copy.disabledTitle}><MessageCircle size={17} /> {copy.whatsapp}</ProofLink>
                  <ProofLink href={emailLink} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#dcd2eb] bg-white px-3 py-2.5 text-sm font-black text-[#1b0b42] transition hover:border-[#8e72ff]" disabledTitle={copy.disabledTitle}><Mail size={17} /> {copy.email}</ProofLink>
                </div>
                {!whatsappLink && !emailLink && <p className="mt-3 text-xs leading-5 text-[#8d789d]">{copy.contactsDemo}</p>}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="pay" aria-labelledby="payment-heading" className="relative scroll-mt-8 overflow-hidden bg-[#fff0d9] py-20 sm:py-28">
      <div className="absolute left-[4%] top-16 h-16 w-7 rotate-[32deg] rounded-full bg-[#20dac5]" />
      <div className="absolute right-[5%] top-20 text-5xl font-black text-[#ff684d]">✦</div>
      <div className="absolute bottom-12 right-[10%] h-8 w-20 -rotate-[27deg] rounded-full border-4 border-[#8e72ff]" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2rem] border-4 border-[#1b0b42] bg-[#1b0b42] shadow-[0_30px_90px_rgba(61,20,86,0.26)]">
          <div className="grid lg:grid-cols-[0.88fr_1.12fr]">
            <div className="relative overflow-hidden border-b-2 border-dashed border-[#1b0b42]/30 bg-[#ff684d] p-7 text-[#1b0b42] sm:p-10 lg:border-b-0 lg:border-r-2 lg:p-12">
              <div className="absolute -left-20 -top-16 h-64 w-64 rounded-full bg-[#ffc62a]/70 blur-3xl" />
              <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[#20dac5]/55 blur-3xl" />
              <div className="absolute right-8 top-9 h-12 w-3 rotate-[25deg] rounded-full bg-[#ffc62a]" />
              <div className="absolute bottom-10 right-10 h-5 w-16 -rotate-[18deg] rounded-full border-4 border-[#1b0b42]" />
              <div className="absolute -bottom-4 -right-4 hidden h-8 w-8 rounded-full bg-[#fff0d9] lg:block" />

              <div className="relative">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#1b0b42]/25 bg-white/40 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-[#1b0b42]">
                  <Ticket size={15} />
                  {copy.admission}
                </span>
                <h2 id="payment-heading" className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
                  {copy.title}
                </h2>
                <p className="mt-4 max-w-md text-base leading-7 text-[#1b0b42]/75">
                  {copy.description}
                </p>

                <div className="mt-8 flex items-end gap-4">
                  <span className="text-6xl font-black tracking-[-0.08em] sm:text-7xl">₹{eventConfig.fee}</span>
                  <span className="mb-2 text-sm font-bold text-[#1b0b42]/60">{copy.oneEntry}</span>
                </div>

                <ol className="mt-10 space-y-4 text-sm text-[#1b0b42]/80">
                  {copy.steps.map((step, index) => (
                    <li key={step} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1b0b42] text-xs font-black text-[#ffc62a]">
                        {index + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>

                <div className="mt-10 flex items-start gap-3 rounded-2xl border border-[#1b0b42]/15 bg-white/35 p-4 text-xs leading-5 text-[#1b0b42]/75">
                  <ShieldCheck className="mt-0.5 shrink-0 text-[#1b0b42]" size={17} />
                  <p>{copy.verified}</p>
                </div>
              </div>
            </div>

            <div className="bg-[#fff8eb] p-5 sm:p-8 lg:p-10">
              <div className="relative rounded-[1.5rem] border-2 border-dashed border-[#1b0b42]/20 bg-white p-5 shadow-[0_20px_55px_rgba(64,31,101,0.12)] sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8e72ff]">{copy.scan}</p>
                    <h3 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[#1b0b42]">{copy.pay}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#5b4775]">{copy.apps}</p>
                  </div>
                  <span className="rounded-2xl bg-[#20dac5] p-3 text-[#1b0b42]"><QrCode size={24} /></span>
                </div>

                <div className="relative my-7 flex min-h-[252px] items-center justify-center overflow-hidden rounded-[1.25rem] border-2 border-dashed border-[#ff684d]/45 bg-[radial-gradient(circle_at_20%_15%,#fff5c1,transparent_24%),radial-gradient(circle_at_85%_86%,#d9fff8,transparent_28%),#fff8eb] p-5">
                  <div className="absolute left-5 top-5 text-2xl text-[#ff684d]">✦</div>
                  <div className="absolute bottom-5 right-6 h-3 w-10 -rotate-[27deg] rounded-full bg-[#20dac5]" />
                  {eventPayment.qrImageUrl ? (
                    <img
                      src={eventPayment.qrImageUrl}
                      alt={`${copy.qrAlt} — ${eventConfig.name}`}
                      className="h-56 w-56 rounded-xl bg-white object-contain p-3 shadow-sm"
                    />
                  ) : upiLink ? (
                    <QRCodeSVG
                      value={upiLink}
                      size={224}
                      level="H"
                      includeMargin
                      bgColor="#ffffff"
                      fgColor="#101918"
                      title={`${copy.qrAlt} — ${eventConfig.name}`}
                      className="rounded-xl bg-white p-2 shadow-sm"
                    />
                  ) : (
                    <div className="max-w-[17rem] text-center">
                      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#8e72ff] text-white shadow-lg shadow-[#8e72ff]/25"><QrCode size={32} /></span>
                      <p className="mt-4 text-sm font-black text-[#1b0b42]">{copy.qrComing}</p>
                      <p className="mt-2 text-xs leading-5 text-[#685579]">{copy.qrDemo}</p>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-[#e3d9ee] bg-[#fff8eb] p-3">
                  <p className="px-1 text-xs font-black uppercase tracking-[0.14em] text-[#8e72ff]">UPI ID</p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-3 text-sm font-bold text-[#1b0b42] shadow-sm">
                      {eventPayment.upiId || copy.upiComing}
                    </code>
                    <button
                      type="button"
                      onClick={copyUpiId}
                      disabled={!hasUpiId}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1b0b42] text-white transition hover:bg-[#8e72ff] disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label={copied ? copy.copied : copy.copy}
                    >
                      {copied ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>

                {upiLink ? (
                  <a
                    href={upiLink}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1b0b42] px-4 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#8e72ff] hover:shadow-lg"
                  >
                    {copy.openUpi} <ExternalLink size={16} />
                  </a>
                ) : (
                  <span
                    aria-disabled="true"
                    className="mt-4 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-[#eadff0] px-4 py-3.5 text-sm font-bold text-[#907d9d]"
                  >
                    {copy.openUpi} <ExternalLink size={16} />
                  </span>
                )}
                {isDemoPayment && (
                  <p className="mt-3 text-center text-xs font-semibold text-[#8e72ff]">{copy.demo}</p>
                )}
              </div>

              <div id="payment-help" className="mt-5 rounded-[1.5rem] border-2 border-dashed border-[#e3d9ee] bg-white p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ffc62a] text-[#1b0b42]"><Check size={18} /></span>
                  <div>
                    <h3 className="font-black text-[#1b0b42]">{copy.paid}</h3>
                    <p className="mt-1 text-sm leading-6 text-[#685579]">{copy.proof}</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <ProofLink
                    href={whatsappLink}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#20b97f] px-4 py-3 text-sm font-black text-[#07352b] transition hover:bg-[#20dac5]"
                    disabledTitle={copy.disabledTitle}
                  >
                    <MessageCircle size={18} /> {copy.whatsapp}
                  </ProofLink>
                  <ProofLink
                    href={emailLink}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e3d9ee] bg-[#fbf7ff] px-4 py-3 text-sm font-black text-[#1b0b42] transition hover:border-[#8e72ff] hover:bg-[#f0e9ff]"
                    disabledTitle={copy.disabledTitle}
                  >
                    <Mail size={18} /> {copy.email}
                  </ProofLink>
                </div>
                {!whatsappLink && !emailLink && (
                  <p className="mt-4 text-center text-xs leading-5 text-[#8d789d]">{copy.contactsDemo}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
