"use client";

import { useEffect } from "react";

/**
 * Catch-all component for the Next.js App Router.
 * This ensures that if a user reloads a page that is meant to be handled by the 
 * React SPA (Vite frontend), Next.js doesn't return a 404.
 */
export default function CatchAllPage() {
  useEffect(() => {
    // If we've reached this page, it means Next.js doesn't have a route for it.
    // In a production environment where the Vite app is served as static files,
    // this component would ideally be replaced by the SPA's entry point.
    console.log("Catch-all route hit. Client-side router should take over.");
  }, []);

  return null; // Let the layout render the shell or wait for redirect
}
