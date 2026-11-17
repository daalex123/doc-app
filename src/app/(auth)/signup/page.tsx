import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { AuthForm } from "../auth-form";
import { signup } from "../actions";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.profile.role));

  return (
    <Card className="border-0 bg-transparent shadow-none ring-0">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Create your account</CardTitle>
        <CardDescription>Book visits and keep your medical history in one place.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <AuthForm action={signup} mode="signup" />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
