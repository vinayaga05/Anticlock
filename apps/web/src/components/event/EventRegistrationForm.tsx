'use client';

import { useState, type FormEvent } from 'react';
import { ArrowDown, CheckCircle2, GraduationCap, Phone, UserRound } from 'lucide-react';
import { EventArtwork } from '@/components/event/EventArtwork';
import { EventReveal } from '@/components/event/EventMotion';
import {
  getRegistrationErrors,
  normalizeEventRegistration,
  registrationLimits,
  type EventRegistration,
  type RegistrationErrors,
} from '@/config/eventRegistration';

const registrationCopy = {
  en: {
    eyebrow: 'Participant registration',
    title: 'Tell us a little about yourself.',
    description: 'Complete all four fields before continuing to payment.',
    firstName: 'First name',
    lastName: 'Last name',
    mobileNumber: 'Mobile number',
    educationQualification: 'Education qualification',
    mobileHint: 'Indian 10-digit number or an international number with + country code.',
    qualificationHint: 'For example: B.Sc. Physical Education, Diploma, or Higher Secondary.',
    action: 'Continue to payment',
    ready: 'Details ready to share. Pay ₹500, then send your payment proof below.',
    note: 'Your details will be included in the WhatsApp or email message you send. Registration is confirmed after payment verification and receipt of your invitation.',
    errors: { required: 'Please complete this field.', tooLong: 'Please shorten this entry.', mobile: 'Enter a valid mobile number, including the country code for international numbers.' },
  },
  ta: {
    eyebrow: 'பங்கேற்பாளர் பதிவு',
    title: 'உங்களைப் பற்றிய விவரங்களைப் பகிருங்கள்.',
    description: 'பணம் செலுத்துவதற்கு முன் நான்கு விவரங்களையும் நிரப்புங்கள்.',
    firstName: 'முதல் பெயர்',
    lastName: 'கடைசி பெயர்',
    mobileNumber: 'கைபேசி எண்',
    educationQualification: 'கல்வித் தகுதி',
    mobileHint: 'இந்தியாவின் 10 இலக்க எண் அல்லது + நாட்டுக் குறியீட்டுடன் சர்வதேச எண்.',
    qualificationHint: 'எடுத்துக்காட்டு: B.Sc. உடற்கல்வி, டிப்ளமோ அல்லது மேல்நிலைக் கல்வி.',
    action: 'பணம் செலுத்த தொடரவும்',
    ready: 'விவரங்கள் பகிரத் தயார். ₹500 செலுத்தி, கீழே பணம் செலுத்திய ஆதாரத்தை அனுப்புங்கள்.',
    note: 'நீங்கள் அனுப்பும் WhatsApp அல்லது மின்னஞ்சல் செய்தியில் இந்த விவரங்கள் சேர்க்கப்படும். பணம் செலுத்தியதைச் சரிபார்த்து அழைப்பிதழ் கிடைத்த பிறகு பதிவு உறுதியாகும்.',
    errors: { required: 'இந்த விவரத்தை நிரப்புங்கள்.', tooLong: 'இந்த விவரத்தைச் சுருக்குங்கள்.', mobile: 'சரியான கைபேசி எண்ணை உள்ளிடுங்கள். சர்வதேச எண்களுக்கு நாட்டுக் குறியீட்டைச் சேர்க்கவும்.' },
  },
} as const;

const fields = [
  { name: 'firstName', autoComplete: 'given-name', icon: UserRound },
  { name: 'lastName', autoComplete: 'family-name', icon: UserRound },
  { name: 'mobileNumber', autoComplete: 'tel', icon: Phone },
  { name: 'educationQualification', autoComplete: 'off', icon: GraduationCap },
] as const;

