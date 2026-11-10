const readPublicValue = (value: string | undefined) => value?.trim() ?? '';

export const eventConfig = {
  name: readPublicValue(process.env.NEXT_PUBLIC_EVENT_NAME) || 'Knock Live 2026',
  eyebrow: 'The Anticlock Experience',
  date: 'Wednesday, 25 November 2026',
  isoDate: '2026-11-25',
  fee: 500,
  currency: 'INR',
  description:
    'A grand Knock gathering for people who discover, connect, and bring their lifestyle to life.',
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
    'My UPI transaction ID is: [add transaction ID]',
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
