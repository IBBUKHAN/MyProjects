import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Mail, Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthStore } from "@/lib/store";

const verifySchema = z.object({
  code: z.string().min(6, "Verification code must be 6 digits"),
});

type VerifyData = z.infer<typeof verifySchema>;

export default function VerifyEmail() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    // Get email and password from URL params or localStorage
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email");
    const storedEmail = localStorage.getItem("pendingVerificationEmail");
    const storedPassword = localStorage.getItem("pendingVerificationPassword");

    const userEmail = emailParam || storedEmail || "";
    setEmail(userEmail);
    setPassword(storedPassword || "");

    if (!userEmail || !storedPassword) {
      toast({
        title: "Error",
        description: "No email or password found. Please register again.",
        variant: "destructive",
      });
      navigate("/register");
    }
  }, [navigate, toast]);

  const form = useForm<VerifyData>({
    resolver: zodResolver(verifySchema),
    defaultValues: {
      code: "",
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (data: VerifyData) => {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: data.code, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Verification failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Set verified state first to show animation
      setIsVerified(true);

      // Store token
      if (data.token) {
        localStorage.setItem("auth_token", data.token);
      }

      // Clean up stored credentials
      localStorage.removeItem("pendingVerificationEmail");
      localStorage.removeItem("pendingVerificationPassword");

      toast({
        title: "Welcome to the EchoMateLite family! 🎉",
        description: "Have a nice day!",
      });

      // Set user and redirect after showing animation
      setTimeout(() => {
        if (data.user) {
          setUser(data.user);
        }
        navigate("/");
      }, 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid verification code",
        variant: "destructive",
      });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to resend code");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Code Resent! 📧",
        description: "Check your email for the new verification code.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resend code",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: VerifyData) => {
    verifyMutation.mutate(data);
  };

  if (isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-green-500 mx-auto mb-6 flex items-center justify-center animate-bounce">
            <CheckCircle className="w-12 h-12 text-white" strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-bold mb-2">Email Verified!</h1>
          <p className="text-muted-foreground mb-6">
            Welcome! Redirecting to your feed...
          </p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary mx-auto mb-4 flex items-center justify-center">
            <Mail
              className="w-10 h-10 text-primary-foreground"
              strokeWidth={2}
            />
          </div>
          <h1 className="text-3xl font-bold mb-2">Verify Your Email</h1>
          <p className="text-muted-foreground">
            We've sent a verification code to
          </p>
          <p className="text-primary font-semibold mt-1">{email}</p>
        </div>

        <div className="glass-effect rounded-2xl p-8 shadow-xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification Code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter 6-digit code"
                        className="px-4 py-3 text-center text-2xl tracking-widest"
                        maxLength={6}
                        {...field}
                        onChange={(e) => {
                          // Only allow numbers
                          const value = e.target.value.replace(/\D/g, "");
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full py-3"
                disabled={verifyMutation.isPending}
              >
                {verifyMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Email"
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-6 space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Didn't receive the code?
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => resendMutation.mutate()}
                disabled={resendMutation.isPending}
              >
                {resendMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resending...
                  </>
                ) : (
                  "Resend Code"
                )}
              </Button>
            </div>

            <div className="text-center pt-4 border-t">
              <Link href="/register">
                <a className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Register
                </a>
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-xl">
          <p className="text-xs text-muted-foreground text-center">
            💡 Check your spam folder if you don't see the email in your inbox
          </p>
        </div>
      </div>
    </div>
  );
}
