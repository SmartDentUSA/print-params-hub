import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = (e?: MediaQueryListEvent) => {
      setIsMobile(e ? e.matches : window.innerWidth < MOBILE_BREAKPOINT)
    }
    
    // Fallback para Safari/iOS antigos
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener("change", onChange)
    } else if (typeof (mql as any).addListener === 'function') {
      (mql as any).addListener(onChange)
    }
    
    setIsMobile(mql.matches)
    
    return () => {
      if (typeof mql.removeEventListener === 'function') {
        mql.removeEventListener("change", onChange)
      } else if (typeof (mql as any).removeListener === 'function') {
        (mql as any).removeListener(onChange)
      }
    }
  }, [])

  return isMobile
}
