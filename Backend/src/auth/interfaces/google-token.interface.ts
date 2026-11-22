/**
 * Accepted Google OpenID Connect ID token payload structure
 * returned by Google's tokeninfo verification endpoint.
 */
export interface GoogleIdTokenPayload {
  iss: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean | 'true' | 'false';
  exp: number | string;
  iat?: number | string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
  azp?: string;
}

export interface VerifiedSocialProfile {
  id: string;
  email: string;
  name: string;
}
