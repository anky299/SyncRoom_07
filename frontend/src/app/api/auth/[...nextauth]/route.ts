import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        const rawBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
        const BACKEND_URL = rawBackendUrl.replace(/\/+$/, '');
        try {
          const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (res.ok) {
            const user = await res.json();
            return user; // contains id, email, username, avatar, bio, optedOutStats
          }
        } catch (e) {
          console.error('NextAuth authorize failed:', e);
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
        token.avatar = (user as any).avatar;
        token.bio = (user as any).bio;
        token.optedOutStats = (user as any).optedOutStats;
      }
      // Dynamic profile update triggers
      if (trigger === 'update' && session) {
        token.username = session.username;
        token.avatar = session.avatar;
        token.bio = session.bio;
        token.optedOutStats = session.optedOutStats;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).username = token.username;
        (session.user as any).avatar = token.avatar;
        (session.user as any).bio = token.bio;
        (session.user as any).optedOutStats = token.optedOutStats;
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
  secret: process.env.NEXTAUTH_SECRET || 'syncroom-super-secret-key-12345',
});

export { handler as GET, handler as POST };
