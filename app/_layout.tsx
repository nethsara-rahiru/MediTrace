import React, { Component } from "react";
import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, Text, Pressable } from "react-native";
import { migrate } from "../src/data/schema";
import { DataProvider } from "../src/data/context";
import { Shell } from "../src/components/Shell";
import { colors } from "../src/theme";
class DatabaseBoundary extends Component<
  React.PropsWithChildren,
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    if (this.state.error)
      return (
        <View
          style={{
            flex: 1,
            padding: 32,
            justifyContent: "center",
            gap: 16,
            backgroundColor: colors.background,
          }}
        >
          <Text style={{ fontSize: 24, fontWeight: "700", color: colors.navy }}>
            Local database unavailable
          </Text>
          <Text style={{ color: colors.muted, lineHeight: 22 }}>
            {this.state.error}
          </Text>
          <Text style={{ color: colors.muted }}>
            On web, use a browser that supports SQLite workers and cross-origin
            isolation. Your stored records have not been cleared.
          </Text>
          <Pressable onPress={() => this.setState({ error: "" })}>
            <Text style={{ color: colors.teal }}>Try again</Text>
          </Pressable>
        </View>
      );
    return this.props.children;
  }
}
export default function Layout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <DatabaseBoundary>
        <SQLiteProvider databaseName="medtrace.db" onInit={migrate}>
          <DataProvider>
            <Shell>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.background },
                  animation: "slide_from_right",
                }}
              />
            </Shell>
          </DataProvider>
        </SQLiteProvider>
      </DatabaseBoundary>
    </SafeAreaProvider>
  );
}
