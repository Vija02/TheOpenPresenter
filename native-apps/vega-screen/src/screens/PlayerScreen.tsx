import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  BackHandler,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type {NativeStackScreenProps} from '@amazon-devices/react-navigation__native-stack';
import {WebView} from '@amazon-devices/webview';
import QRCode from '@amazon-devices/react-native-qrcode-svg';
import {RFValue} from 'react-native-responsive-fontsize';

import {useCookie} from '../api/useCookie';
import {logout} from '../utils/logout';
import type {RootStackParamList} from '../utils/navigation';
import {getRootUrl} from '../utils/rootUrl';
import {getScreen} from '../utils/screen';

type Variant = 'primary' | 'warning' | 'danger';

const VARIANT_ACCENT: Record<Variant, string> = {
  primary: '#0a84ff',
  warning: '#ff9f0a',
  danger: '#ff453a',
};

type Props = NativeStackScreenProps<RootStackParamList, 'Player'>;

export const PlayerScreen: React.FC<Props> = ({navigation}) => {
  const {data: cookie, isLoading} = useCookie();
  const screen = getScreen();
  const webViewRef = useRef<React.ElementRef<typeof WebView>>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (!cookie || !screen) {
      navigation.replace('Setup');
    }
  }, [cookie, isLoading, screen, navigation]);

  // Intercept the hardware back / TV menu button.
  // Priority: close QR > close menu > open menu.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setQrOpen((qr) => {
        if (qr) {
          return false;
        }
        setMenuOpen((open) => !open);
        return false;
      });
      return true; // we've handled it; don't let RN navigate back
    });
    return () => sub.remove();
  }, []);

  const handleRefresh = useCallback(() => {
    setMenuOpen(false);
    // WebView has no reload() — inject JS to reload the page
    webViewRef.current?.injectJavaScript('window.location.reload(); true;');
  }, []);

  const handleShowQr = useCallback(() => {
    setMenuOpen(false);
    setQrOpen(true);
  }, []);

  const handleLogout = useCallback(() => {
    setMenuOpen(false);
    logout();
  }, []);

  const handleExit = useCallback(() => {
    setMenuOpen(false);
    BackHandler.exitApp();
  }, []);

  const controlUrl = screen
    ? `${getRootUrl()}/o/${screen.orgSlug}/screens/${screen.screenSlug}/control`
    : '';

  if (!cookie || !screen) {
    return null;
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{
          uri: `${getRootUrl()}/render/s/${screen.orgSlug}/${
            screen.screenSlug
          }`,
        }}
        javaScriptEnabled
        mediaPlaybackRequiresUserAction={false}
        userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36"
        mixedContentMode="always"
        domStorageEnabled
        thirdPartyCookiesEnabled
      />

      {menuOpen && (
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setMenuOpen(false)}>
          <Pressable
            style={styles.menuCard}
            onPress={(e) => e.stopPropagation()}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Menu</Text>
              <Text style={styles.menuSubtitle}>Choose an action</Text>
            </View>

            <View style={styles.menuList}>
              <MenuRow
                glyph="R"
                label="Refresh page"
                description="Reload the screen content"
                onPress={handleRefresh}
                autoFocus
              />
              <MenuRow
                glyph="QR"
                label="Open controller"
                description="Show QR code to control this screen from your phone"
                onPress={handleShowQr}
              />
              <MenuRow
                glyph="X"
                label="Sign out"
                description="Disconnect this screen from your account"
                onPress={handleLogout}
                variant="warning"
              />
              <MenuRow
                glyph="O"
                label="Exit app"
                description="Close TheOpenPresenter TV"
                onPress={handleExit}
                variant="danger"
              />
            </View>

            <Text style={styles.menuHint}>Press Back to close</Text>
          </Pressable>
        </Pressable>
      )}

      {qrOpen && (
        <Pressable style={styles.menuBackdrop} onPress={() => setQrOpen(false)}>
          <Pressable style={styles.qrCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.qrHeader}>
              <View
                style={[
                  styles.menuRowIcon,
                  {backgroundColor: 'rgba(10,132,255,0.18)'},
                ]}>
                <Text style={[styles.glyphText, {color: '#0a84ff'}]}>QR</Text>
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.menuTitle}>Open controller</Text>
                <Text style={styles.menuSubtitle}>
                  Scan with your phone to control this screen
                </Text>
              </View>
            </View>

            <View style={styles.qrFrame}>
              <QRCode size={getQrSize()} value={controlUrl} />
            </View>

            <Text style={styles.menuHint}>Press Back to close</Text>
          </Pressable>
        </Pressable>
      )}
    </View>
  );
};

