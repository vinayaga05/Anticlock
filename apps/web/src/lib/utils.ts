export function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

export function getAppStoreButton() {
  const url = process.env.NEXT_PUBLIC_APP_STORE_URL;
  return {
    available: !!url,
    url: url || '#',
    label: url ? 'Download on the App Store' : 'Coming Soon',
  };
}

export function getPlayStoreButton() {
  const url = process.env.NEXT_PUBLIC_PLAY_STORE_URL;
  return {
    available: !!url,
    url: url || '#',
    label: url ? 'Get it on Google Play' : 'Coming Soon',
  };
}
