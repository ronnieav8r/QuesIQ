import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { getDb } from "@/server/db/client";
import { accounts, authSessions, users, verificationTokens } from "@/server/db/schema";
import { MagicLinkProvider } from "@/server/auth/magic-link-provider";

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(getDb(), {
    accountsTable: accounts,
    sessionsTable: authSessions,
    usersTable: users,
    verificationTokensTable: verificationTokens,
  }),
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;

      return session;
    },
  },
  providers: [
    MagicLinkProvider(),
    Google({
      allowDangerousEmailAccountLinking: true,
    }),
    GitHub,
  ],
});
