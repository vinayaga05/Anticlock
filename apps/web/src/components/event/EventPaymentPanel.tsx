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
}: {
  href: string;
  children: React.ReactNode;
  className: string;
}) {
  if (!href) {
    return (
      <span
        aria-disabled="true"
        className={`${className} cursor-not-allowed opacity-45`}
        title="Add the event contact in the website environment settings to enable this action."
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

export function EventPaymentPanel() {
  const [copied, setCopied] = useState(false);
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
                  Event admission
                </span>
                <h2 id="payment-heading" className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
                  Your invitation starts here.
                </h2>
                <p className="mt-4 max-w-md text-base leading-7 text-[#1b0b42]/75">
                  Pay the entry fee with any UPI app. Then send your screenshot or transaction ID so our team can verify it and share your invitation.
                </p>

                <div className="mt-8 flex items-end gap-4">
                  <span className="text-6xl font-black tracking-[-0.08em] sm:text-7xl">₹{eventConfig.fee}</span>
                  <span className="mb-2 text-sm font-bold text-[#1b0b42]/60">one entry · UPI only</span>
                </div>

                <ol className="mt-10 space-y-4 text-sm text-[#1b0b42]/80">
                  {[
                    'Scan the QR or open your preferred UPI app.',
                    'Pay the exact entry fee of ₹500.',
                    'Share the proof of payment below.',
                  ].map((step, index) => (
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
                  <p>Payment is verified manually. Your spot is confirmed when you receive the invitation from the event team.</p>
                </div>
              </div>
            </div>

            <div className="bg-[#fff8eb] p-5 sm:p-8 lg:p-10">
              <div className="relative rounded-[1.5rem] border-2 border-dashed border-[#1b0b42]/20 bg-white p-5 shadow-[0_20px_55px_rgba(64,31,101,0.12)] sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8e72ff]">Scan to pay</p>
                    <h3 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[#1b0b42]">Pay ₹{eventConfig.fee} by UPI</h3>
                    <p className="mt-2 text-sm leading-6 text-[#5b4775]">Works with Google Pay, PhonePe, Paytm, BHIM, and other UPI apps.</p>
                  </div>
                  <span className="rounded-2xl bg-[#20dac5] p-3 text-[#1b0b42]"><QrCode size={24} /></span>
                </div>

                <div className="relative my-7 flex min-h-[252px] items-center justify-center overflow-hidden rounded-[1.25rem] border-2 border-dashed border-[#ff684d]/45 bg-[radial-gradient(circle_at_20%_15%,#fff5c1,transparent_24%),radial-gradient(circle_at_85%_86%,#d9fff8,transparent_28%),#fff8eb] p-5">
                  <div className="absolute left-5 top-5 text-2xl text-[#ff684d]">✦</div>
                  <div className="absolute bottom-5 right-6 h-3 w-10 -rotate-[27deg] rounded-full bg-[#20dac5]" />
                  {eventPayment.qrImageUrl ? (
                    <img
                      src={eventPayment.qrImageUrl}
                      alt={`UPI QR code for ${eventConfig.name}`}
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
                      title={`UPI QR code for ${eventConfig.name}`}
                      className="rounded-xl bg-white p-2 shadow-sm"
                    />
                  ) : (
                    <div className="max-w-[17rem] text-center">
                      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#8e72ff] text-white shadow-lg shadow-[#8e72ff]/25"><QrCode size={32} /></span>
                      <p className="mt-4 text-sm font-black text-[#1b0b42]">Your UPI QR will appear here</p>
                      <p className="mt-2 text-xs leading-5 text-[#685579]">This live demo keeps payment disabled until the event team adds real UPI details.</p>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-[#e3d9ee] bg-[#fff8eb] p-3">
                  <p className="px-1 text-xs font-black uppercase tracking-[0.14em] text-[#8e72ff]">UPI ID</p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-3 text-sm font-bold text-[#1b0b42] shadow-sm">
                      {eventPayment.upiId || 'UPI ID coming soon'}
                    </code>
                    <button
                      type="button"
                      onClick={copyUpiId}
                      disabled={!hasUpiId}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1b0b42] text-white transition hover:bg-[#8e72ff] disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label={copied ? 'UPI ID copied' : 'Copy UPI ID'}
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
                    Open a UPI app <ExternalLink size={16} />
                  </a>
                ) : (
                  <span
                    aria-disabled="true"
                    className="mt-4 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-[#eadff0] px-4 py-3.5 text-sm font-bold text-[#907d9d]"
                  >
                    Open a UPI app <ExternalLink size={16} />
                  </span>
                )}
                {isDemoPayment && (
                  <p className="mt-3 text-center text-xs font-semibold text-[#8e72ff]">Demo mode — the organizer&apos;s UPI details are being set up.</p>
                )}
              </div>

              <div id="payment-help" className="mt-5 rounded-[1.5rem] border-2 border-dashed border-[#e3d9ee] bg-white p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ffc62a] text-[#1b0b42]"><Check size={18} /></span>
                  <div>
                    <h3 className="font-black text-[#1b0b42]">Already paid?</h3>
                    <p className="mt-1 text-sm leading-6 text-[#685579]">Send the screenshot or UPI transaction ID. We&apos;ll reply with your invitation through WhatsApp and email after verification.</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <ProofLink
                    href={whatsappLink}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#20b97f] px-4 py-3 text-sm font-black text-[#07352b] transition hover:bg-[#20dac5]"
                  >
                    <MessageCircle size={18} /> Send on WhatsApp
                  </ProofLink>
                  <ProofLink
                    href={emailLink}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e3d9ee] bg-[#fbf7ff] px-4 py-3 text-sm font-black text-[#1b0b42] transition hover:border-[#8e72ff] hover:bg-[#f0e9ff]"
                  >
                    <Mail size={18} /> Email proof
                  </ProofLink>
                </div>
                {!whatsappLink && !emailLink && (
                  <p className="mt-4 text-center text-xs leading-5 text-[#8d789d]">Demo mode keeps proof-of-payment links disabled until event contact details are added.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
