import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { safeFetchJson } from '@/lib/api';

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

        try {
          const user = await safeFetchJson('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });
          return user; // contains id, email, username, avatar, bio, optedOutStats
        } catch (e) {
          console.error('NextAuth authorize failed:', e);
          return null;
        }
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
