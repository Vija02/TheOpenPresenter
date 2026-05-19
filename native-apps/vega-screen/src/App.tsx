import React, {useEffect, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';

import {NavigationContainer} from '@amazon-devices/react-navigation__native';
import {createNativeStackNavigator} from '@amazon-devices/react-navigation__native-stack';
import {SafeAreaProvider} from '@amazon-devices/react-native-safe-area-context';
import {QueryClientProvider} from '@tanstack/react-query';

import {PlayerScreen} from './screens/PlayerScreen';
import {SetupScreen} from './screens/SetupScreen';
import {navigationRef, RootStackParamList} from './utils/navigation';
import {queryClient} from './utils/queryClient';
import {initRootUrl} from './utils/rootUrl';
import {initScreen} from './utils/screen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const App = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    Promise.all([initRootUrl(), initScreen()])
      .catch((e) => {
        console.error('App init failed', e);
      })
      .finally(() => {
        setIsReady(true);
      });
  }, []);

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0a84ff" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator
            initialRouteName="Setup"
            screenOptions={{headerShown: false}}>
            <Stack.Screen name="Setup" component={SetupScreen} />
            <Stack.Screen name="Player" component={PlayerScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0b0d12',
    gap: 16,
  },
  loadingText: {
    color: '#e6e8ee',
    fontSize: 18,
  },
});
