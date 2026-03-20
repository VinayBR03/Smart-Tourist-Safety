import type { ReactNode } from "react"

import {
  QueryClient,
  QueryClientProvider
} from "@tanstack/react-query"

import { ThemeProvider } from "../theme/ThemeProvider"



/* =========================================================
QUERY CLIENT
========================================================= */

const queryClient = new QueryClient({

  defaultOptions: {

    queries: {

      retry: 1,

      refetchOnWindowFocus: false,

      staleTime: 1000 * 60 * 5, // 5 minutes

    },

    mutations: {

      retry: 0

    }

  }

})



/* =========================================================
PROVIDERS
========================================================= */

interface ProvidersProps {

  children: ReactNode

}



export function Providers({ children }: ProvidersProps) {

  return (

    <QueryClientProvider client={queryClient}>

      <ThemeProvider>

        {children}

      </ThemeProvider>

    </QueryClientProvider>

  )

}