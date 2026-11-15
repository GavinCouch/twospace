import { useState } from "react";
import { Image, Keyboard, Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Button, ErrorText, Field, Screen } from "../components/ui";
import { auth } from "../lib/auth";
import { api } from "../lib/api";
import { API_URL, CALLBACK_URL } from "../lib/config";
import { refreshAccount } from "../lib/queries";
import { colors, styles } from "../theme";
type Mode = "sign-in" | "sign-up" | "forgot";
export function SignInScreen() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState("");
  const config = useQuery({ queryKey: ["auth-config"], queryFn: ({ signal }) => api<{ google: boolean; emailPassword: boolean; passwordReset: boolean }>("/api/auth/config", { signal }) });
  function changeMode(next: Mode) { setMode(next); setPassword(""); setError(undefined); setNotice(""); }
  async function run(action: () => Promise<void>) {
    Keyboard.dismiss(); setBusy(true); setError(undefined); setNotice("");
    try { await action(); } catch (cause) { setError(cause); } finally { setBusy(false); }
  }
  async function submit() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error("Enter a valid email address.");
    if (mode === "forgot") {
      const result = await auth.requestPasswordReset({ email: email.trim(), redirectTo: `${API_URL}/reset-password` });
      if (result.error) throw new Error(result.error.message || "Please try again.");
      setNotice("If an account uses this email, a reset link is on its way."); return;
    }
    if (password.length < 10 || password.length > 128) throw new Error("Use a password between 10 and 128 characters.");
    if (mode === "sign-up" && !name.trim()) throw new Error("Enter your name.");
    const result = mode === "sign-up"
      ? await auth.signUp.email({ name: name.trim(), email: email.trim(), password, callbackURL: `${API_URL}/journal` })
      : await auth.signIn.email({ email: email.trim(), password });
    if (result.error) throw new Error(result.error.message || "Sign-in didn’t complete.");
    setPassword("");
    if (mode === "sign-up") { setMode("sign-in"); setNotice("Check your email to verify your account, then sign in here."); }
    await refreshAccount();
  }
  return <Screen><View style={{ paddingTop: 30, paddingBottom: 25, gap: 26 }}><Text style={{ color: colors.accent, fontSize: 22, fontWeight: "600" }}>TwoSpace</Text><Text style={styles.title}>{mode === "sign-up" ? "Create account" : mode === "forgot" ? "Reset password" : "Sign in"}</Text></View>
    {config.isPending && <Text style={styles.muted}>Loading sign-in options…</Text>}
    {config.error && <><ErrorText error={config.error}/><Button secondary onPress={() => void config.refetch()}>Try again</Button></>}
    {config.data?.google && mode !== "forgot" && <Button secondary busy={busy} onPress={() => void run(async () => { const result = await auth.signIn.social({ provider: "google", callbackURL: CALLBACK_URL }); if (result.error) throw new Error(result.error.message || "Google sign-in didn’t complete."); await refreshAccount(); })}>Continue with Google</Button>}
    {config.data?.emailPassword && <View style={styles.stack}>
      {mode === "sign-up" && <Field label="Name" value={name} onChangeText={setName} maxLength={60} autoComplete="name"/>}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" maxLength={254}/>
      {mode !== "forgot" && <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry textContentType={mode === "sign-up" ? "newPassword" : "password"} autoComplete={mode === "sign-up" ? "new-password" : "current-password"} maxLength={128} onSubmitEditing={() => void run(submit)}/>}
      <ErrorText error={error}/>{notice ? <Text accessibilityLiveRegion="polite" style={styles.text}>{notice}</Text> : null}
      <Button busy={busy} disabled={mode === "forgot" && !config.data.passwordReset} onPress={() => void run(submit)}>{mode === "sign-up" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}</Button>
      {mode === "sign-in" && config.data.passwordReset && <Button secondary disabled={busy} onPress={() => changeMode("forgot")}>Forgot password?</Button>}
      <Button secondary disabled={busy} onPress={() => changeMode(mode === "sign-in" ? "sign-up" : "sign-in")}>{mode === "sign-in" ? "Create an account" : "Back to sign in"}</Button>
    </View>}
    {!config.data?.emailPassword && <ErrorText error={error}/>}
  </Screen>;
}
