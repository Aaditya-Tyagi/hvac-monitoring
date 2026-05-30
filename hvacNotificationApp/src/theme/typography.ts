import type { TextStyle } from 'react-native';

// Big numbers for status, generous line-height for paragraph copy.
export const typography = {
  display: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 40,
  } satisfies TextStyle,
  h1: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 32,
  } satisfies TextStyle,
  h2: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  } satisfies TextStyle,
  h3: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  } satisfies TextStyle,
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
  } satisfies TextStyle,
  bodyStrong: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  } satisfies TextStyle,
  caption: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  } satisfies TextStyle,
  micro: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    lineHeight: 14,
  } satisfies TextStyle,
  mono: {
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: '500',
    lineHeight: 20,
  } satisfies TextStyle,
} as const;
