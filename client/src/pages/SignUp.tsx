import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Join StrengthsOpen
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Create your account to get started with team strengths management.
          </p>
        </div>
        <SignUp 
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          redirectUrl="/onboarding"
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "w-full shadow-lg",
            }
          }}
        />
      </div>
    </div>
  );
}