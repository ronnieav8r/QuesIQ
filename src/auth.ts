import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { Session } from "next-auth";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { getDb } from "@/server/db/client";
import { accounts, authSessions, users, verificationTokens } from "@/server/db/schema";
import { getDevAuthSession } from "@/server/auth/dev-bypass";
import { MagicLinkProvider } from "@/server/auth/magic-link-provider";
import { verifyPasswordCredentials } from "@/server/auth/password-auth";

const nextAuth = NextAuth({
  adapter: DrizzleAdapter(getDb(), {
    accountsTable: accounts,
    sessionsTable: authSessions,
    usersTable: users,
    verificationTokensTable: verificationTokens,
  }),
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
      }

      return session;
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        return verifyPasswordCredentials({
          email: credentials?.email,
          password: credentials?.password,
        });
      },
    }),
    MagicLinkProvider(),
    Google({
      allowDangerousEmailAccountLinking: true,
    }),
    GitHub,
  ],
  session: {
    strategy: "jwt",
  },
});

export const { handlers, signIn, signOut } = nextAuth;

export async function auth(): Promise<Session | null> {
  const devSession = await getDevAuthSession();

  if (devSession) {
    return devSession;
  }

  return nextAuth.auth();
}
