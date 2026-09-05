import { StatusBar } from 'expo-status-bar'
import { Text, View } from 'react-native'

export default function Today() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-fg text-lg">Dotbook</Text>
      <Text className="text-muted mt-1 text-sm">Phase 0 — structure only</Text>
      <StatusBar style="auto" />
    </View>
  )
}
