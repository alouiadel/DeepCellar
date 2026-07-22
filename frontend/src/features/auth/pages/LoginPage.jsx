import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { clearAuthError, fetchMe, login, signup } from "@/features/auth/store/authSlice";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";

const USERNAME_RE = /^[A-Za-z0-9_-]{3,30}$/;

export default function LoginPage() {
  const dispatch = useDispatch();
  const { status, error } = useSelector((s) => s.auth);
  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    username: "",
    password: "",
    first_name: "",
    last_name: "",
  });
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (status === "idle") dispatch(fetchMe());
  }, [dispatch, status]);

  useEffect(() => {
    dispatch(clearAuthError());
    setLocalError("");
  }, [mode, dispatch]);

  if (status === "authenticated") {
    return <Navigate to="/chat" replace />;
  }

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setLocalError("");

    if (mode === "login") {
      if (!form.username || !form.password) {
        setLocalError("Please fill in all fields.");
        return;
      }
      dispatch(login({ username: form.username, password: form.password }));
      return;
    }

    if (
      !form.first_name ||
      !form.last_name ||
      !form.username ||
      !form.password
    ) {
      setLocalError("Please fill in all fields.");
      return;
    }
    if (!USERNAME_RE.test(form.username)) {
      setLocalError(
        "Username must be 3-30 characters: letters, digits, _ or -",
      );
      return;
    }
    if (form.password.length < 8) {
      setLocalError("Password must be at least 8 characters.");
      return;
    }
    dispatch(
      signup({
        username: form.username,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
      }),
    );
  }

  const busy = status === "loading";
  const message = localError || error;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <img
            src="/favicon.svg"
            alt="DeepCellar"
            className="mx-auto mb-2 h-12 w-12 rounded-[10px]"
          />
          <CardTitle>
            {mode === "login" ? "Welcome back" : "Create account"}
          </CardTitle>
          <CardDescription>
            {mode === "login" ? "Sign in to your account" : "Join DeepCellar"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {mode === "signup" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    value={form.first_name}
                    onChange={update("first_name")}
                    autoComplete="given-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    value={form.last_name}
                    onChange={update("last_name")}
                    autoComplete="family-name"
                  />
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={form.username}
                onChange={update("username")}
                placeholder="your_username"
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={update("password")}
                  placeholder="••••••••"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  className="pr-16"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {message ? (
              <p className="text-sm text-destructive" role="alert">
                {message}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy
                ? mode === "login"
                  ? "Signing in…"
                  : "Creating account…"
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setMode("signup")}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setMode("login")}
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
