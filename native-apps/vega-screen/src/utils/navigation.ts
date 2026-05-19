import {createNavigationContainerRef} from '@amazon-devices/react-navigation__native';

export type RootStackParamList = {
  Setup: undefined;
  Player: undefined;
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export const navigate = (name: keyof RootStackParamList) => {
  if (navigationRef.isReady()) {
    navigationRef.reset({index: 0, routes: [{name}]});
  }
};
