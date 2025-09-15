"use client";

import { useState } from "react";
import { signup } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
export default function SignupPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <Card className="w-full max-w-md shadow-md">
        <CardContent className="p-6 space-y-6">
          <h1 className="text-2xl font-bold text-center">Unibox Signup</h1>

          <form
            action={async (formData) => {
              setIsSubmitting(true);

              const { success, message } = await signup(formData);
              console.log("Signup response:", { success, message });
              if (success) {
                toast(
                   "Signup successful",{
                  description: message, 
                });
                
                setTimeout(() => { 
                  window.location.href = "/login";
                }, 2000);
              } else {
                toast(
                   "Signup failed",{
                  description: message,
                });
              }

              setIsSubmitting(false);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing up..." : "Signup"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <a href="/login" className="text-blue-600 hover:underline">
              Login
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
