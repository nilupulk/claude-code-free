/**
 * ink-compat — browser-native drop-in replacements for Ink terminal primitives.
 *
 * Import from this package instead of `ink` when bundling for the web:
 *
 *   // In your bundler alias config:
 *   // "ink" → "@/lib/ink-compat"  (Next.js / webpack)
 *   // "ink" → "web/lib/ink-compat/index.ts"  (esbuild)
 *
 * Or import directly in web-only entry points:
 *
 *   import { Box, Text, useInput } from '@/lib/ink-compat'
 */

// Core layout primitive
export { Box, default as BaseBox } from './Box'
export type { BoxProps } from './Box'

// Text primitive
export { Text, default as BaseText } from './Text'
export type { TextProps } from './Text'

// Utility components
export { Static } from './Static'
export type { StaticProps } from './Static'
export { Newline } from './Newline'
export type { NewlineProps } from './Newline'
export { Spacer } from './Spacer'
export { Transform } from './Transform'
export type { TransformProps } from './Transform'

// Hooks
export { default as useInput } from './useInput'
export type { Key } from './useInput'
export { default as useApp } from './useApp'
export { default as useStdin } from './useStdin'
export { default as useStdout } from './useStdout'
export { useFocus } from './useFocus'
export type { UseFocusOptions, UseFocusResult } from './useFocus'

// Provider
export {
  InkCompatProvider,
  WebAppContext,
  WebThemeContext,
  DEFAULT_WEB_THEME,
} from './InkCompatProvider'
export type { InkCompatProviderProps, WebAppContextValue, WebTheme } from './InkCompatProvider'

// Style utilities (useful for advanced consumers)
export { inkBoxPropsToCSS, inkTextPropsToCSS } from './prop-mapping'
export type { InkStyleProps, InkTextStyleProps } from './prop-mapping'
export { inkColorToCSS } from './color-mapping'
