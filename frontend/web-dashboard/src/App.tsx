import { RouterProvider } from "react-router-dom"

import { router } from "./app/router"



/* =========================================================
APP ROOT
========================================================= */

export default function App() {

  return <RouterProvider router={router} />

}