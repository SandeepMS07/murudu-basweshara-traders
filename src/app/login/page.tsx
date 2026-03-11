"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { loginSchema } from "@/features/auth/schemas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { LoginHeroPanel } from "@/components/auth/LoginHeroPanel";
import { LoginLoadingOverlay } from "@/components/auth/LoginLoadingOverlay";

const SAVED_LOGIN_KEY = "pb_manager_saved_login";
type RememberedLogin = {
  email: string;
  rememberMe: boolean;
};

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    const savedLogin = localStorage.getItem(SAVED_LOGIN_KEY);

    if (!savedLogin) {
      return;
    }

    try {
      const parsed = JSON.parse(savedLogin) as Partial<RememberedLogin>;

      form.reset({
        email: parsed.email ?? "",
        password: "",
      });
      setRememberMe(Boolean(parsed.rememberMe && parsed.email));
    } catch {
      localStorage.removeItem(SAVED_LOGIN_KEY);
    }
  }, [form]);

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    setIsLoading(true);

    try {
      if (rememberMe) {
        const payload: RememberedLogin = {
          email: values.email,
          rememberMe: true,
        };
        localStorage.setItem(SAVED_LOGIN_KEY, JSON.stringify(payload));
      } else {
        localStorage.removeItem(SAVED_LOGIN_KEY);
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      let data: { error?: string } = {};

      try {
        data = (await response.json()) as { error?: string };
      } catch {
        data = {};
      }

      if (!response.ok) {
        toast.error("Login Failed", { description: data.error || "Invalid credentials." });
        return;
      }

      toast.success("Login Successful", { description: "Welcome back!" });
      router.push("/dashboard");
      router.refresh();
      
    } catch {
      toast.error("Something went wrong", { description: "Please try again later." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-zinc-100">
      <div className="grid min-h-screen w-full overflow-hidden bg-[#0f1013] lg:grid-cols-[1.25fr_1fr]">
        <LoginHeroPanel />

        <div className="flex items-center justify-center p-6 sm:p-10 lg:p-16">
          <Card className="relative w-full max-w-lg border border-[#2a2d34] bg-[#15171c] text-zinc-100 shadow-none">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl">PB Manager</CardTitle>
              <CardDescription className="text-zinc-400">
                Sign in to continue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LoginLoadingOverlay visible={isLoading} />
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-300">Email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="admin@example.com"
                            className="h-10 border-[#2a2d34] bg-[#101218] text-zinc-100 placeholder:text-zinc-500"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-300">Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              className="h-10 border-[#2a2d34] bg-[#101218] pr-10 text-zinc-100 placeholder:text-zinc-500"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((prev) => !prev)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-200"
                              aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                              {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                      className="h-4 w-4 cursor-pointer rounded border-[#2a2d34] bg-[#101218] accent-[#ff6a3d]"
                    />
                    Remember me
                  </label>
                  <Button
                    type="submit"
                    className="h-10 w-full border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
                    disabled={isLoading}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign in
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
