import { useContext } from 'react'
import { WebAppContext } from './InkCompatProvider'

/**
 * Web-compat `useApp` — exposes `exit()` from the `InkCompatProvider`.
 * Drop-in replacement for Ink's `useApp`.
 */
const useApp = () => useContext(WebAppContext)

export default useApp
