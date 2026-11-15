import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Root } from "./src/root";
import { styles } from "./src/theme";
export default function App() { return <SafeAreaProvider><SafeAreaView style={styles.screen}><StatusBar style="light"/><Root/></SafeAreaView></SafeAreaProvider>; }
