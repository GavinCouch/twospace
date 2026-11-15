import type { PropsWithChildren } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, styles } from "../theme";
export function Screen({ children, refresh, refreshing = false }: PropsWithChildren<{ refresh?: () => void; refreshing?: boolean }>) {
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} refreshControl={refresh ? <RefreshControl tintColor={colors.accent} refreshing={refreshing} onRefresh={refresh}/> : undefined}>{children}</ScrollView></KeyboardAvoidingView>;
}
export function Button({ children, onPress, busy = false, disabled = false, secondary = false, accessibilityLabel }: PropsWithChildren<{ onPress: () => void; busy?: boolean; disabled?: boolean; secondary?: boolean; accessibilityLabel?: string }>) {
  return <Pressable onPress={onPress} disabled={disabled || busy} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled: disabled || busy, busy }} style={({ pressed }) => ({ minHeight: 50, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 13, backgroundColor: secondary ? colors.raised : colors.accent, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10, opacity: disabled || busy ? .5 : pressed ? .75 : 1 })}>{busy && <ActivityIndicator color={secondary ? colors.text : colors.ink}/>}<Text style={{ color: secondary ? colors.text : colors.ink, fontSize: 16, fontWeight: "600", textAlign: "center", flexShrink: 1 }}>{children}</Text></Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 8 }}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} selectionColor={colors.accent} {...props} style={[styles.input, props.multiline && { minHeight: 114, textAlignVertical: "top" }, props.style]}/></View>;
}
export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.error, fontSize: 15, lineHeight: 22 }}>{message}</Text>;
}
export function Empty({ title, detail }: { title: string; detail: string }) {
  return <View style={[styles.card, { paddingVertical: 30 }]}><Text style={styles.heading}>{title}</Text><Text style={styles.muted}>{detail}</Text></View>;
}
export function Loading({ label = "Loading your space…" }: { label?: string }) {
  return <View style={{ padding: 32, gap: 16, alignItems: "center" }} accessibilityRole="progressbar"><ActivityIndicator color={colors.accent}/><Text style={styles.muted}>{label}</Text></View>;
}
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={{ borderRadius: 24, minHeight: 44, paddingVertical: 11, paddingHorizontal: 17, backgroundColor: selected ? colors.accent : colors.raised }}><Text style={{ color: selected ? colors.ink : colors.text, fontSize: 14, fontWeight: "600" }}>{label}</Text></Pressable>;
}
