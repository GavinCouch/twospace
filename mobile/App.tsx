import { useEffect, useState } from "react";
import { AppState, Image, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Root } from "./src/root";
import { colors, styles } from "./src/theme";
export default function App() {
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    return () => subscription.remove();
  }, []);
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <Root />
        {!active && (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: colors.background,
                alignItems: "center",
                justifyContent: "center",
                gap: 18,
              },
            ]}
          >
            <Image
              source={require("./assets/icon.png")}
              style={{ width: 80, height: 80, borderRadius: 24 }}
            />
            <Text style={styles.heading}>TwoSpace</Text>
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
