import { SignIn } from '@clerk/clerk-react';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-zinc-950 text-white">
      <SignIn afterSignInUrl="/workspace" routing="path" path="/sign-in" />
    </div>
  );
}