function getQrSize(): number {
  const {width, height} = Dimensions.get('window');
  return Math.min(width, height) * 0.32;
}

type MenuRowProps = {
  glyph: string;
  label: string;
  description?: string;
  onPress: () => void;
  autoFocus?: boolean;
  variant?: Variant;
};

function MenuRow({
  glyph,
  label,
  description,
  onPress,
  autoFocus,
  variant = 'primary',
}: MenuRowProps) {
  const accent = VARIANT_ACCENT[variant];

  return (
    <Pressable
      onPress={onPress}
      hasTVPreferredFocus={autoFocus}
      style={(state: any) => {
        const active = state.focused || state.pressed;
        return [
          styles.menuRow,
          active && {
            backgroundColor: `${accent}26`,
            borderColor: accent,
          },
        ];
      }}>
      {
        ((state: any) => {
          const active = state.focused || state.pressed;
          return (
            <>
              <View
                style={[
                  styles.menuRowIcon,
                  {backgroundColor: `${accent}1F`},
                  active && {backgroundColor: accent},
                ]}>
                <Text
                  style={[styles.glyphText, {color: active ? '#fff' : accent}]}>
                  {glyph}
                </Text>
              </View>

              <View style={styles.menuRowText}>
                <Text style={styles.menuRowLabel}>{label}</Text>
                {description && (
                  <Text style={styles.menuRowDescription}>{description}</Text>
                )}
              </View>

              <Text
                style={[styles.chevron, {color: active ? accent : '#5a6068'}]}>
                {'>'}
              </Text>
            </>
          );
        }) as any
      }
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {height: '100%'},
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 10, 14, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCard: {
    width: '44%',
    minWidth: 440,
    maxWidth: 620,
    backgroundColor: '#14171d',
    borderRadius: 22,
    paddingVertical: 26,
    paddingHorizontal: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 40,
    shadowOffset: {width: 0, height: 18},
    elevation: 24,
  },
  menuHeader: {
    paddingBottom: 18,
    marginBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  menuTitle: {
    color: '#fff',
    fontSize: RFValue(15),
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  menuSubtitle: {
    color: '#7a8090',
    fontSize: RFValue(9),
    fontWeight: '500',
    marginTop: 4,
  },
  menuList: {
    gap: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  menuRowIcon: {
    width: RFValue(32),
    height: RFValue(32),
    borderRadius: RFValue(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphText: {
    fontSize: RFValue(12),
    fontWeight: '700',
  },
  menuRowText: {
    flex: 1,
    gap: 2,
  },
  menuRowLabel: {
    color: '#f2f3f5',
    fontSize: RFValue(11),
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  menuRowDescription: {
    color: '#8a909c',
    fontSize: RFValue(8),
    fontWeight: '400',
  },
  chevron: {
    fontSize: RFValue(14),
    fontWeight: '700',
  },
  menuHint: {
    color: '#5a6068',
    fontSize: RFValue(7.5),
    textAlign: 'center',
    marginTop: 16,
    letterSpacing: 0.5,
  },
  qrCard: {
    width: '44%',
    minWidth: 440,
    maxWidth: 620,
    backgroundColor: '#14171d',
    borderRadius: 22,
    paddingVertical: 26,
    paddingHorizontal: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 40,
    shadowOffset: {width: 0, height: 18},
    elevation: 24,
  },
  qrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    alignSelf: 'stretch',
    paddingBottom: 18,
    marginBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  qrFrame: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
  },
});
