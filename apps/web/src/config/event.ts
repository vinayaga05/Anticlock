const readPublicValue = (value: string | undefined) => value?.trim() ?? '';

export const eventConfig = {
  name: readPublicValue(process.env.NEXT_PUBLIC_EVENT_NAME) || 'Anticlock Sports, Health & Fitness Academy',
  eyebrow: 'Mupperum Vizha · 10th Annual Celebration',
  date: 'Wednesday, 25 November 2026',
  isoDate: '2026-11-25',
  fee: 500,
  currency: 'INR',
  description:
    'A fitness, health and sports celebration with expert seminars, achiever awards and community learning.',
};

/**
 * These values are intentionally public: they are shown on the event page and
 * used to compose UPI, WhatsApp, and email links. Keep the actual payment
 * destination and attendee support contacts in deployment environment vars.
 */
export const eventPayment = {
  upiId: readPublicValue(process.env.NEXT_PUBLIC_EVENT_UPI_ID),
  payeeName: readPublicValue(process.env.NEXT_PUBLIC_EVENT_PAYEE_NAME) || 'Knock Events',
  qrImageUrl: readPublicValue(process.env.NEXT_PUBLIC_EVENT_QR_IMAGE_URL),
  whatsappNumber: readPublicValue(process.env.NEXT_PUBLIC_EVENT_WHATSAPP_NUMBER),
  email: readPublicValue(process.env.NEXT_PUBLIC_EVENT_EMAIL),
};

export function getUpiPaymentLink() {
  if (!eventPayment.upiId) {
    return '';
  }

  const parameters = new URLSearchParams({
    pa: eventPayment.upiId,
    pn: eventPayment.payeeName,
    am: String(eventConfig.fee),
    cu: eventConfig.currency,
    tn: `${eventConfig.name} entry`,
  });

  return `upi://pay?${parameters.toString()}`;
}

export function getPaymentProofMessage() {
  return [
    `Hi! I have paid ₹${eventConfig.fee} for ${eventConfig.name}.`,
    `வணக்கம்! ${eventConfig.name} நிகழ்விற்காக ₹${eventConfig.fee} செலுத்தியுள்ளேன்.`,
    'My UPI transaction ID is: [add transaction ID]',
    'எனது UPI பரிவர்த்தனை எண்: [பரிவர்த்தனை எண்ணை சேர்க்கவும்]',
    'I have attached my payment screenshot. Please send my invitation on WhatsApp and email.',
  ].join('\n');
}

export function getWhatsAppProofLink() {
  const number = eventPayment.whatsappNumber.replace(/\D/g, '');

  return number ? `https://wa.me/${number}?text=${encodeURIComponent(getPaymentProofMessage())}` : '';
}

export function getEmailProofLink() {
  if (!eventPayment.email) {
    return '';
  }

  const subject = `Payment proof — ${eventConfig.name}`;
  return `mailto:${eventPayment.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(getPaymentProofMessage())}`;
}
