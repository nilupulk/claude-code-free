/**
 * Web-compat `useStdout` — stub that satisfies the Ink hook interface.
 * There is no stdout stream in a browser context.
 */
const useStdout = () => ({
  /** Not available on web — always `null`. */
  stdout: null as unknown as NodeJS.WriteStream,
  /** No-op on web. */
  write: (_: string) => {},
})

export default useStdout