export function EventRegistrationForm({ language, onReady, onEdit }: {
  language: 'en' | 'ta';
  onReady: (details: EventRegistration) => void;
  onEdit: () => void;
}) {
  const [details, setDetails] = useState<EventRegistration>({ firstName: '', lastName: '', mobileNumber: '', educationQualification: '' });
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [ready, setReady] = useState(false);
  const copy = registrationCopy[language];

  function continueToPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = getRegistrationErrors(details);
    setErrors(nextErrors);
    const firstError = fields.find(({ name }) => nextErrors[name]);
    if (firstError) {
      const input = event.currentTarget.elements.namedItem(firstError.name);
      if (input instanceof HTMLInputElement) input.focus();
      return;
    }

    const normalized = normalizeEventRegistration(details);
    setDetails(normalized);
    setReady(true);
    onReady(normalized);
    document.getElementById('event-payment-options')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start',
    });
  }

  return (
    <EventReveal className="relative mb-6 rounded-[1.75rem] border-2 border-[#bceaf4] bg-white p-6 shadow-lg shadow-[#09235b]/5 sm:p-8">
      <div className="flex items-start gap-4">
        <EventArtwork kind="community" className="hidden h-16 w-16 shrink-0 sm:block" />
        <div>
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[#0b7696]">{copy.eyebrow}</p>
          <h2 id="registration-heading" className="mt-2 text-2xl font-black tracking-tight text-[#09235b] sm:text-3xl">{copy.title}</h2>
          <p className="mt-2 text-sm leading-6 text-[#415878]">{copy.description}</p>
        </div>
      </div>

      <form aria-labelledby="registration-heading" method="post" noValidate onSubmit={continueToPayment} className="mt-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {fields.map(({ name, autoComplete, icon: Icon }) => {
            const hint = name === 'mobileNumber' ? copy.mobileHint : name === 'educationQualification' ? copy.qualificationHint : '';
            const error = errors[name];
            return (
              <div key={name} className="min-w-0">
                <label htmlFor={`event-${name}`} className="text-sm font-black text-[#09235b]">{copy[name]} <span aria-hidden="true" className="text-[#d23848]">*</span></label>
                <div className="relative mt-2">
                  <Icon aria-hidden="true" size={17} className="pointer-events-none absolute left-3.5 top-3.5 text-[#0b7696]" />
                  <input
                    id={`event-${name}`}
                    name={name}
                    type={name === 'mobileNumber' ? 'tel' : 'text'}
                    inputMode={name === 'mobileNumber' ? 'tel' : 'text'}
                    autoComplete={autoComplete}
                    maxLength={registrationLimits[name]}
                    required
                    value={details[name]}
                    aria-invalid={Boolean(error)}
                    aria-describedby={[hint && `event-${name}-hint`, error && `event-${name}-error`].filter(Boolean).join(' ') || undefined}
                    className={`w-full rounded-xl border-2 bg-[#f9fcff] py-3 pl-10 pr-3 text-sm text-[#09235b] outline-none transition focus:border-[#0b7696] focus:ring-2 focus:ring-[#0b7696]/15 ${error ? 'border-[#d23848]' : 'border-[#dce8ef]'}`}
                    onChange={(event) => {
                      setDetails((current) => ({ ...current, [name]: event.target.value }));
                      setErrors((current) => ({ ...current, [name]: undefined }));
                      setReady(false);
                      onEdit();
                    }}
                  />
                </div>
                {hint && <p id={`event-${name}-hint`} className="mt-2 text-xs leading-5 text-[#52677e]">{hint}</p>}
                {error && <p id={`event-${name}-error`} role="alert" className="mt-2 text-xs font-bold leading-5 text-[#bc263d]">{copy.errors[error]}</p>}
              </div>
            );
          })}
        </div>
        <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="max-w-2xl text-xs leading-5 text-[#52677e]">{copy.note}</p>
          <button type="submit" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#09235b] px-5 py-3.5 text-sm font-black text-white transition hover:bg-[#0b5f9d]">
            {copy.action} <ArrowDown aria-hidden="true" size={17} />
          </button>
        </div>
        <div role="status" aria-live="polite" className={ready ? 'mt-4 flex gap-2 rounded-xl bg-[#e5faf1] p-3 text-sm font-bold leading-6 text-[#116147]' : undefined}>
          {ready && <><CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0" size={18} /><span>{copy.ready}</span></>}
        </div>
      </form>
    </EventReveal>
  );
}
