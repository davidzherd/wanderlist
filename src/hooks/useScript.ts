import { useEffect, useState } from 'react'

type ScriptStatus = 'idle' | 'loading' | 'ready' | 'error'

const loadedScripts = new Map<string, ScriptStatus>()

export function useScript(src: string): ScriptStatus {
  const [status, setStatus] = useState<ScriptStatus>(loadedScripts.get(src) ?? 'idle')

  useEffect(() => {
    if (loadedScripts.get(src) === 'ready') {
      setStatus('ready')
      return
    }

    let script = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)

    if (!script) {
      script = document.createElement('script')
      script.src = src
      script.async = true
      document.body.appendChild(script)
    }

    loadedScripts.set(src, 'loading')
    setStatus('loading')

    const handleLoad = () => {
      loadedScripts.set(src, 'ready')
      setStatus('ready')
    }
    const handleError = () => {
      loadedScripts.set(src, 'error')
      setStatus('error')
    }

    script.addEventListener('load', handleLoad)
    script.addEventListener('error', handleError)

    return () => {
      script?.removeEventListener('load', handleLoad)
      script?.removeEventListener('error', handleError)
    }
  }, [src])

  return status
}
