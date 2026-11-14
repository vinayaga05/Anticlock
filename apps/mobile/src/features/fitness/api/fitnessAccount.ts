import {
  assertFitnessSession,
  fitnessRequest,
  fitnessSession,
} from './fitnessApi';

type AccountClosure = { accountClosed: true; fitnessDataDeleted: true };

/** The app mounts mobile authentication at /auth, separately from /v1. */
export async function closeFitnessAccount(
  userId: string | undefined,
  cleanup: { logout: () => Promise<void>; clearPrivateState: () => void },
): Promise<AccountClosure> {
  const session = fitnessSession(userId);
  const response = await fitnessRequest<AccountClosure>(
    '/auth/mobile/account',
    {
      method: 'DELETE',
      body: JSON.stringify({ confirmAccountClosure: true }),
    },
    session,
  );
  if (response.accountClosed !== true || response.fitnessDataDeleted !== true) {
    throw new Error(
      'Account closure could not be confirmed. Your session is still open; try again.',
    );
  }
  assertFitnessSession(session);
  // AuthProvider.logout synchronously clears storage, API token and user before
  // awaiting best-effort remote logout. Clear private caches without that wait.
  const logout = cleanup.logout();
  cleanup.clearPrivateState();
  await logout;
  return response;
}
