declare module 'firebase-admin' {
  const admin: {
    apps: unknown[];
    initializeApp: (options: { credential: unknown }) => unknown;
    credential: { cert: (serviceAccount: unknown) => unknown };
  };
  export = admin;
}
