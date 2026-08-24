import type { Auth } from 'firebase-admin/auth';
import { DevelopmentIdentityVerifier } from './development-identity.verifier';
import { FirebaseIdentityVerifier } from './firebase-identity.verifier';

describe('authentication identity verifiers', () => {
  it('accepts only the explicitly configured development token', async () => {
    const verifier = new DevelopmentIdentityVerifier(
      'configured-development-token',
      'local-firebase-uid',
    );

    await expect(
      verifier.verifyToken('configured-development-token'),
    ).resolves.toEqual({
      subject: 'local-firebase-uid',
      provider: 'development',
    });
    await expect(verifier.verifyToken('forged-token')).rejects.toThrow(
      'Invalid development bearer token',
    );
  });

  it('verifies Firebase ID tokens with revocation checking enabled', async () => {
    const verifyIdToken = jest.fn().mockResolvedValue({
      uid: 'firebase-user-a',
      email: 'user-a@example.test',
    });
    const verifier = new FirebaseIdentityVerifier({
      verifyIdToken,
    } as unknown as Auth);

    await expect(verifier.verifyToken('firebase-id-token')).resolves.toEqual({
      subject: 'firebase-user-a',
      provider: 'firebase',
      email: 'user-a@example.test',
    });
    expect(verifyIdToken).toHaveBeenCalledWith('firebase-id-token', true);
  });
});
