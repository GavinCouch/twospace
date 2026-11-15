import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
export default function App() {
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: "#131315" }}><StatusBar style="light"/><View style={{ padding: 24 }}><Text style={{ color: "#f5f2f3", fontSize: 28, fontWeight: "600" }}>TwoSpace</Text></View></SafeAreaView></SafeAreaProvider>;
}
