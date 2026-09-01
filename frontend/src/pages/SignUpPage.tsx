import { SignUp } from '@clerk/clerk-react';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-zinc-950 text-white">
      <SignUp afterSignUpUrl="/workspace" routing="path" path="/sign-up" />
    </div>
  );
}