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
  WalletCards,
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
    <section id="pay" aria-labelledby="payment-heading" className="scroll-mt-8 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] border border-aqua/25 bg-[#0f1717] shadow-[0_30px_100px_rgba(20,184,166,0.16)]">
          <div className="grid lg:grid-cols-[0.88fr_1.12fr]">
            <div className="relative overflow-hidden border-b border-white/10 p-7 sm:p-10 lg:border-b-0 lg:border-r lg:p-12">
              <div className="absolute -left-24 -top-16 h-64 w-64 rounded-full bg-aqua/20 blur-3xl" />
              <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-coral/15 blur-3xl" />

              <div className="relative">
                <span className="inline-flex items-center gap-2 rounded-full border border-aqua/30 bg-aqua/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-aqua">
                  <WalletCards size={15} />
                  UPI payment
                </span>
                <h2 id="payment-heading" className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Your invitation starts here.
                </h2>
                <p className="mt-4 max-w-md text-base leading-7 text-white/65">
                  Pay the entry fee with any UPI app. Then send your screenshot or transaction ID so our team can verify it and share your invitation.
                </p>

                <div className="mt-8 flex items-end gap-4">
                  <span className="text-6xl font-black tracking-[-0.08em] text-white sm:text-7xl">₹{eventConfig.fee}</span>
                  <span className="mb-2 text-sm font-medium text-white/55">one entry · UPI only</span>
                </div>

                <ol className="mt-10 space-y-4 text-sm text-white/75">
                  {[
                    'Scan the QR or open your preferred UPI app.',
                    'Pay the exact entry fee of ₹500.',
                    'Share the proof of payment below.',
                  ].map((step, index) => (
                    <li key={step} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-aqua">
                        {index + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>

                <div className="mt-10 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-5 text-white/55">
                  <ShieldCheck className="mt-0.5 shrink-0 text-lime" size={17} />
                  <p>Payment is verified manually. Your spot is confirmed when you receive the invitation from the event team.</p>
                </div>
              </div>
            </div>

            <div className="bg-[#f8faf9] p-5 sm:p-8 lg:p-10">
              <div className="rounded-[1.5rem] border border-black/5 bg-white p-5 shadow-[0_20px_55px_rgba(15,23,23,0.10)] sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-aqua-deep">Scan to pay</p>
                    <h3 className="mt-2 text-2xl font-bold tracking-tight text-[#101918]">Pay ₹{eventConfig.fee} by UPI</h3>
                    <p className="mt-2 text-sm leading-6 text-[#50605e]">Works with Google Pay, PhonePe, Paytm, BHIM, and other UPI apps.</p>
                  </div>
                  <span className="rounded-2xl bg-aqua/10 p-3 text-aqua-deep"><QrCode size={24} /></span>
                </div>

                <div className="my-7 flex min-h-[252px] items-center justify-center rounded-[1.25rem] border border-dashed border-[#c7d5d1] bg-[#f5f8f7] p-5">
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
                      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-aqua/10 text-aqua-deep"><QrCode size={32} /></span>
                      <p className="mt-4 text-sm font-semibold text-[#1d2927]">Your UPI QR will appear here</p>
                      <p className="mt-2 text-xs leading-5 text-[#65736f]">Add the event UPI ID or organizer QR in the site configuration before publishing.</p>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-[#e2eae7] bg-[#f8faf9] p-3">
                  <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#71817d]">UPI ID</p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-3 text-sm font-semibold text-[#15201e] shadow-sm">
                      {eventPayment.upiId || 'Add NEXT_PUBLIC_EVENT_UPI_ID'}
                    </code>
                    <button
                      type="button"
                      onClick={copyUpiId}
                      disabled={!hasUpiId}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#15201e] text-white transition hover:bg-aqua-deep disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label={copied ? 'UPI ID copied' : 'Copy UPI ID'}
                    >
                      {copied ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>

                <a
                  href={upiLink || '#payment-help'}
                  aria-disabled={!upiLink}
                  className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold transition ${
                    upiLink
                      ? 'bg-[#15201e] text-white hover:-translate-y-0.5 hover:bg-aqua-deep hover:shadow-lg'
                      : 'cursor-not-allowed bg-[#dce5e2] text-[#82908c]'
                  }`}
                >
                  Open a UPI app <ExternalLink size={16} />
                </a>
                {!hasQr && (
                  <p className="mt-3 text-center text-xs text-[#71817d]">The organizer&apos;s UPI details are not configured yet.</p>
                )}
              </div>

              <div id="payment-help" className="mt-5 rounded-[1.5rem] border border-[#e2eae7] bg-white p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-coral/10 text-coral-deep"><Check size={18} /></span>
                  <div>
                    <h3 className="font-bold text-[#15201e]">Already paid?</h3>
                    <p className="mt-1 text-sm leading-6 text-[#61706c]">Send the screenshot or UPI transaction ID. We&apos;ll reply with your invitation through WhatsApp and email after verification.</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <ProofLink
                    href={whatsappLink}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1c9b5f] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#16834f]"
                  >
                    <MessageCircle size={18} /> Send on WhatsApp
                  </ProofLink>
                  <ProofLink
                    href={emailLink}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d7e3df] bg-white px-4 py-3 text-sm font-bold text-[#1b2825] transition hover:border-aqua hover:bg-aqua/5"
                  >
                    <Mail size={18} /> Email proof
                  </ProofLink>
                </div>
                {!whatsappLink && !emailLink && (
                  <p className="mt-4 text-center text-xs leading-5 text-[#75837f]">Add the WhatsApp number and email address in the event configuration to enable proof-of-payment links.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
