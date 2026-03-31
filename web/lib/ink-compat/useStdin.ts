/**
 * Web-compat `useStdin` — stub that satisfies the Ink hook interface.
 * On the web there is no stdin stream; components that call `setRawMode`
 * or read from `stdin` directly should check `isRawModeSupported === false`
 * and fall back gracefully.
 */
const useStdin = () => ({
  /** Not available on web — always `null`. */
  stdin: null as unknown as NodeJS.ReadStream,
  /** No-op on web. */
  setRawMode: (_value: boolean) => {},
  /** Always `false` on web. */
  isRawModeSupported: false as const,
  internal_exitOnCtrlC: false as const,
  /** No event emitter on web — components must use `useInput` instead. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  internal_eventEmitter: null as any,
  internal_querier: null,
})

export default useStdin
