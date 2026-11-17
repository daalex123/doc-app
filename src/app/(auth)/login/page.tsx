import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { AuthForm } from "../auth-form";
import { login } from "../actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.profile.role));

  const { next, error } = await searchParams;

  return (
    <Card className="border-0 bg-transparent shadow-none ring-0">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
        <CardDescription>Sign in to manage your appointments.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {error === "confirmation" ? (
          <Alert variant="destructive">
            <AlertDescription>
              That confirmation link is invalid or has expired. Please sign in or sign up again.
            </AlertDescription>
          </Alert>
        ) : null}
        <AuthForm action={login} mode="login" next={next} />
        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
