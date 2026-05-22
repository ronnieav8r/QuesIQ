import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

import { getDb } from "@/server/db/client";
import { accounts, authSessions, users, verificationTokens } from "@/server/db/schema";

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
  providers: [GitHub],
});
